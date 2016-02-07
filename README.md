# meetup-proxy-aws-lambda

A proxy for the [Meetup.com](http://meetup.com) API that lives in AWS Lambda & API Gateway. We're using this to embed the upcoming Open Austin events on our website.

Give our Meetup.com proxy a whirl: https://lhtgmc37pi.execute-api.us-west-2.amazonaws.com/prod/meetup-proxy-aws-lambda.

The reason this project exists is because:

1. The Meetup.com widgets are ugly and only show one event.
2. The Meetup.com API doesn't have a public endpoint to get events for a Meetup.
3. I don't want to expose my Meetup.com API key publicly.

Since my key is in the lambda, you might be able to do something evil with it. But because all this code does is call `/events?group_urlname=Open-Austin`, this should limit the damage. Hopefully.

# Contributing

First installing some things:

```
npm install
```

Add a `src/secrets.json` file that looks like this:

```json
{
    "meetup_api_key": "...................."
}
```

You can get a Meetup.com API key from https://secure.meetup.com/meetup_api/key/.

Then confirm it works:

```
npm run test
```

# Deploying

To update the lambda function first install the AWS-CLI, get AWS credentials from @luqmaan, and then run this:

```
./lambda.sh
```

# Setting up the Lambda & API Gateway project for the first time

If you'd like to copy this lambda to your own AWS account, here's how I did it.

1. Go to AWS Lambda and create a Lambda
2. Use the `microservice-http-endpoint` blueprint.
3. Use the zip file created by running the `./lambda.sh` command.
4. Finish setting up the API Gateway using the defaults.
5. Change the API Gateway settings to not require authentication on the endpoint. I had it sent to IAM and things were sad.
6. Enable CORS to allow requests from any domain.

# Questions

Have a question about this project? Open an issue or contact us on the Open Austin Slack chat. [slack.open-austin.org](http://slack.open-austin.org)

# License

The code for this repository has been released into the public domain by Open Austin via the Unlicense.

Created by @luqmaan.
