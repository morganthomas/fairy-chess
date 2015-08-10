if (typeof window === 'undefined') {
  var _ = require('./lib/lodash.js');
}

var getSquare = function(board, loc) {
  return board[loc.row][loc.col];
}

var setSquare = function(board, loc, val) {
  board[loc.row][loc.col] = val;
}

// Calls the given function on each location in the given board.
var forEachLoc = function(board, callback) {
  for (var row = 0; row < board.length; row++) {
    for (var col = 0; col < board[row].length; col++) {
      callback({ row: row, col: col });
    }
  }
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
  return game.states[getCurrentStateIndex(game)];
}

var getCurrentStateIndex = function(game) {
  return game.states.length - 1;
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

// Given a game and a move (which is assumed to be legal), performs the move
// and updates the game accordingly.
var executeMove = function(game, move) {
  if (move.template === 'dummy') {
    var state = getCurrentState(game);
    var newState = _.cloneDeep(state);
    var newPiece = _.clone(getSquare(state.board, move.params.from));
    setSquare(newState.board, move.params.from, null);
    setSquare(newState.board, move.params.to, newPiece);
    game.states.push(newState);
    game.moves.push(move);
  }
}

// Given a game and a move, says whether the move is legal in the current state.
var moveIsLegal = function(game, move) {
  // XXX
  return true;
}

//
// Node exports
//

if (typeof window === 'undefined') {
  module.exports = {
    generateGame: generateGame,
    moveIsLegal: moveIsLegal,
    executeMove: executeMove
  };
}
