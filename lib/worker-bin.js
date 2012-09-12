
var dnode = require('dnode'),
    net = require('net'),
    url = require('url'),
    argv = require('optimist')
        .demand(['port'])
        .default('ip', '127.0.0.1')
        .default('registry', '127.0.0.1:9000')
        .default('registerEvery', 30)
        .usage('$0 --ip listenip --port listenport --registry ip:port --registerEvery 120')
        .argv;

var worker = require('./worker.js');

try {
    var ip = argv.ip,
        wrkServer = worker.server(argv),
        server = net.createServer(wrkServer),
        reg = argv.registry.split(':'), 
        regadr = {host:'127.0.0.1', port:reg[0]};
    if (reg.length > 1) regadr = {host:reg[0], port: reg[1]};
    
    server.listen(argv.port, ip);
    wrkServer.registry({host:ip, port:argv.port}, regadr, argv.registerEvery);
 }
catch (e) {
    console.log(e);
    process.exit();
}

