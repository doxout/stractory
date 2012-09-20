var stractory = require('../lib/stractory.js');

var chatroom = stractory.dnode(function() {
    var people = {};
    var msgs = [];

    var event_callbacks = {};
    return {
        join: function(person) { 
            people[person] = true; 
            if (event_callbacks['join'])
                event_callbacks['join'].forEach(function(cb) { cb(person); });
        },
        part: function(person) { if (people[person]) delete people[person]; },
        on: function(evt, callback) {
           if (!event_callbacks[evt]) event_callbacks[evt] = []; 
           event_callbacks[evt].push(callback); 
        },
        msg: function(person, msg) {
            msgs.push(msg);  
            if (event_callbacks['msg'])
                event_callbacks['msg'].forEach(function(cb) { cb(person, msg); });
        },
        list: function(callback) { callback(people); },
        msglist: function(callback) { callback(msgs); }
    }
});
stractory.client({host: '127.0.0.1', port: 9000}, function(err, strac) {

    strac.create('myroom', chatroom, function(err) { 
        //if (err) throw err;
        strac.get('myroom', function(err, room) {
            if (err) throw err;
            
            room.on('join', function(person) { console.log("*", person, "joined"); });
            room.join("Alex");
            room.join("Nekoj");

            room.on("msg", function(who, msg) {
                console.log("<" + who + ">", msg);
            });

            room.msg("Alex", "Zdravo");
            room.msg("Nekoj", "Zdravo nazad");
            room.list(function(l) { console.log("people", l); });
            room.msglist(function(ml) { console.log("msgs", ml); });
        })
    });
});
