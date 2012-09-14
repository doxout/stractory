var dnode = require('dnode'),
    bstream = require('./blockable-stream.js'),
    resolve = require('resolve'),
    vm = require('vm')

module.exports = function(options) {

    var actors = {};


    var newSandbox = (function() {
        var resolvePaths = options && options.node_modules ? options.node_modules.split(",") : null;
        var resolveCache = {};
        var resolveCached = function(module) {
            var cached = resolveCache[module]
            if (cached) return cached;
            else { 
                resolveCache[module] = cached = resolve.sync(module, {basedir: process.cwd(), paths: resolvePaths});
                return cached;
            }
        }
        var actor_require = function(id) {
            return require(resolveCached(id));
        };
        //for (var key in require) actor_require[key] = require[key];
        //actor_require.resolve = resolveCached;
        return function() {
            var sand = {};
            for (var key in global) sand[key] = global[key];
            sand.require = actor_require;
            return sand;
        };
    }());
    
   
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
                if (!params.server) cb(name + " has unspecified function");
                else if (actors[name]) cb(name + " already exists");
                else {
                    try {
                        var actorSrc = ["(", params.server, ")"].join('');
                        var constructor = vm.runInNewContext(actorSrc, newSandbox(), name);
                        // prepare a fresh sandbox
                        // run the script, it should return the actor constructor
                        // call the function that creates a client handler
                        var handler = constructor(params.options);
                      
                        // put the handler in the local registry
                        actors[name] = {
                            handler: handler,
                            params: params
                        };
                        cb(null);
                        //var middleware = eval('(' + params.server + ')');
                    } catch (e) {
                        console.log(params.server);
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
                        delete actors[name];
                        cb && cb(null);
                    } catch (e) { cb && cb(e); }
                }
            }

        });
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

