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
      resolveWithFullResponse: true,
    };
    let grouprequest = await request(options);
    if (grouprequest) {
      var meetupgroups = JSON.parse(grouprequest.body);
      console.log(meetupgroups.length + ' groups received!');
      //console.log('x-ratelimit-limit: ' + grouprequest.headers['x-ratelimit-limit']);
      console.log('x-ratelimit-remaining: ' + grouprequest.headers['x-ratelimit-remaining']);
      console.log('x-ratelimit-reset: ' + grouprequest.headers['x-ratelimit-reset']);
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

async function refreshCredentials() {
  let params = {
    Names: [ /* required */
      'clientID',
      'clientSecret',
      'refreshToken'
    ],
    WithDecryption: true
  }
  let paramrequest = await ssm.getParameters(params).promise();
  let authparams = {};
  paramrequest.Parameters.forEach(param => {
    authparams[param.Name] = param.Value;
  });
  let options = {
    url: `https://secure.meetup.com/oauth2/access?client_id=${authparams.clientID}&client_secret=${authparams.clientSecret}&grant_type=refresh_token&refresh_token=${authparams.refreshToken}`,
    headers: {
      accept: 'application/json'
    },
  };
  let refreshrequest = await request.post(options);
  let accessToken = JSON.parse(refreshrequest).access_token;
  params = {
    Name: 'accessToken',
    Type: 'SecureString',
    Value: accessToken,
    Overwrite: true
  };
  let updateTokenrequest = await ssm.putParameter(params).promise();
  return(accessToken);
}
