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
  boardPos = $("#chess-board-origin").position();
  console.log("Mouse: " + mouseX + ", " + mouseY);
  return { row: 7 - Math.floor((mouseY - boardPos.top) / SQUARE_SIZE),
           col: Math.floor((mouseX - (boardPos.left + LEFT_BORDER_WIDTH_PX))
                                / SQUARE_SIZE) };
}

$(document).ready(function() {
  var game = new Game();
  var processingPieceDrag = false;
  var dragStartLoc = null;

  function refreshDisplay() {
    displayState(game.state);
  }

  // Moves the piece at loc1, if there is any such piece, to loc2.
  function executeMove(loc1, loc2) {
    var piece = game.state.board.get(loc1);

    if (piece) {
      // XXX: Implement flags for special cases.
      game.performMove({ piece: piece, newLoc: loc2, flag: null });
    }

    refreshDisplay();
  }

  $("#chess-board").mousedown(function (downEvent) {
    startLoc = mouseToLoc(downEvent.pageX, downEvent.pageY);
    console.log("Start: " + startLoc.row + ", " + startLoc.col);
    processingPieceDrag = true;
    dragStartLoc = startLoc;
  });

  $("#chess-board").mouseup(function(upEvent) {
    if (processingPieceDrag) {
      endLoc = mouseToLoc(upEvent.pageX, upEvent.pageY);
      console.log("End: " + endLoc.row + ", " + endLoc.col);
      executeMove(dragStartLoc, endLoc);
      processingPieceDrag = false;
      dragStartLoc = null;
    }
  });

  refreshDisplay();
});
