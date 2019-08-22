const request = require('request-promise');
const AWS = require('aws-sdk');
const QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/613444755180/meetupgroups';
const dynamodb = new AWS.DynamoDB.DocumentClient({region: 'us-east-1'});
const sqs = new AWS.SQS({region : 'us-east-1'});
const ssm = new AWS.SSM({region : 'us-east-1'});

exports.handler = async function(event, context, callback) {
  try {
    let thisgroup = JSON.parse(event.Records[0].body);
    let urlname = thisgroup.urlname;
    let location = thisgroup.location;
    let deletehandle = event.Records[0].receiptHandle;
    if (urlname) {
      let events = await getevents(urlname);
      let result = await saveevents(events, location);
      let deletion = await deletegroup(deletehandle);
    }
    return context.succeed('Success!');
  } catch (err) {
    return context.fail(err);
  }
}

async function getevents(group){
  let params = {
    Name: 'accessToken',
    WithDecryption: true
  };
  let tokenrequest = await ssm.getParameter(params).promise();
  let access_token = tokenrequest.Parameter["Value"];
  let options = {
    url: 'https://api.meetup.com/' + group + '/events',
    qs: {
        'access_token': access_token,
        'page': 10,
    },
    resolveWithFullResponse: true,
  }
  console.log('Requesting events for ', group);
  let meetuprequest = await request(options);
  if (meetuprequest) {
    console.log('Meetup Events Received!')
    let meetupevents = JSON.parse(meetuprequest.body);
    //console.log(meetupevents);
    //console.log('x-ratelimit-limit: ' + meetuprequest.headers['x-ratelimit-limit']);
    console.log('x-ratelimit-remaining: ' + meetuprequest.headers['x-ratelimit-remaining']);
    console.log('x-ratelimit-reset: ' + meetuprequest.headers['x-ratelimit-reset']);
    return meetupevents;
  } else {
    console.log('No response from Meetup');
    throw new Error('No response from Meetup');
  }
}

async function saveevents(listofevents, location) {
  console.log('Count: ' + listofevents.length);
  //Setting deletedate to 12:00:01am tomorrow
  let tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate()+2);
  tomorrow.setHours(0, 0, 1);
  let deleteddate = Math.round(tomorrow.getTime() / 1000);
  if (listofevents.length == 0) {
    console.log('No results to write!');
    return;
  }
  let params = {
    RequestItems: {
      "meetups": []
    }
  };
  listofevents.forEach(event => {
    //console.log(event.id + ' ' + location + ' ' + event + ' ' + deleteddate);
    params.RequestItems.meetups.push( {
      PutRequest: {
        Item: {
          "meetup_id": event.id,
          "location": location,
          "event": JSON.stringify(event),
          "deletedate": deleteddate
        }
      }
    });
  });
  await dynamodb.batchWrite(params).promise()
    .then(function(data) {
      let itemsLost = data.UnprocessedItems;
      if (itemsLost.constructor === Object && Object.keys(itemsLost).length === 0) {
        console.log("DB writes succeeded!");
      } else {
        throw new Error('One event failed!');
      }
    }, function(err) {
      console.log(err);
      throw new Error('All DB writes failed!');
    });
  return;
}

async function deletegroup(deletehandle) {
    let deleteParams = {
    QueueUrl: QUEUE_URL,
    ReceiptHandle: deletehandle
  };
  let deletedgroup = await sqs.deleteMessage(deleteParams).promise();
  if (deletedgroup) {
    console.log('Group Deleted', deletedgroup);
  } else {
    throw new Error('Failed deletion!');
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
