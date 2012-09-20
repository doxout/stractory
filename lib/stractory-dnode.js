module.exports = function(options, $init$) {
    if (!$init$) { $init$ = options; options = {} };
    return {
        options: options,
        server:(function(options) { 
            var d = ($init$(options)); 
            return function(client) { 
                client.once("data", function() { 
                    client.pipe(require("dnode")(d)).pipe(client); 
                }); 
            }; 
        }).toString().replace('$init$', $init$.toString()),
        client: function(client, cb) {
            var d = require('dnode')();
            d.once('remote', function(remote) {
                cb(null, remote);
            });
            client.pipe(d).pipe(client);
            client.write("init\n");
        }
    };
};
