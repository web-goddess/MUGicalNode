var request = require('request-promise');
var secrets = require('./secrets.json');
var AWS = require('aws-sdk');
var QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/613444755180/meetupgroups';
var sqs = new AWS.SQS({region : 'us-east-1'});

exports.handler = async function(event, context, callback) {
  try {
    var targetlocation = event.targetlocation || 'Sydney';
    var options = {
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
    let grouprequest = await request(options);
    if (grouprequest) {
      console.log('Groups Received!')
      var meetupgroups = JSON.parse(grouprequest);
    } else {
      console.log('No response from Meetup');
      throw new Error('No response from Meetup');
    }
    const queuedgroups = meetupgroups.map(function(group) {
      console.log('group: ' + JSON.stringify(group.urlname));
      var params = {
        MessageBody: JSON.stringify(group.urlname),
        QueueUrl: QUEUE_URL
      };
      sqs.sendMessage(params).promise();
    });
    await Promise.all(queuedgroups);
    context.succeed('Success!');
  } catch (err) {
    return context.fail(err);
  }
}
