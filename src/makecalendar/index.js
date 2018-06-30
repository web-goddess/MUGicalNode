var secrets = require('./secrets.json');
var icalToolkit = require('ical-toolkit');
var striptags = require('striptags');
var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB.DocumentClient({region: 'us-east-1'});
var s3 = new AWS.S3();

exports.handler = async function(event, context, callback) {
  try {
    var targetlocation = event.targetlocation || 'Hobart';
    let listofevents = await pullevents(targetlocation);
    if (listofevents.length > 0) {
      let calendar = await createcalendar(listofevents, targetlocation);
      let result = await publishcalendar(calendar, targetlocation);
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
