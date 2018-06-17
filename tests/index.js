var handler = require('../src/getgroups');

var event = {};
var context = {
    fail: function() {
        console.log('FAIL', arguments);
    },
    succeed: function() {
        console.log('SUCCEED', arguments);
    }
}

handler.handler(event, context, function (err) { });
