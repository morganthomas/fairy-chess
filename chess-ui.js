// Every piece object in the DOM has the class .chess-piece.

// The size of the left border of the chess squares.
var LEFT_BORDER_WIDTH_PX = 1;

// Displays a given game state.
function displayState(state) {
  var board = state.board;
  var iter = allBoardLocs();

  hideAllPieces(state);

  for (var loc = iter(); loc; loc = iter()) {
    var piece = board.get(loc);
    if (piece) {
      displayPiece(loc, piece);
    }
  }
}

// Removes all piece objects from the DOM.
function hideAllPieces() {
  $(".chess-piece").remove();
}

// Size of a square, in pixels.
var SQUARE_SIZE = 64;

// Gives the filename of the image for the given piece.
function pieceImageName(piece) {
  var prettyColorNames = {};
  prettyColorNames[BLACK] = "Black";
  prettyColorNames[WHITE] = "White";

  var prettyRankNames = {};
  prettyRankNames[PAWN] = "Pawn";
  prettyRankNames[ROOK] = "Rook";
  prettyRankNames[KNIGHT] = "Knight";
  prettyRankNames[BISHOP] = "Bishop";
  prettyRankNames[QUEEN] = "Queen";
  prettyRankNames[KING] = "King";

  return "images/" + prettyColorNames[piece.color] +
    prettyRankNames[piece.rank] + ".png";
}

// Creates a DOM object displaying the given piece.
function displayPiece(loc, piece) {
  var pieceJ = $('<div class="chess-piece"><img src="' +
    pieceImageName(piece) + '"></div>');
  pieceJ.css("top", (7 - loc.row) * SQUARE_SIZE + "px");
  pieceJ.css("left", (loc.col * SQUARE_SIZE - LEFT_BORDER_WIDTH_PX)
    + "px");
  // Necessary to prevent the browser from interpreting the user as
  // attempting an image drag when they drag a piece.
  pieceJ.on('dragstart', function(event) {
    event.preventDefault();
  });
  $("#chess-board-origin").append(pieceJ);
}

// Converts mouse coordinates to a location on the chess board, assuming
// the mouse coordinates are within the chess board.
function mouseToLoc(mouseX, mouseY) {
  var boardPos = $("#chess-board-origin").position();
  console.log("Mouse: " + mouseX + ", " + mouseY);
  return { row: 7 - Math.floor((mouseY - boardPos.top) / SQUARE_SIZE),
           col: Math.floor((mouseX - (boardPos.left + LEFT_BORDER_WIDTH_PX))
                                / SQUARE_SIZE) };
}

// A UIGameState object records the state of the game UI, which includes
// the state of the game and (currently) also data for tracking the
// progress of piece drags.
function UIGameState() {
  this.game = new Game();
  this.processingPieceDrag = false;
  this.dragStartLoc = null;
  this.pieceBeingDragged = null;
  this.boardPos = $("#chess-board-origin").position();

  this.resetDragState = function() {
    this.processingPieceDrag = false;
    this.dragStartLoc = null;
    this.pieceBeingDragged = null;
  }

  this.refreshDisplay = function() {
    displayState(uiState.game.state);
  }

  var uiState = this;

  this.mousedownHandler = function(downEvent) {
    uiState.dragStartLoc = mouseToLoc(downEvent.pageX, downEvent.pageY);
    uiState.processingPieceDrag = true;
    uiState.pieceBeingDragged = $(this);
  };

  this.mouseupHandler = function(upEvent) {
    if (uiState.processingPieceDrag) {
      endLoc = mouseToLoc(upEvent.pageX, upEvent.pageY);

      // XXX: Provide pawn promotion callback.
      var move = createMove(uiState.game.state, uiState.dragStartLoc, endLoc, null);

      if (move) {
        uiState.game.performMove(move);
      }

      uiState.refreshDisplay();
      uiState.resetDragState();
    }
  };

  this.mousemoveHandler = function(moveEvent) {
    if (uiState.processingPieceDrag) {
      uiState.pieceBeingDragged.css("top", (moveEvent.pageY - (SQUARE_SIZE / 2) - uiState.boardPos.top) + "px");
      uiState.pieceBeingDragged.css("left", (moveEvent.pageX - (SQUARE_SIZE / 2) - uiState.boardPos.left) + "px");
    }
  };
}


$(document).ready(function() {
  var uiState = new UIGameState();

  var game = new Game();
  var processingPieceDrag = false;
  var dragStartLoc = null;

  function refreshDisplay() {
    displayState(game.state);
  }

  $("#chess-board").on("mousedown", ".chess-piece", uiState.mousedownHandler);
  $('body').on('mousemove', uiState.mousemoveHandler);
  $("#chess-board").on("mouseup", uiState.mouseupHandler);

  refreshDisplay();
});
