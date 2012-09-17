module.exports = function(cmd, args, client) {
    return {
        options: {cmd: cmd, args: args},
        server: function(opt) {
            var cp = require('child_process');
            var proc = cp.spawn(opt.cmd, opt.args);
            var ret = function(client) {
                client.pipe(proc.stdin);
                proc.stdout.pipe(client);
            }
            ret.destroy = function() { 
                proc.kill('SIGKILL'); 
            }
            return ret;
        },
        client: client
    };
}
