#!/usr/bin/env node

var net = require('net'),
    argv = require('optimist')
        .describe('ip', "Listening ip (all if unspecified)")
        .describe('port', "Listening port")
        .describe('registerTimeout', 'Remove workers that dont re-register after timeout (seconds)') 
        .default('registerTimeout', 100)
        .demand(['port'])
        .usage('$0 --ip listenip --port listenport --registerTimeout seconds')
        .argv,
    stractory = require('../lib/stractory.js');

var sserver = stractory.server(argv),
    server = net.createServer(sserver);

if (argv.ip) server.listen(argv.port, ip);
else server.listen(argv.port);

