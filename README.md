# Introduction

![node web](http://nodejs.org/images/logos/nodejs-1024x768.png)

Remember this wallpaper?

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

# How is this different than [hook.io](http://github.com/hookio/hook.io)?

<table>
<tr>
  <th></th><th>stractory</th><th>hook.io</th>
</tr>
<tr>
  <td>protocol</td><td>simple stream, use any protocol: event emitter, dnode, binary, ...</td><td>predefined, event emitter</td>
</tr>
<tr>
  <td>I/O</td><td>most I/O is between workers</td><td>all I/O routed through a single hook</td>
</tr>
<tr>
  <td>auto discovery</td><td>none</td><td>mdns</td><td></td>
</tr>
<tr>
  <td>management</td>
  <td>autoassign actor to worker, deploy modules manually</td>
  <td>manually decide which and how many hook to run on which process on which machine, then manually set all that up</td>
  <td></td>
</tr>
<tr>
  <td>address multiple actors</td>
  <td>n/a: simple connect/get actor by name (but more comming soon)</td>
  <td>powerful wildcard messaging</td>
</tr>
</table>

# Setup 

    sudo npm install -g "git://github.com/spion/stractory"

To run a stractory, create a stractory server:

    stractory --port 9000

then from the same machine you may run stractory workers:

    stractory-worker --port 9001 --registry 9000

or you can also run them from other machines

    stractory-worker --port 9001 --registry stractory_ip:9000

(make sure every worker has a separate ip/port combination)

By default, modules will be loaded from `process.cwd()/node_modules`.
Additionally you can specify require search paths (extra node modules dirs)

    stractory-worker --port 9001 --registry 9000 --node_modules path/to/node_modules


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

   
The passed function is an actor server initialization function. It will run on a randomly 
picked worker.  This function is not a closure; variables from the outside scope of this 
function will be undefined when its run on the worker.

The initialization function  should return a client handling function, like the one passed to 
`net.createServer()`

The previous command created a simple echo actor, and it could be written like so:

    var echo_actor = function() { return function(c) { c.pipe(c); }; };
    strac.create('mr-echo', echo_actor);    

Asking the factory for the named actor will give you a new client connection to
that actor:

    strac.connect('mr-echo', function(err, client) {
        client.write('Hello');
        client.on('data', function(data) { console.log("mr-echo said: ", data); });
    });

Or you can reuse an existing connection:

    strac.get('mr-echo', function(err, client) { client.write("hi"); });

`get(name cb)` connects to the actor if required, otherwise returns the last cached client.
This is faster and much more resource-friendly than creating a new connection every 
time, but it might not work for some types of actors that require a new connection
for every client or use. RPC clients like dnode will work fine.

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
        client:function(client, cb) {
            var d = require('dnode')();
            d.on('remote', function(remote) {
                cb(null, remote);
            });
            client.pipe(d).pipe(client);
        }
    }
    strac.create('name', dnode_transformer, function(err) { });

Or use the built-in dnode agent builder function (shorter and safer)

    var dnode_transformer = stractory.dnode({replaceWith:'oo'}, function(options) {
        return {
            transform : function (s, cb) {
                cb(s.replace(/[aeiou]{2,}/, options.replaceWith).toUpperCase())
            }
        };
    });

    strac.create('name', dnode_transformer, function(err) { });

Notice how the options are passed to the server function.

When a client wrapper is specified like in the dnode examples, using `strac.get` and `strac.connect`
will yield the wrapped actor client instead:

    strac.get('name', function(err, client) {
        client.transform('beep', function(result) {
            console.log("beep => ", result); 
            // beep => BOOP
        });
    });

# The closure caveat:

The client wrapper and server functions are NOT closures. They will be transformed 
to strings, and the server function will be eval-ed on the worker. If you want to 
pass any variables to them, use the options object. All options must be non-functions 
and serializable by dnode. (note that dnode does support cyclic objects)

What this means is that you should treat actors as if they're separate modules.
That means e.g. that you can't simply use the dnode variable if you've already required 
it; it must be made available on the worker by calling

    var dnode = require('dnode');

in the actor's server function body (just like you would do for a separate module)

# Other built in actor types

## Spawn actor

This is a child process spawn based actor with its stdin and stdout streams
available for input/output:

    // a glorified 'multicast' echo server - spawn once and pipe to all clients 
    strac.create('custom-process', stractory.spawn('cat'), smart_client) 

The third argument is an optional "smarter" client.

Possible uses include audio and video stream encoders.


# Roadmap (TODO)

## Queuing client API:

Queue stractory requests until a connection is estabilished.

    var strac = stractory.client({host:.., port:..});
    
    strac.connect('actorname', function(err, actor) {
    });
   
## Other stractory client functions:

### Wait until an actor appears

    strac.wait('name', function(err, client) {
        client.write('ping');
        client.on('data', function(d) {
            console.log(d);
        })   
    });

### Support for array and regex arguments

    strac.connect([array], function([errs], [actors]) {})

    strac.connect(/regex/, function([errs], [actors]) {});


# Performance stats

These are ballpark figures on what to expect. 

Local machine: Core i5-2450M @ 2.5GHz with 4GB RAM (with 4 workers)

 * average create time for a simple dnode actor 1.88 ms
 * average connect time to this actor 1.90 ms
 * average dnode message exchange time (call + callback) 0.26 ms

For more info look at test\_performance in test\_factory.js
    
Have fun!

