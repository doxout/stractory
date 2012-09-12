# Stractory

A stractory is a server that acts as a stream factory. Stractory allows you to attach
middleware around the created stream that will process the input and answer with output.

A stractory client connects to the stractory server and abstracts its functions.

The stractory server has an interface which has the following commands

    var strac = stractory.connect('ip:port', function(strac) {
        strac.create('name', function(istream, ostream) {
            istream.on('data', function(d) {
                ostream.write(d);
            });       
        });
    });

   
This causes named I/O streams to be created on the factory server
and the specified middleware to be attached to them.

You can use:

    strac.create('name', { 
        server: function(istream, ostream, options) {
            istream.on('data', function(d) {
                ostream.write(d);
            }); 
        },
        client:function(istream, ostream, options, cb) {
            cb(wrapper(istream, ostream));
        },
        options: {
        }
    }, function(err) {
        if (err) console.log("error creating stream - perhaps it already exists?"); 
    });

if you wish to provide a default wrapper for the client and/or specify options.
You can obtain a client stream or its wrapper for an existing server stream:

    strac.get('name', function(err, istream, ostream, options) {
    });

The get function will return null if the named server stream is not available at the stractory. 
You can also wait until the named server stream becomes available instead
(NOT YET AVIALABLE)

    strac.wait('name', function(err, istream, ostream, options) {
        ostream.write('ping');
        istream.on('data', function(d) {
            console.log(d);
        })   
    });

Note that both functions will return the client wrapper if available instead

    strac.get('name', function(err, client) {
    });
