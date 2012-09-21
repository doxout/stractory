var dnode = require('dnode'),
    bstream = require('./blockable-stream.js'),
    workerCli = require('./worker-client.js'),
    net = require('net'),
    EventEmitter = require('events').EventEmitter,
    callq = require('./call-queue');

module.exports = function(hostport, cb) {

    var retCli = callq([
            'addListener', 'removeListener', 
            'removeAllListeners', 'setMaxListeners', 
            'on', 'once', 'emit', 'listeners',
            'get', 'connect', 'create', 'destroy', 'close']);

    var c = net.connect(hostport, function() {
        var d = dnode();
        d.once('remote', function(r) {

            var self = new EventEmitter();
            c.on('timeout', function() { self.emit('timeout'); });
            c.on('error', function(err) { self.emit('error', err); });
            d.on('error', function(err) { self.emit('error', err); });
            d.on('fail', function(err) { self.emit('fail', err); });
            c.on('close', function(had_err) { self.emit('close', had_err); });

            var passWorkerEvents = function(cli, w) {
                cli.on('timeout', function() { self.emit('worker-timeout', w); });
                cli.on('error', function(err) { self.emit('worker-error', w, err); });
                cli.on('fail', function(err) { self.emit('worker-fail', w, err); });
                cli.on('close', function(had_err) { self.emit('worker-close', w, had_err); });
            }

            // rethink if caching clients here is a good idea.
            var client_cache = {};

            self.get = function(name, cb) {
                if (client_cache[name]) 
                    process.nextTick(function() { cb(null, client_cache[name]); });
                else
                    self.connect(name, cb); 
            },
            self.connect = function(name, cb) {
                r.getWorker(name, function(err, w) {
                    if (err) return cb && cb(err);
                    workerCli(w, function(err, worker) {
                        if (err) return cb && cb(err);
                        passWorkerEvents(worker, w);
                        worker.dial(name, function(err, cli, opt) {
                            if (!err) client_cache[name] = cli;
                            cb(err, cli, opt);
                        });
                    });
                })
            }
            self.create = function(name, params, cb) {
                if (!params.server) {
                    params = {
                        server: params,
                        client: null,
                    };
                }
                params.options = params.options || {};
                params.server = params.server.toString();
                params.client = params.client ? params.client.toString() : null;
                r.create(name, params, cb);
            };
            self.destroy = function(name, cb) { 
                r.destroy(name, cb);
                client_cache[name] = null;
            };
            self.close = function() { c.end(); c.destroy(); }
            
            retCli.drain(self);
            
            cb && cb(null, self);
        });
        c.pipe(d).pipe(c);
    });
    return retCli.mock;
}
