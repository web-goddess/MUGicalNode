var request = require('request-promise');
var secrets = require('./secrets.json');
var AWS = require('aws-sdk');
var QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/613444755180/meetupgroups';
var sqs = new AWS.SQS({region : 'us-east-1'});
var pool = require('./database')
var mysql = require('mysql')

exports.handler = async function(event, context, callback) {
  try {
    let group = await getgroup();
    let events = await getevents(group);
    let result = await saveevents(events);
    return context.succeed('Success!');
  } catch (err) {
    return context.fail(err);
  } finally {
    pool.end(function (err) {
      // all connections in the pool have ended
    });
  }
}

async function getgroup() {
  let data = await sqs.receiveMessage({
    QueueUrl: QUEUE_URL,
    MaxNumberOfMessages: '1'
  }).promise();
  if (data.Messages) {
    var group = JSON.parse(data.Messages[0].Body);
    console.log('SQS Message Received: ', group);
  } else {
    throw new Error('Nothing in queue!');
  }
  let deleteParams = {
    QueueUrl: QUEUE_URL,
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
  const queries = listofevents.results.map(function(event) {
    var sql = "INSERT INTO meetupevents (meetupevents_data) VALUES (?)";
    var inserts = [JSON.stringify(event)];
    sql = mysql.format(sql, inserts);
    return pool.query(sql);
  });
  await Promise.all(queries);
  console.log('DB writes done!');
  return;
}
