var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var User = require('../models/user');

passport.serializeUser(function(user, done){
  done(null, user.id);
});

passport.deserializeUser(function(id, done){
  User.findById(id, function(err, user){
    done(err, user);
  });
});

var localStrategy = new LocalStrategy(function(username, password, done){
  User.findOne({username: username}, function(err, user){
    if(err) return done(err);

    if(!user) return done(null, false);

    user.comparePassword(password, function(err, isMatch){
      if(err) return done(err);

      if(isMatch){
        return done(err, user);
      } else {
        return done(null, false);
      }
    });
  });
});

passport.use(localStrategy);


// We don't really need to export anything from this file, since just
// including it is enough. However, this helpful middleware allows us
// to block access to routes if the user isn't authenticated by redirecting
// them to the login page.
module.exports = {
  ensureAuthenticated: function(req, res, next){
    if(req.isAuthenticated()){
      return next();
    }

    res.redirect('/auth/login');
  }
};
