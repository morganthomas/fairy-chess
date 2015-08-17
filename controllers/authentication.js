var passport = require('passport');
var User = require('../models/user');

var performLogin = function(req, res, next, user){
  req.login(user, function(err){
    if(err) return next(err);
    return res.redirect('/');
  });
};

var authenticationController = {
  login: function(req, res){
    res.render('login', {
      error: req.flash('error')
    });
  },

  processLogin: function(req, res, next){
    var authFunction = passport.authenticate('local', function(err, user, info){
      if(err) return next(err);

      if(!user) {
        req.flash('error', 'Error logging in. Please try again.');
        return res.redirect('/auth/login');
      }

      performLogin(req, res, next, user);
    });

    authFunction(req, res, next);
  },

  processSignup: function(req, res, next){
    var user = new User({
      username: req.body.username,
      password: req.body.password,
      email: req.body.email
    });

    user.save(function(err, user){
      if(err) {
        var errorMessage = 'An error occured, please try again';

        if(err.code === 11000){
          errorMessage = 'This user already exists.';
        }

        req.flash('error', errorMessage);
        return res.redirect('/auth/login');
      }

      performLogin(req, res, next, user);
    });
  },

  logout: function(req, res){
    req.logout();
    res.redirect('/intro');
  }
};

module.exports = authenticationController;
