var Challenge = require('../models/challenge');
var Game = require('../models/game');

var indexController = {
	index: function(req, res) {
		Challenge.find({
			$and: [{$or: [ { receiver: req.user.id }, { sender: req.user.id } ]},
						 { status: { $in: ['open', 'accepted'] } }]
		  })
			.populate('sender receiver game')
			.exec(function(err, challenges) {
				if (err) { return res.send("Error finding challenges."); }

				var openChallenges = challenges.filter(function(challenge) {
					return challenge.status === 'open';
				});

				var acceptedChallenges = challenges.filter(function(challenge) {
					return challenge.status === 'accepted';
				});

				res.render('index', {
					user: req.user,
					openChallenges: openChallenges,
					acceptedChallenges: acceptedChallenges,
					formatUsername: function(user) {
						return user.id === req.user.id ? 'you' : user.username;
					}
				});
			});
	}
};

module.exports = indexController;
