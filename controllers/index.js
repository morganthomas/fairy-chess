var Challenge = require('../models/challenge');

var indexController = {
	index: function(req, res) {
		Challenge.find({
			$and: [{$or: [ { receiver: req.user.id }, { sender: req.user.id } ]},
						 { status: 'open' }]
		  })
			.populate('sender').populate('receiver')
			.exec(function(err, openChallenges) {
				if (err) { return res.send("Error finding challenges."); }

				res.render('index', {
					user: req.user,
					openChallenges: openChallenges
				});
			});
	}
};

module.exports = indexController;
