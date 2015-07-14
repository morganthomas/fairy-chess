// Status:
//  * Move execution is completely implemented, but not tested for moves
//    that are not yet generated.
//  * Moves still to be generated are pawn promotions.

function SHOW() {
  console.log.apply(console, arguments);
  return arguments[arguments.length - 1];
}

function all(bools) {
  return bools.reduce(function(a,b) {
    return a && b;
  }, true);
}

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

var colorNames = (function() {
  var colorNames = {};
  colorNames[WHITE] = "white";
  colorNames[BLACK] = "black";
  return colorNames;
})();

// Ranks
var PAWN = "P";
var ROOK = "R";
var KNIGHT = "N";
var BISHOP = "B";
var QUEEN = "Q";
var KING = "K";

var RANKS = [PAWN, ROOK, KNIGHT, BISHOP, QUEEN, KING];

// Gives the point value of a given rank.
var RANK_POINT_VALUES = {
  P: 1,
  R: 5,
  N: 3,
  B: 3,
  Q: 5,
  K: undefined
};

//
// Board Locations
//
// A board location is an object with row and colum properties.
//

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

// Returns a duplicate of the piece with a new location.
function movedPiece(piece, newLoc) {
  var newPiece = _.cloneDeep(piece);
  newPiece.loc = newLoc;
  return newPiece;
}

// Says whether two pieces are equal.
function pieceEq(piece1, piece2) {
  return piece1.color == piece2.color &&
         piece1.rank == piece2.rank &&
         locEq(piece1.loc, piece2.loc);
}

// Makes a board configuration with undefined contents.
function makeBoardConfig() {
  var board = new Object();

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

//
// GameState:
//   A game state is an object with properties:
//     board: A board configuration.
//     kingLocs: An object with properties BLACK and WHITE giving the location
//       of the black and white kings. Efficiently finding the kings is
//       useful for determining whether a player is in check.
//     playerToMove: Player whose turn it is (i.e., their color).
//     status: One of GAME_NOT_OVER, CHECKMATE (for the player to move),
//      or STALEMATE (where the player to move has no moves).
//     capturedPieces: An array of all captured pieces.
//

var GAME_NOT_OVER = "game not over";
var STALEMATE = "stalemate";
var CHECKMATE = "checkmate";

//
// Move:
//   A move is an object with properties:
//     piece
//     newLoc
//     flag: A movement flag, or null.
//   And an optional property:
//     promotionTo: Gives the rank to promote the pawn to, for a pawn promotion.
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
    kingLocs: {
      W: { row: 0, col: 4 },
      B: { row: 7, col: 4 }
    },
    playerToMove: WHITE,
    status: GAME_NOT_OVER,
    capturedPieces: []
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

// For pieces (pawns capturing) which must capture an enemy piece.
var mustCaptureControl = simpleMovementController(
  CONTINUE_BUT_NO_STOP, STOP_HERE_EXCLUSIVE, STOP_HERE_INCLUSIVE);

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
// might leave the player in check.
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
  return regularPawnMoves(state, piece).concat(doublePawnMoves(state, piece)).
    concat(pawnCaptures(state, piece)).concat(pawnEnPassants(state, piece)).
    concat(pawnPromotions(state, piece));
};

function regularPawnMoves(state, piece) {
  return findMoves(state,
    [[{row: colorAdvanceDir(piece.color), col: 0}]],
    cannotCaptureControl, piece, null);
}

function doublePawnMoves(state, piece) {
  return !piece.hasBeenMoved ?
    findMoves(state,
      [_.fill(Array(2), {row: colorAdvanceDir(piece.color), col: 0})],
      cannotCaptureControl, piece, PAWN_DOUBLE_MOVE) :
    [];
}

function pawnCaptures(state, piece) {
  var advanceDir = colorAdvanceDir(piece.color);
  return findMoves(state,
    [[{ row: advanceDir, col: 1 }], [{ row: advanceDir, col: -1 }]],
    mustCaptureControl, piece, null);
}

function pawnEnPassants(state, piece) {
  return pawnEnPassant(state, piece, 1).concat(pawnEnPassant(state, piece, -1));
}

function pawnEnPassant(state, piece, horizDir) {
  var enemyLoc = locPlus(piece.loc, { row: 0, col: horizDir });

  if (!inBounds(enemyLoc)) {
    return [];
  }

  var enemy = state.board.get(enemyLoc);

  if (enemy !== null && enemy.color === colorOpponent(piece.color) &&
        enemy.rank === PAWN && enemy.justMovedDoubly) {
    return findMoves(state,
      [[{ row: colorAdvanceDir(piece.color), col: horizDir }]],
      cannotCaptureControl, piece, EN_PASSANT);
  } else {
    return [];
  }
}

function pawnPromotions(state, piece) {
  var forwardMoves = findMoves(state,
    [[{row: colorAdvanceDir(piece.color), col: 0}]],
    cannotCaptureControl, piece, PAWN_PROMOTION);
  var moves = [];

  if (piece.loc.row === (piece.color === BLACK ? 1 : 6)) {
    forwardMoves.forEach(function(move) {
      RANKS.forEach(function(rank) {
        var newMove = _.cloneDeep(move);
        newMove.promotionTo = rank;
        moves.push(newMove);
      });
    });
  }

  return moves;
}

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
  return findMoves(state, kingMoveSpecs, canCaptureControl, piece, null)
    .concat(castles(state, piece, 1))
    .concat(castles(state, piece, -1));
};

// Returns any castle moves for the king in the given horizontal direction.
function castles(state, piece, horizDir) {
  var rookLoc = { row: piece.loc.row, col: horizDir === -1 ? 0 : 7 };
  var rook = state.board.get(rookLoc);

  // The second and third conditions in this conjunction imply that the
  // piece 'rook' is in fact a friendly rook.
  if (!piece.hasBeenMoved && rook !== null && !rook.hasBeenMoved) {
    return findMoves(state, [_.fill(Array(2), { row: 0, col: horizDir })],
      castleControl, piece, CASTLE);
  } else {
    return [];
  }
}

// This function is mutually recursive with semiLegalMovesFromLoc. The reason
// the recursion terminates is that this function is only called when the king
// has not been moved, and it calls semiLegalMovesFromLoc on a state where
// the king has been moved.
function castleControl(state, piece, newLoc) {
  if (state.board.get(newLoc) === null) {
    var newState = _.cloneDeep(state);
    executeMove(newState, { piece: piece, newLoc: newLoc, flag: null });

    if (playerToMoveCanCaptureKing(newState)) {
      return STOP_HERE_EXCLUSIVE;
    } else {
      return CONTINUE;
    }
  } else {
    return STOP_HERE_EXCLUSIVE;
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
    result = result.concat(semiLegalMovesFromLoc(state, loc));
  });

  return result;
}

//
// Checking for check
//

// Says whether in the given state, the player to move can capture the
// opponent's king.
function playerToMoveCanCaptureKing(state) {
  var moves = semiLegalMoves(state);

  for (var i = 0; i < moves.length; i++) {
    if (locEq(moves[i].newLoc, state.kingLocs[colorOpponent(state.playerToMove)])) {
      return true;
    }
  }

  return false;
}

// Says whether in the given state, the given player is in check.
function isInCheck(state, playerColor) {
  var newState = _.clone(state);
  newState.playerToMove = colorOpponent(playerColor);
  return playerToMoveCanCaptureKing(newState);
}

// Says whether the given move puts the player moving in check.
function movePutsPlayerInCheck(state, move) {
  var newState = _.cloneDeep(state);
  executeMove(newState, move);
  return playerToMoveCanCaptureKing(newState);
}

//
// Checking game status
//

// Returns the game status: either the game is not over, it is a stalemate, or
// the player to move is in checkmate.
function gameStatus(state) {
  if (legalMoves(state).length === 0) {
    if (isInCheck(state, state.playerToMove)) {
      return CHECKMATE;
    } else {
      return STALEMATE;
    }
  } else {
    return GAME_NOT_OVER;
  }
}

//
// Legality of moves. We say that moves which capture the opponent's king are
// legal; they just can't in fact happen in ordinary game play.
//

function legalMovesFromLoc(state, loc) {
  return _.filter(semiLegalMovesFromLoc(state, loc), function(move) {
    return !movePutsPlayerInCheck(state, move);
  });
}

function legalMoves(state) {
  return _.flatten(allBoardLocs.map(_.curry(legalMovesFromLoc)(state)));
}

function moveIsLegal(state, move) {
  return moveIsSemiLegal(state, move) && !movePutsPlayerInCheck(state, move);
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

  newPiece.hasBeenMoved = true;

  if (move.flag === PAWN_DOUBLE_MOVE) {
    newPiece.justMovedDoubly = true;
  } else {
    newPiece.justMovedDoubly = false;
  }

  // All pieces which didn't move this turn also didn't do a double pawn move.
  allBoardLocs.forEach(function(loc) {
    var piece = state.board.get(loc);
    if (piece !== null && !locEq(loc, newPiece.loc)) {
      piece.justMovedDoubly = false;
    }
  });

  if (move.flag === EN_PASSANT) {
    var enemyLoc = locPlus(move.newLoc,
      { row: -colorAdvanceDir(newPiece.color), col: 0 });
    capturedPiece = state.board.get(enemyLoc);
    state.board.set(enemyLoc, null);
  }

  if (move.flag === PAWN_PROMOTION) {
    newPiece.rank = move.promotionTo;
  }

  if (move.flag === CASTLE) {
    var moveHorizontalDelta = newPiece.loc.col - move.piece.loc.col;
    var moveHorizontalDir = moveHorizontalDelta / Math.abs(moveHorizontalDelta);

    var oldRookLoc = { row: move.piece.loc.row, col: moveHorizontalDir < 0 ? 0 : 7 };
    var rook = state.board.get(oldRookLoc);
    var newRookLoc = locPlus(newPiece.loc, { row: 0, col: -moveHorizontalDir });

    executeMove(state,
      { piece: rook, newLoc: newRookLoc, flag: null },
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
// locations is out of bounds. Takes an optional fourth argument for the
// rank to promote a pawn to for pawn promotion.
function createMove(state, loc1, loc2, promotionTo) {
  if (inBounds(loc1) && inBounds(loc2)) {
    var piece = state.board.get(loc1);

    if (piece) {
      var flag = null;

      if (piece.rank === PAWN && locEq(loc2,
        locPlus(loc1, { row: 2 * colorAdvanceDir(piece.color), col: 0 }))) {
        flag = PAWN_DOUBLE_MOVE;
      } else if (piece.rank === PAWN && loc2.col !== loc1.col &&
          state.board.get(loc2) === null) {
        // A legal move is an en passant iff it meets the above conditions.
        flag = EN_PASSANT;
      } else if (piece.rank === KING && Math.abs(loc2.col - loc1.col) > 1) {
        // A legal move is a castle iff it meets the above conditions.
        flag = CASTLE;
      } else if (promotionTo) {
        flag = PAWN_PROMOTION;
      }

      // XXX: other flags

      return { piece: piece, newLoc: loc2, flag: flag, promotionTo: promotionTo };
    }
  }

  return null;
}

//
// Algebraic chess notation
//

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

function displayRankAlgebraic(rank) {
  return rank === PAWN ? '' : rank;
}

// Returns the algebraic notation for the given move from the given
// state.
function displayMoveAlgebraic(state, move) {
  if (move.flag === CASTLE) {
    if (move.newLoc.col < move.piece.loc.col) {
      // Queenside castle
      return '0-0-0';
    } else {
      // Kingside castle
      return '0-0';
    }
  }

  // The moves which have the same destination as this move and the
  // same rank of piece.
  var ambiguousMoves = legalMoves(state).filter(function(otherMove) {
    return locEq(move.newLoc, otherMove.newLoc) &&
      move.piece.rank === otherMove.piece.rank &&
      !moveEq(move, otherMove);
  });

  var disambiguationString;

  if (ambiguousMoves.length > 0) {
    if (all(ambiguousMoves.map(function(otherMove) {
          return otherMove.piece.loc.col !== move.piece.loc.col;
        }))) {
      disambiguationString = displayColAlgebraic(move.piece.loc.col);
    } else if (all(ambiguousMoves.map(function(otherMove) {
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

  var pawnPromotionString;

  if (move.flag === PAWN_PROMOTION) {
    pawnPromotionString = '/' + displayRankAlgebraic(move.promotionTo);
  } else {
    pawnPromotionString = '';
  }

  return displayRankAlgebraic(move.piece.rank) +
    disambiguationString +
    displayLocAlgebraic(move.newLoc) +
    pawnPromotionString;
}

//
// Game object
//

function Game() {
  this.state = makeStartingGameState();

  // A log of all the game states that have occurred, including the
  // current one.
  this.stateLog = [this.state];
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

  // Updates the state to the new given state, which was produced by
  // the given move. Assumes the state being viewed is the last state
  // in the log.
  this.updateState = function(newState, move) {
    if (this.stateBeingViewedIndex === this.stateLog.length - 1) {
      this.stateLog.push(newState);
      this.moveLog.push(move);
      this.moveAlgebraicNotations.push(displayMoveAlgebraic(this.state, move));

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
    this.stateLog = this.stateLog.slice(0, this.currentStateIndex + 1);
    this.moveLog = this.moveLog.slice(0, this.currentStateIndex);
    this.moveAlgebraicNotations = this.moveAlgebraicNotations.slice(0, this.currentStateIndex);
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
  // operative if the current state is being viewed.
  this.performMove = function(move) {
    var state = this.getStateBeingViewed();

    if (this.stateBeingViewedIndex === this.stateLog.length - 1 &&
        moveIsLegal(state, move)) {
      // console.log(displayMoveAlgebraic(this.state, move));

      var newState = _.cloneDeep(state);
      executeMove(newState, move);
      newState.status = gameStatus(newState);
      this.updateState(newState, move);

      console.log(this);

      return true;
    } else {
      return false;
    }
  };
}
