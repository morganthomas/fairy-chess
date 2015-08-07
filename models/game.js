var mongoose = require('mongoose');

var gameSchema = mongoose.Schema({
  // A map from the keys white and black to the players' IDs
  players: {
    type: Object,
    required: true
  },

  // A map from piece type names to serial-friendlyized piece types.
  pieceTypes: {
    type: Object,
    required: true
  },

  // The board info. Currently must contain attributes numRows and numCols.
  boardInfo: {
    type: Object,
    required: true
  },

  // A list of all game states that have occurred.
  states: {
    type: Array
  },

  // A list of all moves that have occurred.
  moves: {
    type: Array,
    default: []
  }
});

var Game = mongoose.model('game', gameSchema);
module.exports = Game;
