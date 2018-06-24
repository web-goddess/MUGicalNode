var request = require('request-promise');
var secrets = require('./secrets.json');
var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB.DocumentClient({region: 'us-east-1'});
var sqs = new AWS.SQS({region : 'us-east-1'});

exports.handler = async function(event, context, callback) {
  try {
    let group = await getgroup();
    if (group.group) {
      let events = await getevents(group.group);
      let result = await saveevents(events);
      let deletion = await deletegroup(group.deletehandle);
    }
    return context.succeed('Success!');
  } catch (err) {
    return context.fail(err);
  }
}

async function getgroup() {
  let data = await sqs.receiveMessage({
    QueueUrl: 'https://sqs.us-east-1.amazonaws.com/613444755180/meetupgroups',
    MaxNumberOfMessages: '1'
  }).promise();
  if (data.Messages) {
    var group = JSON.parse(data.Messages[0].Body);
    console.log('SQS Message Received: ', group);
  } else {
    //console.log('Nothing in queue!');
    return;
  }
  return {"group": group, "deletehandle": data.Messages[0].ReceiptHandle};
}

async function getevents(group){
  let options = {
    url: 'https://api.meetup.com/2/events',
    qs: {
        'group_urlname': group,
        'key': secrets.meetup_api_key,
        'page': 10,
    },
  }
  console.log('Requesting events for ', group);
  let meetuprequest = await request(options);
  if (meetuprequest) {
    console.log('Meetup Events Received!')
    var meetupevents = JSON.parse(meetuprequest);
    //console.log(meetupevents);
    return meetupevents;
  } else {
    console.log('No response from Meetup');
    throw new Error('No response from Meetup');
  }
}

async function saveevents(listofevents) {
  console.log('Count: ' + listofevents.results.length);
  const queuedevents = listofevents.results.map(function(event) {
    var params = {
      Item: {
       "meetupid": event.id,
       "event": event
      },
      TableName: "meetupevents"
     };
    return dynamodb.put(params).promise();
  });
  await Promise.all(queuedevents)
    .then(success => {
      console.log('DB writes done!');
    }, error => {
      console.log(error)
    });
  return;
}

async function deletegroup(deletehandle) {
    let deleteParams = {
    QueueUrl: 'https://sqs.us-east-1.amazonaws.com/613444755180/meetupgroups',
    ReceiptHandle: deletehandle
  };
  let deletedgroup = await sqs.deleteMessage(deleteParams).promise();
  if (deletedgroup) {
    console.log('Group Deleted', deletedgroup);
  } else {
    throw new Error('Failed deletion!');
  }
}
