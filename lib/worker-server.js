var dnode = require('dnode'),
    bstream = require('./blockable-stream.js');

module.exports = function(worker) {

    var agents = {};

    var self = function(client) {
        var dni = bstream(), dno = bstream();
        var exec = dnode({
            /**
             * Just like a telephone call. Dial the named agent
             * @param name name of the agent to dial. After dialing,
             * your client will be "transfered" from dnode to the
             * actual agent 
             * @param cb(err, params) callback this when complete. create params will be passed back
             */
            dial: function(name, cb) {
                if (!agents[name]) 
                    return cb && cb("not found: " + name);                
                var agent = agents[name];
                cb(null, agent.params);
                dni.off(); dno.off(); // workaround until unpipe is implemented in node 0.9
                agent.handler(client); // transfer to the agent
            },
            /**
             * Create a new named agent
             * @param name stream name
             * @param params.server stream middleware function (stringified)
             * @param params.options stream options
             * @param cb(err) callback this when complete
             */
            create: function(name, params, cb) {
                if (!params.server) cb(name + " has unspecified function");
                else if (agents[name]) cb(name + " already exists");
                else {
                    var middleware = eval('(' + params.server + ')');
                    // call the function that creates a client handler
                    var handler = middleware(params.options);
                    // put the handler in the local registry
                    agents[name] = {
                        handler: handler,
                        params: params
                    };
                    cb(null);
                }
            },
            /**
             * Destroys an agent. Note that ongoing connections
             * will not be dropped unless there is a destroy function
             * attached to the client handler.
             * @param name stream name
             * @param cb callback when complete
             */
            destroy: function(name, cb) {
                if (!agents[name]) cb && cb(name + " not found");
                else {
                    var a = agents[name].handler;
                    try {
                        if (a && a.destroy) a.destroy();
                        delete agents[name];
                        cb && cb(null);
                    } catch (e) { cb && cb(e); }
                }
            }

        });
        client.pipe(dni).pipe(exec).pipe(dno).pipe(client);
    };


    var reginterval = null;
    /**
     * Register as present in the factory.
     * @param me.host my ip
     * @param me.port my port
     * @param regadr.host factory registry IP
     * @param regadr.port factory registry port
     * @param interval re-register every interval seconds
     */
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

