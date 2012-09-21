module.exports = function(names, obj) {
    var queue = [];
    var self = obj || {};
    var mock = self.mock = {};

    names.forEach(function(name) {
        mock[name] = function() { queue.push({name: name, args: arguments}); }
    });
    self.drain = function(obj) {
        queue.forEach(function(el) {
            obj[el.name].apply(obj, el.args);
        });
        for (var name in mock) {
            mock[name] = obj[name].bind(obj); 
        }
    }
    return self;
};

