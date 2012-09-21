var dnode = require('dnode'),
    bstream = require('./blockable-stream.js'),
    net = require('net'),
    EventEmitter = require('events').EventEmitter;



module.exports = function(worker, cb) {
    var c = net.connect(worker, function() {
        var d = dnode(), dni = bstream(), dno = bstream();
        d.once('remote', function(r) {
            var self = new EventEmitter();
            c.on('timeout', function() { self.emit('timeout'); });
            c.on('error', function(err) { self.emit('error', err); });
            d.on('error', function(err) { self.emit('error', err); });
            c.on('close', function(had_err) { self.emit('close', had_err); });
            self.dial = function(name, cb) {
                r.dial(name, function(err, params) {
                    if (err) return cb && cb(err);
                    dni.off();
                    dno.off();
                    if (params.client) 
                        eval('(' + params.client + ')')(c, cb, params.options);
                    else return cb && cb(null, c, params.options);
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
            self.close = function() { c.end(); c.destroy(); };
            cb(null, self);
        });
        c.pipe(dni).pipe(d).pipe(dno).pipe(c);
        d.on('fail', function(err) { console.log(err); });
    });
    c.on('error', function(err) { cb(err); });
}
