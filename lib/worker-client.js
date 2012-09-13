var dnode = require('dnode'),
    bstream = require('./blockable-stream.js'),
    net = require('net');


module.exports = function(worker, cb) {
    var c = net.connect(worker, function() {
        var d = dnode(), dni = bstream(), dno = bstream();
        d.on('remote', function(r) {
            var self = {};
            self.dial = function(name, cb) {
                r.dial(name, function(err, params) {
                    if (err) return cb && cb(err);
                    dni.off();
                    dno.off();
                    cb(null, c, params);
                });
            };
            self.create = function(name, params, cb) {
                if (!params.server) 
                    params = {server: params, client: null};
                params.options = params.options || {};
                params.server = params.server.toString();
                params.client = params.client ? params.client.toString() : null;
                r.create(name, params, cb);
            };
            self.destroy = function(name, cb) { r.destroy(name, cb); };
            cb(null, self);
        });
        c.pipe(dni).pipe(d).pipe(dno).pipe(c);
    });
    c.on('error', function(err) { cb(err); });
}
