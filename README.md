# Introduction

The first time you saw this wallpaper:

![node web](http://nodejs.org/images/logos/nodejs-1024x768.png)

Did you think: "It would be cool if such a web of node workers was easy to set up"?

Well, it should be much easier with stractory, the streaming actor factory

Stractory allows you to run stream actors (like dnode) on a pool of generic workers. 

# What is a stractory server?

A stractory server allows you to create stream actors.

Stream actors are basically lightweight services. They consist of:
- a stream server with a protocol
- an optional client that abstracts the protocol

For example, [dnode](http://github.com/substack/dnode) is a type of a stream actor: dnode actors consist
of a server that handles connections and answers RPC messages, and the client
that abstracts the dnode protocol, used to communicate with the actor server

The point of stractory is to distribute these streaming actors to multiple
machines. To do this multiple generic workers can join (register to) a 
stractory server. When the stractory is asked to create an actor, it will
delegate the actor's server function to a random worker which will
execute it. The returned client-handling function will be used to 
process all connections arriving to the actor.

# Setup 

    npm install -g "git://github.com/spion/stractory"

To run a stractory, create a stractory server:

    stractory.js --port 9000

then from the same machine you may run stractory workers:

    stractory-worker.js --port 9001 --registry 9000

or you can also run them from other machines

    stractory-worker.js --port 9001 --registry stractory_ip:9000

By default, modules will be loaded from process.cwd()/node\_modules.
Additionally you can specify require search paths (extra node modules dirs)

    stractory-worker.js --port 9001 --registry 9000 --node_modules path/to/node_modules

(make sure every worker has a separate ip/port combination)


# Usage

Connect to the stractory and create an actor:

    var strac = stractory.client({host:ip, port:port}, function(strac) {
        strac.create('named-actor', function() {
            return function(client) {
                client.on('data', function(d) {
                    client.write(d);
                });       
            };
        });
    });

   
The passed function() is an actor server initialization function. It will run on a randomly 
picked worker.  This function is not a closure; variables from the outside scope of this 
function will be undefined when its run on the worker.

The initialization function  should return a client handling function, like the one passed to 
net.createServer()

The previous command created a simple echo actor, and it could be written like so:

    var echo_actor = function() { return function(c) { c.pipe(c); }; };
    strac.create('mr-echo', echo_actor);    

Asking the factory for the named actor will give you a client connection to
that actor:

    strac.connect('mr-echo', function(err, client) {
        client.write('Hello');
        client.on('data', function(data) { console.log("mr-echo said: ", data); });
    });

# Complex actors

Echo actors are boring, and you usually want to abstract streams to something
higher-level to get message passing.

To do this, specify an actor server, an actor client wrapper and options to pass to both.

Create a dnode-based actor:

    var dnode_transformer = {
        options: {
            replaceWith:'oo'
        },
        server: function(options) {
            var d = require('dnode');
            var srv = {
                transform : function (s, cb) {
                    cb(s.replace(/[aeiou]{2,}/, options.replaceWith).toUpperCase())
                }
            };
            return function(client) { client.pipe(dnode(srv)).pipe(client); } 
        },
        client:function(client, options, cb) {
            var d = require('dnode')();
            d.on('remote', function(remote) {
                cb(null, remote);
            });
            client.pipe(d).pipe(client);
        }
    }
    strac.create('name', dnode_transformer, function(err) { });

Or use the built-in dnode agent builder function (shorter)

    var dnode_transformer = stractory.dnode({replaceWith:'oo'}, function(options) {
        return {
            transform : function (s, cb) {
                cb(s.replace(/[aeiou]{2,}/, options.replaceWith).toUpperCase())
            }
        };
    });

    strac.create('name', dnode_transformer, function(err) { });

Notice how the options are passed to the server function.

When a client wrapper is specified like in the dnode examples, using strac.connect
will yield the wrapped actor client instead:

    strac.connect('name', function(err, client) {
        client.transform('beep', function(result) {
            console.log("beep => ", result); 
            // beep => BOOP
        });
    });

There is a caveat here: the client wrapper and server functions are NOT closures.
They will be transformed to strings, and the server function will be
eval-ed on the worker. If you want to pass any variables to them, use
the options object. All options must be serializable by JSON.stringify 

That means e.g. that you can't simply use dnode if you've already required it,
it must be available on the worker and you must require() it in the
function body.

# TODO

## DONE: Generic dnode actor

(generic in the sense that you will be able to specify any functions):

    strac.create('custom-dnode', stractory.dnode(function(options) { 
        return {add: function(x) { return x + options.num }};
    }, {num: 5}));
    

## Spawn actor

child process spawn based actor with its stdin and stdout streams
available for input/output:
    
     // a glorified regular echo server - spawn once per client
    strac.create('custom-process', stractory.spawnclient('cat')) 


    // a glorified 'multicast' echo server - spawn once and pipe to all clients 
    strac.create('custom-process', stractory.spawnonce('cat')) 
    

They might need a lot of various parameters passed without closures available, 
so generic actors (such as a dnode one) will not be straightforward to write but 
once written they will be easier to use. That way the effects of the closure caveat, 
while still relevant, will become less pronounced.

## strac.wait
    strac.wait('name', function(err, client) {
        client.write('ping');
        client.on('data', function(d) {
            console.log(d);
        })   
    });

    strac.connect([array], function(err, [array]) {})

    strac.connect(/regex/, function(err, [array]) {});
    
Have fun!
