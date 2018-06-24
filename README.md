# MUGicalNode

An attempt to implement my [MUGicalPHP calendar generation script](https://github.com/web-goddess/MUGicalPHP) to run as a collection of AWS Lambda serverless functions.

## /src/getgroups

This lambda gets all the meetup groups associated with various topics in a given location and sends them to an SQS queue. This runs once per day at 1am.

### Setup
* You need to create an SQS queue called `meetupgroups`.
  * The retention period on the queue is set to 23 hours, which ensures that if something goes wrong, it gets purged before it runs again the next day.
  * The default visibility timeout on the queue is set to 5 minutes.
  * After 3 failed attempts to retrieve events, the group is sent to a dead letter queue.
* You need to set up a CloudWatch rule for each city to trigger the lambda to run on a cron schedule.
  * The target should be set to your lambda function.
  * You should configure the input to pass in a constant (JSON text): `{"targetlocation": "Brisbane"}`

## /src/getevents

This lambda retrieves a group from the queue and then calls the Meetup API to retrieve its upcoming events. These are saved to a DynamoDB database. This runs every minute, all the time.

### Setup
* You need to create a DynamoDB table called `meetups`.
  * You should enable the `Time to live attribute` and set the TTL attribute to `deletedate`.
* You need to set up a CloudWatch rule to trigger the lambda to run every minute.
  * The target should be set to your lambda function.

## /src/makecalendar

This lambda retrieves all the events for a given location from the database and turns them into an iCal calendar. That's uploaded to S3. This runs once per day at 11pm.

### Setup
* You need to create an S3 bucket to write to.
* You need to set up a CloudWatch rule for each city to trigger the lambda to run on a cron schedule.
  * The target should be set to your lambda function.
  * You should configure the input to pass in a constant (JSON text): `{"targetlocation": "Brisbane"}`


## /src/MUGicalNode - DEPRECATED

My first attempt at a direct implementation of the old version. It works, but the MeetupAPI really, _really_ doesn't like me hitting their API so much.

# License

The code for this repository has been released into the public domain by Kristine Howard via the Unlicense.

Originally based on Open Austin's [meetup-proxy-aws-lambda](https://github.com/open-austin/meetup-proxy-aws-lambda).

Created by [@web-goddess](https://github.com/web-goddess).
