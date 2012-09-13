# Introduction

The first time you saw this wallpaper:

![node web](http://nodejs.org/images/logos/nodejs-1024x768.png)

Did you think: "It would be cool if such a web of node workers was easy to set up"?

Well, it should be much easier with stractory, the streaming server factory

Stractory allows you to run stragents (stream agents, like dnode) on a pool of generic workers. 

# What is a stractory server?

A stractory server is a server that acts as a stream agent factory. 


Stream agents are basically client-server pairs, with at least
the function that initializes the server being defined. This server 
initialization function returns a client-handling function 
like the function passed to net.createServer()

For example, dnode is a type of a stream agent: dnode agents consist
of a server that handles connections and answers RPC and the client
used to connect to such a server

The point of stractory is to distribute these agents to multiple
machines. To do this multiple generic workers can join (register to) a 
stractory server. When the factory is asked to create an agent, it will
delegate the agent's server function to a random worker which will
execute it. The returned client handling function will be used to 
process all connections arriving to the agent.

# Setup 

To run a stractory, create a stractory server:

    net.createServer(stractory.server()).listen(9000);

then from the same machine or other machines you may run stractory workers:

    node lib/worker-bin.js --ip listenip --port listenport --registry stractoryip:9000

# Usage

Connect to the stractory and create an agent:

    var strac = stractory.connect({host:ip, port:port}, function(strac) {
        strac.create('named-agent', function() {
            return function(client) {
                client.on('data', function(d) {
                    client.write(d);
                });       
            };
        });
    });

   
The passed function() will run on a randomly picked worker. It should
return a client handling function

The previous command created a simple echo stragent, and it could be written like so:

    var echo_agent = function() { return function(c) { c.pipe(c); }; };
    strac.create('mr-echo', echo_agent);    

Asking the factory for the named agent will give you a client connection to
that agent:

    strac.connect('mr-echo', function(err, client) {
        client.write('Hello')
        client.on('data', function(data) { console.log("mr-echo said: ", data); });
    });

# Complex agents

Echo agents are boring, and you usually want to abstract streams to something
higher-level.

Specify an agent server, an agent client wrapper and options to pass to both.

Create a dnode-based agent:

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

Notice how the options are passed to the server and client functions.

When a client wrapper is specified like in the dnode example, using strac.connect
will yield the wrapped client instead:

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

Various stragents are planned, among which: a generic dnode stragent
(generic in the sense that you will be able to specify any functions, e.g.

    strac.create('custom-dnode', stragent.dnode(function(options) { 
        return {add: function(x) { return x + options.num }};
    }, {num: 5}));
    
and a child_process.spawn based agent with its stdin and stdout streams
available for input/output.

As they might need a lot of various parameters passed without closures available, 
generic stragents (such as a dnode one) will not be straightforward to write but 
once written they will be easier to use. 

That way the effects of the closure caveat, while still relevant, will become
less pronounced.

Some other possible ideas to be implemented
(NOT YET AVIALABLE)

    strac.wait('name', function(err, client) {
        client.write('ping');
        client.on('data', function(d) {
            console.log(d);
        })   
    });

    strac.connect([array], function(err, [array]) {})

    strac.connect(/regex/, function(err, [array]) {});
    
Have fun!
