var dnode = require('dnode'),
    bstream = require('./blockable-stream.js'),
    through = require('through');

module.exports = function(worker) {

    var streams = {};

    var self = function(c) {
        var dni = bstream(), dno = bstream();
        var exec = dnode({
            /**
             * Just like a telephone call. Dial the named stream
             * @param name name of the stream to dial. After dialing,
             * your stream will be "transfered" from dnode to the
             * actual memory stream
             * @param cb(err, params) callback this when complete. create params will be passed back
             */
            dial: function(name, cb) {
                if (!streams[name]) {
                    cb("not found: " + name);
                
                } else {
                    var s = streams[name];
                    cb(null, s.params);
                    // will stop piping to dnode. Workaround until .unpipe
                    // is implemented in node 0.9
                    dni.off(); dno.off();
                    // and start piping to the called stream directly
                    c.pipe(s.i);
                    s.o.pipe(c);
                }
            },
            /**
             * Create a new stream
             * @param name stream name
             * @param params.server stream middleware function (stringified)
             * @param params.options stream options
             * @param cb(err) callback this when complete
             */
            create: function(name, params, cb) {
                if (!params.server) cb(name + " has unspecified function");
                else if (streams[name]) cb(name + " already exists");
                else {
                    var middleware = eval('(' + params.server + ')');
                    // create a through stream
                    var i = through(), o = through()
                    // put it in the local registry
                    streams[name] = {
                        i: i, o:o,
                        params: params
                    };
                    // call the function that attaches to it
                    middleware(i, o, params.options);
                    cb(null);
                }
            },
            /**
             * Destroys a stream
             * @param name stream name
             * @param cb callback when complete
             */
            destroy: function(name, cb) {
                if (!streams[name]) cb && cb(name + " not found");
                else {
                    streams[name].i.destroy();
                    streams[name].o.destroy();
                    delete streams[name];
                    cb && cb(null);
                }
            }

        });
        c.pipe(dni).pipe(exec).pipe(dno).pipe(c);
    };


    var reginterval = null;
    self.registry = function(me, regadr, interval) {
        if (reginterval) clearInterval(reginterval);
        var regfn = function() {
            try {
                var dreg = dnode.connect(regadr);
                dreg.on('remote', function(reg) {
                    reg.register(me.host, me.port, function(err) {
                        if (err) console.log("error registering to stractory:", err);
                        dreg.end();
                    });
                });
                dreg.on('error', function(err) {
                    console.log("error communicating with stractory:", err);
                });
            } catch (e) {
                console.log("Could not register to registry:", e);
            }
        };
        reginterval = setInterval(regfn, interval * 1000);
        regfn();
    }


    return self;
}

