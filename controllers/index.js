var Challenge = require('../models/challenge');
var Game = require('../models/game');
var fs = require('fs');

var indexController = {
	index: function(req, res) {
		res.render('index');
	},

	intro: function(req, res) {
		res.render('intro');
	},

	rules: function(req, res) {
		res.render('rules');
	},

	template: function(req, res) {
		res.render('templates/' + req.params.template);
	}
};

module.exports = indexController;
