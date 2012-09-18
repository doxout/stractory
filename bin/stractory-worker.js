#!/usr/bin/env node

var net = require('net'),
    worker = require('../lib/worker.js'),
    argv = require('optimist')
        .demand(['listen', 'registry'])
        .describe('listen', 'listening ip:port or just port (default ip 127.0.0.1)')
        .describe('registry', 'stractory ip:port or just port (default ip 127.0.0.1)')
        .describe('workingDir', 'working directory (should contain node_modules)')
        .default('workingDir', process.cwd())
        .describe('registerEvery', 'Notify the stractory that we are here every X seconds')
        .default('registerEvery', 30)
        .usage('$0 [options]')
        .argv;

var hostPortParse = function(hostport) {
    var hpArr = hostport.toString().split(':'), 
        hpObj = {host: undefined, port:hpArr[0]};
    if (hpArr.length > 1) hpObj = {host:hpArr[0], port: hpArr[1]};
    return hpObj;
}

var wrkServer = worker.server(argv),
    server = net.createServer(wrkServer),
    regadr = hostPortParse(argv.registry),
    listadr = hostPortParse(argv.listen);

server.listen(listadr.port, listadr.host);

regadr.host = regadr.host || '127.0.0.1';
wrkServer.registry(listadr, regadr, argv.registerEvery);

