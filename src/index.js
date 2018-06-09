var request = require('request');
var secrets = require('./secrets.json');
var icalToolkit = require('ical-toolkit');

//Create a builder
var builder = icalToolkit.createIcsFileBuilder();

/*
 * Settings (All Default values shown below. It is optional to specify)
 * */
builder.spacers = true; //Add space in ICS file, better human reading. Default: true
builder.NEWLINE_CHAR = '\r\n'; //Newline char to use.
builder.throwError = false; //If true throws errors, else returns error when you do .toString() to generate the file contents.
builder.ignoreTZIDMismatch = true; //If TZID is invalid, ignore or not to ignore!

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

            /**
             * Build ICS
             * */

            //Name of calander 'X-WR-CALNAME' tag.
            builder.calname = 'Test Meetup Calendar';

            //Cal timezone 'X-WR-TIMEZONE' tag. Optional. We recommend it to be same as tzid.
            builder.timezone = 'australia/sydney';

            //Time Zone ID. This will automatically add VTIMEZONE info.
            builder.tzid = 'australia/sydney';

            //Method
            builder.method = 'REQUEST';

            var meetupevents = JSON.parse(body);
            var e = meetupevents.results[0];

            //Add events
            builder.events.push({
              //Event start time, Required: type Date()
              start: new Date(e.time),

              //Event end time, Required: type Date()
              end: new Date(),

              //Event summary, Required: type String
              summary: e.group.name,

              //All Optionals Below

              //Event identifier, Optional, default auto generated
              uid: 'event_' + e.id + '@meetup.com',

              //Optional, The sequence number in update, Default: 0
              sequence: null,

              //Location of event, optional.
              location: e.location,

              //Optional description of event.
              description: e.description,

              //Status of event
              status: 'CONFIRMED',

              //Url for event on core application, Optional.
              url: e.event_url
            });

            var result = icalToolkit.parseToJSON(builder.toString());
        }
        catch (e) {
            return context.fail({error: 'Could not parse body: ' + body});
        }
        return context.succeed(result);
    });
}

exports.handler = handler;
