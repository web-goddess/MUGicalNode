const express = require('express')

// Import the axios library, to make HTTP requests
const axios = require('axios')

// This is the client ID and client secret that you obtained
// while registering the application
const clientID = '{key}'
const clientSecret = '{secret}'

const app = express()

// Declare the redirect route
app.get('/oauth/redirect', (req, res) => {
  // The req.query object has the query params that
  // were sent to this route. We want the `code` param
  const requestToken = req.query.code
  console.log('requestToken: ' + requestToken)
  axios({
    // make a POST request
    method: 'post',
    // to the Github authentication API, with the client ID, client secret
    // and request token
    url: `https://secure.meetup.com/oauth2/access?client_id=${clientID}&client_secret=${clientSecret}&grant_type=authorization_code&redirect_uri=http://localhost:8080/oauth/redirect&code=${requestToken}`,
    // Set the content type header, so that we get the response in JSOn
    headers: {
         accept: 'application/json'
    }
  }).then((response) => {
    // Once we get the response, extract the access token from
    // the response body
    const accessToken = response.data.access_token
    const expiry = response.data.expires_in
    const refreshToken = response.data.refresh_token
    console.log('accessToken: ' + accessToken)
    console.log('expiry: ' + expiry)
    console.log('refreshToken: ' + refreshToken)
    // redirect the user to the welcome page, along with the access token
    //res.redirect(`/welcome.html?access_token=${accessToken}`)
  })
})

app.use(express.static(__dirname))
app.listen(8080)
