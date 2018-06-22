var request = require('request-promise');
var secrets = require('./secrets.json');
var AWS = require('aws-sdk');
var sqs = new AWS.SQS({region : 'us-east-1'});

exports.handler = async function(event, context, callback) {
  try {
    let group = await getgroup();
    if (group) {
      let events = await getevents(group);
      let result = await saveevents(events);
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
  let deleteParams = {
    QueueUrl: 'https://sqs.us-east-1.amazonaws.com/613444755180/meetupgroups',
    ReceiptHandle: data.Messages[0].ReceiptHandle
  };
  let deletedgroup = await sqs.deleteMessage(deleteParams).promise();
  if (deletedgroup) {
    console.log('Message Deleted', deletedgroup);
  } else {
    throw new Error('Failed deletion!');
  }
  return group;
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
    var city = event.venue.city.substring(0,3);
    var queue_url = 'https://sqs.us-east-1.amazonaws.com/613444755180/meetups' + city;
    var params = {
      MessageBody: JSON.stringify(event),
      QueueUrl: queue_url
    };
    return sqs.sendMessage(params).promise();
  });
  //await Promise.all(queuedevents);
  console.log('SQS logging done!');
  return;
}
