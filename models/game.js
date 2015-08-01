var mongoose = require('mongoose');

var gameSchema = mongoose.Schema({
  // A map from the keys WHITE and BLACK to the players' IDs
  players: {
    type: Object,
    required: true
  },

  // A map from piece type names to serial-friendlyized piece types.
  pieceTypes: {
    type: Object,
    required: true
  },

  // A list of all game states that have occurred.
  states: {
    type: [Object],
    required: true
  },

  // A list of all moves that have occurred.
  moves: {
    type: [Object],
    required: true,
    default: []
  }
});

var Game = mongoose.model('game', gameSchema);
module.exports = Game;
