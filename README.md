# Introduction

![node web](http://nodejs.org/images/logos/nodejs-1024x768.png)

Remember this wallpaper?

Did you think: "It would be cool if such a web of node workers was easy to set up"?

Well, it should be much easier with stractory, the streaming actor factory

Stractory allows you to run stream actors (like dnode) on a pool of generic workers. 

# What is a stractory server?

A stractory server allows you to create named stream actors.

Stream actors are basically lightweight services. They consist of:
- a stream server with a protocol
- an optional client that abstracts the protocol


For example, [dnode](http://github.com/substack/dnode) is a type of a stream actor: dnode actors consist of: 
- a server that provides RPC 
- the client that abstracts the dnode protocol and is used to call RPC on the server

Stractory can distribute these streaming actors to run on multiple worker processes on multiple machines.
    
When the stractory is asked to create a named actor, it will run the actor's server on a random worker from the pool. The name must be globally unique.

    mystractory.create("name", stractory.dnode(function() { 
        // the exported dnode functions
        return { dostuff: function() {} };
    }); 

Afterwards we can ask the stractory to get us the named actor from any process

    mystractory.get("name", function(actor) { actor.dostuff(); });

# Why

Writing node.js code is easy as long as we stick to a single process. However the moment we need to scale beyond that, we may find ourselves needing to rewrite large chunks of our code that unfortunately rely on memory, event emitters and streams being available to all clients (e.g. socket.io). 

To solve this problem we can use e.g. redis as a communication channel between processes. However this might mean large changes in our code.

Another approach is to write a service for each task and run them on separate processes. However a single process doing one thing means we constantly need to calculate how many processes of what type we need to run on how many machines

With stractory we can move our existing code inside actors and keep on sharing memory, streams and event emitters. 

Unlike redis, there is no single channel through which all messages pass. Instead there is a single registry (the stractory). It assigns and keeps track which actor runs on which worker process. All other communication is between workers and client processes.  

Finally, instead of giving separate jobs to separate processes we simply run generic workers and stractory will automatically spread our actors across all of them. 

Some good actor examples:

- a game between two (or more) players
- a chatroom 
- a collaborative drawing board 
- a single opened live document
- a live audio/video stream

and so on.

# Setup 

    sudo npm install -g "git://github.com/spion/stractory"

To run a stractory, create a stractory server:

    stractory --listen 9000 &

then from the same machine you may run 4 stractory workers:

    stractory-workers --listen 9001,9002,9003,9004 --registry 9000

To use as a library, install it in the local directory:

    npm install "git://github.com/spion/stractory"

# More about running workers

You can also run workers from other machines

    stractory-workers --listen 9001,9002 --registry stractory_ip:9000

By default, workers will load modules from `process.cwd()/node_modules`. You can specify a different working dir: 

    stractory-workers --listen 9001,9002 --registry 9000 --workingDir path/to/working_directory

and modules will be looked up in path/to/working\_directory/node\_modules


# Usage

Connect to the stractory and create an actor:

    var strac = stractory.client({host:ip, port:port});
    strac.create('named-actor', function() {
        return function(client) {
        client.on('data', function(d) {
            client.write(d);
            });       
        };
    });

   
The passed function is an actor server initialization function. It will run on a randomly picked worker.  This function is not a closure; variables from the outside scope of this function will be undefined when its run on the worker.

The initialization function  should return a client handling function, like the one passed to `net.createServer()`

The previous command created a simple echo actor, and it could be written like so:

    var echo_actor = function() { return function(c) { c.pipe(c); }; };
    strac.create('mr-echo', echo_actor);    

Asking the factory for the named actor will give you a new client connection to that actor:

    strac.connect('mr-echo', function(err, client) {
        client.write('Hello');
        client.on('data', function(data) { console.log("mr-echo said: ", data); });
    });

Or you can reuse an existing connection:

    strac.get('mr-echo', function(err, client) { client.write("hi"); });

`get(name cb)` connects to the actor if required, otherwise returns the last cached client. This is faster and much more resource-friendly than creating a new connection every time, but it might not work for some types of actors that require a new connection for every client or use. RPC clients like dnode will work fine.

# Complex actors

Echo actors are boring, and you usually want to abstract streams to something higher-level to get message passing.

To do this, specify an actor server, an actor client wrapper and options to pass to both.

Create a dnode-based actor:

    var dnode_transformer = stractory.dnode({replaceWith:'oo'}, function(options) {
        return {
            transform : function (s, cb) {
                cb(s.replace(/[aeiou]{2,}/, options.replaceWith).toUpperCase())
            }
        };
    });

    strac.create('name', dnode_transformer, function(err) { });

Notice how the options are passed to the server function.

When a client wrapper is specified like in the dnode examples, using `strac.get` and `strac.connect` will yield the wrapped actor client instead:

    strac.get('name', function(err, client) {
        client.transform('beep', function(result) {
            console.log("beep => ", result); 
            // beep => BOOP
        });
    });

# How is this different than [hook.io](http://github.com/hookio/hook.io)?

<table>
<tr>
  <th></th><th>stractory</th><th>hook.io</th>
</tr>
<tr>
  <td>protocol and client</td>
  <td>simple stream, use any protocol / client: event emitter, dnode, binary, ...</td>
  <td>JSON based protocol, event emitter client.</td>
</tr>
<tr>
  <td>I/O</td><td>most I/O is between workers</td><td>all I/O routed through a single hook</td>
</tr>
<tr>
  <td>auto discovery</td><td>none</td><td>mdns</td>
</tr>
<tr>
  <td>management</td>
  <td>autoassign actor to worker, deploy modules manually</td>
  <td>manually decide which and how many hooks to run on which processes on which machines, then manually set all that up</td>
</tr>
<tr>
  <td>address multiple actors</td>
  <td>n/a: simple connect/get actor by name (but more coming soon)</td>
  <td>powerful wildcard messaging</td>
</tr>
</table>

# Closure caveat

The client wrapper and server functions are NOT closures. They will be transformed to strings, and the server function will be eval-ed on the worker. If you want to pass any variables to them, use the options object. All options must be non-functions and serializable by dnode. (note that dnode does support cyclic objects)

What this means is that you should treat actors as if they're separate modules. That means e.g. that you can't simply use the dnode variable if you've already required it; it must be made available on the worker by calling

    var dnode = require('dnode');

in the actor's server function body (just like you would do for a separate module)

# Events

The returned stractory client is an eventemitter and supports the following events

### error
   
An error in the connection or dnode communication occured. You should probably re-estabilish a new client connection if you wish to continue, e.g.
    
    var errorHandler = function(err) { 
        console.log(err);
        strac = stractory.client(hostport);
    })
    strac.on('error', errorHandler);    

### timeout

Connection to the stractory server has timed out. See 
[timeout in net.Socket](http://nodejs.org/api/net.html#net_event_timeout)

### close

Connection to the stractory server was closed. See
[close in net.Socket](http://nodejs.org/api/net.html#net_event_close_1)

### fail

A dnode protocol communication error has occured. Usually the client can recover from this error.

### actor-timeout:

Connection estabilished to an actor has timed out.

    strac.on('actor-timeout', function(actorName, actorConnection) { })

### actor-error

An error in the connection to the actor has occured

    strac.on('actor-error', function(actorName, actorConnetion, error) { });

### actor-close

Connection to the actor was closed. Addiional parameter indicates if the connection was closed because of an error.

    strac.on('actor-close', function(actorName, actorConnetion, had_error) { });


# Chatroom example

Run a node repl:

    node

Create a dnode-based chatroom actor...  

    var stractory = require('stractory');

    var chatroom = stractory.dnode(function() {
        var people = {};
        var msgs = [];

        var event_callbacks = {};
        return {
            join: function(person) { 
                people[person] = true; 
                if (event_callbacks['join'])
                    event_callbacks['join'].forEach(function(cb) { cb(person); });
            },
            part: function(person) { if (people[person]) delete people[person]; },
            on: function(evt, callback) {
               if (!event_callbacks[evt]) event_callbacks[evt] = []; 
               event_callbacks[evt].push(callback); 
            },
            msg: function(person, msg) {
                msgs.push(msg);  
                if (event_callbacks['msg'])
                    event_callbacks['msg'].forEach(function(cb) { cb(person, msg); });
            },
            list: function(callback) { callback(people); },
            msglist: function(callback) { callback(msgs); }
        }
    });

and tell stractory to run it by the name `myroom`  on a random worker

    var strac = stractory.client({host: '127.0.0.1', port: 9000});
    strac.create('myroom', chatroom, function(err) { 
        strac.get('myroom', function(err, room) {
            room.on('join', function(person) { console.log("*", person, "joined"); });
            room.on("msg", function(who, msg) { console.log("<" + who + ">", msg); });
        });
    });

We're also listening for messages and joins to the chatroom.
    
Lets run another repl 
    
    node    

connect to the room and make some noise

    var strac = require('stractory').client({host: '127.0.0.1', port: 9000});

    strac.get('myroom', function(err, room) {
        if (err) throw err;
        room.join("Alex");
        room.join("Bob");
        room.msg("Alex", "Hello");
        room.msg("Bob", "Hello back");
    });

You should get this in the first REPL:

    * Alex joined
    * Bob joined
    <Alex> Hello
    <Bob> Hello back



# Other built in actor types

## Spawn actor

This is a child process spawn based actor with its stdin and stdout streams available for input/output:

    // a glorified 'multicast' echo server - spawn once and pipe to all clients 
    strac.create('custom-process', stractory.spawn('cat'), smart_client) 

The third argument is an optional "smarter" client.

Possible uses include audio and video stream encoders.

## Eventemitter actor:

If you don't need the callback functionality of dnode, (you only need to transmit simple JSON objects i.e. message passing), you can use stractory.eventemitter. The only benefit is that its upto 4 times faster than dnode

    var multicastEchoEmitter = stractory.eventemitter(function() {
        var clients = []; 
        return function(ee) {
            clients.push(ee);
            ee.recv.on('echo', function(data) { 
                clients.forEach(function(c) { c.send.emit('echo', data) })  
            }); 
        }   
    });

    strac.create('ee', multicastEchoEmitter, function(err) {
        fac.get('ee', function(err, ee) {
            ee.recv.on('echo', function(msg) {
                console.log(msg);
            });
            ee.send.emit('echo', {hello: "world"});
        });
    });


# Roadmap (TODO)
   
## Binary stream multiplexer (?)

If instead of multiple connections a binary stream multiplexer is used, things like scaling to 100 000 actors might be possible, and stractory wouldn't be limited to < `ulimit -n` actor connections per process.


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

Local machine: Core i5-2450M @ 2.5GHz with 4GB RAM (with 1 worker)

any actor type
  * creates: 600 creates/s (700 with 4 workers)
  * connects: 250 conn/s (550 with 4 workers)

dnode actor, messages with callback and string
  * message exchange: 11,000 msg/s

eventemitter actor, pure json messages
  * message exchange: 40,000 msg/s


For more info look at test\_factory.js
    
Have fun!

