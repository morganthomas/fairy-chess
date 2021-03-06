var mongoose = require('mongoose');

var challengeSchema = mongoose.Schema({
  sender: {
    type: mongoose.Schema.ObjectId,
    required: true,
    ref: 'user'
  },
  receiver: {
    type: mongoose.Schema.ObjectId,
    required: true,
    ref: 'user'
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  status: {
    type: String,
    // We say that a challenge is "active" if it is either open or accepted, and
    // "inactive" otherwise.
    enum: ['open', 'accepted', 'rejected', 'expired', 'withdrawn', 'completed'],
    required: true,
    default: 'open'
  },
  game: {
    type: mongoose.Schema.ObjectId,
    required: false,
    ref: 'game'
  }
});

var Challenge = mongoose.model('challenge', challengeSchema);
module.exports = Challenge;
