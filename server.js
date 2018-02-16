var https = require('https');
var fs = require('fs');

var express = require('express');

var app = require('./index');
var server;

// server = https.createServer({
//     key: fs.readFileSync(process.env.SSL_KEY_PATH),
//     cert: fs.readFileSync(process.env.SSL_CERT_PATH)
// }, app).listen(process.env.PORT || 8000);

// server.on('listening', function() {
//     console.log('Server HTTPS listening on https://localhost:%d', this.address().port);
// });

var appHTTP = express();
appHTTP.use(app);
var serverHTTP = require('http').createServer(appHTTP).listen(8080);
serverHTTP.on('listening', function() {
    console.log('Server HTTP listening on http://localhost:%d', this.address().port);
});
