# Introduction

The first time you saw this wallpaper:

![node web](http://nodejs.org/images/logos/nodejs-1024x768.png)

Did you think: "It would be cool if such a web of node workers was easy to set up"

Introducing stractory, the stream factory

Run stragents (stream based agents, like dnode) on a pool of generic workers. 

# What is a stractory server

A stractory server is a server that acts as a stream factory. You can create named
stream pairs (input and output) by telling the stractory what you want. 

You can specify what agent function will run. The agent will attach and process data
from the created input stream and answer with output on the output stream.

To run a stractory, create a stractory server:

    net.createServer(stractory.server()).listen(9000);

then from the same machine or other machines you may run stractory workers:

    node --ip listenip --port listenport --registry registryip:9000

You can use a stractory client to connect to the stractory server and create stream agents.

Here is how that looks like:

    var strac = stractory.connect({host:ip, port:port}, function(strac) {
        strac.create('named-stream', function(istream, ostream) {
            istream.on('data', function(d) {
                ostream.write(d);
            });       
        });
    });

   
This causes named I/O streams to be created on a random worker which
is registered to the factory server. The specified the middleware function 
will be attached to the streams and will execute on the worker. 

The previous command created a simple echo stragent, and it could be written like so:

    var echo_agent = function(istream, ostream) { istream.pipe(ostream); };
    strac.create('named-stream', echo_agent);

Echo streams are boring, and you usually want to abstract streams to something
higher-level. 

stractory allows you a more complex specification for the agent, which allows
you to write an agent server, an agent client wrapper and pass options to both.

To do that, you can for example create a dnode-based agent:

    var dnode_transformer = { 
        server: function(istream, ostream, options) {
            var d = require('dnode')({
                transform : function (s, cb) {
                    cb(s.replace(/[aeiou]{2,}/, options.replaceWith).toUpperCase())
                }
            });
            istream.pipe(d).pipe(ostream);
        },
        client:function(istream, ostream, options, cb) {
            var d = require('dnode')();
            d.on('remote', function(remote) {
                cb(remote);
            });
            istream.pipe(d).pipe(ostream);
        },
        options: {
            replaceWith:'oo'
        }
    }
    strac.create('name', dnode_transformer, function(err) {
        if (err) console.log("error creating stream - perhaps it already exists?"); 
    });

if you wish to provide a default wrapper for the client and/or pass options.

By default, if there is no client wrapper, asking the factory for the named
stragent will give you the stream pair and options:

    strac.get('name', function(err, istream, ostream, options) {
    });

But, if a client wrapper was specified like in the dnode example, you will
instead obtain the real deal (the dnode client)

    strac.get('name', function(err, client) {
        client.transform('beep', function(result) {
            console.log("beep => ", result); 
            // beep => BOOP
        });
    });

There is a caveat here: the client and server functions are NOT closures.
They will be transformed to strings, and the server function will be
executed on the worker. If you want to pass any variables to them, use
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
available.

As they might need a lot of various parameters passed without closures available, 
generic stragents (such as a dnode one) will not be straightforward to write but 
once written they will be very easier to use. 

That way the effects of the closure caveat, while still relevant, will become
less pronounced.

Some other possible ideas to be implemented
(NOT YET AVIALABLE)

    strac.wait('name', function(err, istream, ostream) {
        ostream.write('ping');
        istream.on('data', function(d) {
            console.log(d);
        })   
    });

    strac.get([array], function(err, [array]) {})

    strac.get(/regex/, function(err, [array]) {});
    
Have fun!