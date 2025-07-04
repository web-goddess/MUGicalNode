# MUGicalNode

An implementation of my [MUGicalPHP calendar generation script](https://github.com/web-goddess/MUGicalPHP) that runs as a collection of AWS Lambda serverless functions.

Note: calendar links removed as this is no longer running due to Meetup changing their API.

## General
### Installation
The basis for this app came from Open Austin's [meetup-proxy-aws-lambda](https://github.com/open-austin/meetup-proxy-aws-lambda). I've broken it up into four separate lambda functions, each of which lives in its own directory within `src`:

* `src/getcities`
* `src/getgroups`
* `src/getevents`
* `src/makecalendar`

There's also a lambda layer that includes common dependencies:

```
npm install
npm install aws-sdk
npm install request
npm install request-promise
npm install ical-toolkit
npm install striptags
```

There's also a special function that's used for refreshing your Meetup OAuth credentials when needed. It requires a couple other dependencies:

```
npm install express
npm install axios
```

### Getting initial OAuth credentials

As Meetup have deprecated use of simple API keys, we have to jump through a few hoops to get authorised. (I'm indebted to [Soham Kamani's blog post](https://www.sohamkamani.com/blog/javascript/2018-06-24-oauth-with-node-js/) for showing how to do this.) Start by going to Meetup and [creating a new OAuth consumer](https://secure.meetup.com/meetup_api/oauth_consumers/). Set the Redirect URI to `http://localhost:8080/oauth/redirect`. Once you've created the consumer, you'll have a Key and a Secret.

Go to `auth/index.html` and replace `{key}` with the Key for your Meetup consumer app.

Then go to `auth/index.js` and replace `{key}` with the Key and `{secret}` with the Secret for your Meetup consumer app.

Open a terminal and go to the `auth` directory and run `node index.js`. Then open a browser window and visit [http://localhost:8080](http://localhost:8080), where you should see the `index.html` landing page. Click on the “Login with github” link, and youll be redirected to the familiar OAuth page to register with Github. Go ahead and authenticate. Afterwards it'll try to redirect you to [http://localhost:8080/oauth/redirect](http://localhost:8080/oauth/redirect) and just hang since that doesn't exist. However, have a look back in your terminal which should have logged four lines.

**requestToken:** {longcrypticstring}  
**accessToken:** {longcrypticstring}  
**expiry:** 3600  
**refreshToken:** {longcrypticstring}

Copy and paste them all somewhere, and then you can Control-C to kill the webserver.

### Systems Manager

In the AWS console, go to Systems Manager and click on Parameter Store in the menu on the left. You're going to create four new parameters: `accessToken`, `refreshToken`, `clientID`, `clientSecret`. For each one, set Tier as standard and Type as Secure String. Paste the relevant values into the boxes for Value. (`clientID` is your Meetup consumer Key, and `clientSecret` is your Meetup consumer Secret.) You can leave all other fields the same.

### Testing

If you want to test out one of the lambdas, you'll need to first install the [AWS CLI](https://aws.amazon.com/cli/) to your machine.

Then update the `tests/index.js` file to point to the lambda you want to test.

Then just run:

```
npm run test
```

### Deployment

First create the layer for your dependencies. Run `npm run build` which will reinstall any missing dependencies and create a zip file called `mugicalnode-layer.zip`. In the AWS console go to Lambda and then click the Layers option. Create a new layer `MugicalNodeDependencies` with the runtime `Node.js 10.x`. Click the option to upload the zip you just created and save the layer.

Next create the lambda functions. You can just use the "Author from scratch" option for each one and paste in the relevant function. The runtime should be `Node.js 10.x`. The name of each lambda needs to match the name of a folder within `src`. I recommend setting the timeout to 30 seconds for each. (Note: for `makecalendar` you will likely want to bump the memory up to 256MB.)

I recommend setting up a new execution role. You'll need to make sure this role has access to CloudWatch Logs, S3, SQS, Systems Manager parameters (getParameter, get Parameters, and putParameter), and the relevant DynamoDB tables. (See below.)

Make sure your function is set up to use the layer you just created.

Note: if you later update a function locally, you can deploy to AWS by running this command (being sure to substitute in the name of your lambda/folder:

```
./lambda.sh {nameoflambda}
```

## /src/getcities

This lambda gets a list of cities from a database table. It's used by a Step Function that we'll define later...

### Setup
* You need to create a DynamoDB table called `appconfig` with the primary partition name `appname` (String) and primary sort key `my_key` (String).
* You will then create an item in the table that consists of a list of cities. The JSON is defined in `ddb-cities.json`. Just create an item and select the option for "Text" and "DynamoDB JSON." Then you can paste in the JSON from the file.

## /src/getgroups

This lambda gets all the meetup groups associated with various topics in a given location and sends them to an SQS queue. It's triggered as part of the Step Function we'll define.

### Setup
* You need to create an SQS queue called `meetupgroups`.
  * The retention period on the queue is set to 23 hours, which ensures that if something goes wrong, it gets purged before it runs again the next day.
  * The default visibility timeout on the queue is set to 1 minute.
  * In the Redrive policy, set the Maximum Receives to 20 and set a dead letter queue for any groups that fail.
* Update the `QUEUE_URL` in the lambda function to match the URL of your queue.
* Make sure the region in the lambda matches the one where you set up your SQS queue and your parameter store!
* Make sure your lambda execution role has permissions to access the parameter store!
* You also need to add the list of topics as an item to your `appconfig` DynamoDB table. The JSON is defined in `ddb-topics.json`. Just create an item and select the option for "Text" and "DynamoDB JSON." Then you can paste in the JSON from the file.

## /src/getevents

This lambda retrieves a group from the queue and then calls the Meetup API to retrieve its upcoming events. These are saved to a DynamoDB database. This lambda is triggered from the `meetupgroups` SQS queue. Events will be deleted from the database a day after they finish.

TODO: if authorisation fails, refresh accessToken with Meetup...

### Setup
* You need to create a DynamoDB table called `meetups`.
  * You should enable the `Time to live attribute` and set the TTL attribute to `deletedate`.
* Make sure the regions in the lambda matches where you set up your SQS queue, DynamoDB, and your parameter store!
* Make sure your lambda execution role has permissions to access the parameter store!
* Create a trigger on the lambda that uses the SQS queue `meetupgroups`. Set the batch size to 1.

## /src/makecalendar

This lambda retrieves all the events for a given location from the database and turns them into two iCal calendars: one with lots of separate events and a digest that has one all-day event per day. These are uploaded to S3. This will be triggered from another Step Function that we'll set up shortly.

### Setup
* You need to create an S3 bucket to write to.
* Make sure the region in the lambda matches the one where you set up your DynamoDB table!

## Step Functions

To trigger these lambdas to run, we're going to set up two Step Functions (state machines).

### MUGicalNode
Create a State Machine called 'MUGicalNode' using the 'Author with Code Snippets' option, and for the definition paste in the Amazon States Language from `sf-mugicalnode.txt`. You'll need to change the resource definitions to point your `getcities` and `getgroups` lambdas. It will call the `getcities` lambda, and then loop through it calling `getgroups` on each city.

### MUGicalNode-Calendar
Create a State Machine called 'MUGicalNode-Calendar' using the 'Author with Code Snippets' option, and for the definition paste in the Amazon States Language from `sf-mugicalnodecal.txt`. You'll need to change the resource definitions to point your `getcities` and `makecalendar` lambdas. It will call the `getcities` lambda, and then loop through it calling `makecalendar` on each city.

## CloudWatch Rules

To actually kick off the Step Functions, you need to create two CloudWatch Rules.

* Create a Rule called 'MUGicalNode' using the 'Schedule' option and enter `0 1 * * ? *` as the cron expression. This will run every day at 1am. Change the target to Step Functions state machine and select the 'MUGicalNode' state machine you created in the previous step.
* Create a Rule called 'MUGicalNodeCalendar' using the 'Schedule' option and enter `00 23 * * ? *` as the cron expression. This will run every night at 11pm. Change the target to Step Functions state machine and select the 'MUGicalNode-Calendar' state machine you created in the previous step.

And that's it!

# License

The code for this repository has been released into the public domain by Kristine Howard via the Unlicense.

Originally based on Open Austin's [meetup-proxy-aws-lambda](https://github.com/open-austin/meetup-proxy-aws-lambda).

Created by [@web-goddess](https://github.com/web-goddess).
