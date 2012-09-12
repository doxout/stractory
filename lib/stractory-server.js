var dnode = require('dnode')
    workerCli = require('./worker-client.js');

module.exports = function(opt) {
    if (!opt) opt = {};

    opt.registerTimeout = opt.registerTimeout || 60 * 2; // 2 minutes

    var clients = {};    

    var stream = {};



    var purgeOldWorkers = function() {
        var now = new Date().getTime();
        for (var id in clients) {
            if ((now - clients[id].lastContact) / 1000 > opt.registerTimeout) 
                delete clients[id]
        }
    }
    var randomWorker = function() {
        var available = [];
        for (var id in clients) available.push(clients[id])
        var rand = Math.floor(Math.random() * available.length);
        return available[rand];
    }

    var countWorkers = function() {
        var k = 0; for (var key in clients) ++k; return k;
    };
    return function(c) {
    
        var d = dnode({
            register: function(host, port, cb) {
                var id = host + ":" + port;
                if (!clients[id]) clients[id] = {id: id, host: host, port: port};
                clients[id].lastContact = new Date().getTime();
                cb(null);
            },
            create: function(name, params, cb) {
                if (stream[name] && clients[stream[name]]) 
                    return cb(name + "already exists", clients[stream[name]]);
                else {
                    purgeOldWorkers(); 
                    var w = randomWorker();
                    if (w) workerCli(w, function(err, worker) {
                        if (err) return cb && cb(err, w);
                        worker.create(name, params, function(err) {
                            if (!err) stream[name] = w.id;
                            cb && cb(err, w);
                        });
                    });
                    else cb("sorry, number of available workers is: " + countWorkers());
                }
            },
            destroy: function(name, params, cb) {
                purgeOldWorkers();
                if (!stream[name]) return cb && cb(name+": no such stream");
                if (!clients[stream[name]]) {
                    delete stream[name];
                    cb && cb(null);
                }
                workerCli(clients[stream[name]], function(err, worker) {
                    if (err) return cb && cb(err);
                    worker.destroy(name, function(err) {
                        delete stream[name];
                        cb && cb(err);
                    });                 
                });
            },
            getWorker: function(name, cb) {
                purgeOldWorkers();
                if (stream[name] && clients[stream[name]]) {
                    cb(null, clients[stream[name]]);
                }
                else {
                    cb(!stream[name] ? name+": no such stream" : name+": stream is on dead worker");
                }
            }
        });
        c.pipe(d).pipe(c);

    }
}
