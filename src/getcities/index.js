const request = require('request-promise');
const AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB.DocumentClient({region: 'us-east-1'});

exports.handler = async function(event, context, callback) {
  try {
    // Retrieve cities list from database
    var configparams = {
      TableName : 'appconfig',
      KeyConditionExpression: 'appname = :appname AND my_key = :my_key',
      ExpressionAttributeValues: {
        ':appname': 'mugicalnode',
        ':my_key': 'cities'
      }
    };
    let cities = await dynamodb.query(configparams).promise();
    let citieslist = cities.Items[0].my_values.values;
    citieslist.push("Done");
    context.succeed(citieslist);
  } catch (err) {
    return context.fail(err);
  }
}
