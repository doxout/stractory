
var resolve = require('resolve');

module.exports = function(options) {
    var resolvePaths = options && options.node_modules ? options.node_modules.split(",") : null;
    var resolveCache = {};
    var resolveCached = function(module) {
        var cached = resolveCache[module]
            if (cached) return cached;
            else { 
                resolveCache[module] = cached = resolve.sync(module, 
                        {basedir: process.cwd(), paths: resolvePaths});
                return cached;
            }
    }
    var actor_require = function(id) {
        return require(resolveCached(id));
    };
    for (var key in require) actor_require[key] = require[key];
    actor_require.resolve = resolveCached;
    return function() {
        var sand = {};
        for (var key in global) sand[key] = global[key];
        sand.require = actor_require;
        return sand;
    };
};


