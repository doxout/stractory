var worker = require('../lib/worker.js'),
    stractory = require('../lib/stractory.js'),
    net = require('net'),
    dnode = require('dnode');



var environment = function(opt) {
    
    var self = {};

    var workers  = [];
    var stracserv = null;

    var cproc = require('child_process');
        
    self.setup = function(cb, numworkers, workopt) {
    
        var startport = 9000;

        var strac = stractory.server({registerTimeout: 25});
        stracserv = net.createServer(strac);
        stracserv.listen(startport);
        var regadr = { host: '127.0.0.1', port: startport };
        
        for (var k = 1; k < numworkers + 1; ++k) {
            if (opt && opt.spawn) {
                var worker_script = require('path').resolve(__dirname + '/../bin/stractory-worker.js');
                var ws = cproc.spawn(worker_script ,
                        [
                        '--listen', startport + k, 
                        '--registry', regadr.host + ':' + regadr.port,
                        '--registerEvery', 10]);
                ws.stdout.pipe(process.stdout);
                workers.push(ws);

            } else {
                var w = worker.server(workopt);
                var ws = net.createServer(w);
                ws.listen(startport + k);
                w.registry({host: '127.0.0.1', port: startport + k}, regadr, 10);           
                workers.push(ws);

            }
        }
        
        // Allows some time for the workers to register
        var waitTime;
        if (opt && opt.spawn) waitTime = 50 + 150 * numworkers;
        else waitTime = 30;
        setTimeout(function() { cb(regadr); }, waitTime);
    }

    self.teardown = function() {
        try { stracserv.close(); } catch (e) { console.log(e); }

        for (var k = 0; k < workers.length; ++k) {
            if (opt && opt.spawn) {
                workers[k].kill('SIGKILL');
            }
            else workers[k].close(); 
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
        list: function(callback) { callback(people); },
        test: function(callback) { callback(); }
    }
});




var env = environment({spawn:true});

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
    }, 1);
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
                if (err) console.error(err);
                test.ok(!err, "create echo server err: " + err);
                fac.connect('echo',  function(err, cli) {
                    test.ok(!err, "connect echo server err:" + err);
                    if (err) console.log(err);
                    cli.write("Hello");
                    cli.on('data', function(d) {
                        test.ok(d == 'Hello', "echo server response is: " + d);
                        env.teardown();
                        test.done();
                    });

                });

            });
        });
    }, 1);
};



exports.dnode_adder_generic = function(test) {
    test_dnodes(test, createAddingDnode(10));
};



exports.dnode_complex = function(test) {
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
    }, 4); 
};

exports.spawn_actor = function(test) {
    test.expect(4);
    env.setup(function(facadr) {
        stractory.client(facadr, function(err, fac) {
            fac.create('cat', stractory.spawn('cat'), function(err) {
                test.ok(!err, 'create spawn cat');
                fac.connect('cat', function(err, c1) {
                    test.ok(!err, 'connect to cat 1 ' + err);
                    fac.connect('cat', function(err, c2) {
                        test.ok(!err, 'connect to cat 2 ' + err);
                        c2.write('cat');
                        c1.on('data', function(d) {
                            test.ok('cat' == d, 'cat data received ' + d);
                            env.teardown();
                            test.done(); 
                        });
                    });
                });
            });
        });
    }, 2);
}


var test_performance = function(test, actorType, actorTest, msgCount) {
    test.expect(3);

    var spawnenv = environment({spawn: true});
    spawnenv.setup(function(facadr) {
        stractory.client(facadr, function(err, fac) {
            var rooms = 500;

            var resumeAfter = function(n, cb) {
                var alldata = [];
                return function(err, data) {
                    alldata.push(data); if (--n == 0) cb(alldata); };
            };
            var ts = new Date().getTime();
            var r1 = resumeAfter(rooms, function() {
                var t = new Date().getTime();
                var perCreate = (t - ts) / rooms;
                test.ok(perCreate < 25, "creates:" + (1000 / perCreate).toFixed() + " creates/s");
                var r2 = resumeAfter(rooms, function(allrooms) {
                    var tm = new Date().getTime();
                    var perConnect = (tm - t) / rooms;
                    test.ok(perConnect < 15, "connects: " + (1000 / perConnect).toFixed() + " conn/s");
                    var r3 = resumeAfter(rooms * msgCount, function() {
                        var perMsg = (new Date().getTime() - tm) / (rooms * msgCount);
                        test.ok(perMsg < 2, "message exchange: " + (2 * 1000 / perMsg).toFixed() + " msg/s");
                        spawnenv.teardown();
                        test.done();
                    });
                    for (var k = 0; k < msgCount; ++k) allrooms.forEach(function(r) { actorTest(r, r3); }); 
                });
                for (var k = 0; k < rooms; ++k) fac.connect("room" + k, r2);
            })
            for (var k = 0; k < rooms; ++k)
                fac.create("room" + k, actorType, r1);
            

        });
    }, 4); 
}

exports.performance_dnode = function(test) {
    test_performance(test, people_tracking_actor, function(cli, cb) { cli.test(cb); }, 20);
}


exports.performance_json_messages = function(test) {
    test_performance(test, echoServer, function(cli, cb) { 
        if (!cli.has_on_bind) { 
            cli.has_on_bind = true; 
            cli.on('data', function(data) { 
                var jsons = data.toString().trim().split('\n')
                .map(JSON.parse).map(cb);
            });
        }
        cli.write(JSON.stringify({test:'data', more:true, nothing:null, arr:[1,2,3]}) + '\n'); 
    }, 200);
}

