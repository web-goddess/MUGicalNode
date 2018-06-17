var request = require('request');
var secrets = require('./secrets.json');
var AWS = require('aws-sdk');
var QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/613444755180/meetupgroups';
var sqs = new AWS.SQS({region : 'us-east-1'});
var async = require('async');

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
    }
    catch (e) {
      return context.fail('Could not parse groups body: ' + body);
    }
    async.each(meetupgroups, function(group, groupdone){
      console.log('group: ' + JSON.stringify(group.urlname));
      var params = {
        MessageBody: JSON.stringify(group.urlname),
        QueueUrl: QUEUE_URL
      };
      sqs.sendMessage(params, function(err,data){
        if(err) {
          console.log('error:',"Fail Send Message" + err);
        } else {
          console.log('data:',data.MessageId);
        }
        groupdone(err);
      });
    }, function(err){
      if(err) {
        console.log('One of the messages failed to send');
        return context.fail(err);
      } else {
        return context.succeed('Success!');
      }
    });
  });
}

exports.handler = handler;
