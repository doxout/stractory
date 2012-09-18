#!/usr/bin/env node

var net = require('net'),
    cp = require('child_process'),
    path = require('path'),
    argv = require('optimist')
        .demand(['listen', 'registry'])
        .describe('listen', 'comma-separated list with ip:port or just port of each worker')
        .describe('registry', 'listening ip:port or just port (default ip 127.0.0.1)')
        .describe('respawnDelay', 'wait before respawning dead worker (sec)')
        .default('respawnDelay', 3)
        .describe('workingDir', 'worker working dir (should contain node_modules)')
        .default('workingDir', process.cwd())
        .describe('registerEvery', 'worker will notify stractory that its here every X sec')
        .default('registerEvery',   30)
        .usage('$0 [options]')
        .argv;

var workers = argv.listen.split(',');

var workprocesses = {};
workers.forEach(function(w) {
    var respawn = function() {
        var args = [
            '--listen', w,
            '--registry', argv.registry,
            '--workingDir', argv.workingDir,
            '--registerEvery', argv.registerEvery];
        var worker = cp.spawn(path.join(__dirname, 'stractory-worker.js'), args);
        worker.stdout.pipe(process.stdout);
        worker.stderr.pipe(process.stderr);
        worker.on('exit', function() {
            setTimeout(respawn, argv.respawnDelay * 1000);
        });
        workprocesses[w] = worker;
    }
    respawn();
});

process.on('exit', function() {
    for (var key in workprocesses) 
        workprocesses[key].kill('SIGKILL');
});
