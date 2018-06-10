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

function handler(event, context, callback) {

  // get location from event parameter
  var targetlocation = event.targetlocation || 'Sydney';
  console.log('Targetlocation:' + targetlocation);

  // async process
  async.waterfall([
    getgroups,
    geteventsforallgroups,
    createcalendar,
    publishcalendar,
  ], function (err, result) {
    if (err) {
      console.error(err);
      callback(err);
    } else {
      console.log('All done!');
      callback(null);
    }
  });

  function getgroups(getgroupsdone) {
    var options = {
      url: 'https://api.meetup.com/find/groups',
      qs: {
        'country': 'AU',
        'upcoming_events': 'true',
        'key': secrets.meetup_api_key,
        'location': targetlocation + ', Australia',
        'topic_id': '48471,17628,15582,3833,84681,79740,21549,21441,18062,15167,10209,124668,116249',
        //'topic_id': '79740' // testing
      },
    };
    request(options, function(err, res, body) {
      if (err) {
        console.log(err);
        getgroupsdone(err);
        return;
      }
      if (res.statusCode !== 200) {
        console.log(body);
        getgroupsdone('Bad status ' + res.statusCode + ' ' + body);
        return;
      }
      try {
        var meetupgroups = JSON.parse(body);
      }
      catch (e) {
        getgroupsdone('Could not parse groups body: ' + body);
        return;
      }
      var groups = [];
      for (var i = 0, len = meetupgroups.length; i < len; i++) {
        groups.push(meetupgroups[i].urlname);
      }
      getgroupsdone(null, groups);
    });
  }

  function geteventsforallgroups(groups, getalleventsdone) {
    var allevents = new Object();
    async.each(groups, function(group, callback){
      geteventsforgroup(group, allevents, callback);
    }, function(err) {
      if(err) {
        console.log('One of the group requests failed to process');
        getalleventsdone(err);
      } else {
        console.log('All group requests have been processed successfully');
        //console.log(allevents);
        getalleventsdone(null, allevents);
      }
    });
  }

  function geteventsforgroup(group,allevents,getgroupeventsdone){
    //Get events for particular group
    console.log('getting results for ' + group);
    var options = {
        url: 'https://api.meetup.com/2/events',
        qs: {
            'group_urlname': group,
            'key': secrets.meetup_api_key,
        },
    };
    request(options, function(err, res, body) {
      if (err) {
        console.log(err);
        getgroupeventsdone(err);
        return;
      }
      if (res.statusCode !== 200) {
        console.log(body);
        getgroupeventsdone('Bad status ' + res.statusCode + ' ' + body);
        return;
      }
      try {
        var meetupevents = JSON.parse(body);
      }
      catch (e) {
        console.log(body);
        getgroupeventsdone('Could not parse events body: ' + body);
        return;
      }
      allevents[group] = meetupevents;
      getgroupeventsdone();
    });
  }

  function createcalendar(allevents, calendarready) {
    // set up calendar
    builder.calname = 'Test Meetup Calendar';
    builder.timezone = 'australia/sydney';
    builder.tzid = 'australia/sydney';
    builder.method = 'REQUEST';

    var flattenedevents = [];
    Object.values(allevents).forEach(function(element) {
      flattenedevents = flattenedevents.concat(element.results)
    })

    for (var i = 0, len = flattenedevents.length; i < len; i++) {
      var e = flattenedevents[i];
      var description = '';
      var duration = '';

      if (e.status == 'cancelled') {
        description += 'CANCELLED! ';
      }
      if (e.description) {
        description += e.name + ' - ';
        description += striptags(e.description.replace(/\r|\n/, '')).substr(0,250);
        description += '...\n\n'
      }
      description += "Event URL: " + e.event_url;

      if (e.duration) {
  			duration = e.duration;
  		} else {
  			duration = 10800000;
  		}

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
        end: new Date(e.time+duration),

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
    }
    var result = builder.toString();
    calendarready(null, result);
  }

  function publishcalendar(calendar, calendarpublished) {
    var params = {
      Body: calendar,
      Bucket: 'krishoward-temp',
      Key: targetlocation.toLowerCase() + 'mugs.ics',
      ContentType: 'text/calendar'
    };
    s3.putObject(params, function(err) {
     if (err) {
       console.log(err, err.stack);
       calendarpublished(err);
     }
     else {
       console.log(calendar);
       calendarpublished(null, calendar);
    }
   });
  }
}

exports.handler = handler;
