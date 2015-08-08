var Challenge = require('../models/challenge');
var Game = require('../models/game');
var fs = require('fs');

var indexController = {
	index: function(req, res) {
		res.render('index');
	},

	template: function(req, res) {
		res.render('templates/' + req.params.template);
	}
};

module.exports = indexController;
