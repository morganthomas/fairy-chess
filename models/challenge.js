var mongoose = require('mongoose');

var challengeSchema = mongoose.Schema({
  sender: {
    type: mongoose.Schema.ObjectID,
    required: true,
    ref: 'user'
  },
  receiver: {
    type: mongoose.Schema.ObjectID,
    required: true
    ref: 'user'
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['open', 'accepted', 'rejected', 'expired'],
    required: true,
    default: 'open'
  },
  game: {
    type: mongoose.Schema.ObjectID,
    required: false,
    ref: 'game'
  }
});

var Challenge = mongoose.model('challenge', challengeSchema);
module.exports = Challenge;
