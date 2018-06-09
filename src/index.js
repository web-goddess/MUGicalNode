var request = require('request');
var secrets = require('./secrets.json');

function handler(event, context) {
    var options = {
        url: 'https://api.meetup.com/2/events',
        qs: {
            'group_urlname': 'Syd-Technology-Leaders',
            'key': secrets.meetup_api_key,
        },
    };

    request(options, function(err, res, body) {
        if (err) {
            console.error(err, body);
            return context.fail({error: err});
        }
        if (res.statusCode !== 200) {
            console.error(body);
            return context.fail({error: body});
        }
        try {
            var result = JSON.parse(body);
        }
        catch (e) {
            return context.fail({error: 'Could not parse body: ' + body});
        }
        return context.succeed(result);
    });
}

exports.handler = handler;
