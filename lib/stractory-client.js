var dnode = require('dnode'),
    bstream = require('./blockable-stream.js'),
    workerCli = require('./worker-client.js')
    net = require('net');


module.exports = function(hostport, cb) {
    var c = net.connect(hostport, function() {
        var d = dnode();
        d.on('remote', function(r) {
            var self = {};
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
            cb(null, self);
        });
        c.pipe(d).pipe(c);
    }); 
}
