#!/usr/bin/env node

var net = require('net'),
    argv = require('optimist')
        .describe('listen', "Listening [ip:]port (all ips if unspecified)")
        .describe('registerTimeout', 'Remove workers that dont re-register after timeout (sec)') 
        .default('registerTimeout', 100)
        .demand(['listen'])
        .usage('$0 [options]')
        .argv,
    stractory = require('../lib/stractory.js');

var hostPortParse = function(hostport) {
    var hpArr = hostport.toString().split(':'), 
        hpObj = {host: undefined, port:hpArr[0]};
    if (hpArr.length > 1) hpObj = {host:hpArr[0], port: hpArr[1]};
    return hpObj;
}


var sserver = stractory.server(argv),
    server = net.createServer(sserver);

var hp = hostPortParse(argv.listen);
if (hp.host) server.listen(hp.port, hp.host);
else server.listen(hp.port);

