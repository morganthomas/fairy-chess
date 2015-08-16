///////////////////////////////////////////////////////////////////////////////
// Node imports
///////////////////////////////////////////////////////////////////////////////

if (typeof window === 'undefined') {
  var _ = require('../lib/lodash.js');
}

///////////////////////////////////////////////////////////////////////////////
//
// Utility
//
///////////////////////////////////////////////////////////////////////////////

// Maps a function over an array and returns the array of output values
// which were truthy.
var mapFilter = function(array, f) {
  var result = [];

  array.forEach(function(x) {
    var y = f(x);
    if (y) {
      result.push(y);
    }
  });

  return result;
}

///////////////////////////////////////////////////////////////////////////////
//
// Basic types:
//  * A location is an object with properties row and col.
//  * A color is one of 'white' or 'black'.
//  * A piece is an object with properties:
//     loc
//     color
//     type: A number, which is an index into the array of piece types (to be explained)
//       for this game.
//     hasMovedYet: A boolean, saying whether the piece has moved in this game.
//  * A board is a two-dimensional array of pieces, with empty squares
//    containing null.
//  * A board info object is an object with properties:
//     numRows
//     numCols
//     numPieceTypes
//  * A game state is the part of the description of a game that can
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

// Black moves down the board; white moves up the board.
var colorOrientation = function(color) {
  return color === 'black' ? -1 : 1;
}

var colorOpponent = function(color) {
  return color === 'black' ? 'white' : 'black';
}

// Adds two locations.
function locPlus(loc1, loc2) {
  return { row: loc1.row + loc2.row, col: loc1.col + loc2.col };
}

// Says whether two locations are equal.
function locEq(loc1, loc2) {
  return loc1.row === loc2.row &&
         loc1.col === loc2.col;
}

// Gets the contents of the given location in the given board.
var getSquare = function(board, loc) {
  return board[loc.row][loc.col];
}

// Sets the contents of the given location in the given board.
var setSquare = function(board, loc, val) {
  board[loc.row][loc.col] = val;
}

// Says whether the given location is in the bounds of the given board.
var isInBounds = function(board, loc) {
  return 0 <= loc.row && loc.row < board.length &&
    0 <= loc.col && loc.col < board[0].length;
}

// Calls the given function on each location in the given board.
var forEachLoc = function(board, callback) {
  for (var row = 0; row < board.length; row++) {
    for (var col = 0; col < board[row].length; col++) {
      callback({ row: row, col: col });
    }
  }
}

// Returns all locations in the given board.
var allBoardLocs = function(board) {
  var locs = [];
  forEachLoc(board, function(loc) {
    locs.push(loc);
  });
  return locs;
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

// Gets the current state in a game.
var getCurrentState = function(game) {
  return game.states[getCurrentStateIndex(game)];
}

// Gets the index of the current state in a game.
var getCurrentStateIndex = function(game) {
  return game.states.length - 1;
}

// Gets the piece type object for a given piece in a given game.
var getPieceType = function(game, piece) {
  return game.pieceTypes[piece.type];
}

///////////////////////////////////////////////////////////////////////////////
//
//   PIECE TYPE GENERATION
//
// A movement rule is an object with properties:
//  * type: A string (used for lookup in a table). The number of movement rule
//      types is finite and fixed.
//  * params: An object. The parameters used by the movement rule type to say more specifically
//      how the piece moves.
//
// A piece type is an object with properties:
//  * movementRule: A movement rule.
//  * name: The name of the piece (a string).
//  * icon: The icon name of the piece (a string).
//  * royal: Whether the piece is royal (boolean).
//
// Currently we have the following movement rule types:
//  * 'walker': Can do a number of one-square moves in nonuniform directions.
//  * 'rider': Can move an unlimited distance along a vector.
//  * 'leaper': Generalization of a knight, explained below.
//  * 'leaprider': Moves like a leaper, but it can iterate its leap.
//  * 'exchange': Swaps position with any friendly piece of a certain type.
//  * 'retreat': Teleports to home row.
//  * 'catapult': Moves by hopping over an adjacent piece and continuing along
//      a vector.
//  * 'grasshopper': Moves along a vector and must hop over a piece immediately
//      before its destination.
//  * 'leapfrog': Moves by repeated hops, like a checkers piece capturing (but it does
//      not capture the pieces it moves over).
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
//  regularMove: A movement rule, since the piece needs another way to move.
//
// RETREAT:
//  squares: 'black', 'white', or 'both', specifying the kinds of squares on the
//    home row that it can retreat to.
//  regularMove: A movement rule.
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
//  move: A movement rule.
//  capture: A movement rule.
//
// COMBINATION:
//  first: A movement rule.
//  second: A movement rule.
//
// Functions for generating piece types can take three parameters: the board info,
// their own index (that is, the index of the piece type being generated), and
// an array of rule types to exclude.
//
// There are four "ranks" of pieces we generate: lowly, minor, major, and queen.
// The difference between these ranks is their strength.. The king always has
// its usual movement rules, because if it were much different it would probably be
// either too easy or too hard to make checkmate. The queen often has more powerful
// movement rules than in chess, but is sometimes royal, making it risky to use in these
// cases.
//
///////////////////////////////////////////////////////////////////////////////

var CHECK_OPTION_WEIGHTS = true;

// Takes an array of pairs of probabilities and values, returning a randomly
// selected value according to the given weights. The weights should add up
// to 1. Checks that weights add up to 1 if requested above; useful for development.
var randomSelect = function(selectionName, options) {
  var rand = Math.random();
  var val = 0.0;

  if (CHECK_OPTION_WEIGHTS) {
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
// a function for randomly generating movement rule types, and a map from movement rule types
// to functions for randomly generating movement parameters. The function it returns generates
// a movement rule given board info and the index of the piece type that the mvoement rule
// will belong to, as well as an optional list of movement rule types which it's not allowed to use.
var makeMovementRulesGenerator = function(generateMovementTypes, generateMovementParams) {
  return function(boardInfo, ownIndex, exclusions) {
    if (!exclusions) {
      exclusions = [];
    }

    var type;

    // Just try random movement rule types until we get one that's allowed.
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

  // Recall that pickOneNoReplacement removes the item it selects from the array.
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

// These are all movement vectors which can belong to vector sets (as defined above).
var allMovementVectors =
  [{ row:  1, col: 0 }, { row:  1, col: 1 }, { row: 0, col: 1 },
   { row: -1, col: 0 }, { row: -1, col: 1 }];

// These movement types are "non-nestable," meaning that they can't appear inside
// movement rules that contain movement rules. Presently all movement rules which
// contain movement rules are non-nestable.
var nonNestableMovementTypes = ['exchange', 'retreat', 'movecapture', 'combination'];

var nestableMovementTypes = ['walker', 'rider', 'leaper', 'leaprider',
  'catapult', 'grasshopper', 'leapfrog'];

// This is the exchange parameter generator, which is common to all ranks. Takes a
// function for randomly generating movement rules.
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
    var squaresOptions = ['black', 'white', 'both'];
    return {
      squares: pickOne(squaresOptions),
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
      exclusions.concat(nonNestableMovementTypes).concat([move.type]));

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
// Generate movement rules for major pieces
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
  // come just below, to avoid circularity, because of how they are generated
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
  // come just below, to avoid circularity, because of how they are generated
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

  // Generate some data used for legal move generation, explained below.
  precomputePaths(game);

  return game;
};


///////////////////////////////////////////////////////////////////////////////
//
// Moves, like movement rules, are generic objects. A move consists of a
// move type, identified by a string, and a set of parameters. Each move type
// t is associated with a function executeMoveType[t](game, state, params, piece),
// which produces (non-destructively) the new state that results from executing
// a move of type t with the given params by the given piece in the given game
// in the given state. The executeMove function should not assume that the state
// is the most recent in the game, or that it is one which has occurred in the
// game.
//
// Formally, a move is an object with properties:
//  type: A string.
//  params: A key-value map.
//  piece: The piece doing the move.
// After being executed by executeMoveInGame, a move also gains an
// algebraicNotation property containing its algebraic notation as a string.
//
// Presently, we have two move types:
//  'selfmove': A move whcih simply moves the piece doing the move, capturing any
//    piece in the square it moves to.
//  'exchange': A move which exchanges the piece doing the move with any piece
//    in the square it moves to.
//
// These move types have the following parameters:
//
// SELFMOVE:
//   to: A location, saying where the piece is moving to.
//
// EXCHANGE:
//  to: A location, saying where the piece is moving to.
//
///////////////////////////////////////////////////////////////////////////////

// Returns true if the two moves are (semantically) equal. Different from
// _.isEqual because a move can have an algebraicNotation property, and otherwise
// identical moves where one has this property and the other lacks it are equal.
var moveEq = function(move1, move2) {
  return move1.type === move2.type && _.isEqual(move1.params, move2.params);
}

// Given a state and "from" and "to" locations, constructs a move which tries to
// be a legal move based on it. There is always at most one legal move in a given
// state with given "from" and "to" locations, and this function finds it if it
// exists. Returns null if there is no piece at "from."
var constructMove = function(state, from, to) {
  var fromContents = getSquare(state.board, from);
  var toContents = getSquare(state.board, to);

  if (!fromContents) {
    return null;
  }

  if (toContents && toContents.color === fromContents.color) {
    return {
      piece: fromContents,
      type: 'exchange',
      params: {
        to: to
      }
    }
  } else {
    // The destination square is empty or contains an enemy piece
    return {
      piece: fromContents,
      type: 'selfmove',
      params: {
        to: to
      }
    }
  }
}

// This function computes the game status in a given state.
var computeStatus = function(game, state) {
  if (legalMoves(game, state).length > 0) {
    return 'game not over';
  } else {
    if (isInCheck(game, state, state.playerToMove)) {
      return 'checkmate';
    } else {
      return 'stalemate';
    }
  }
}

// This function does some updating to a state that needs to happen after any move.
var updateStateAfterMove = function(game, state) {
  state.playerToMove = colorOpponent(state.playerToMove);
}

var executeMoveType = {
  'selfmove': function(game, state, params, piece) {
    // XXX: Don't use _.cloneDeep; it's slow
    var newState = _.cloneDeep(state);
    var movedPiece = _.cloneDeep(piece);
    var targetPiece = getSquare(state.board, params.to);

    movedPiece.loc = params.to;
    setSquare(newState.board, params.to, movedPiece);
    setSquare(newState.board, piece.loc, null);

    if (targetPiece) {
      newState.capturedPieces.push(targetPiece);
    }

    updateStateAfterMove(game, newState);

    return newState;
  },

  'exchange': function(game, state, params, piece) {
    // XXX: Don't use _.cloneDeep
    var newState = _.cloneDeep(state);
    var loc1 = piece.loc;
    var loc2 = params.to;

    var movedPiece1 = _.cloneDeep(piece);
    movedPiece1.loc = loc2;

    var movedPiece2 = _.cloneDeep(getSquare(state.board, loc2));
    movedPiece2.loc = loc1;

    setSquare(newState.board, loc1, movedPiece2);
    setSquare(newState.board, loc2, movedPiece1);

    updateStateAfterMove(game, newState);

    return newState;
  }
};

// Given a game, a state, and a move, assumes the move is legal, and performs the move,
// returning the state that results.
var executeMove = function(game, state, move) {
  return executeMoveType[move.type](game, state, move.params, move.piece);
}

// Given a game and a move, assumes the move is legal, and performs the move,
// updating the game destructively.
var executeMoveInGame = function(game, move) {
  var state = getCurrentState(game);
  var newState = executeMove(game, state, move);
  newState.status = computeStatus(game, newState);
  game.states.push(newState);
  move.algebraicNotation = displayMoveAlgebraic(game, state, move);
  game.moves.push(move);
}

///////////////////////////////////////////////////////////////////////////////
//
// Semi-legal move generation
//
// A semi-legal move is one which is legal, except that it might place the player
// who is moving in check. Our strategy for generating the legal moves in a given
// state involves first generating the semi-legal moves in that state.
//
// This strategy relies on a map semiLegalMovesForPieceType from movement rule types to
// functions. Given a movement rule type t, semiLegalMovesForPieceType[t](game, state, params, piece)
// produces all semi-legal moves for the given piece in the given state.
//
// Our strategy for generating most semi-legal moves works as follows. First we
// generate the set of paths which the piece can move along. A path is a series of unit
// vectors, showing the squares the piece moves through in turn. This set of paths is
// always finite because the board is finite.
//
// Next, we specify a movement controller. The movement controller is a function
//   control(game, state, piece, loc, data) -> [directive, newData]
// where the parameters and outputs are as follows:
//   game: The game.
//   state: The current state.
//   piece: The piece being moved.
//   loc: A location along the path.
//   data, newData: Some state data used by the controller.
//   directive: A movement directive; one of 'continue', 'stop here exclusive',
//     'stop here inclusive', or 'continue no stop'.
//
// To determine the semi-legality of a move, we take its path and its controller.
// We run through every location on the path, calling control with the location
// and with the data produced by the control on the last step. This produces a
// movement directive which indicates whether we can continue, whether we can
// stop, etc. The directives have the following meaning:
//   'continue': Puts no constraints on the semi-legality of the move.
//   'stop here exclusive': The move is not semi-legal.
//   'stop here inclusive': The move is semi-legal, as long as this step is the
//     end of the path.
//   'continue no stop': The move is semi-legal, as long as this step is not
//     the end of the path.
//
// The "non-nestable" movement rule types are movecapture, combination, exchange,
// and retreat. All other movement rule types are "nestable." Exactly the nestable
// movement rule types have their semi-legal moves generated by the method just
// described.
//
// To save computation during gameplay, we precompute all of the paths that
// can be used for a given movement rule, and attach them to the rule object.
// Once this is done, semiLegalMovesForPieceType[t] can be defined, for any
// nestable type t, as simpleSelfmoveGenerator(controller) for some controller.
// (See below.)
//
// It is noteworthy that the possible paths depend on whether we are black
// or white, because black moves down the board and white moves up the board.
// Therefore the precomputed paths are stored as an object of the form
//   { white: <array of paths>, black: <array of paths> }
//
// To be used inside movecapture, the nestable movement rule types must be able
// to provide move generation functions for no-capture and capture-only
// variants of themselves.
//
// The difference between the no-capture, capture-only, and regular (move-and-capture)
// variants of a movement rule are just the movement controller used. Building
// on this observation, we define a map nestableMoveControllers which
// goes from (the name of) a nestable movement type t to an object of the form
//  { regular: <controller>, moveOnly: <controller>, captureOnly: <controller> }
// This map can be used by the moveandcapture move generator.
//
///////////////////////////////////////////////////////////////////////////////

//
// PATH SETS
//

// This function takes an array of paths and produces all paths which are
// the result of uniformly repeating one of the paths.
var uniformUnlimitedRepeatPaths = function(game, paths) {
  var resultPaths = [];

  paths.forEach(function(path) {
    var pathRowDiff = 0;
    var pathColDiff = 0;

    path.forEach(function(vec) {
      pathRowDiff += vec.row;
      pathColDiff += vec.col;
    });

    var pathRowLength = Math.abs(pathRowDiff);
    var pathColLength = Math.abs(pathColDiff);

    var pathVertRepsLimit = Math.floor(game.boardInfo.numRows / pathRowLength);
    var pathHorizRepsLimit = Math.floor(game.boardInfo.numCols / pathColLength);

    var pathRepsLimit = Math.min(pathVertRepsLimit, pathHorizRepsLimit);

    for (var reps = 1; reps <= pathRepsLimit; reps++) {
      var repeatedPath = [];

      for (var i = 0; i < reps; i++) {
        for (var j = 0; j < path.length; j++) {
          repeatedPath.push(path[j]);
        }
      }

      resultPaths.push(repeatedPath);
    }
  });

  return resultPaths;
}

// This function takes an array of paths and produces all paths which are
// the result of non-uniformly repeating some of the paths between min and
// max times.
var nonuniformLimitedRepeatPaths = function(game, paths, min, max) {
  var resultPaths = [];

  for (var reps = min; reps <= max; reps++) {
    resultPaths = resultPaths.concat(nonuniformFixedRepeatPaths(game, paths, reps));
  }

  return resultPaths;
}

// Like nonuniformLimitedRepeatPaths, but does a fixed number of repetitions.
var nonuniformFixedRepeatPaths = function(game, paths, n) {
  if (n === 1) {
    return paths;
  } else {
    var shorterPaths = nonuniformFixedRepeatPaths(game, paths, n-1);
    var resultPaths = [];

    shorterPaths.forEach(function(sp) {
      paths.forEach(function(p) {
        resultPaths.push(sp.concat(p));
      });
    });

    return resultPaths;
  }
}

// This function takes the unit vectors used in walker, rider, etc. parameters (vector sets)
// and generates the full set of unit vectors by reflecting across the Y axis.
var makeHorizontalSymmetry = function(vectors) {
  var results = [];

  vectors.forEach(function(vector) {
    results.push(vector);

    if (vector.col !== 0) {
      results.push({ row: vector.row, col: -vector.col });
    }
  });

  return results;
}

// Takes an array of unit vectors and orients them to the color given; that is,
// it flips them vertically if the color is black.
var orientVectorsToColor = function(color, vectors) {
  var orientation = colorOrientation(color);
  return vectors.map(function(vector) {
    return { row: orientation * vector.row, col: vector.col };
  });
}

// Takes an array of vectors and produces an array of length-one paths.
var unitVectorsToPaths = function(vectors) {
  return vectors.map(function(vector) {
    return [vector];
  });
};

// Takes an array of unit vectors as found in move rule parameters (i.e., a vector set) and
// converts it to an array of paths of length 1 suitable for path generation.
var seedPathsFromUnitVectors = function(color, vectors) {
  return unitVectorsToPaths(makeHorizontalSymmetry(orientVectorsToColor(color, vectors)));
}

// Returns the destination of a path if you start from (0,0).
var pathDest = function(path) {
  var dest = { row: 0, col: 0 };

  path.forEach(function(vec) {
    dest = locPlus(dest, vec);
  });

  return dest;
}

// Filters a path set so it doesn't contain any paths that go to the same place.
var makePathDestinationsUnique = function(paths) {
  return _.uniq(paths, false, pathDest);
}

// Makes an L-shaped path, going a given number of rows and a given number
// of columns. The order in which the row and column moves occur is unspecified.
// We can get away with this because we only use this function for leapers,
// where it doesn't make a difference. Takes signs for the rows and cols,
// indicating the direction of movement.
var makeLPath = function(rows, rowsSign, cols, colsSign) {
  var path = [];

  for (var i = 0; i < rows; i++) {
    path.push({ row: rowsSign, col: 0 });
  }

  for (var i = 0; i < cols; i++) {
    path.push({ row: 0, col: colsSign });
  }

  return path;
}

var makeWalkerPaths = function(game, color, params) {
  return nonuniformLimitedRepeatPaths(game,
    seedPathsFromUnitVectors(color, params.vectors),
    params.min,
    params.max);
}

var makeRiderPaths = function(game, color, params) {
  return uniformUnlimitedRepeatPaths(game,
    seedPathsFromUnitVectors(color, params.vectors));
}

// Takes a set of leaper parameters and produces the paths it describes.
var makeLeaperPaths = function(game, color, params) {
  var paths = [];

  for (var n = params.nmin; n <= params.nmax; n++) {
    for (var m = params.mmin; m <= params.mmax; m++) {
      [1,-1].forEach(function(s) {
        [1,-1].forEach(function(t) {
          paths.push(makeLPath(n, s, m, t));
          paths.push(makeLPath(m, s, n, t));
        })
      })
    }
  }

  return makePathDestinationsUnique(paths);
}

var makeLeapriderPaths = function(game, color, params) {
  return uniformUnlimitedRepeatPaths(game, makeLeaperPaths(game, color, params));
}

var makeLeapfrogPaths = function(game, color, params) {
  return nonuniformLimitedRepeatPaths(game,
    seedPathsFromUnitVectors(color, params.vectors), 2, params.limit * 2)
}

// Path computing functions for all nestable types.
var pathComputingFunctions = {
  'walker': makeWalkerPaths,
  'rider': makeRiderPaths,
  'leaper': makeLeaperPaths,
  'leaprider': makeLeapriderPaths,
  'catapult': makeRiderPaths,
  'grasshopper': makeRiderPaths,
  'leapfrog': makeLeapfrogPaths
}

// Computes the path sets for the various piece types in a game, and installs
// them as "paths" properties on the piece type.
var precomputePaths = function(game) {
  // Find all the rules of nestable movement types.
  var nestableRules = [];

  game.pieceTypes.forEach(function (pieceType) {
    var rule = pieceType.movementRule;

    if (_.include(nestableMovementTypes, rule.type)) {
      nestableRules.push(rule);
    } else {
      // The rule is non-nestable
      if (rule.type === 'retreat' || rule.type === 'exchange') {
        nestableRules.push(rule.params.regularMove);
      } else if (rule.type === 'movecapture') {
        nestableRules.push(rule.params.move);
        nestableRules.push(rule.params.capture);
      } else if (rule.type === 'combination') {
        nestableRules.push(rule.params.first);
        nestableRules.push(rule.params.second);
      }
    }
  });

  // Precompute the paths
  nestableRules.forEach(function(rule) {
    rule.paths = {
      white: pathComputingFunctions[rule.type](game, 'white', rule.params),
      black: pathComputingFunctions[rule.type](game, 'black', rule.params)
    }
  })
}

//
// MOVEMENT CONTROLLERS
//

// Generates a movement controller which simply returns the given directive
// when moving into a square of the corresponding type (empty, occupied by
// an enemy piece, or occupied by a friendly piece).
var simpleMovementController = function(empty, friendly, enemy) {
  return function(game, state, piece, loc, data) {
    var directive;
    var contents = getSquare(state.board, loc);

    if (!contents) {
      directive = empty;
    } else if (contents.color === piece.color) {
      directive = friendly;
    } else {
      directive = enemy;
    }

    return [directive, data];
  }
}

var regularMovementController =
  simpleMovementController('continue', 'stop here exclusive', 'stop here inclusive');

var regularMovementControllers = {
  regular: regularMovementController,
  moveOnly: simpleMovementController('continue', 'stop here exclusive', 'stop here exclusive'),
  captureOnly: simpleMovementController('continue no stop', 'stop here exclusive', 'stop here inclusive')
};

var leaperMovementController =
  simpleMovementController('continue', 'continue no stop', 'continue');

var leaperMovementControllers = {
  regular: leaperMovementController,
  moveOnly: simpleMovementController('continue', 'continue no stop', 'continue no stop'),
  captureOnly: simpleMovementController('continue no stop', 'continue no stop', 'continue')
};

var makeCatapultMovementController = function(canCapture, canMove) {
  return function(game, state, piece, loc, data) {
    var dest = getSquare(state.board, loc);

    if (data === null && dest) { // null is the start state given by simpleMovementController
      return ['continue no stop', 'hopped'];
    } else if (data === 'hopped') {
      if (!dest) {
        return [canMove ? 'continue' : 'continue no stop', 'hopped'];
      } else if (canCapture && dest.color === colorOpponent(piece.color)) {
        return ['stop here inclusive', 'captured'];
      }
    }

    return ['stop here exclusive', 'invalid'];
  }
}

var makeGrasshopperMovementController = function(canCapture, canMove) {
  return function(game, state, piece, loc, data) {
    var dest = getSquare(state.board, loc);

    if (data === null) {
      if (!dest) {
        return ['continue no stop', null];
      } else {
        return ['continue no stop', 'hopped'];
      }
    } else if (data === 'hopped') {
      if ((canMove && !dest) || (canCapture && dest.color === colorOpponent(piece.color))) {
        return ['stop here inclusive', 'done'];
      }
    }

    return ['stop here exclusive', 'invalid'];
  }
}

var makeLeapfrogMovementController = function(canCapture, canMove) {
  return function(game, state, piece, loc, data) {
    var dest = getSquare(state.board, loc);

    if (data === null && dest) {
      return ['continue no stop', 'hopped'];
    } else if (data === 'hopped') {
      if (!dest) {
        return [canMove ? 'continue' : 'continue no stop', null];
      } else if (canCapture && dest.color === colorOpponent(piece.color)) {
        return ['stop here inclusive', 'captured'];
      }
    }

    return ['stop here exclusive', 'invalid'];
  }
}

var nestableMoveControllers = {
  'walker': regularMovementControllers,
  'rider': regularMovementControllers,
  'leaper': leaperMovementControllers,
  'leaprider': leaperMovementControllers,
  'catapult': {
    regular: makeCatapultMovementController(true, true),
    captureOnly: makeCatapultMovementController(true, false),
    moveOnly: makeCatapultMovementController(false, true)
  },
  'grasshopper': {
    regular: makeGrasshopperMovementController(true, true),
    captureOnly: makeGrasshopperMovementController(true, false),
    moveOnly: makeGrasshopperMovementController(false, true)
  },
  'leapfrog': {
    regular: makeLeapfrogMovementController(true, true),
    captureOnly: makeLeapfrogMovementController(true, false),
    moveOnly: makeLeapfrogMovementController(false, true)
  }
}

//
// SEMI-LEGAL MOVE GENERATION
//

// Takes an array of paths, a controller, and start data for the controller, and
// generates all semi-legal selfmoves for the given piece according to the given
// information.
var generateSelfmoves = function(controller, startData, paths, game, state, piece) {
  return mapFilter(paths, function(path) {
    var loc = piece.loc;
    var data = startData;

    for (var i = 0; i < path.length; i++) {
      loc = locPlus(loc, path[i]);

      if (!isInBounds(state.board, loc)) {
        return null;
      }

      var result = controller(game, state, piece, loc, data);
      var directive = result[0];
      data = result[1];

      if (directive === 'stop here exclusive') {
        return null;
      }

      if (directive === 'stop here inclusive' && i !== path.length - 1) {
        return null;
      }

      if (directive === 'continue no stop' && i === path.length - 1) {
        return null;
      }
    }

    // If we got here then the move is semi-legal, and loc is the destination.
    return {
      piece: piece,
      type: 'selfmove',
      params: {
        to: loc
      }
    };
  });
}

var simpleSelfmoveGenerator = function(controller) {
  return function(game, state, params, piece, paths) {
    if (!paths) {
      paths = getPieceType(game, piece).movementRule.paths[piece.color];
    }

    return generateSelfmoves(controller, null, paths, game, state, piece);
  }
};

var stubMoveGenerator = function() {
  return [];
}

var getNestableGenerator = function(rule, mood) {
  return simpleSelfmoveGenerator(nestableMoveControllers[rule.type][mood]);
}

var semiLegalMovesForPieceType = {
  'walker': simpleSelfmoveGenerator(regularMovementController),
  'rider': simpleSelfmoveGenerator(regularMovementController),
  'leaper': simpleSelfmoveGenerator(leaperMovementController),
  'leaprider': simpleSelfmoveGenerator(leaperMovementController),

  'exchange': function(game, state, params, piece) {
    var regularGenerator = getNestableGenerator(params.regularMove, 'regular');

    var destLocs = allBoardLocs(state.board).filter(function(loc) {
      var otherPiece = getSquare(state.board, loc);
      return otherPiece && otherPiece.color === piece.color &&
        otherPiece.type === params.type;
    });

    return regularGenerator(game, state, params, piece, params.regularMove.paths[piece.color])
      .concat(destLocs.map(function(loc) {
        return {
          piece: piece,
          type: 'exchange',
          params: {
            to: loc
          }
        };
      }));
  },

  'retreat': function(game, state, params, piece) {
    var regularGenerator = getNestableGenerator(params.regularMove, 'regular');

    var retreatCols = params.squares === 'both' ?
      [0,1,2,3,4,5,6,7] :
      (params.squares === piece.color ?
        [1,3,5,7] : [0,2,4,6])

    var retreatRow = piece.color === 'black' ? 7 : 0;

    var retreatLocs = retreatCols.map(function(col) {
      return { row: retreatRow, col: col };
    }).filter(function(loc) {
      return !getSquare(state.board, loc);
    });

    var retreatMoves = retreatLocs.map(function(loc) {
      return {
        piece: piece,
        type: 'selfmove',
        params: {
          to: loc
        }
      };
    });

    return regularGenerator(game, state, params, piece, params.regularMove.paths[piece.color])
      .concat(retreatMoves);
  },

  'catapult': simpleSelfmoveGenerator(makeCatapultMovementController(true, true)),
  'grasshopper': simpleSelfmoveGenerator(makeGrasshopperMovementController(true, true)),
  'leapfrog': simpleSelfmoveGenerator(makeLeapfrogMovementController(true, true)),

  'movecapture': function(game, state, params, piece) {
    var captureGenerator = getNestableGenerator(params.capture, 'captureOnly');
    var moveGenerator = getNestableGenerator(params.move, 'moveOnly');

    return captureGenerator(game, state, params, piece, params.capture.paths[piece.color])
      .concat(moveGenerator(game, state, params, piece, params.move.paths[piece.color]));
  },

  'combination': function(game, state, params, piece) {
    var firstGenerator = getNestableGenerator(params.first, 'regular');
    var secondGenerator = getNestableGenerator(params.second, 'regular');

    return firstGenerator(game, state, params, piece, params.first.paths[piece.color])
      .concat(secondGenerator(game, state, params, piece, params.second.paths[piece.color]));
  }
}

var semiLegalMovesForPiece = function(game, state, piece) {
  var movementRule = getPieceType(game, piece).movementRule;
  return semiLegalMovesForPieceType[movementRule.type]
    (game, state, movementRule.params, piece);
}

var moveIsSemiLegalForPiece = function(game, state, move, piece) {
  return !!_.find(semiLegalMovesForPiece(game, state, move.piece),
    function(otherMove) {
      return moveEq(move, otherMove);
    });
}

var testSemiLegalMoves = function() {
  var game = generateGame();
  var state = getCurrentState(game);

  forEachLoc(state.board, function(loc) {
    var piece = getSquare(state.board, loc);

    if (piece) {
      console.log(semiLegalMovesForPiece(game, state, piece));
    }
  })
}

var moveIsSemiLegal = function(game, state, move) {
  return move.piece.color === state.playerToMove &&
    moveIsSemiLegalForPiece(game, state, move, move.piece);
}

var semiLegalMoves = function(game, state) {
  return _.flatten(allBoardLocs(state.board).map(function(loc) {
    var piece = getSquare(state.board, loc);
    if (piece && piece.color === state.playerToMove) {
      return semiLegalMovesForPiece(game, state, piece);
    } else {
      return [];
    }
  }));
}

///////////////////////////////////////////////////////////////////////////////
//
// Check, game statuses, and move legality.
//
///////////////////////////////////////////////////////////////////////////////

// Says whether in the given state, the player to move can capture a royal piece.
function playerToMoveCanCaptureRoyalPiece(game, state) {
  var moves = semiLegalMoves(game, state);
  var enemyRoyalPieces = [];
  var result = false;

  forEachLoc(state.board, function(loc) {
    var piece = getSquare(state.board, loc);

    if (piece && piece.color === colorOpponent(state.playerToMove) &&
        getPieceType(game, piece).royal) {
      enemyRoyalPieces.push(piece);
    }
  })

  return _.some(moves, function(move) {
    return _.some(enemyRoyalPieces, function(piece) {
      return move.type === 'selfmove' && _.isEqual(piece.loc, move.params.to);
    });
  })
}

// Says whether in the given state, the given player is in check.
function isInCheck(game, state, playerColor) {
  var newState = _.clone(state);
  newState.playerToMove = colorOpponent(playerColor);
  return playerToMoveCanCaptureRoyalPiece(game, newState);
}

// Given a game and a state, lists all legal moves for the player to move.
var legalMoves = function(game, state) {
  return semiLegalMoves(game, state).filter(function(move) {
    var newState = executeMove(game, state, move);
    return !isInCheck(game, state, state.playerToMove);
  });
}

// Given a game and a move, says whether the move is legal in the given state.
var moveIsLegal = function(game, state, move) {
  if (moveIsSemiLegal(game, state, move)) {
    var newState = executeMove(game, state, move);
    return !isInCheck(game, newState, state.playerToMove);
  } else {
    return false;
  }
}

var moveIsLegalInCurrentState = function(game, move) {
  return moveIsLegal(game, getCurrentState(game), move);
}

///////////////////////////////////////////////////////////////////////////////
//
// Move notations. Currently, we use chess algebraic notation, since our
// board and pieces are compatible with this.
//
///////////////////////////////////////////////////////////////////////////////

function displayRowAlgebraic(rowNum) {
  return (rowNum + 1).toString();
}

function displayColAlgebraic(colNum) {
  var COL_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  return COL_NAMES[colNum];
}

function displayLocAlgebraic(loc) {
  return displayColAlgebraic(loc.col) + displayRowAlgebraic(loc.row);
}

var typeAlgebraicNotations = ['','R','N','B','Q','K'];

function displayPieceTypeAlgebraic(type) {
  // XXX: Depends on details of how piece types are currently generated.
  // This is OK because we can't change the piece type generation code
  // without rethinking how this function works anyway.
  return typeAlgebraicNotations[type];
}

// Returns the algebraic notation for the given move from the given
// state.
function displayMoveAlgebraic(game, state, move) {
  // The moves which have the same destination as this move and the
  // same rank of piece.
  var ambiguousMoves = legalMoves(game, state).filter(function(otherMove) {
    return _.isEqual(move.params.to, otherMove.params.to) &&
      move.piece.type === otherMove.piece.type &&
      !moveEq(move, otherMove);
  });

  var disambiguationString;

  if (ambiguousMoves.length > 0) {
    if (_.each(ambiguousMoves.map(function(otherMove) {
          return otherMove.piece.loc.col !== move.piece.loc.col;
        }))) {
      disambiguationString = displayColAlgebraic(move.piece.loc.col);
    } else if (_.each(ambiguousMoves.map(function(otherMove) {
          return otherMove.piece.loc.row !== move.piece.loc.row;
        }))) {
      disambiguationString = displayRowAlgebraic(move.piece.loc.row);
    } else {
      disambiguationString = displayLocAlgebraic(move.piece.loc);
    }
  } else {
    disambiguationString = '';
  }

  // XXX: capture notation?
  return displayPieceTypeAlgebraic(move.piece.type) +
    disambiguationString +
    displayLocAlgebraic(move.params.to);
}

///////////////////////////////////////////////////////////////////////////////
// Node exports
///////////////////////////////////////////////////////////////////////////////

if (typeof window === 'undefined') {
  module.exports = {
    generateGame: generateGame,
    moveIsLegalInCurrentState: moveIsLegalInCurrentState,
    executeMoveInGame: executeMoveInGame,
    getCurrentState: getCurrentState
  };
}
