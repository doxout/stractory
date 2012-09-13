module.exports = function(options, init) {
    if (!init) { init = options; options = {} };
    return {
        options: options,
        server:['function(options) { var d = (', init.toString(), '(options));',
                'return function(client) { client.pipe(require("dnode")(d)).pipe(client);  } }'].join(''),
        client: function(client, options, cb) {
            var d = require('dnode')();
            d.on('remote', function(remote) { 
                cb(null, remote);
            });
            client.pipe(d).pipe(client);
        }
    };
};
