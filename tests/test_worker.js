var worker = require('../lib/worker.js'),
    net = require('net'),
    dnode = require('dnode');


var prepare = function(cb) {
    var s = net.createServer(worker.server());
    s.listen(8001);
    worker.client({host:'127.0.0.1', port:8001}, function(err, r) {
        if (err) console.log(err);
        else cb(r,s);
    });
};

var echoServer = {
    server: function(is, os) {
        is.on('data', function(data) { os.write(data); });
    }
};


exports.dial_unknown = function(test) {
    test.expect(1);
    prepare(function(worker, s) {
        worker.dial('unknown', function(err, arg) {
            test.ok(err != null, "nonexisting stream dialed without errors");
            s.close();
            test.done();
        });
    });
};

exports.dial_known = function(test) {
    test.expect(3);
    prepare(function(worker, s) {
        worker.create('known', echoServer, function(err) {
            test.ok(err == null, "create known error: " + err);
            worker.dial('known', function(err, i, o) {
                test.ok(err == null, "dialing existng stream error: " + err);
                o.write("Hello");
                i.on('data', function(d) {
                    test.ok(d == 'Hello', "echo server response is: " + d);
                    s.close();
                    test.done();
                });

            });

        });
    });
};

exports.create_destroy = function(test) {
    test.expect(4);
    prepare(function(worker, s) {
        worker.destroy('test', function(err) {
            test.ok(err != null, 'nonexisting stream destroyed without errors');
            worker.create('test', echoServer, function(err) {
                test.ok(err == null, 'create error: ' + err);
                worker.create('test', echoServer, function(err) {
                    test.ok(err != null, 'create called twice without errors');
                    worker.destroy('test', function(err) {
                        test.ok(err == null, 'destroy error: ' + err);
                        s.close();
                        test.done();
                    });
                });
            });

        });
    });
};

