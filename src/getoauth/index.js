const AWS = require('aws-sdk');
const request = require('request-promise');
const ssm = new AWS.SSM({region : 'us-east-1'});

exports.handler = async function(event, context, callback) {
  try {
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
    context.succeed('Success!');
  } catch (err) {
    return context.fail(err);
  }
}
