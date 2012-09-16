var dnode = require('dnode'),
    bstream = require('./blockable-stream.js'),
    workerCli = require('./worker-client.js')
    net = require('net');


module.exports = function(hostport, cb) {
    var c = net.connect(hostport, function() {
        var d = dnode();
        d.on('remote', function(r) {
            var self = {};
            self.connect = function(name, cb) {
                r.getWorker(name, function(err, w) {
                    if (err) return cb && cb(err);
                    workerCli(w, function(err, worker) {
                        if (err) return cb && cb(err);
                        worker.dial(name, cb);
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
            };
            self.close = function() { c.end(); c.destroy(); }
            cb(null, self);
        });
        c.pipe(d).pipe(c);
    }); 
}
