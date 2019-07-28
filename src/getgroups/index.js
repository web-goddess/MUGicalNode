const request = require('request-promise');
const AWS = require('aws-sdk');
const QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/613444755180/meetupgroups';
const sqs = new AWS.SQS({region : 'us-east-1'});
const ssm = new AWS.SSM({region : 'us-east-1'});

exports.handler = async function(event, context, callback) {
  try {
    let params = {
      Name: 'accessToken',
      WithDecryption: true
    };
    let tokenrequest = await ssm.getParameter(params).promise();
    let access_token = tokenrequest.Parameter["Value"];
    let targetlocation = event.targetlocation || 'Brisbane';
    let options = {
      url: 'https://api.meetup.com/find/groups',
      qs: {
        'country': 'AU',
        'upcoming_events': 'true',
        'access_token': access_token,
        'location': targetlocation + ', Australia',
        'topic_id': '48471,17628,15582,3833,84681,79740,21549,21441,18062,15167,10209,124668,116249,7029',
        //'topic_id': '79740' // testing
      },
    };
    let grouprequest = await request(options);
    if (grouprequest) {
      console.log('Groups Received!');
      var meetupgroups = JSON.parse(grouprequest);
    } else {
      console.log('No response from Meetup');
      throw new Error('No response from Meetup');
    }
    let queuedgroups = meetupgroups.map(function(group) {
      console.log('group: ' + JSON.stringify(group.urlname));
      let params = {
        MessageBody: JSON.stringify({"urlname": group.urlname, "location": targetlocation}),
        QueueUrl: QUEUE_URL
      };
      return sqs.sendMessage(params).promise();
    });
    await Promise.all(queuedgroups);
    context.succeed('Success!');
  } catch (err) {
    return context.fail(err);
  }
}
