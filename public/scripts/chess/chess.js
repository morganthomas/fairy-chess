///////////////////////////////////////////////////////////////////////////////
// Node imports
///////////////////////////////////////////////////////////////////////////////

if (typeof window === 'undefined') {
  var _ = require('../lib/lodash.js');
}

///////////////////////////////////////////////////////////////////////////////
//
// Basic types:
//  * A location is an object with properties row and col.
//  * A color is one of 'white' or 'black'.
//  * A piece is an object with properties:
//     loc
//     color
//     type: A number, which is an index into the array of piece types
//       for this game.
//     hasMovedYet: A boolean.
//  * A board is a two-dimensional array of pieces, with empty squares
//    containing null.
//  * A board info object is an object with properties:
//     numRows
//     numCols
//     numPieceTypes
//  * A game state represents the part of the description of a game that can
//    change over time. It has the following properties:
//      board: The current board.
//      playerToMove: The color of the player whose turn it is.
//      status: One of 'game not over', 'stalemate', or 'checkmate'. The player
//        who is stalemated or checkmated is the playerToMove.
//      capturedPieces: An array of captured pieces.
//  * A game object represents the whole game. It has the following properties:
//      players: An object with properties white and black, both holding user IDs.
//      pieceTypes: An array of piece types (defined below).
//      boardInfo: A board info object.
//      states: An array of all states that have occurred, most recent last.
//      moves: An array of all moves that have been made, most recent last.
//        The nth move resulted in the (n+1)th state.
//
///////////////////////////////////////////////////////////////////////////////

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

// Given board info, generates an empty board.
var makeEmptyBoard = function(boardInfo) {
  var board = [];

  for (var row = 0; row < boardInfo.numRows; row++) {
    board[row] = [];

    for (var col = 0; col < boardInfo.numCols; col++) {
      board[row][col] = null;
    }
  }

  return board;
}

///////////////////////////////////////////////////////////////////////////////
//
//   PIECE TYPE GENERATION
//
// A movement rule is an object with properties:
//  * type: A string (used for lookup in a table). The number of movement
//      types is finite and fixed.
//  * params: The parameters used by the movement type to say more specifically
//      how the piece moves.
//
// A piece type is an object with properties:
//  * movementRule: A movement rule.
//  * name: The name of the piece (a string).
//  * icon: The icon name of the piece (a string).
//  * royal: Whether the piece is royal (boolean).
//
// Currently we have the following movement types:
//  * 'walker': Can do a number of one-square moves in nonuniform directions.
//  * 'rider': Can move an unlimited distance along a vector.
//  * 'leaper': Generalization of a knight.
//  * 'leaprider': A leaper which can repeat its move.
//  * 'exchange': Swaps position with any friendly piece of a certain type.
//  * 'retreat': Teleports to home row.
//  * 'catapult': Moves by hopping over an adjacent piece and continuing along
//      a vector.
//  * 'grasshopper': Moves along a vector and must hop over a piece immediately
//      before its destination.
//  * 'leapfrog': Moves by repeated hops.
//  * 'movecapture': Has different rules for moving and for capturing.
//  * 'combination': Has two different movement rules, both of which let it capture.
//
// Now we specify the parameters for each of these movement types. A "vector set"
// is an array which is a subset of all the vectors { row: r, col: c } with r and
// c both -1, 0, or 1, not both zero, and c non-negative. A vector set is always
// horizontally symmetric, which is why the columns are non-negative. In addition
// a vector set must contain a forward moving vector (one with r positive).
//
// WALKERS:
//  vectors: A vector set, specifying the directions the walker can move.
//  min: The minimum number of squares the walker can move.
//  max: The maximum number of squares the walker can move.
//
// RIDERS:
//  vectors: A vector set.
//
// LEAPERS:
//  mmin, mmax, nmin, nmax: Positive integers.
//
//  The interpretation is that for any mmin <= m <= mmax and nmin <= n <= nmax,
//  the leaper can move m spaces horizontally then n spaces vertically, or
//  n spaces horizontally then m spaces vertically.
//
// LEAPRIDERS:
//  mmin, mmax, nmin, nmax: Positive integers.
//
//  The interpretation is the same, but the leaprider can move repeatedly according
//  to a fixed instance of the recipe.
//
// EXCHANGE:
//  type: A piece type index, specifying the type it can exchange with.
//  regularMove: A movement type, since the piece needs another way to move.
//
// RETREAT:
//  squares: 'black', 'white', or 'both', specifying the kinds of squares on the
//    home row that it can retreat to.
//  regularMove: A movement type.
//
// CATAPULT:
//  vectors: A vector set.
//
// GRASSHOPPER:
//  vectors: A vector set.
//
// LEAPFROG:
//  vectors: A vector set.
//  limit: Maximum number of leaps.
//
// MOVECAPTURE:
//  move: A movement type.
//  capture: A movement type.
//
// COMBINATION:
//  first: A movement type.
//  second: A movement type.
//
// Functions for generating piece types can take three parameters: the board info,
// their own index (that is, the index of the piece type being generated), and
// an array of rule types to exclude.
//
// There are four types of pieces we generate: lowly, minor, major, and queen.
// The difference between these types is their strength.. The king always has
// its usual movement rules, because if it were different it would probably be
// either too easy or too hard to make checkmate. The queen has very powerful
// movement rules, but is sometimes royal.
//
///////////////////////////////////////////////////////////////////////////////

var DEV_MODE = true;

// Takes an array of pairs of probabilities and values, returning a randomly
// selected value according to the given weights. The weights should add up
// to 1. Checks that weights add up to 1 if in development mode.
var randomSelect = function(selectionName, options) {
  var rand = Math.random();
  var val = 0.0;

  if (DEV_MODE) {
    var sumOfWeights = options.reduce(function(start, next) {
      return start + next[1];
    }, 0);

    if (Math.abs(sumOfWeights - 1) >= 0.0001) {
      console.log(selectionName + " doesn't add up to 1; it adds up to " + sumOfWeights + "!");
    }
  }

  for (var i = 0; i < options.length; i++) {
    val += options[i][1];

    if (rand < val) {
      return options[i][0];
    }
  }

  // If rounding errors mean we didn't select anything, just return the first thing.
  return options[0][0];
}

// Chooses an element at random from an array.
var pickOne = function(array) {
  var n = Math.floor(Math.random() * array.length);
  var elt = array[n];
  return elt;
}

// Chooses an element at random from an array and destructively deletes the
// element.
var pickOneNoReplacement = function(array) {
  var n = Math.floor(Math.random() * array.length);
  var elt = array[n];
  array.splice(n, 1);
  return elt;
}

// Function for generating functions for generating movement rules. Takes
// a function for generating movement types, and a map from movement types
// to functions for generating movement parameters.
var makeMovementRulesGenerator = function(generateMovementTypes, generateMovementParams) {
  return function(boardInfo, ownIndex, exclusions) {
    if (!exclusions) {
      exclusions = [];
    }

    var type;

    do {
      type = generateMovementTypes();
    } while (_.includes(exclusions, type));

    return {
      type: type,
      params: generateMovementParams[type](boardInfo, ownIndex, exclusions)
    };
  }
}

// Function for generating movement vectors. Takes an array of options where the
// values are numbers, representing the number of vectors (there are 5 in total)
// to include. One of the forward moving vectors will always be included.
var generateMovementVectors = function(options) {
  var numVectors = randomSelect('number of vectors', options);
  var result = [];

  var forwardVectors = [{ row: 1, col: 0 }, { row: 1, col: 1 }];
  result.push(pickOneNoReplacement(forwardVectors));

  var remainingVectors = [
    forwardVectors[0],
    { row: 0, col: 1 },
    { row: -1, col: 0 },
    { row: -1, col: 1 }];

  for (var i = 0; i < numVectors - 1; i++) {
    result.push(pickOneNoReplacement(remainingVectors));
  }

  return result;
}

var allMovementVectors = [
  [{ row:  1, col: 0 }, { row:  1, col: 1 }, { row: 0, col: 1 },
   { row: -1, col: 0 }, { row: -1, col: 1 }]
];

// These movement types are "non-nestable," meaning that they can't appear inside
// movement rules that contain movement rules. Presently all movement rules which
// contain movement rules are non-nestable.
var nonNestableMovementTypes = ['exchange', 'retreat', 'movecapture', 'combination']

// This is the exchange parameter generator, which is common to all ranks.
var makeExchangeParameterGenerator = function(generateMovementRule) {
  return function(boardInfo, ownIndex, exclusions) {
    var options = _.range(boardInfo.numPieceTypes);
    options.splice(ownIndex, 1);
    return {
      type: pickOne(options),
      regularMove: generateMovementRule(boardInfo, ownIndex,
        exclusions.concat(nonNestableMovementTypes))
    };
  }
}

var makeRetreatParameterGenerator = function(generateMovementRule) {
  return function(boardInfo, ownIndex, exclusions) {
    var options = ['black', 'white', 'both'];
    return {
      squares: pickOne(options),
      regularMove: generateMovementRule(boardInfo, ownIndex,
        exclusions.concat(nonNestableMovementTypes))
    }
  }
}

var makeMovecaptureParameterGenerator = function(generateMovementRule) {
 return function(boardInfo, ownIndex, exclusions) {
   var move = generateMovementRule(boardInfo, ownIndex,
     exclusions.concat(nonNestableMovementTypes));
    var capture = generateMovementRule(boardInfo, ownIndex,
      exclusions.concat(nonNestableMovementTypes).concat(move.type));

   return {
     move: move,
     capture: capture
   }
 }
}

var makeCombinationParameterGenerator = function(generateMovementRule) {
  return function(boardInfo, ownIndex, exclusions) {
    var first = generateMovementRule(boardInfo, ownIndex,
      exclusions.concat(nonNestableMovementTypes));
    var second = generateMovementRule(boardInfo, ownIndex,
      exclusions.concat(nonNestableMovementTypes).concat([first.type]))

    return {
      first: first,
      second: second
    }
  }
}

///////////////////////////////////////////////////////////////////////////////
//
// Generate major movement rules
//
///////////////////////////////////////////////////////////////////////////////

var generateMajorMovementType = function() {
  return randomSelect('major movement type',
    [['walker', 0.1],
     ['rider', 0.2],
     ['leaper', 0.15],
     ['leaprider', 0.05],
     ['exchange', 0.05],
     ['retreat', 0.05],
     ['catapult', 0.05],
     ['grasshopper', 0.05],
     ['leapfrog', 0.1],
     ['movecapture', 0.15],
     ['combination', 0.05]]);
}

var generateMajorVectors = function() {
  return generateMovementVectors([
    [3, 0.2],
    [4, 0.4],
    [5, 0.4],
  ]);
}

var generateMajorMovementParams = {
  'walker': function() {
    var min = randomSelect('walker min', [
      [1, 0.7],
      [2, 0.3]
    ]);

    var max = min + randomSelect('walker max', [
      [0, 0.5],
      [1, 0.5],
    ]);

    return {
      vectors: generateMajorVectors(),
      min: min,
      max: max
    }
  },

  'rider': function() {
    return {
      vectors: generateMajorVectors()
    }
  },

  'leaper': function() {
    var genLeaperMin = function() {
      return randomSelect('leaper min', [
        [1, 0.3],
        [2, 0.4],
        [3, 0.3]
      ]);
    }

    var genLeaperMax = function() {
      return randomSelect('leaper max', [
        [0, 0.4],
        [1, 0.4],
        [2, 0.2]
      ])
    }

    var mmin = genLeaperMin();
    var mmax = mmin + genLeaperMax();
    var nmin = genLeaperMin();
    var nmax = nmin + genLeaperMax();

    return {
      mmin: mmin,
      mmax: mmax,
      nmin: nmin,
      nmax: nmax
    };
  },

  'leaprider': function() {
    var genLeapriderMin = function() {
      return randomSelect('leaprider min', [
        [1, 0.3],
        [2, 0.4],
        [3, 0.3]
      ]);
    }

    var mmin = genLeapriderMin();
    var nmin = genLeapriderMin();

    return {
      mmin: mmin,
      mmax: mmin,
      nmin: nmin,
      nmax: nmin
    };
  },

  'exchange': function(boardInfo, ownIndex, exclusions) {
    var options = _.range(boardInfo.numPieceTypes);
    options.splice(ownIndex, 1);
    return {
      type: ownIndex,
      regularMove: generateMajorMovementRule(boardInfo, ownIndex,
        exclusions.concat(['exchange']))
    };
  },

  'retreat': function(boardInfo, ownIndex) {
    var options = ['black', 'white', 'both'];
    return {
      squares: pickOne(options),
      regularMove: generateMajorMovementRule(boardInfo, ownIndex)
    }
  },

  'catapult': function() {
    return {
      vectors: generateMajorVectors()
    }
  },

  'grasshopper': function() {
    return {
      vectors: generateMajorVectors()
    }
  },

  'leapfrog': function() {
    return {
      vectors: generateMajorVectors(),
      limit: randomSelect('leapfrog limit', [
        [1, 0.05],
        [2, 0.25],
        [3, 0.65],
        [4, 0.05]
      ])
    }
  }

  // The rules for exchange, retreat, movecapture, and combination have to
  // come later, to avoid circularity, because of how they are generated
  // by combinators.
}

var generateMajorMovementRule = makeMovementRulesGenerator(
  generateMajorMovementType, generateMajorMovementParams);

generateMajorMovementParams['exchange'] = makeExchangeParameterGenerator(generateMajorMovementRule);
generateMajorMovementParams['retreat'] = makeRetreatParameterGenerator(generateMajorMovementRule);
generateMajorMovementParams['movecapture'] = makeMovecaptureParameterGenerator(generateMajorMovementRule);
generateMajorMovementParams['combination'] = makeCombinationParameterGenerator(generateMajorMovementRule);

///////////////////////////////////////////////////////////////////////////////
//
// Generate minor movement rules
//
///////////////////////////////////////////////////////////////////////////////

var generateMinorMovementType = function() {
  return randomSelect('minor movement type',
    [['walker', 0.1],
     ['rider', 0.3],
     ['leaper', 0.3],
     ['exchange', 0.05],
     ['retreat', 0.05],
     ['movecapture', 0.15],
     ['combination', 0.05]]);
}

var generateMinorVectors = function() {
  return generateMovementVectors([
    [2, 0.1],
    [3, 0.5],
    [4, 0.3],
    [5, 0.1],
  ]);
}

var generateMinorMovementParams = {
  'walker': function() {
    var min = randomSelect('walker min', [
      [1, 0.8],
      [2, 0.2]
    ]);

    return {
      vectors: generateMinorVectors(),
      min: min,
      max: min
    }
  },

  'rider': function() {
    return {
      vectors: generateMinorVectors()
    }
  },

  'leaper': function() {
    var genLeaperMin = function() {
      return randomSelect('leaper min', [
        [1, 0.3],
        [2, 0.5],
        [3, 0.2]
      ]);
    }

    var mmin = genLeaperMin();
    var nmin = genLeaperMin();

    return {
      mmin: mmin,
      mmax: mmin,
      nmin: nmin,
      nmax: nmin
    };
  }

  // The rules for exchange, retreat, movecapture, and combination have to
  // come later, to avoid circularity, because of how they are generated
  // by combinators.
}

var generateMinorMovementRule = makeMovementRulesGenerator(
  generateMinorMovementType, generateMinorMovementParams);

generateMinorMovementParams['exchange'] = makeExchangeParameterGenerator(generateMinorMovementRule);
generateMinorMovementParams['retreat'] = makeRetreatParameterGenerator(generateMinorMovementRule);
generateMinorMovementParams['movecapture'] = makeMovecaptureParameterGenerator(generateMinorMovementRule);
generateMinorMovementParams['combination'] = makeCombinationParameterGenerator(generateMinorMovementRule);

///////////////////////////////////////////////////////////////////////////////
//
// Generate queen movement rules
//
///////////////////////////////////////////////////////////////////////////////

var generateQueenMovementType = function() {
  return randomSelect('queen movement type',
   [['walker', 0.25],
    ['rider', 0.3],
    ['leaper', 0.2],
    ['leaprider', 0.1],
    ['exchange', 0.05],
    ['catapult', 0.03],
    ['grasshopper', 0.03],
    ['leapfrog', 0.04]]);
}

var generateQueenMovementParams = {
  'walker': function() {
    var min = 1;

    var max = min + randomSelect('walker max', [
      [0, 0.3],
      [1, 0.4],
      [2, 0.3],
    ]);

    return {
      vectors: generateMajorVectors(),
      min: min,
      max: max
    }
  },

  'rider': function() {
    return {
      vectors: allMovementVectors
    }
  },

  'leaper': function() {
    var genLeaperMin = function() {
      return randomSelect('leaper min', [
        [0, 0.5],
        [1, 0.5],
      ]);
    }

    var genLeaperMax = function() {
      return randomSelect('leaper max', [
        [1, 0.3],
        [2, 0.4],
        [3, 0.3]
      ])
    }

    var mmin = genLeaperMin();
    var mmax = mmin + genLeaperMax();
    var nmin = genLeaperMin();
    var nmax = nmin + genLeaperMax();

    return {
      mmin: mmin,
      mmax: mmax,
      nmin: nmin,
      nmax: nmax
    };
  },

  'leaprider': function() {
    var genLeapriderMin = function() {
      return randomSelect('leaprider min', [
        [1, 0.5],
        [2, 0.5]
      ]);
    }

    var genLeapriderMax = function() {
      return randomSelect('leaprider max', [
        [0, 0.3],
        [1, 0.4],
        [2, 0.3]
      ]);
    }

    var mmin = genLeapriderMin();
    var mmax = mmin + genLeapriderMax();
    var nmin = genLeapriderMin();
    var nmax = nmin + genLeapriderMax();

    return {
      mmin: mmin,
      mmax: mmax,
      nmin: nmin,
      nmax: nmax
    };
  },

  'catapult': function() {
    return {
      vectors: allMovementVectors
    }
  },

  'grasshopper': function() {
    return {
      vectors: allMovementVectors
    }
  },

  'leapfrog': function() {
    return {
      vectors: allMovementVectors,
      limit: randomSelect('leapfrog limit', [
        [1, 0.05],
        [2, 0.25],
        [3, 0.65],
        [4, 0.05]
      ])
    }
  }
}

var generateQueenMovementRule = makeMovementRulesGenerator(
  generateQueenMovementType, generateQueenMovementParams);

generateQueenMovementParams['exchange'] = makeExchangeParameterGenerator(generateQueenMovementRule);

///////////////////////////////////////////////////////////////////////////////
//
// Lowly movement rule generation. For now, lowly pieces are just ordinary pawns.
//
///////////////////////////////////////////////////////////////////////////////

var generateLowlyMovementRule = function() {
  return {
    type: 'movecapture',
    params: {
      move: {
        type: 'walker',
        params: {
          vectors: [{ row: 1, col: 0 }],
          min: 1,
          max: 1
        }
      },

      capture: {
        type: 'walker',
        params: {
          vectors: [{ row: 1, col: 1 }],
          min: 1,
          max: 1
        }
      }
    }
  };
}

///////////////////////////////////////////////////////////////////////////////
//
// Game generation.
//
///////////////////////////////////////////////////////////////////////////////

var kingMovementRule = {
  type: 'walker',
  params: {
    vectors: allMovementVectors,
    min: 1,
    max: 1
  }
}

// Given board info, generates an array of pieces types. Currently it assumes
// the board is 8x8 and there are 6 piece types.
var generatePieceTypes = function(boardInfo) {
  var pawn = {
    movementRule: generateLowlyMovementRule(boardInfo, 0),
    name: "Pawn",
    icon: "Pawn",
    royal: false
  };

  var rook = {
    movementRule: generateMajorMovementRule(boardInfo, 1),
    name: "Rook",
    icon: "Rook",
    royal: false
  };

  var knight = {
    movementRule: generateMinorMovementRule(boardInfo, 2),
    name: "Knight",
    icon: "Knight",
    royal: false
  };

  var bishop = {
    movementRule: generateMinorMovementRule(boardInfo, 3),
    name: "Bishop",
    icon: "Bishop",
    royal: false
  };

  var queen = {
    movementRule: generateQueenMovementRule(boardInfo, 4),
    name: "Queen",
    icon: "Queen",
    royal: Math.random() >= .7
  };

  var king = {
    movementRule: kingMovementRule,
    name: "King",
    icon: "King",
    royal: true
  }

  return [pawn, rook, knight, bishop, queen, king];
}

// Given board info and piece types, generates a starting board. Currently
// just generates the usual chess layout, and assumes the usual chess board info;
// this should be generalized.
var generateStartingBoard = function(boardInfo, pieceTypes) {
  var board = makeEmptyBoard(boardInfo);

  makeStartingFirstRow(board, 'white', 0);
  makeStartingSecondRow(board, 'white', 1);
  makeStartingSecondRow(board, 'black', 6);
  makeStartingFirstRow(board, 'black', 7);

  return board;
}

var startingBackRowTypes = [1,2,3,4,5,3,2,1];

// Takes a board config and fills the back row for the given color with the
// starting pieces, assuming that the given row number is the back row.
function makeStartingFirstRow(board, color, row) {
  for (var col = 0; col <= 7; col++) {
    var loc = { row: row, col: col };
    setSquare(board, loc,
      { color: color, type: startingBackRowTypes[col], loc: loc, hasMovedYet: false });
  }
}

function makeStartingSecondRow(board, color, row) {
  for (var col = 0; col <= 7; col++) {
    var loc = { row: row, col: col };
    setSquare(board, loc,
      { color: color, type: 0, loc: loc, hasMovedYet: false });
  }
}

var generateGame = function(player1, player2) {
  var game = {};
  var startState = {};

  var shuffledPlayers = _.shuffle([player1, player2]);
  var players = {};
  players.white = shuffledPlayers[0];
  players.black = shuffledPlayers[1];
  game.players = players;

  game.states = [startState];
  game.moves = [];

  // XXX: Allow different kinds of boards.
  game.boardInfo = {
    numRows: 8,
    numCols: 8,
    numPieceTypes: 6
  };

  game.pieceTypes = generatePieceTypes(game.boardInfo);

  startState.playerToMove = 'white';
  startState.status = 'game not over';
  startState.capturedPieces = [];

  startState.board = generateStartingBoard(game.boardInfo, game.pieceTypes);

  return game;
};


///////////////////////////////////////////////////////////////////////////////
//
// XXX: Organize this stuff
//
///////////////////////////////////////////////////////////////////////////////

var getCurrentState = function(game) {
  return game.states[getCurrentStateIndex(game)];
}

var getCurrentStateIndex = function(game) {
  return game.states.length - 1;
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

///////////////////////////////////////////////////////////////////////////////
// Node exports
///////////////////////////////////////////////////////////////////////////////

if (typeof window === 'undefined') {
  module.exports = {
    generateGame: generateGame,
    moveIsLegal: moveIsLegal,
    executeMove: executeMove
  };
}
