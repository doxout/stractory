var dnode = require('dnode'),
    bstream = require('./blockable-stream.js'),
    resolve = require('resolve'),
    EventEmitter = require('events').EventEmitter;
    vm = require('vm')

module.exports = function(options) {
    options = options || {};

    var newSandbox = require('./sandbox-builder.js')(options);

    var domain = null;
    if (options.domains) domain = require('domain');

    var handlerCreator = function(name, params) {
        var actorSrc = ["(", params.server, ")"].join('');
        // prepare a fresh sandbox
        // run the script, it should return the actor constructor
        var constructor = vm.runInNewContext(actorSrc, newSandbox(), name);
        // call the function that creates a client handler and return the handler.
        return constructor(params.options);

    }

    
    var actors = {};

    var getActorList = function() {
        var l = []; for (var key in actors) l.push(key); return l;
    }
    
   
    var self = function(client) {
        var dni = bstream(), dno = bstream();
        var exec = dnode({

            /**
             * Just like a telephone call. Dial the named actor
             * @param name name of the actor to dial. After dialing,
             * your client will be "transfered" from dnode to the
             * actual actor 
             * @param cb(err, params) callback this when complete. create params will be passed back
             */
            dial: function(name, cb) {
                if (!actors[name]) 
                    return cb && cb("not found: " + name);                
                var actor = actors[name];
                cb(null, actor.params);
                dni.off(); dno.off(); // workaround until unpipe is implemented in node 0.9
                actor.handler(client); // transfer to the actor
            },
            /**
             * Create a new named actor
             * @param name stream name
             * @param params.server stream middleware function (stringified)
             * @param params.options stream options
             * @param cb(err) callback this when complete
             */
            create: function(name, params, cb) {
                if (!params.server) cb(new Error(name + " has unspecified function"));
                else if (actors[name]) cb(new Error(name + " already exists"));
                else {
                    try {
                        var handler = handlerCreator(name, params), dom = null;
                        if (domain) {
                            dom = domain.create();
                            dom.on('error', function(err) {
                                console.log("exception thrown in actor handler for:", name);
                                console.log(e);
                                self.events.emit("handler-error", err);
                            });
                            handler = dom.bind(handler); 
                            if (handler.destroy) 
                                handler.destroy = dom.bind(handler.destroy); 
                        }
                        // put the handler in the local registry
                        actors[name] = { handler: handler, params: params, domain: dom };
                        cb(null);
                        //var middleware = eval('(' + params.server + ')');
                    } catch (e) {
                        console.log("exception thrown in actor:", name); 
                        console.log(e);
                        //console.log("code:", params.server);
                        cb(e, params.server);
                    }
                    
                }
            },
            /**
             * Destroys an actor. Note that ongoing connections
             * will not be dropped unless there is a destroy function
             * attached to the client handler which does that.
             * @param name stream name
             * @param cb callback when complete
             */
            destroy: function(name, cb) {
                if (!actors[name]) cb && cb(name + " not found");
                else {
                    var a = actors[name].handler;
                    try {
                        if (a && a.destroy) a.destroy();
                        if (a.domain) a.domain.dispose();
                        delete actors[name];
                        cb && cb(null);
                    } catch (e) { cb && cb(e); }
                }
            },

            /**
             * Emit misc signals to the worker. Useful to support
             * extensions like close, kill, etc.
             */ 
            emit: function(sig) {
                var args = Array.prototype.slice.call(arguments, 1);
                self.events.emit(sig, args);
            }

        });
        exec.on('fail', function(err) { console.log(err); })
        exec.on('error', function(err) { console.log(err); })
        client.pipe(dni).pipe(exec).pipe(dno).pipe(client);
    };


    var reginterval = null;
    
    /**
     * Register worker as present in the factory.
     * @param me.host my ip
     * @param me.port my port
     * @param regadr.host factory registry IP
     * @param regadr.port factory registry port
     * @param interval re-register every interval seconds
     */
    self.registry = function(me, regadr, interval) {
        if (reginterval) clearInterval(reginterval);
        var reg = null;
        var register = function() { 
            reg.register(me.host, me.port, getActorList(), function(err) {
                if (err) console.log("error registering to stractory:", err);
            });
        }
        var regfn = function() {
            try { 
                if (reg == null) {
                    var dreg = dnode.connect(regadr);
                    dreg.on('remote', function(regr) {
                        reg = regr;
                        register();
                    });
                    dreg.on('error', function(err) {
                        reg = null;
                        console.log("error communicating with stractory:", err);
                    });
                } else {
                    register();                    
                }
            } catch (e) {
                reg = null;
                console.log("Could not register to registry:", e);
            }
        };
        reginterval = setInterval(regfn, interval * 1000);
        regfn();
    }

    self.events = new EventEmitter();


    return self;
}

