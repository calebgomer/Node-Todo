// Auth URL definitions
var LOGGED_IN_HOME_PATH = '/';
var LOGGED_OUT_HOME_PATH = '/';
var BASE_DEBUG_URL = 'http://localhost:3000';
var LOGIN_PATH = '/login';
var LOGIN_PATH_GOOGLE = '/login/google';
var LOGIN_CALLBACK_PATH = '/login/google/return';
var LOGOUT_PATH = '/logout';

function getCallbackUrl() {
  return getRealm() + LOGIN_CALLBACK_PATH;
}

function getRealm() {
  return process.env.APP_URL || BASE_DEBUG_URL;
}

var express = require('express')
  , http = require('http')
  , passport = require('passport')
  , util = require('util')
  , GoogleStrategy = require('passport-google').Strategy
  , mongodb = require('mongodb');


// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Google profile is serialized
//   and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


// Use the GoogleStrategy within Passport.
//   Strategies in passport require a `validate` function, which accept
//   credentials (in this case, an OpenID identifier and profile), and invoke a
//   callback with a user object.
passport.use(new GoogleStrategy({
    returnURL: getCallbackUrl(),
    realm: getRealm()
  },
  function(identifier, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {
      
      // To keep the example simple, the user's Google profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the Google account with a user record in your database,
      // and return that user instead.
      profile.identifier = identifier;
      return done(null, profile);
    });
  }
));




var app = express();

// configure Express
app.configure(function() {
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.logger());
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.session({ secret: 'keyboard cat' }));
  // Initialize Passport!  Also use passport.session() middleware, to support
  // persistent login sessions (recommended).
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);
  app.use(express.static(__dirname + '/../../public'));
});


app.get('/', function(req, res){
  res.render('home', { user: req.user });
});

app.get('/account', ensureAuthenticated, function(req, res){
  res.render('account', { user: req.user });
});

app.get(LOGIN_PATH, function(req, res){
  res.render('login', { user: req.user });
});

// GET /auth/google
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Google authentication will involve redirecting
//   the user to google.com.  After authenticating, Google will redirect the
//   user back to this application at /auth/google/return
app.get(LOGIN_PATH_GOOGLE, 
  passport.authenticate('google', { failureRedirect: LOGIN_PATH }),
  function(req, res) {
    res.redirect(LOGGED_IN_HOME_PATH);
  });

// GET /auth/google/return
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get(LOGIN_CALLBACK_PATH, 
  passport.authenticate('google', { failureRedirect: LOGIN_PATH }),
  function(req, res) {
    res.redirect(LOGGED_IN_HOME_PATH);
  });

app.get(LOGOUT_PATH, function(req, res){
  req.logout();
  res.redirect(LOGGED_OUT_HOME_PATH);
});

var server = http.createServer(app);
server.listen(app.get('port'), function() {
  console.log("ready on port " + app.get('port'));
});


// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect(LOGIN_PATH);
}
