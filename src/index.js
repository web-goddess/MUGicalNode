var request = require('request');
var secrets = require('./secrets.json');
var icalToolkit = require('ical-toolkit');
var striptags = require('striptags');
var AWS = require('aws-sdk');
var async = require('async');

// get reference to S3 client
var s3 = new AWS.S3();

// get reference to calendar builder
var builder = icalToolkit.createIcsFileBuilder();
builder.spacers = true; //Add space in ICS file, better human reading. Default: true
builder.NEWLINE_CHAR = '\r\n'; //Newline char to use.
builder.throwError = false; //If true throws errors, else returns error when you do .toString() to generate the file contents.
builder.ignoreTZIDMismatch = true; //If TZID is invalid, ignore or not to ignore!

function handler(event, context) {

    //Set up calendar
    builder.calname = 'Test Meetup Calendar';
    builder.timezone = 'australia/sydney';
    builder.tzid = 'australia/sydney';
    builder.method = 'REQUEST';

    //Get Location
    var targetlocation = event.targetlocation;
    console.log('Targetlocation:' + targetlocation);

    //Get events for particular group
    var g = 'Girl-Geek-Sydney';
    var options = {
        url: 'https://api.meetup.com/2/events',
        qs: {
            'group_urlname': g,
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
            console.log('Getting events for ' + g + '\n\n');

            var meetupevents = JSON.parse(body);

            for (var i = 0, len = meetupevents.results.length; i < len; i++) {
              var e = meetupevents.results[i];
              var description = '';

              if (e.status == 'cancelled') {
                description += 'CANCELLED! ';
              }
              if (e.description) {
                description += e.name + ' - ';
                description += striptags(e.description.replace(/\r|\n/, '')).substr(0,250);
                description += '...\n\n'
              }
              description += "Event URL: " + e.event_url;

              if (e.venue.name) {
                location = e.venue.name;
                if (e.venue.address_1) {
                  location += ' (' + e.venue.address_1 + ', ' + e.venue.city + ', ' + e.venue.localized_country_name + ')';
                };
              } else {
                location = 'TBC';
              }

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

                //Location of event, optional.
                location: location,

                //Optional description of event.
                description: description,

                //Status of event
                status: 'CONFIRMED',

                //Url for event on core application, Optional.
                url: e.event_url
              });

              var result = builder.toString();
            }
        }
        catch (e) {
            return context.fail({error: 'Could not parse body: ' + body});
        }
        return context.succeed(result);
    });
}

exports.handler = handler;
