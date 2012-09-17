var dnode = require('dnode')
    workerCli = require('./worker-client.js');

module.exports = function(opt) {
    if (!opt) opt = {};

    opt.registerTimeout = opt.registerTimeout || 120; // 2 minutes

    var workers = {};    

    var actors = {};


    var purgeOldWorkers = function() {
        var now = new Date().getTime();
        for (var id in workers) 
            if ((now - workers[id].lastContact) / 1000 > opt.registerTimeout) {
                delete workers[id];
                //if (cachedClient[id]) delete cachedClient[id];
            }
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


    var cachedCli = function(w, cb) {
        var cc = w.cachedClient;
        if (cc) 
            cb(null, cc);
        else workerCli(w, function(err, worker) {
            if (!err) w.cachedClient = worker;
            cb(err, worker);
        });
    };

    return function(c) {
    
        var d = dnode({
            register: function(host, port, wactors, cb) {
                if (!host) host = c.remoteAddress;
                var id = host + ":" + port;
                if (!workers[id])  
                    workers[id] = {id: id, host: host, port: port, cachedClient:null};
                workers[id].lastContact = new Date().getTime();
                wactors.forEach(function(a) { actors[a] = id; });
                cachedCli(workers[id], function() {});
                cb(null);
            },
            create: function(name, params, cb) {
                if (actors[name] && workers[actors[name]]) 
                    return cb(name + ": actor already exists", workers[actors[name]]);
                purgeOldWorkers(); 
                var w = randomWorker();
                if (w) cachedCli(w, function(err, worker) {
                    if (err) return cb && cb(err, w);
                    worker.create(name, params, function(err) {
                        if (!err) actors[name] = w.id;
                        //worker.close();
                        return cb && cb(err, w);
                    });
                });
                else cb && cb("sorry, number of available workers is: " + countWorkers());
            },
            destroy: function(name, params, cb) {
                purgeOldWorkers();
                if (!actors[name]) return cb && cb(name+": no such actor");
                if (!workers[actors[name]]) {
                    delete actors[name];
                    return cb && cb(null);
                }
                cachedCli(workers[actors[name]], function(err, worker) {
                    if (err) return cb && cb(err);
                    worker.destroy(name, function(err) {
                        if (!err) delete actors[name];
                        return cb && cb(err);
                    });                 
                });
            },
            getWorker: function(name, cb) {
                purgeOldWorkers();
                if (actors[name] && workers[actors[name]])
                    cb(null, workers[actors[name]]);
                else 
                    cb(name + (!actors[name] ? ": no such actor" : ": actor is on dead worker"));
            }
        });
        c.pipe(d).pipe(c);

    }
}
