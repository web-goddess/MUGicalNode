var secrets = require('./secrets.json');
var icalToolkit = require('ical-toolkit');
var striptags = require('striptags');
var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB.DocumentClient({region: 'us-east-1'});
var s3 = new AWS.S3();

exports.handler = async function(event, context, callback) {
  try {
    var targetlocation = event.targetlocation || 'Melbourne';
    let listofevents = await pullevents(targetlocation);
    if (listofevents.length > 0) {
      let calendar = await createcalendar(listofevents, targetlocation);
      let digest = await createdigest(listofevents, targetlocation);
      let result = await publishcalendar(calendar, targetlocation);
      let digestresult = await publishdigest(digest, targetlocation);
      return context.succeed('Success!');
    } else {
      return context.fail('No events in the DB for ' + targetlocation);
    }
  } catch (err) {
    return context.fail(err);
  }
}

async function pullevents(targetlocation) {
  console.log('Retrieving events for ' + targetlocation);
  let eventslist = new Array();
  var params = {
    TableName : 'meetups',
    KeyConditionExpression: '#loc = :location',
    ExpressionAttributeNames:{
      '#loc': 'location'
    },
    ExpressionAttributeValues: {
      ':location': targetlocation
    }
  };
  var data = await dynamodb.query(params).promise();
  while (data.Items) {
    data.Items.forEach(event => {
      eventslist.push(event.event);
    });
    if(data.LastEvaluatedKey) {
      //console.log("Loop! Not done yet!");
      params.ExclusiveStartKey = data.LastEvaluatedKey;
      data = await dynamodb.query(params).promise();
    } else {
      //console.log("Loop is done!");
      break;
    }
  }
  console.log("Count of events: " + eventslist.length);
  return eventslist;
}

async function createcalendar(allevents, city) {
  // set up calendar
  var builder = icalToolkit.createIcsFileBuilder();
  builder.calname = city + ' Meetup Calendar';
  builder.timezone = 'australia/' + city.toLowerCase();
  builder.tzid = 'australia/' + city.toLowerCase();
  builder.method = 'REQUEST';

  for (var i = 0, len = allevents.length; i < len; i++) {
    var e = allevents[i];
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

    if (e.venue && e.venue.name) {
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
  console.log('Calendar is ready!');
  return builder.toString();
}

async function createdigest(allevents, city) {
  // set up calendar
  var builder = icalToolkit.createIcsFileBuilder();
  builder.calname = city + ' Meetup Digest Calendar';
  builder.timezone = 'australia/' + city.toLowerCase();
  builder.tzid = 'australia/' + city.toLowerCase();
  builder.method = 'REQUEST';

  var dayevents = {};

  for (var i = 0, len = allevents.length; i < len; i++) {

    var e = allevents[i];
    var eventdate = new Date(e.time);
    eventdate = eventdate.toLocaleDateString('en-US', {timeZone: 'Australia/' + city});
    if (!dayevents[eventdate]) {
      dayevents[eventdate] = [];
    }
    dayevents[eventdate].push(e);
  }

  for (var day in dayevents) {
    var startdate = '';
    var daydescription = '';
    dayevents[day].sort(function (a, b) {
      return a.time - b.time;
    });
    for (var i = 0, len = dayevents[day].length; i < len; i++) {
      var m = dayevents[day][i];
      var mdate = new Date(m.time);
      var mtime = mdate.toLocaleTimeString('en-AU', {timeZone: 'Australia/' + city.toLowerCase()});
      daydescription += mtime + ' ' + m.group.name + ' ' + m.event_url;
      daydescription += '\n\n';
      if (!startdate) {
        var parts = day.split('/');
        startdate = new Date(Date.UTC(parts[2], parts[0]-1, parts[1]));
      }
    }
    //Add events
    builder.events.push({
      //Event start time, Required: type Date()
      start: startdate,

      //Event end time, Required: type Date()
      end: startdate,

      //All Day flag
      allDay: true,

      //Event summary, Required: type String
      summary: 'Today\'s Tech Meetups',

      //All Optionals Below

      //Optional description of event.
      description: daydescription,

      //Status of event
      status: 'CONFIRMED',
    });
  }
  console.log('Digest is ready!');
  return builder.toString();
}

async function publishcalendar(calendar, city) {
  var params = {
    Body: calendar,
    Bucket: 'krishoward.org',
    Key: city.toLowerCase() + 'mugs.ics',
    ContentType: 'text/calendar'
  };
  await s3.putObject(params).promise()
  .then(function(data) {
    console.log("Upload succeeded!");
  }, function(err) {
    console.log(err);
    throw new Error('Upload failed!');
  });
  return;
}

async function publishdigest(calendar, city) {
  var params = {
    Body: calendar,
    Bucket: 'krishoward.org',
    Key: city.toLowerCase() + 'mugs-digest.ics',
    ContentType: 'text/calendar'
  };
  await s3.putObject(params).promise()
  .then(function(data) {
    console.log("Upload succeeded!");
  }, function(err) {
    console.log(err);
    throw new Error('Upload failed!');
  });
  return;
}

function addhours(date, hours) {
    return new Date(date.getTime() + hours*60*60000);
}
