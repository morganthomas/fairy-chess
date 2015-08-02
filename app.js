var express = require('express');
var bodyParser = require('body-parser');
var indexController = require('./controllers/index.js');
var mongoose = require('mongoose');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var flash = require('connect-flash');
var passport = require('passport');
var passportConfig = require('./config/passport');
var indexController = require('./controllers/index');
var authenticationController = require('./controllers/authentication');
var gameController = require('./controllers/game');

mongoose.connect('mongodb://localhost/fairychess');

var app = express();
app.set('view engine', 'jade');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({extended: false}));

app.use(cookieParser());
app.use(flash());

app.use(session({
	secret: 'hairy fairy',
	resave: false,
	saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

app.get('/auth/login', authenticationController.login);
app.post('/auth/login', authenticationController.processLogin);
app.post('/auth/signup', authenticationController.processSignup);
app.get('/auth/logout', authenticationController.logout);

app.post('/game/initiate-challenge', gameController.initiateChallenge);
app.post('/game/withdraw-challenge', gameController.removeChallenge('sender', 'withdrawn'));
app.post('/game/reject-challenge', gameController.removeChallenge('receiver', 'rejected'));

// ***** IMPORTANT ***** //
// By including this middleware (defined in our config/passport.js module.exports),
// We can prevent unauthorized access to any route handler defined after this call
// to .use()
app.use(passportConfig.ensureAuthenticated);

app.get('/', indexController.index);

var server = app.listen(3000, function() {
	console.log('Express server listening on port ' + server.address().port);
});
