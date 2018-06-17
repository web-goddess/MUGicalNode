# MUGicalNode

An attempt to implement my [MUGicalPHP calendar generation script](https://github.com/web-goddess/MUGicalPHP) to run as a collection of AWS Lambda serverless functions.

## /src/MUGicalNode

My first attempt at a direct implementation of the old version. It works, but the MeetupAPI really, _really_ doesn't like me hitting their API so much.

## /src/getgroups

Breaking out the first step - getting all the meetup groups associated with various topics in a given location and sending them to an SQS queue. I plan to run this once per day and set the queue retention period to 23 hours.

## To Do

[] Implement a "getevents" Lambda that gets the events for each group in the queue and inserts them into a database. I plan to run this every few minutes throughout the day.
[] Implement a "createcalender" Lambda that processes the database once per day and creates calendars for each city. These will be published on S3 and then the database purged.

# License

The code for this repository has been released into the public domain by Kristine Howard via the Unlicense.

Originally based on Open Austin's [meetup-proxy-aws-lambda](https://github.com/open-austin/meetup-proxy-aws-lambda).

Created by [@web-goddess](https://github.com/web-goddess).
