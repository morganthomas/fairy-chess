var User = require('../models/user');
var Challenge = require('../models/challenge');

var gameController = {
  initiateChallenge: function(req, res) {
    User.findOne({ username: req.body.receiver }, function(err, receiver) {
      if (err) {
        res.send("Database error.");
      } else if (!receiver) {
        res.send("User does not exist.")
      } else {
        if (receiver.id === req.user.id) {
          res.send("You cannot challenge yourself to a game!")
        } else {
          var challenge = new Challenge({
            sender: req.user.id,
            receiver: receiver.id
          });

          challenge.save(function(err) {
            if (err) {
              res.send("Database error.");
            } else {
              res.send("Challenge sent!");
            }
          });
        }
      }
    });
  },

  // A function for both withdrawing and rejecting challenges.
  // Takes an argument saying who can do this, and the status that results.
  removeChallenge: function(who, status) {
    return function(req, res) {
      Challenge.findById(req.body.challenge, function(err, challenge) {
        if (err) {
          return res.send("Database error.");
        } else if (!challenge) {
          return res.send("Challenge does not exist.");
        } else {
          console.log(challenge);
          console.log(req.user.id);

          if (!challenge[who].equals(req.user.id)) {
            return res.send("You cannot remove this challenge!");
          }

          challenge.status = status;

          challenge.save(function(err) {
            if (err) {
              return res.send("Database error.");
            }

            res.send("Challenge removed!");
          });
        }
      });
    }
  }
}

module.exports = gameController;
