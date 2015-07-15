function SHOW() {
  console.log.apply(console, arguments);
  return arguments[arguments.length - 1];
}

function all(bools) {
  return bools.reduce(function(a,b) {
    return a && b;
  }, true);
}

// All arguments are assumed to be arrays. Appends each argument after
// the first to the first, destructively. Returns the resulting array.
function append(first) {
  for (var i = 1; i < arguments.length; i++) {
    for (var j = 0; j < arguments[i].length; j++) {
      first.push(arguments[i][j]);
    }
  }

  return first;
}

// Returns all the subsets of the given array, preserving order.
function subsets(a) {
  if (a.length === 0) {
    return [[]];
  } else {
    var smallerSubsets = subsets(_.rest(a));
    return smallerSubsets.concat(smallerSubsets.map(function(subset) {
      return [_.first(a)].concat(subset);
    }));
  }
}

// Takes an array of pairs of probabilities and values, returning a randomly
// selected value according to the given weights. The weights should add up
// to 1.
function randomSelect(options) {
  var rand = Math.random();
  var val = 0.0;

  for (var i = 0; i < options.length; i++) {
    val += options[i][0];

    if (rand < val) {
      return options[i][1];
    }
  }

  console.log("Error: didn't select anything from ", options);
}

//
// Types
//

// Colors
var BLACK = "B";
var WHITE = "W";

function colorOpponent(color) {
  if (color === BLACK) {
    return WHITE;
  } else {
    return BLACK;
  }
}

function colorAdvanceDir(color) {
  if (color === BLACK) {
    return -1;
  } else {
    return 1;
  }
}

var colorNames = (function() {
  var colorNames = {};
  colorNames[WHITE] = "white";
  colorNames[BLACK] = "black";
  return colorNames;
})();

//
// Board Locations
//
// A board location is an object with row and column properties.
// Locations are treated as immutable.
//

// Adds two locations.
function locPlus(loc1, loc2) {
  return { row: loc1.row + loc2.row, col: loc1.col + loc2.col };
}

// Says whether two locations are equal.
function locEq(loc1, loc2) {
  return loc1.row === loc2.row &&
         loc1.col === loc2.col;
}

//
//   A unit location difference is a location where row and col are both
//   one of -1, 0, or 1. It is understood as a differential to be applied
//   to a location.
//
//   A movement vector is an array of unit location differences. It is
//   understood as a specification of a movement that a piece might do, in
//   a stepwise fashion: move this way, then this way, etc.
//

//
// An iteration control is one of CONTINUE, STOP_HERE_INCLUSIVE, or
// STOP_HERE_EXCLUSIVE, CONTINUE_BUT_NO_STOP. When iterating through
// a sequence, they instruct:
//  CONTINUE: can consume this element and keep iterating.
//  STOP_HERE_INCLUSIVE: can consume this element but must stop iterating after.
//  STOP_HERE_EXCLUSIVE: cannot consume this element or keep iterating after.
//  CONTINUE_BUT_NO_STOP: can consume this element but must not stop at it,
//    i.e. must consume elements after it.
//

var CONTINUE = "continue";
var STOP_HERE_INCLUSIVE = "stop inclusive";
var STOP_HERE_EXCLUSIVE = "stop exclusive";
var CONTINUE_BUT_NO_STOP = "continue no stop";

//
// A movement controller is a function which takes the following inputs:
//   * state: a game state.
//   * piece: a piece.
//   * newLoc: a board location adjacent to the piece's current location.
// and produces an iteration control. The interpretation is that if you
// are trying to execute a move a single step at a time, you call the
// movement controller governing that movement at each step in the movement,
// to see whether you are allowed to continue (which depends e.g. on
// whether the piece is blocked).
//

// A movement controller manufacturing function for simple movement
// controllers. Makes a movement controller given specifications for
// what iteration controls to return in the case of moving into a square
// occupied by a friendly piece, a square occupied by an enemy piece, and
// an empty square.
function simpleMovementController(whenEmpty, whenFriendly, whenEnemy) {
  return function(state, piece, newLoc) {
    var newLocContents = state.board.get(newLoc);

    if (newLocContents) {
      // newLocContents is a piece occupying the square we're trying to
      // move into.
      if (newLocContents.color === piece.color) {
        return whenFriendly;
      } else {
        return whenEnemy;
      }
    } else {
      return whenEmpty;
    }
  };
}

//
// Movement types
//
// A movement type consists of the following data:
//  vector: A movement vector where all diffs are positive in all coordinates.
//  symmetry: one of SYMMETRY_HORIZONTAL,
//    SYMMETRY_FOUR_WAY, SYMMETRY_EIGHT_WAY.
//  repeat: A boolean, saying whether the vector can be repeated.
//  controller: A movement controller.
//

// XXX: Add another kind of diagonal symmetry, using the map (row,col) -> (row,-col).
var SYMMETRY_HORIZONTAL = "horizontal";
var SYMMETRY_FOUR_WAY = "four way";
var SYMMETRY_EIGHT_WAY = "eight way";

//
// Piece types
//
// A piece type consists of the following data:
//  movementTypes: An array of movement types.
//  royal: A boolean. Royal pieces can be checkmated.
//  name: A string.
//

//
// Piece type generation
//

// The different movement vectors we use:
var MOVEMENT_VECTORS = [
  [{ row: 1, col: 0 }],
  [{ row: 1, col: 1 }],
  [{ row: 1, col: 0 }, { row: 0, col: 1 }],
  [{ row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 0 }],
  [{ row: 1, col: 0 }, { row: 1, col: 0 }, { row: 0, col: 1 }],
  [{ row: 1, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }],
  [{ row: 1, col: 1 }, { row: 1, col: 0 }],
  [{ row: 1, col: 0 }, { row: 1, col: 1 }]
];

// Returns the horizontal length of a vector.
function vectorHorizLength(vector) {
  return Math.abs(_.sum(vector.map(function(diff) {
    return diff.col;
  })));
}

// Returns the vertical length of a vector.
function vectorVertLength(vector) {
  return Math.abs(_.sum(vector.map(function(diff) {
    return diff.row;
  })));
}

// Takes a starting location and a movement vector, and produces the board
// location that results from moving according to the movement spec from
// the starting location.
function vectorToLoc(startLoc, vector) {
  var endLoc = startLoc;

  for (var i = 0; i < vector.length; i++) {
    endLoc = locPlus(endLoc, vector[i]);
  }

  return endLoc;
}

// Flips a vector vertically.
function flipVectorVert(vector) {
  return vector.map(function(diff) {
    return { row: -diff.row, col: diff.col };
  });
}

// The different movement controllers we use are classified as follows.
// The two movement "classes" are REGULAR and LEAP. Furthermore, a movement
// type can allow or disallow capturing. XXX: Add hopping.
// Leapers can never repeat, except for some royals, and regulars can always
// repeat.

var MOVEMENT_REGULAR = "regular";
var MOVEMENT_LEAP = "leap";

function getMovementController(movementClass, canCapture) {
  if (movementClass === MOVEMENT_REGULAR) {
    return simpleMovementController(CONTINUE, STOP_HERE_EXCLUSIVE,
      canCapture ? STOP_HERE_INCLUSIVE : STOP_HERE_EXCLUSIVE);
  } else {
    return simpleMovementController(CONTINUE, CONTINUE_BUT_NO_STOP,
     canCapture ? CONTINUE : CONTINUE_BUT_NO_STOP);
  }
}

// We classify piece types into three kinds: lowly, major, and royal.
// Each kind has a different generation algorithm.

//
// Generating lowly piece types
//

var LOWLY_CAPTURE_VECTORS = [
 [0.5, MOVEMENT_VECTORS[0]], [0.4, MOVEMENT_VECTORS[1]],
 [0.1, MOVEMENT_VECTORS[2]]
];

var LOWLY_SYMMETRIES = [
  [0.8, SYMMETRY_HORIZONTAL], [0.2, SYMMETRY_FOUR_WAY]
]

// Lowly pieces are always leapers that move one square.
function generateLowlyMovementType(canCapture) {
  var vector = canCapture ?
    randomSelect(LOWLY_CAPTURE_VECTORS) :
    MOVEMENT_VECTORS[0];

  return {
    vector: vector,
    symmetry: randomSelect(LOWLY_SYMMETRIES),
    repeat: false,
    controller: getMovementController(MOVEMENT_LEAP, canCapture)
  };
}

function generateLowlyPieceType(name) {
  var captureIsDifferent = Math.random() <= 0.6;
  var movementTypes = captureIsDifferent ?
    [generateLowlyMovementType(true), generateLowlyMovementType(false)] :
    [generateLowlyMovementType(true)];

  return {
    movementTypes: movementTypes,
    royal: false,
    name: name
  };
}

//
// Generating major piece types
//

var MAJOR_REGULAR_VECTORS = [
  [0.2, MOVEMENT_VECTORS[0]],
  [0.2, MOVEMENT_VECTORS[1]],
  [0.2, MOVEMENT_VECTORS[2]],
  [0.05, MOVEMENT_VECTORS[3]],
  [0.05, MOVEMENT_VECTORS[4]],
  [0.05, MOVEMENT_VECTORS[5]],
  [0.125, MOVEMENT_VECTORS[6]],
  [0.125, MOVEMENT_VECTORS[7]]
];

var MAJOR_LEAP_VECTORS = [
  [0.0, MOVEMENT_VECTORS[0]],
  [0.0, MOVEMENT_VECTORS[1]],
  [0.0, MOVEMENT_VECTORS[2]],
  [0.2, MOVEMENT_VECTORS[3]],
  [0.2, MOVEMENT_VECTORS[4]],
  [0.2, MOVEMENT_VECTORS[5]],
  [0.2, MOVEMENT_VECTORS[6]],
  [0.2, MOVEMENT_VECTORS[7]]
];

var MAJOR_MOVEMENT_CLASSES = [
  [0.7, MOVEMENT_REGULAR],
  [0.3, MOVEMENT_LEAP]
];

var MAJOR_SYMMETRIES = [
  [0.0, SYMMETRY_HORIZONTAL],
  [0.8, SYMMETRY_FOUR_WAY],
  [0.2, SYMMETRY_EIGHT_WAY]
];

function generateMajorMovementType(canCapture) {
  var movementClass = randomSelect(MAJOR_MOVEMENT_CLASSES);

  return {
    vector: randomSelect(movementClass === MOVEMENT_REGULAR ?
      MAJOR_REGULAR_VECTORS : MAJOR_LEAP_VECTORS),
    symmetry: randomSelect(MAJOR_SYMMETRIES),
    repeat: movementClass === MOVEMENT_REGULAR,
    controller: getMovementController(movementClass, canCapture)
  }
}

var VARIETY_ONE_MOVE = 'one move';
var VARIETY_TWO_MOVE = 'two move';
var VARIETY_ONE_MOVE_ONE_CAPTURE = 'one move one capture';
var VARIETY_TWO_MOVE_ONE_CAPTURE = 'two move one capture';

var MAJOR_MOVEMENT_VARIETIES = [
  [0.8, VARIETY_ONE_MOVE],
  [0.05, VARIETY_TWO_MOVE],
  [0.1, VARIETY_ONE_MOVE_ONE_CAPTURE],
  [0.05, VARIETY_TWO_MOVE_ONE_CAPTURE]
];

function generateMajorPieceType(name) {
  var movementVariety = randomSelect(MAJOR_MOVEMENT_VARIETIES);
  var movementTypes;

  switch (movementVariety) {
    case VARIETY_ONE_MOVE:
      movementTypes = [generateMajorMovementType(true)];
      break;
    case VARIETY_TWO_MOVE:
      movementTypes = [
        generateMajorMovementType(true),
        generateMajorMovementType(true)
      ];
      break;
    case VARIETY_ONE_MOVE_ONE_CAPTURE:
      movementTypes = [
        generateMajorMovementType(true),
        generateMajorMovementType(false)
      ];
      break;
    case VARIETY_TWO_MOVE_ONE_CAPTURE:
      movementTypes = [
        generateMajorMovementType(true),
        generateMajorMovementType(false)
      ];
      break;
  }

  return {
    movementTypes: movementTypes,
    royal: false,
    name: name
  };
}

//
// Generating royal piece types
//

var ROYAL_VECTORS = [
  [0.3, MOVEMENT_VECTORS[0]],
  [0.3, MOVEMENT_VECTORS[1]],
  [0.3, MOVEMENT_VECTORS[2]],
  [0.01, MOVEMENT_VECTORS[3]],
  [0.01, MOVEMENT_VECTORS[4]],
  [0.01, MOVEMENT_VECTORS[5]],
  [0.035, MOVEMENT_VECTORS[6]],
  [0.035, MOVEMENT_VECTORS[7]]
];

var ROYAL_MOVEMENT_CLASSES = [
  [1.0, MOVEMENT_REGULAR],
  [0.0, MOVEMENT_LEAP]
];

var ROYAL_SYMMETRIES = [
  [0.0, SYMMETRY_HORIZONTAL],
  [0.3, SYMMETRY_FOUR_WAY],
  [0.7, SYMMETRY_EIGHT_WAY]
];

function generateRoyalMovementType() {
  var movementClass = randomSelect(ROYAL_MOVEMENT_CLASSES);

  return {
    vector: randomSelect(ROYAL_VECTORS),
    symmetry: randomSelect(ROYAL_SYMMETRIES),
    repeat: Math.random() <= 0.3,
    controller: getMovementController(movementClass, true)
  };
}

function generateRoyalPieceType(name) {
  return {
    movementTypes: [generateRoyalMovementType()],
    royal: true,
    name: name
  };
}

//
// A piece set consists of the following data:
//  lowlyPieces: An array of lowly pieces.
//  highPieces: An array of major and royal pieces.
// Currently the piece set matches the structure of the chess set, but
// this should be generalized.
//

function generatePieceSet() {
  var pawn = generateLowlyPieceType("Pawn");
  var rook = generateMajorPieceType("Rook");
  var knight = generateMajorPieceType("Knight");
  var bishop = generateMajorPieceType("Bishop");
  var queen = Math.random() <= 0.3 ?
    generateRoyalPieceType("Queen") : generateMajorPieceType("Queen");
  var king = generateRoyalPieceType("King");

  return {
    lowlyPieces: [pawn, pawn, pawn, pawn, pawn, pawn, pawn, pawn],
    highPieces: _.shuffle([rook, knight, bishop, queen, king, bishop, knight, rook])
  };
}

//
// Piece:
//   A piece is an object with properties:
//     color: The piece's color.
//     type: The piece's type.
//     loc: The board location the piece inhabits.
//
//   Pieces are immutable.
//
// BoardConfig:
//   A board configuration is an object with methods get() and set() taking
//   board locations. The contents of a square are a piece or null.
//   Board configurations are mutable.
//
// Currently boards have to be 8x8. This should be changed.
//


// Returns a duplicate of the piece with a new location.
function movedPiece(piece, newLoc) {
  var newPiece = copyPiece(piece);
  newPiece.loc = newLoc;
  return newPiece;
}

// Says whether two pieces are equal.
function pieceEq(piece1, piece2) {
  return piece1.color === piece2.color &&
         piece1.type === piece2.type &&
         locEq(piece1.loc, piece2.loc);
}

// Copies a piece.
function copyPiece(piece) {
  return {
    color: piece.color,
    type: piece.type,
    loc: piece.loc
  };
}

// Makes a board configuration with undefined contents.
function makeBoardConfig() {
  var board = {};

  board.array = new Array(8);
  for (var i = 0; i < 8; i++) {
    board.array[i] = new Array(8);
  }

  board.get = function(loc) {
    return this.array[loc.row][loc.col];
  };

  board.set = function(loc, val) {
    this.array[loc.row][loc.col] = val;
  };

  return board;
}

// Duplicates a board configuration.
function copyBoardConfig(board) {
  var newBoard = makeBoardConfig();

  allBoardLocs.forEach(function(loc) {
    newBoard.set(loc, board.get(loc));
  });

  return newBoard;
}

// An array of all board locations.
var allBoardLocs = (function() {
  var result = [];

  for (var row = 0; row < 8; row++) {
    for (var col = 0; col < 8; col++) {
      result.push({ row: row, col: col });
    }
  }

  return result;
})();

// Says whether the given board location is in bounds.
function inBounds(loc) {
  return 0 <= loc.row && loc.row <= 7 && 0 <= loc.col && loc.col <= 7;
}

//
// GameState:
//   A game state is an object with properties:
//     board: A board configuration.
//     playerToMove: Player whose turn it is (i.e., their color).
//     status: One of GAME_NOT_OVER, CHECKMATE (for the player to move),
//      or STALEMATE (where the player to move has no moves).
//     capturedPieces: An array of all captured pieces.
//

var GAME_NOT_OVER = "game not over";
var STALEMATE = "stalemate";
var CHECKMATE = "checkmate";

// Duplicates a game state with only the properties needed for move search.
function copyGameStateLean(state) {
  return {
    board: copyBoardConfig(state.board),
    kingLocs: { B: state.kingLocs[BLACK], W: state.kingLocs[WHITE] },
    playerToMove: state.playerToMove,
    capturedPieces: []
  };
}

// Does a shallow copy of a game state.
function copyGameStateShallow(state) {
  return {
    board: state.board,
    kingLocs: state.kingLocs,
    playerToMove: state.playerToMove,
    capturedPieces: state.capturedPieces
  }
}

// Duplicates a game state.
function copyGameState(state) {
  return {
    board: copyBoardConfig(state.board),
    playerToMove: state.playerToMove,
    status: state.status,
    capturedPieces: state.capturedPieces.slice(0, state.capturedPieces.length)
  };
}

//
// Move:
//   A move is an object with properties:
//     piece
//     newLoc
//

// Says whether two moves are equal.
function moveEq(move1, move2) {
  return pieceEq(move1.piece, move2.piece) &&
         locEq(move1.newLoc, move2.newLoc);
}

// Does a shallow copy of a move.
function copyMove(move) {
  return {
    piece: move.piece,
    newLoc: move.newLoc
  }
}

//
// Starting game state
//

// Takes a board config and fills the back row for the given color with the
// starting pieces, assuming that the given row number is the back row.
function makeStartingFirstRow(pieceSet, board, color, row) {
  for (var col = 0; col <= 7; col++) {
    var loc = { row: row, col: col };
    board.set(loc,
      { color: color, type: pieceSet.highPieces[col], loc: loc });
  }
}

function makeStartingSecondRow(pieceSet, board, color, row) {
  for (var col = 0; col <= 7; col++) {
    var loc = { row: row, col: col };
    board.set(loc,
      { color: color, type: pieceSet.lowlyPieces[col], loc: loc });
  }
}

function makeBlankRow(board, row) {
  for (var col = 0; col <= 7; col++) {
    board.set({ row: row, col: col }, null);
  }
}

function makeStartingBoardConfig(pieceSet) {
  var board = makeBoardConfig();

  makeStartingFirstRow(pieceSet, board, WHITE, 0);
  makeStartingSecondRow(pieceSet, board, WHITE, 1);

  for (var i = 2; i <= 5; i++) {
    makeBlankRow(board, i);
  }

  makeStartingSecondRow(pieceSet, board, BLACK, 6);
  makeStartingFirstRow(pieceSet, board, BLACK, 7);

  return board;
}

function makeStartingGameState(pieceSet) {
  return {
    board: makeStartingBoardConfig(pieceSet),
    playerToMove: WHITE,
    status: GAME_NOT_OVER,
    capturedPieces: []
  };
}

//
// Move generation
//

// Takes a move specified by a movement vector, a movement controller, and
// a piece, and says whether the move is allowed by the movement controller
// in the given game state. Disallows moves which go outside of the board.
function moveIsAllowed(state, spec, controller, piece) {
  if (spec.length === 0) {
    // No move goes for zero squares.
    return false;
  } else {
    var newLoc = locPlus(spec[0], piece.loc);

    if (inBounds(newLoc)) {
      var iterControl = controller(state, piece, newLoc);

      if (spec.length === 1) {
        return iterControl === STOP_HERE_INCLUSIVE ||
               iterControl === CONTINUE;
      } else {
        if (iterControl === CONTINUE ||
            iterControl === CONTINUE_BUT_NO_STOP) {
          return moveIsAllowed(state, spec.slice(1, spec.length), controller,
            movedPiece(piece, newLoc));
        } else {
          return false;
        }
      }
    } else {
      return false;
    }
  }
}

// This function takes a game state, a list of movement vectors, a movement
// controller, and a piece. It returns all moves specified by one of the
// vectors which are allowed for the given piece in the given state by the
// given controller. It can specify the semi-legal moves for pieces with
// simple movement rules. It returns an array of moves.
function findMoves(state, vectors, controller, piece) {
  var moves = [];

  for (var i = 0; i < vectors.length; i++) {
    if (moveIsAllowed(state, vectors[i], controller, piece)) {
      moves.push({ piece: piece,
        newLoc: vectorToLoc(piece.loc, vectors[i]) });
    }
  }

  return moves;
}

// Locaction rotations
var horizFlip = function(loc) {
  return { row: loc.row, col: -loc.col };
};

var vertFlip = function(loc) {
  return { row: -loc.row, col: loc.col };
};

var diagFlip = function(loc) {
  return { row: loc.col, col: loc.row };
};

var SYMMETRY_MAPS = {};
SYMMETRY_MAPS[SYMMETRY_HORIZONTAL] = [horizFlip];
SYMMETRY_MAPS[SYMMETRY_FOUR_WAY] = [vertFlip, horizFlip];
SYMMETRY_MAPS[SYMMETRY_EIGHT_WAY] = [vertFlip, horizFlip, diagFlip];

// This function takes a movement vector and a symmetry type and returns
// the list of movement vectors resulting from the rotations specified
// by the symmetry type. XXX: Currently, it might return duplicates.
function vectorRotations(vector, symmetry) {
  var symmetryMaps = SYMMETRY_MAPS[symmetry];
  var transformations = subsets(symmetryMaps)
    .map(function(transformationArray) {
      return transformationArray.reduce(function(f,g) {
        return _.flowRight(f,g);
      }, _.identity);
    });
  return transformations.map(function(transformation) {
    return vector.map(transformation);
  });
}

// Takes a vector and produces all repetitions of the vectors which
// fit inside the board.
function vectorRepetitions(vector) {
  var repetitions = [];
  var repeatedVector = vector;

  while (vectorHorizLength(repeatedVector) <= 8 &&
         vectorVertLength(repeatedVector) <= 8) {
    repetitions.push(repeatedVector);
    repeatedVector = repeatedVector.concat(vector);
  }

  return repetitions;
}

function movementTypeVectors(color, type) {
  var vectorOrienter = color === BLACK ? flipVectorVert : _.identity;
  var vector = vectorOrienter(type.vector);

  var repeatFunc = type.repeat ? vectorRepetitions : function(a) { return [a]; };

  var rotatedVectors = vectorRotations(vector, type.symmetry);
  return _.flatten(rotatedVectors.map(repeatFunc));
}

// Takes a state and a piece, and returns all semi-legal moves for that piece.
function pieceSemiLegalMoves(state, piece) {
  return _.flatten(piece.type.movementTypes.map(function(movementType) {
    return findMoves(state, movementTypeVectors(piece.color, movementType),
      movementType.controller, piece);
  }));
}

//
// Semi-legality: a semi-legal move is a move which is legal except that it
// might leave the player in check.
//

// Returns all semi-legal moves from the given board location for the
// player of the given color in the given state.
function semiLegalMovesFromLoc(state, loc) {
  var piece = state.board.get(loc);

  if (piece !== null && piece.color === state.playerToMove) {
    return pieceSemiLegalMoves(state, piece); // XXX
  } else {
    return [];
  }
}

// Says whether the given move is semi-legal in the given state.
function moveIsSemiLegal(state, move) {
  var possibleMoves = semiLegalMovesFromLoc(state, move.piece.loc);
  var isSemiLegal = false;

  for (var i = 0; i < possibleMoves.length; i++) {
    if (moveEq(move, possibleMoves[i])) {
      isSemiLegal = true;
    }
  }

  return isSemiLegal;
}

// Returns all semi-legal moves in the given state.
function semiLegalMoves(state) {
  var result = [];

  allBoardLocs.forEach(function(loc) {
    append(result, semiLegalMovesFromLoc(state, loc));
  });

  return result;
}

//
// Execution of moves
//

// Takes a state and a move, which is assumed to be legal. Updates the
// state in place to reflect the result of making the move.
// Does not change the active player if doNotChangePlayerToMove is true.
// Returns any captured piece, or null if no piece was captured.
// Does not update the game status. (Should it?)
function executeMove(state, move, doNotChangePlayerToMove) {
  state.board.set(move.piece.loc, null);
  var capturedPiece = state.board.get(move.newLoc);
  var newPiece = movedPiece(move.piece, move.newLoc);
  state.board.set(move.newLoc, newPiece);

  if (!doNotChangePlayerToMove) {
    state.playerToMove = colorOpponent(state.playerToMove);
  }

  if (capturedPiece) {
    state.capturedPieces.push(capturedPiece);
  }
}

//
// Move construction
//

// Returns true if the given move is a move of a pawn onto the opponent's
// first row.
function couldPromotePawn(move) {
  return move.newLoc.row === (move.piece.color === BLACK ? 0 : 7) &&
    move.piece.rank === PAWN;
}

// Given a game state and start and end board locations, creates a move
// from the one location to the other, applying the appropriate flags.
// Returns null if there is no piece at the starting location or one of the
// locations is out of bounds.
function createMove(state, loc1, loc2) {
  if (inBounds(loc1) && inBounds(loc2)) {
    var piece = state.board.get(loc1);

    if (piece) {
      return { piece: piece, newLoc: loc2 };
    }
  }

  return null;
}


//
// Game object
//

function Game() {
  this.pieceSet = generatePieceSet();
  // A log of all the game states that have occurred, including the
  // current one.
  this.stateLog = [makeStartingGameState(this.pieceSet)];
  this.currentStateIndex = 0;
  this.stateBeingViewedIndex = 0;
  this.planningMode = false;

  // A log of all the moves that have occurred. Move n resulted in
  // state n+1.
  this.moveLog = [];

  // A log (for performance) of the algebraic notation of each move.
  this.moveAlgebraicNotations = [];

  // Gets the state being viewed.
  this.getStateBeingViewed = function() {
    return this.stateLog[this.stateBeingViewedIndex];
  }

  // Removes states after the given index.
  this.truncateStateLog = function(index) {
    this.stateLog = this.stateLog.slice(0, index + 1);
    this.moveLog = this.moveLog.slice(0, index);
    // this.moveAlgebraicNotations = this.moveAlgebraicNotations.slice(0, index); // XXX
  }

  // Updates the state to the new given state, which was produced by
  // the given move. Assumes the state being viewed is no earlier than the
  // current state. Removes any states after the one being viewed.
  this.updateState = function(newState, move) {
    if (this.stateBeingViewedIndex >= this.currentStateIndex) {
      this.truncateStateLog(this.stateBeingViewedIndex);
      this.stateLog.push(newState);
      this.moveLog.push(move);
      // this.moveAlgebraicNotations.push(
      //   displayMoveAlgebraic(this.getStateBeingViewed(), move)); // XXX

      if (!this.planningMode) {
        this.currentStateIndex++;
      }

      this.stateBeingViewedIndex++;
    }
  };

  // Enter and exit planning mode.
  this.enterPlanningMode = function() {
    this.planningMode = true;
  }

  this.exitPlanningMode = function() {
    this.planningMode = false;
    this.truncateStateLog(this.currentStateIndex);
    this.stateBeingViewedIndex = Math.min(this.stateBeingViewedIndex, this.currentStateIndex);
  }

  this.commitFirstPlannedMove = function() {
    if (this.planningMode && this.stateLog.length > this.currentStateIndex + 1) {
      var firstPlannedMove = this.moveLog[this.currentStateIndex + 1 - 1];
      this.exitPlanningMode();
      this.performMove(firstPlannedMove);
    }
  }

  // Takes a move and, if the move is legal, performs it and updates the
  // game state. It returns true if the move was legal. Also, only
  // operative if the state being viewed is no earlier than the current state.
  // Overwrites any states after the one being viewed.
  this.performMove = function(move) {
    var state = this.getStateBeingViewed();

    if (this.stateBeingViewedIndex >= this.currentStateIndex &&
        moveIsSemiLegal(state, move)) { // XXX: Change to legal
      // console.log(displayMoveAlgebraic(this.state, move));

      var newState = copyGameState(state);
      executeMove(newState, move);
      // newState.status = gameStatus(newState); // XXX
      this.updateState(newState, move);

      // console.log(this);

      return true;
    } else {
      return false;
    }
  };
}
