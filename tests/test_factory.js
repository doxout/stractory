var worker = require('../lib/worker.js'),
    stractory = require('../lib/stractory.js'),
    net = require('net'),
    dnode = require('dnode');



var environment = function() {
    
    var self = {};

    var workers  = [];
    var stracserv = null;

    self.setup = function(cb) {
    
        var startport = 9000;

        var strac = stractory.server({registerTimeout: 25});
        stracserv = net.createServer(strac);
        stracserv.listen(startport);
        var regadr = { host: '127.0.0.1', port: startport };
        for (var k = 1; k < 5; ++k) {
            var w = worker.server();
            var ws = net.createServer(w);
            ws.listen(startport + k);
            w.registry({host: '127.0.0.1', port: startport + k}, regadr, 10);
            workers.push(ws);
        }
        
        // Allows tome time for the workers to register
        setTimeout(function() { cb(regadr); }, 50);
    }

    self.teardown = function() {
        stracserv.close();
        for (var k = 0; k < workers.length; ++k) {
            workers[k].close();
        }
        workers = [];
    }

    return self;
};

var echoServer = function(opt) {
    return function(client) {
        client.on('data', function(data) { client.write(data); });
    }
};



var createAddingDnodeManual = function(addamount) {
    return {
        options: { add: addamount },
        server: function(options) {
            var dnode = require('dnode');
            return function(client) {
                var d = dnode({
                    add: function(num, cb) {
                        cb(options.add + num);
                    }
                });
                client.pipe(d).pipe(client);
            };
        },
        client: function(client, options, cb) {
            var d = require('dnode')();
            d.on('remote', function(r) {
                cb(null, r);
            });
            client.pipe(d).pipe(client);
        },
    };
}
var createAddingDnode = function(add) {
    return stractory.dnode({add: add}, function(options) {
        return { 
            add: function(num, cb) { cb(options.add + num); }
        };
    });
}


var people_tracking_actor = stractory.dnode({}, function() {
    var people = {};
    return {
        join: function(person) { people[person] = true; },
        part: function(person) { if (people[person]) delete people[person]; },
        list: function(callback) { callback(people); }
    }
});




var env = environment();


var test_dnodes = function(test, dnode_tested) {
    test.expect(5);
    env.setup(function(facadr) {
        stractory.client(facadr, function(err, fac) {
            test.ok(!err, "stractory client err: " + err);            
            fac.create('dnode-add', dnode_tested, function(err) {
                test.ok(!err, "create dnode-add err: " + JSON.stringify(err));
                fac.connect('dnode-add',  function(err, cli) {
                    test.ok(!err, "connect dnode-add err:" + err);
                    test.ok(cli, "client is: " + cli);
                    cli.add(5, function(res) {
                        test.ok(res == 15, "adder server response is: " + res);
                        env.teardown();
                        test.done();
                    });
                });

            });
        });
    });
}


exports.nonexistant_echo = function(test) {
    test.expect(5);
    env.setup(function(facadr) {
        stractory.client(facadr, function(err, fac) {
            test.ok(!err, "stractory client err: " + err);            
            fac.connect('nonexistant', function(err, i, o) {
                test.ok(err, "connect nonexistant err: " + err); 
            });
            fac.create('echo', echoServer, function(err) {
                test.ok(!err, "create echo server err: " + err);
                fac.connect('echo',  function(err, cli) {
                    test.ok(!err, "connect echo server err:" + err);
                    cli.write("Hello");
                    cli.on('data', function(d) {
                        test.ok(d == 'Hello', "echo server response is: " + d);
                        env.teardown();
                        test.done();
                    });

                });

            });
        });
    });
};



exports.dnode_adder_manual = function(test) {
    test_dnodes(test, createAddingDnodeManual(10));
};

exports.dnode_adder_generic = function(test) {
    test_dnodes(test, createAddingDnode(10));
};



exports.test_dnode_complex = function(test) {
    test.expect(1);
    env.setup(function(facadr) {
        stractory.client(facadr, function(err, fac) {
            fac.create("room", people_tracking_actor, function(err) {
                fac.connect("room", function(err, cli) {
                    cli.join("dude");
                    cli.join("dudette");
                    cli.list(function(people) {
                        test.ok(people['dude'], "people.dude = " + people['dude']);
                        env.teardown();
                        test.done();
                    });
                });
            });
        });
    });
};

