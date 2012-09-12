var through = require('through');

module.exports = function() {
    var works = true;
    var self = through(function(data) {
        if (works) this.emit('data', data);
    });
    self.off = function() { works = false; };
    return self;
};
