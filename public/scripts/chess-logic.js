if (typeof window === 'undefined') {
  var _ = require('./lib/lodash.js');
}

var getSquare = function(board, loc) {
  return board[loc.row][loc.col];
}

var setSquare = function(board, loc, val) {
  board[loc.row][loc.col] = val;
}

// XXX
var makeInitialState = function(pieceTypes, boardInfo) {
  var board = [];

  for (var i = 0; i < boardInfo.numRows; i++) {
    board[i] = [];

    for (var j = 0; j < boardInfo.numCols; j++) {
      board[i][j] = null;
    }
  }

  var dummyPiece = { type: null, color: null, loc: { row: 0, col: 0 } };

  setSquare(board, { row: 7, col: 0 }, dummyPiece);

  var state = {
    board: board,
    playerToMove: 'white',
    status: 'not over',
    capturedPieces: []
  }

  return state;
}

var getCurrentState = function(game) {
  return game.states[game.states.length - 1];
}

// Returns a new game object, given the two players.
var generateGame = function(player1, player2) {
  var shuffledPlayers = _.shuffle([player1, player2]);
  var players = {};
  players.white = shuffledPlayers[0];
  players.black = shuffledPlayers[1];

  // XXX
  var boardInfo = {
    numRows: 8,
    numCols: 8
  };

  // XXX
  var pieceTypes = {};

  return {
    players: players,
    pieceTypes: pieceTypes,
    boardInfo: boardInfo,
    states: [makeInitialState(pieceTypes, boardInfo)], // XXX
    moves: []
  };
}

// Calls the given function on each location in the given board.
var forEachLoc = function(board, callback) {
  for (var row = 0; row < board.length; row++) {
    for (var col = 0; col < board[row].length; col++) {
      callback({ row: row, col: col });
    }
  }
}

if (typeof window === 'undefined') {
  module.exports = {
    generateGame: generateGame
  };
}
