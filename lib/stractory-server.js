var dnode = require('dnode')
    workerCli = require('./worker-client.js');

module.exports = function(opt) {
    if (!opt) opt = {};

    opt.registerTimeout = opt.registerTimeout || 120; // 2 minutes

    var workers = {};    

    var agents = {};


    var purgeOldWorkers = function() {
        var now = new Date().getTime();
        for (var id in workers) 
            if ((now - workers[id].lastContact) / 1000 > opt.registerTimeout)
                delete workers[id];
    }
    var randomWorker = function() {
        var available = [];
        for (var id in workers) available.push(workers[id])
        var rand = Math.floor(Math.random() * available.length);
        return available[rand];
    }

    var countWorkers = function() {
        var k = 0; for (var id in workers) ++k; return k;
    };
    return function(c) {
    
        var d = dnode({
            register: function(host, port, cb) {
                var id = host + ":" + port;
                if (!workers[id]) workers[id] = {id: id, host: host, port: port};
                workers[id].lastContact = new Date().getTime();
                cb(null);
            },
            create: function(name, params, cb) {
                if (agents[name] && workers[agents[name]]) 
                    return cb(name + ": agent already exists", workers[agents[name]]);
                purgeOldWorkers(); 
                var w = randomWorker();
                if (w) workerCli(w, function(err, worker) {
                    if (err) return cb && cb(err, w);
                    worker.create(name, params, function(err) {
                        if (!err) agents[name] = w.id;
                        return cb && cb(err, w);
                    });
                });
                else cb && cb("sorry, number of available workers is: " + countWorkers());
            },
            destroy: function(name, params, cb) {
                purgeOldWorkers();
                if (!agents[name]) return cb && cb(name+": no such agent");
                if (!workers[agents[name]]) {
                    delete agents[name];
                    return cb && cb(null);
                }
                workerCli(workers[agents[name]], function(err, worker) {
                    if (err) return cb && cb(err);
                    worker.destroy(name, function(err) {
                        delete agents[name];
                        return cb && cb(err);
                    });                 
                });
            },
            getWorker: function(name, cb) {
                purgeOldWorkers();
                if (agents[name] && workers[agents[name]])
                    cb(null, workers[agents[name]]);
                else 
                    cb(name + (!agents[name] ? ": no such agent" : ": agent is on dead worker"));
            }
        });
        c.pipe(d).pipe(c);

    }
}
