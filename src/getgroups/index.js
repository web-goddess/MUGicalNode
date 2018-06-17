var request = require('request');
var secrets = require('./secrets.json');
var AWS = require('aws-sdk');
var QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/613444755180/meetupgroups';
var sqs = new AWS.SQS({region : 'us-east-1'});

function handler(event, context, callback) {

  // get location from event parameter
  var targetlocation = event.targetlocation || 'Sydney';
  //console.log('Targetlocation:' + targetlocation);

  var options = {
    url: 'https://api.meetup.com/find/groups',
    qs: {
      'country': 'AU',
      'upcoming_events': 'true',
      'key': secrets.meetup_api_key,
      'location': targetlocation + ', Australia',
      'topic_id': '48471,17628,15582,3833,84681,79740,21549,21441,18062,15167,10209,124668,116249',
      //'topic_id': '79740,17628,15582' // testing
    },
  };
  request(options, function(err, res, body) {
    if (err) {
      console.log(err);
      return context.fail(err);
    }
    if (res.statusCode !== 200) {
      console.log(body);
      return context.fail('Bad status ' + res.statusCode + ' ' + body);
    }
    try {
      var meetupgroups = JSON.parse(body);
      for (var i = 0, len = meetupgroups.length; i < len; i++) {
        console.log('group: ' + JSON.stringify(meetupgroups[i].urlname));
        var params = {
          MessageBody: JSON.stringify(meetupgroups[i].urlname),
          QueueUrl: QUEUE_URL
        };
        sqs.sendMessage(params, function(err,data){
          if(err) {
            console.log('error:',"Fail Send Message" + err);
            return;
          }
          console.log('data:',data.MessageId);
        });
      }
    }
    catch (e) {
      return context.fail('Could not parse groups body: ' + body);
    }
    return context.succeed('Success!');
  });
}

exports.handler = handler;
