var dnode = require('dnode'),
    bstream = require('./blockable-stream.js'),
    workerCli = require('./worker-client.js'),
    net = require('net'),
    EventEmitter = require('events').EventEmitter,
    callqueue = require('./call-queue.js');

module.exports = function(hostport, cb) {

    var self = new EventEmitter();
    var retCli = callqueue(['get', 'connect', 'create', 'destroy', 'close'], self);


    var c = net.connect(hostport, function() {
        var d = dnode();
        d.once('remote', function(r) {

            c.on('timeout', function() { self.emit('timeout'); });
            c.on('error', function(err) { self.emit('error', err); });
            d.on('error', function(err) { self.emit('error', err); });
            d.on('fail', function(err) { self.emit('fail', err); });
            c.on('close', function(had_err) { self.emit('close', had_err); });

            var passWorkerEvents = function(cli, name, w) {
                cli.on('timeout', function() { self.emit('actor-timeout', name, cli); });
                cli.on('error', function(err) { self.emit('actor-error', name, cli, err); });
                cli.on('fail', function(err) { self.emit('actor-fail', name, cli, err); });
                cli.on('close', function(had_err) { self.emit('actor-close', name, cli, had_err); });
            }

            // rethink if caching clients here is a good idea.
            var client_cache = {};

            self.get = function(name, cb) {
                if (client_cache[name]) {
                    process.nextTick(function() { cb(null, client_cache[name].client); });
                }
                else
                    self.connect(name, cb); 
            };
            self.connect = function(name, cb) {
                r.getWorker(name, function(err, w) {
                    if (err) return cb && cb(err);
                    workerCli(w, function(err, worker) {
                        if (err) return cb && cb(err);
                        passWorkerEvents(worker, name, w);
                        worker.dial(name, function(err, cli, opt) {
                            if (!err) client_cache[name] = {client: cli, worker: worker};
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
