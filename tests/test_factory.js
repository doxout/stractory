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
        cb(regadr);
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

var echoServer = function(is, os) {
        is.on('data', function(data) { os.write(data); });
};

var createAddingDnode = function(addamount) {
    return {
        server: function(is, os, opt) {
            var d = require('dnode')({
                add: function(num, cb) {
                    cb(opt.add + num);
                }
            });
            console.log("piped");
            is.pipe(d).pipe(os);
        },
        client: function(is, os, opt) {
            var d = require('dnode')();
            d.on('remote', function(err, r) {
                console.log(r);
                cb(err, r);
            });
            is.pipe(d).pipe(os);
        },
        options: { add: addamount }
    };
}

var env = environment();

exports.nonexistant_echo = function(test) {
    test.expect(5);
    env.setup(function(facadr) {
        stractory.client(facadr, function(err, fac) {
            test.ok(!err, "stractory client error: " + err);            
            fac.get('nonexistant', function(err, i, o) {
                test.ok(err, err); 
            });
            fac.create('echo', echoServer, function(err) {
                test.ok(!err, "create echo server err: " + err);
                fac.get('echo',  function(err, i, o) {
                    test.ok(err == null, "get echo server err:" + err);
                    o.write("Hello");
                    i.on('data', function(d) {
                        test.ok(d == 'Hello', "echo server response is: " + d);
                        env.teardown();
                        test.done();
                    });

                });

            });
        });
    });
};

exports.dnode_adder = function(test) {
    test.expect(3);
    env.setup(function(facadr) {
        stractory.client(facadr, function(err, fac) {
            console.log("stractory client", err, err == null);
            test.ok(err == null, "stractory client error: " + err);            
            fac.create('dnode-add', createAddingDnode(10), function(err) {
                console.log("created dnode-add", err, err == null);
                test.ok(err == null, "create echo server err: " + JSON.stringify(err));
                fac.get('dnode-add',  function(err, cli) {
                    console.log(err, cli);
                    test.ok(err == null, "get echo server err:" + err);
                    cli.add(5, function(res) {
                        test.ok(res == 15, "adder server response is: " + res);
                        env.teardown();
                        test.done();
                    });
                });

            });
        });
    });
};


