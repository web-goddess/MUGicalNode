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

  // set up calendar
  builder.calname = 'Test Meetup Calendar';
  builder.timezone = 'australia/sydney';
  builder.tzid = 'australia/sydney';
  builder.method = 'REQUEST';

  // get location from event parameter
  var targetlocation = event.targetlocation;
  console.log('Targetlocation:' + targetlocation);

  // async process
  async.waterfall([
    getgroups,
    //getevents,
    //publishcalendar,
  ], function (err, result) {
    // result now equals 'done'
  });

  function getgroups(callback) {
    var options1 = {
      url: 'https://api.meetup.com/find/groups',
      qs: {
        'country': 'AU',
        'upcoming_events': 'true',
        'key': secrets.meetup_api_key,
        'location': targetlocation + ', Australia',
        //'topic_id': '48471,17628,15582,3833,84681,79740,21549,21441,18062,15167,10209,124668,116249',
        'topic_id': '79740' // testing
      },
    };
    request(options1, function(err, res, body) {
      if (err) {
          console.error(err, body);
          return context.fail({error: err});
      }
      if (res.statusCode !== 200) {
          console.error(body);
          return context.fail({error: body});
      }
      try {
        var meetupgroups = JSON.parse(body);
      }
      catch (e) {
          return context.fail({error: 'Could not parse body: ' + body});
      }
      var groups = [];
      for (var i = 0, len = meetupgroups.length; i < len; i++) {
        groups.push(meetupgroups[i].urlname);
      }
      console.log(groups);
      callback(null, groups);
    });
  }
}

exports.handler = handler;
