var dnode = require('dnode'),
    bstream = require('./blockable-stream.js'),
    workerCli = require('./worker-client.js')
    net = require('net');


module.exports = function(hostport, cb) {
    var c = net.connect(hostport, function() {
        var d = dnode();
        d.on('remote', function(r) {
            var self = {};
            self.get = function(name, cb) {
                r.getWorker(name, function(err, w) {
                    if (err) return cb(err);
                    workerCli(w, function(err, worker) {
                        worker.dial(name, function(err, i, o, params) {
                            if (params.client) {
                                var clifn = eval('(' + params.client + ')');
                                clifn(i, o, params.options, function(err, client) {
                                    cb(err, client);
                                });
                            } else {
                                cb(null, i, o, params.options);
                            }
                        });
                        if (err) return cb(err);
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
            self.destroy = function(name, cb) { r.destroy(name, cb); };
            cb(null, self);
        });
        c.pipe(d).pipe(c);
    }); 
}
