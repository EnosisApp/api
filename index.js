var express = require('express');

var fs = require('fs');
var bodyParser = require('body-parser');

var app;

app = module.exports = express();

var cons = require('consolidate');
app.engine('dust', cons.dust);
if (process.env.ENV == 'DEV') {
    cons.dust.debugLevel = 'DEBUG';
}
app.set('view engine', 'dust');

app.use(bodyParser.urlencoded());
app.use(bodyParser.json({
    limit: '50mb'
}));

app.use('/*',function(req,res,next){
    res.header('Access-Control-Allow-Origin' , '*');
    res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE, PUT');
    res.header('Access-Control-Allow-Headers' , '"X-Requested-With, Content-Type, Origin, Authorization, Accept, Client-Security-Token, Accept-Encoding');
    next();
});

app.use('/static', express.static(__dirname + '/public/static'));

app.enable('trust proxy');

fs.readdirSync('./controllers').forEach(function(file) {
    if (file.substr(-3) == '.js') {
        var route = require('./controllers/' + file);
        route.controller(app);
    } else if (file != '.DS_Store') {
        fs.readdirSync('./controllers/' + file).forEach(function(file2) {
            if (file2.substr(-3) == '.js') {
                var route = require('./controllers/' + file + '/' + file2);
                route.controller(app, file);
            }
        });
    }
});

app.on('start', function() {
    console.log('Application ready to serve requests.');
});
