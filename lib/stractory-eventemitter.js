module.exports = function(options, $init$) {
    if (!$init$) { $init$ = options; options = {} };
    return {
        server: (function(options) {
            var handler = ($init$(options));
            return function(client) {
                var EventEmitter = require('events').EventEmitter,
                    emitStream = require('emit-stream'),
                    JSONStream = require('JSONStream'),
                    EventEmitter = require('events').EventEmitter;

                var recv = emitStream.fromStream(client.pipe(JSONStream.parse([true])));
                var send = new EventEmitter();
                emitStream.toStream(send).pipe(JSONStream.stringify()).pipe(client);
                handler({recv:recv,send:send});
            };
        }).toString().replace("$init$", $init$.toString()),
        client: function(client, cb) {
            var EventEmitter = require('events').EventEmitter,
                emitStream = require('emit-stream'),
                JSONStream = require('JSONStream');
            
            var recv = emitStream.fromStream(client.pipe(JSONStream.parse([true])));
            var send = new EventEmitter();
            emitStream.toStream(send).pipe(JSONStream.stringify()).pipe(client);
            return cb(null, {recv:recv,send:send});
        }
    };
}
