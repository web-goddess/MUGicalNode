var request = require('request');
var secrets = require('./secrets.json');
var AWS = require('aws-sdk');
var QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/613444755180/meetupgroups';
var sqs = new AWS.SQS({region : 'us-east-1'});
var mysql = require('mysql');
var async = require('async');

function handler(event, context, callback) {

  /* var pool  = mysql.createPool({
      host     : secrets.dbhost,
      user     : secrets.dbuser,
      password : secrets.dbpw,
      database : secrets.dbname
    }); */

  async.waterfall([
    getgroup,
    getevents,
    //saveevents,
  ], function (err, result) {
    if (err) {
      console.error(err);
      callback(err);
    } else {
      console.log('All done!');
      callback(null);
    }
  });

  function getgroup(getgroupdone) {
    sqs.receiveMessage({
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: '1'
    }, function(err, data) {
      if (err) {
        console.log("Receive Error", err);
        getgroupdone(err);
      } else if (data.Messages) {
        getgroupdone(null, JSON.parse(data.Messages[0].Body));
      }
    });
  }

  function getevents(group, geteventsdone){
    console.log("Group: " + group);

    var options = {
      url: 'https://api.meetup.com/2/events',
      qs: {
          'group_urlname': group,
          'key': secrets.meetup_api_key,
      },
    }
    request(options, function(err, res, body) {
      if (err) {
        console.log(err);
        geteventsdone(err);
        return;
      }
      if (res.statusCode !== 200) {
        console.log(body);
        geteventsdone('Bad status ' + res.statusCode + ' ' + body);
        return;
      }
      try {
        var meetupevents = JSON.parse(body);
        //console.log(meetupevents);
        //console.log(res.headers);
      }
      catch (e) {
        geteventsdone('Could not parse events body: ' + body);
        return;
      }
      var events = [];
      for (var i = 0, len = meetupevents.results.length; i < len; i++) {
        events.push(meetupevents.results[i]);
      }
      //console.log(events);
      geteventsdone(null, events);
    });
  }
}

exports.handler = handler;
