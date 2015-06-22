// Status:
//  * Move execution is completely implemented, but not tested for moves
//    that are not yet generated.
//  * Moves still to be generated are double pawn moves, pawn captures,
//    en passant, and castling.
//  * Checking for check and testing for legal moves are not
//    implemented.

//
// Utility
//

// An iterator is a function which will return the next thing in the iteration,
// or null when it's done.

//
// Types
//

// Colors
var BLACK = "B";
var WHITE = "W";

function colorOpponent(color) {
  if (color == BLACK) {
    return WHITE;
  } else {
    return BLACK;
  }
}

function colorAdvanceDir(color) {
  if (color == BLACK) {
    return -1;
  } else {
    return 1;
  }
}

// Ranks
var PAWN = "P";
var ROOK = "R";
var KNIGHT = "N";
var BISHOP = "B";
var QUEEN = "Q";
var KING = "K";

//
// Board Locations
//
// A board location is an object with row and colum properties.
//

// Returns a new iterator over all the board locations.
function allBoardLocs() {
  var row = 0;
  var col = 0;

  return function() {
    if (col <= 7) {
      return { row: row, col : col++ };
    } else if (row < 7) {
      col = 0;
      row++;
      return { row: row, col: col };
    } else {
      return null;
    }
  };
}

// Says whether the given board location is in bounds.
function inBounds(loc) {
  return 0 <= loc.row && loc.row <= 7 && 0 <= loc.col && loc.col <= 7;
}

// Adds two locations.
function locPlus(loc1, loc2) {
  return { row: loc1.row + loc2.row, col: loc1.col + loc2.col };
}

// Says whether two locations are equal.
function locEq(loc1, loc2) {
  return loc1.row == loc2.row &&
         loc1.col == loc2.col;
}

//
// More types:
//
// Piece:
//   A piece is an object with properties:
//     color: The piece's color.
//     rank: The piece's rank.
//     loc: The board location the piece inhabits.
//     hasBeenMoved: A boolean saying whether the piece has been moved
//       on a previous turn. Used with kings and rooks for determining
//       whether castling is legal.
//     justMovedDoubly: true for pawns which were moved doubly on the
//       last turn, and false for all other pieces. Used for determining
//       whether en passant is legal.
//
//   In addition, a pawn may have the property justMovedDoubly set to
//   true on the turn after it was moved doubly, to determine whether en
//   passant is legal.
//
// BoardConfig:
//   A board configuration is an object with methods get() and set() taking
//   board locations. The contents of a square are a piece or null.
//

// Makes a new piece given just color, rank, and location, setting
// hasBeenMoved to false and justMovedDoubly to false.
function makePiece(color, rank, loc) {
  return { color: color, rank: rank, loc: loc, hasBeenMoved: false,
    justMovedDoubly: false };
}

// Duplicates a piece.
function copyPiece(piece) {
  newPiece = {};
  newPiece.color = piece.color;
  newPiece.rank = piece.rank;
  newPiece.loc = piece.loc;
  newPiece.hasBeenMoved = piece.hasBeenMoved;
  newPiece.justMovedDoubly = piece.justMovedDoubly;
  return newPiece;
}

// Returns a duplicate of the piece with a new location.
function movedPiece(piece, newLoc) {
  var newPiece = copyPiece(piece);
  newPiece.loc = newLoc;
  return newPiece;
}

// Says whether two pieces are equal.
function pieceEq(piece1, piece2) {
  return piece1.color == piece2.color &&
         piece1.rank == piece2.rank &&
         locEq(piece1.loc, piece2.loc);
}

// Makes an empty board configuration.
function makeBoardConfig() {
  var board = new Object();

  board.array = new Array(8);
  for (var i = 0; i < 8; i++) {
    board.array[i] = new Array(8);
  }

  board.get = function(loc) {
    return board.array[loc.row][loc.col];
  };

  board.set = function(loc, val) {
    board.array[loc.row][loc.col] = val;
  };

  return board;
}

//
// GameState:
//   A game state is an object with properties:
//     board: A board configuration.
//     kingLocs: An object with properties BLACK and WHITE giving the location
//       of the black and white kings. Efficiently finding the kings is
//       useful for determining whether a player is in check.
//     playerToMove: Player whose turn it is (i.e., their color).
//
// Move:
//   A move is an object with properties:
//     piece
//     newLoc
//     flag: A movement flag, or null.
//   And optional properties:
//     promotionTo: Gives the rank to promote the pawn to, for a pawn promotion.
//     involvedRook: The rook involved in a castle move.
//
//   A castle is represented by the move of the king.
//

//
// Movement flags:
//
var PAWN_DOUBLE_MOVE = "pawn double move";
var EN_PASSANT = "en passant";
var PAWN_PROMOTION = "pawn promotion";
var CASTLE = "castle";

// Says whether two moves are equal.
function moveEq(move1, move2) {
  return pieceEq(move1.piece, move2.piece) &&
         locEq(move1.newLoc, move2.newLoc) &&
         move1.flag == move2.flag;
         // XXX: deal with promotionTo
}

//
// Starting game state
//

var startingBackRow = [ROOK, KNIGHT, BISHOP, QUEEN, KING, BISHOP, KNIGHT, ROOK];

// Takes a board config and fills the back row for the given color with the
// starting pieces, assuming that the given row number is the back row.
function makeStartingBackRow(board, color, row) {
  for (var col = 0; col <= 7; col++) {
    var loc = { row: row, col: col };
    board.set(loc,
      makePiece(color, startingBackRow[col], loc));
  }
}

function makePawnRow(board, color, row) {
  for (var col = 0; col <= 7; col++) {
    var loc = { row: row, col: col };
    board.set(loc,
      makePiece(color, PAWN, loc));
  }
}

function makeBlankRow(board, row) {
  for (var col = 0; col <= 7; col++) {
    board.set({ row: row, col: col }, null);
  }
}

function makeStartingBoardConfig() {
  var board = makeBoardConfig();

  makeStartingBackRow(board, WHITE, 0);
  makePawnRow(board, WHITE, 1);

  for (var i = 2; i <= 5; i++) {
    makeBlankRow(board, i);
  }

  makePawnRow(board, BLACK, 6);
  makeStartingBackRow(board, BLACK, 7);

  return board;
}

function makeStartingGameState() {
  return {
    board: makeStartingBoardConfig(),
    kingsAndRooksMoved: [],
    pawnJustMovedDoubly: null,
    kingLocs: {
      W: { row: 0, col: 4 },
      B: { row: 0, col: 4 }
    },
    playerToMove: WHITE
  };
}

//
// Basic concepts used to implement the listing of legal moves.
//
// Types:
//   A unit location difference is a location where row and col are both
//   one of -1, 0, or 1. It is understood as a differential to be applied
//   to a location.
//
//   A movement spec is an array of unit location differences. It is
//   understood as a specification of a movement that a piece might do, in
//   a stepwise fashion: move this way, then this way, etc.

// Takes a starting location and a movement spec, and produces the board
// location that results from moving according to the movement spec from
// the starting location.
function specToLoc(startLoc, spec) {
  var endLoc = startLoc;

  for (var i = 0; i < spec.length; i++) {
    endLoc = locPlus(endLoc, spec[i]);
  }

  return endLoc;
}

// Produces all the movement specs that are a result of applying one of the
// given unit location differences up to n times in a row.
function linearMovementSpecs(n, unitDiffs) {
  var specs = [];

  for (var i = 0; i < unitDiffs.length; i++) {
    for (var m = 1; m <= n; m++) {
      var spec = [];

      for (var k = 1; k <= m; k++) {
        spec.push(unitDiffs[i]);
      }

      specs.push(spec);
    }
  }

  return specs;
}

// Now some movement specs!

var straightLineMoves = linearMovementSpecs(8,
 [{ row: 0, col:  1 }, { row:  1, col: 0 },
  { row: 0, col: -1 }, { row: -1, col: 0}]);

var diagonalMoves = linearMovementSpecs(8,
  [{ row:  1, col: 1 }, { row:  1, col: -1 },
   { row: -1, col: 1 }, { row: -1, col: -1}]);

// An iteration control is one of CONTINUE, STOP_HERE_INCLUSIVE, or
// STOP_HERE_EXCLUSIVE, CONTINUE_BUT_NO_STOP. When iterating through
// a sequence, they instruct:
//  CONTINUE: can consume this element and keep iterating.
//  STOP_HERE_INCLUSIVE: can consume this element but must stop iterating after.
//  STOP_HERE_EXCLUSIVE: cannot consume this element or keep iterating after.
//  CONTINUE_BUT_NO_STOP: can consume this element but must not stop at it,
//    i.e. must consume elements after it.

var CONTINUE = "continue";
var STOP_HERE_INCLUSIVE = "stop inclusive";
var STOP_HERE_EXCLUSIVE = "stop exclusive";
var CONTINUE_BUT_NO_STOP = "continue no stop";

// A movement controller is a function which takes the following inputs:
//   * state: a game state.
//   * piece: a piece.
//   * newLoc: a board location adjacent to the piece's current location.
// and produces an iteration control. The interpretation is that if you
// are trying to execute a move a single step at a time, you call the
// movement controller governing that movement at each step in the movement,
// to see whether you are allowed to continue (which depends e.g. on
// whether the piece is blocked).

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
      if (newLocContents.color == piece.color) {
        return whenFriendly;
      } else {
        return whenEnemy;
      }
    } else {
      return whenEmpty;
    }
  };
}

// Now a bunch of movement controllers!

// For pieces which can move through empty squares and capture enemy pieces
// (rook, bishop, etc.).
var canCaptureControl = simpleMovementController(
  CONTINUE, STOP_HERE_EXCLUSIVE, STOP_HERE_INCLUSIVE);

// For pieces which can move but cannot capture (pawn forward moves).
var cannotCaptureControl = simpleMovementController(
  CONTINUE, STOP_HERE_EXCLUSIVE, STOP_HERE_EXCLUSIVE);

// For pieces which can move unrestrictedly but cannot capture friendly
// pieces (knights).
var knightMoveControl = simpleMovementController(
  CONTINUE, CONTINUE_BUT_NO_STOP, CONTINUE);

// Takes a move specified by a movement spec, a movement controller, and
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

      if (spec.length == 1) {
        return iterControl == STOP_HERE_INCLUSIVE ||
               iterControl == CONTINUE;
      } else {
        if (iterControl == CONTINUE ||
            iterControl == CONTINUE_BUT_NO_STOP) {
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

// This function takes a game state, a list of movement specs, a movement
// controller, and a piece. It returns all moves specified by one of the
// specs which are allowed for the given piece in the given state by the
// given controller. It can specify the semi-legal moves for pieces with
// simple movement rules. It returns an array of moves. It takes a flag
// which is applied to all of the moves.
function findMoves(state, specs, controller, piece, flag) {
  var moves = [];

  for (var i = 0; i < specs.length; i++) {
    if (moveIsAllowed(state, specs[i], controller, piece)) {
      moves.push({ piece: piece,
        newLoc: specToLoc(piece.loc, specs[i]),
        flag: flag });
    }
  }

  return moves;
}

//
// Semi-legality: a semi-legal move is a move which is legal except that it
// might leave the player in check and/or capture the opponent's king.
//

// Returns all semi-legal moves from the given board location for the
// player of the given color in the given state.
function semiLegalMovesFromLoc(state, loc) {
  var piece = state.board.get(loc);

  if (piece !== null && piece.color == state.playerToMove) {
    return semiLegalMoveFunctions[piece.rank](state, piece);
  } else {
    return [];
  }
}

// This is an object giving the movement functions for each rank of piece.
// Each function takes a state and a piece, and returns a list of moves
// which are semi-legal for that piece in the given state (though it assumes
// that piece is of the color whose move it is).
var semiLegalMoveFunctions = {};

semiLegalMoveFunctions[PAWN] = function(state, piece) {
  // XXX: Simple test
  return findMoves(state,
    [[{row: 1, col: 0}], [{row: -1, col: 0}]],
    cannotCaptureControl,
    piece);
};

semiLegalMoveFunctions[ROOK] = function(state, piece) {
  return findMoves(state, straightLineMoves, canCaptureControl, piece, null);
};

var knightMoveSpecs = function() {
  var specs = [];
  var xs = [-1,1];

  for (var i = 0; i < 2; i++) {
    for (var j = 0; j < 2; j++) {
      specs.push([
        { row: xs[i], col: 0 },
        { row: xs[i], col: 0 },
        { row: 0, col: xs[j] }
      ]);

      specs.push([
        { row: 0, col: xs[i] },
        { row: 0, col: xs[i] },
        { row: xs[j], col: 0 }
      ]);
    }
  }

  return specs;
}();

semiLegalMoveFunctions[KNIGHT] = function(state, piece) {
  return findMoves(state, knightMoveSpecs, knightMoveControl, piece, null);
};

semiLegalMoveFunctions[BISHOP] = function(state, piece) {
  return findMoves(state, diagonalMoves, canCaptureControl, piece, null);
};

semiLegalMoveFunctions[QUEEN] = function(state, piece) {
  return findMoves(state, diagonalMoves.concat(straightLineMoves),
    canCaptureControl, piece, null);
};

var kingMoveSpecs = function() {
  var specs = [];
  var xs = [-1,0,1];

  for (var i = 0; i < 3; i++) {
    for (var j = 0; j < 3; j++) {
      if (xs[i] != 0 || xs[j] != 0) {
        specs.push(
          [{ row: xs[i], col: xs[j] }]
        );
      }
    }
  }

  return specs;
}();

semiLegalMoveFunctions[KING] = function(state, piece) {
  // XXX: castling
  return findMoves(state, kingMoveSpecs, canCaptureControl, piece, null);
};

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

//
// Legality of moves
//

function moveIsLegal(state, move) {
  // XXX
  return moveIsSemiLegal(state, move);
}

//
// Execution of moves
//

// Takes a state and a move, which is assumed to be legal. Updates the
// state in place to reflect the result of making the move.
// Does not change the active player if doNotChangePlayerToMove is true.
function executeMove(state, move, doNotChangePlayerToMove) {
  state.board.set(move.piece.loc, null);
  var newPiece = movedPiece(move.piece, move.newLoc);
  state.board.set(move.newLoc, newPiece);

  newPiece.hasBeenMoved = true;

  if (move.flag === PAWN_DOUBLE_MOVE) {
    newPiece.justMovedDoubly = true;
  } else {
    newPiece.justMovedDoubly = false;
  }

  if (move.flag === EN_PASSANT) {
    state.board.set(
      locPlus(move.loc, { row: -colorAdvanceDir(newPiece.color), col: 0 }),
      null);
  }

  if (move.flag === PAWN_PROMOTION) {
    newPiece.rank = move.promotionTo;
  }

  if (move.flag === CASTLE) {
    var moveHorizontalDelta = newPiece.loc - piece.loc;
    var moveHorizontalDir = moveHorizontalDelta / Math.abs(moveHorizontalDelta);
    var newRookLoc = { row: move.involvedRook.loc.row,
        col: locPlus(newPiece.loc, { row: 0, col: -moveHorizontalDir }) };
    executeMove(state,
      { piece: move.involvedRook, newLoc: newRookLoc, flag: null },
      true // Do not change whose turn it is.
    );
  }

  // We can assume the other king is still where it was, because in
  // particular it wasn't captured, by our assumption that the move is legal.
  if (newPiece.rank === KING) {
    state.kingLocs[newPiece.color] = newPiece.loc;
  }

  if (!doNotChangePlayerToMove) {
    state.playerToMove = colorOpponent(state.playerToMove);
  }
}

//
// Game object
//

function Game() {
  this.state = makeStartingGameState();

  // Takes a move and, if the move is legal, performs it and updates the
  // starting game state. It returns true if it did this, and false otherwise.
  this.performMove = function(move) {
    if (moveIsSemiLegal(this.state, move)) {
      executeMove(this.state, move);
    }
  };
}
