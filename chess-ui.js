// Every piece object in the DOM has the class .chess-piece.

// The size of the left border of the chess squares.
var LEFT_BORDER_WIDTH_PX = 1;

// Displays a given game state.
function displayState(state) {
  hideAllPieces(state);

  allBoardLocs.forEach(function(loc) {
    var piece = state.board.get(loc);
    if (piece) {
      displayPiece(loc, piece);
    }
  });
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
  return { row: 7 - Math.floor((mouseY - boardPos.top) / SQUARE_SIZE),
           col: Math.floor((mouseX - (boardPos.left + LEFT_BORDER_WIDTH_PX))
                                / SQUARE_SIZE) };
}

$(document).ready(function() {
  var game = new Game();
  var processingPieceDrag = false;
  var dragStartLoc = null;
  var pieceBeingDragged = null;
  var boardPos = $("#chess-board-origin").position();

  var resetDragState = function() {
    processingPieceDrag = false;
    dragStartLoc = null;
    pieceBeingDragged = null;
  }

  var refreshDisplay = function() {
    displayState(game.state);
  }

  var mousedownHandler = function(downEvent) {
    dragStartLoc = mouseToLoc(downEvent.pageX, downEvent.pageY);
    processingPieceDrag = true;
    pieceBeingDragged = $(this);
  };

  var mouseupHandler = function(upEvent) {
    if (processingPieceDrag) {
      endLoc = mouseToLoc(upEvent.pageX, upEvent.pageY);

      // XXX: Provide pawn promotion callback.
      var move = createMove(game.state, dragStartLoc, endLoc, null);

      if (move) {
        console.log(game.performMove(move));
      }

      refreshDisplay();
      resetDragState();
    }
  };

  var mousemoveHandler = function(moveEvent) {
    if (processingPieceDrag) {
      pieceBeingDragged.css("top", (moveEvent.pageY - (SQUARE_SIZE / 2) - boardPos.top) + "px");
      pieceBeingDragged.css("left", (moveEvent.pageX - (SQUARE_SIZE / 2) - boardPos.left) + "px");
    }
  };

  $("#chess-board").on("mousedown", ".chess-piece", mousedownHandler);
  $('body').on('mousemove', mousemoveHandler);
  $("#chess-board").on("mouseup", mouseupHandler);

  refreshDisplay();
});
