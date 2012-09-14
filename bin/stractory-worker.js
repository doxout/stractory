#!/usr/bin/env node

var net = require('net'),
    worker = require('../lib/worker.js'),
    argv = require('optimist')
        .demand(['port', 'registry'])
        .describe('port', 'worker listening port')
        .describe('registry', 'ip:port or just port of the stractory (default ip 127.0.0.1)')
        .default('registerEvery', 30)
        .describe('registerEvery', 'Notify the stractory that we are here every X seconds')
        .usage('$0 --ip listenip --port listenport --registry ip:port --registerEvery seconds')
        .argv;

var wrkServer = worker.server(argv),
    server = net.createServer(wrkServer),
    reg = argv.registry.split(':'), 
    regadr = {host:'127.0.0.1', port:reg[0]};

if (reg.length > 1) regadr = {host:reg[0], port: reg[1]};

if (argv.ip) server.listen(argv.port, ip);
else server.listen(argv.port);

wrkServer.registry({host:argv.ip, port:argv.port}, regadr, argv.registerEvery);

