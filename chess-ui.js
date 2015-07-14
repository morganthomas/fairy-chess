// Every piece object in the DOM has the class .chess-piece.

// The size of the left border of the chess squares.
var LEFT_BORDER_WIDTH_PX = 1;

// Displays a given game state.
function displayState(game) {
  var state = game.getStateBeingViewed();

  $(".chess-piece").remove();

  allBoardLocs.forEach(function(loc) {
    var piece = state.board.get(loc);
    if (piece) {
      displayPiece(loc, piece);
    }
  });

  displayStatus(state);
  displayCapturedPieces(state);
  displayMoveLog(game);
  displayPlanningControls(game);
}

// Displays the captured pieces.
function displayCapturedPieces(state) {
  // XXX: Sort
  $("#captured-pieces").empty();

  [WHITE,BLACK].forEach(function(color) {
    var capturedPieces = state.capturedPieces.filter(function(piece) {
      return piece.color === color;
    });

    var $div = $('<div></div>');
    $('#captured-pieces').append($div);

    capturedPieces.forEach(function(piece) {
      var $piece = makePieceImage(piece);
      $piece.addClass('captured-piece');
      $div.append($piece);
    });
  });
}

// Displays the move log.
function displayMoveLog(game) {
  var $tbody = $('#move-record-table tbody');
  $tbody.empty();

  var $startTr = $('<tr></tr>');
  var $startTd = $('<td colspan="3"></td>');
  $startTd.text("⟨start⟩");
  $startTd.addClass('move-log-cell');
  $startTd.data('index', 0);
  $startTr.append($startTd);
  $tbody.append($startTr);

  if (game.stateBeingViewedIndex === 0) {
    $startTd.addClass('move-being-viewed');
  }

  for (var i = 0; i * 2 < game.moveLog.length; i++) {
    var $tr = $('<tr></tr>');

    var $num = $('<td></td>');
    $num.text(i+1);
    $tr.append($num);

    function makeMoveCell(j) {
      var $elt = $('<td></td>');

      if (j < game.moveLog.length) {
        $elt.data('index', j+1);
        $elt.addClass('move-log-cell');
        $elt.text(game.moveAlgebraicNotations[j]);

        if (j + 1 === game.stateBeingViewedIndex) {
          $elt.addClass('move-being-viewed');
        }

        if (j + 1 > game.currentStateIndex) {
          $elt.addClass('hypothetical-move');
        }
      }

      $tr.append($elt);
    }

    makeMoveCell(i*2); // White move
    makeMoveCell(i*2 + 1); // Black move

    $tbody.append($tr);
  }
}

// Displays the status of the game (white to move, checkmate, etc.)
function displayStatus(state) {
  var activeColorName = colorNames[state.playerToMove];
  var alertClass;

  if (state.status === GAME_NOT_OVER) {
    if (isInCheck(state, state.playerToMove)) {
      // N.B.: Only the player whose move it is can be in check.
      $("#game-status").text(_.capitalize(activeColorName) + " is in check!");
      alertClass = "alert-warning";
    } else {
      $("#game-status").text(_.capitalize(activeColorName) + " to move.");
      alertClass = "alert-info";
    }
  } else if (state.status === CHECKMATE) {
    $("#game-status").html('Checkmate! ' +
      _.capitalize(colorNames[colorOpponent(state.playerToMove)]) +
      ' won!');
    alertClass = 'alert-danger';
  } else if (state.status === STALEMATE) {
    $("#game-status").html('Stalemate! ' +
      _.capitalize(activeColorName) + ' has no moves.');
    alertClass = 'alert-danger';
  }

  // Set appropriate CSS classes.
  $("#game-status").removeClass('alert-info');
  $("#game-status").removeClass('alert-warning');
  $("#game-status").removeClass('alert-danger');
  $("#game-status").addClass(alertClass);
}

function displayPlanningControls(game) {
  if (game.planningMode) {
    $('#planning-mode-toggle-button').text('Exit Planning Mode');

    if (game.stateLog.length > game.currentStateIndex + 1) {
      $('#commit-move-div').show();
    } else {
      $('#commit-move-div').hide();
    }
  } else {
    $('#planning-mode-toggle-button').text('Enter Planning Mode');
    $('#commit-move-div').hide();
  }
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

function makePieceImage(piece) {
  var $piece = $('<div><img src="' + pieceImageName(piece) + '"></div>');
  return $piece;
}

// Creates a DOM object displaying the given piece.
function displayPiece(loc, piece) {
  var $piece = makePieceImage(piece);
  $piece.addClass('chess-piece');
  $piece.css("top", (7 - loc.row) * SQUARE_SIZE + "px");
  $piece.css("left", (loc.col * SQUARE_SIZE - LEFT_BORDER_WIDTH_PX)
    + "px");
  // Necessary to prevent the browser from interpreting the user as
  // attempting an image drag when they drag a piece.
  $piece.on('dragstart', function(event) {
    event.preventDefault();
  });
  $("#chess-board-origin").append($piece);
}

// Converts mouse coordinates to a location on the chess board, assuming
// the mouse coordinates are within the chess board.
function mouseToLoc(mouseX, mouseY) {
  var boardPos = $("#chess-board-origin").offset();
  return { row: 7 - Math.floor((mouseY - boardPos.top) / SQUARE_SIZE),
           col: Math.floor((mouseX - (boardPos.left + LEFT_BORDER_WIDTH_PX))
                                / SQUARE_SIZE) };
}

$(document).ready(function() {
  var game = new Game();
  var processingPieceDrag = false;
  var dragStartLoc = null;
  var pieceBeingDragged = null;

  var resetDragState = function() {
    processingPieceDrag = false;
    dragStartLoc = null;
    pieceBeingDragged.removeClass("piece-being-dragged");
    pieceBeingDragged = null;
  };

  var refreshDisplay = function() {
    displayState(game);
  };

  // Returns the CSS for the position of a piece being dragged, given the
  // event containing the mouse coordinates.
  var getDraggedPiecePosition = function(event) {
    var boardPos = $("#chess-board-origin").offset();

    return {
      top: (event.pageY - (SQUARE_SIZE / 2) - boardPos.top) + "px",
      left: (event.pageX - (SQUARE_SIZE / 2) - boardPos.left) + "px"
    };
  };

  // Updates the position of the piece being dragged, given the event containing the
  // mouse coordinates. If smooth is true, animates the position change.
  var updateDraggedPiecePosition = function(event, smooth) {
    var DRAG_ANIMATION_RATE_MS_PER_PX = 5;

    var newPos = getDraggedPiecePosition(event);

    if (smooth) {
      var oldPos = { top: pieceBeingDragged.css("top"),
                     left: pieceBeingDragged.css("left") };
      var distance = Math.sqrt(
        Math.pow(parseInt(oldPos.left) - parseInt(newPos.left), 2) +
        Math.pow(parseInt(oldPos.top) - parseInt(newPos.top), 2));
      var animationTime = distance * DRAG_ANIMATION_RATE_MS_PER_PX;

      pieceBeingDragged.animate(newPos, animationTime);
    } else {
      pieceBeingDragged.css(newPos);
    }
  }

  var mousedownHandler = function(downEvent) {
    dragStartLoc = mouseToLoc(downEvent.pageX, downEvent.pageY);
    processingPieceDrag = true;
    pieceBeingDragged = $(this);
    $(this).addClass("piece-being-dragged");
    updateDraggedPiecePosition(downEvent, false);
  };

  var mouseupHandler = function(upEvent) {
    if (processingPieceDrag) {
      endLoc = mouseToLoc(upEvent.pageX, upEvent.pageY);
      var state = game.getStateBeingViewed();

      var move = createMove(state, dragStartLoc, endLoc, null);

      if (move && couldPromotePawn(move)) {
        // XXX: Stub interface.
        var newRank = prompt("What rank do you want to promote your pawn to?");
        move = createMove(state, dragStartLoc, endLoc, newRank);
      }

      if (move) {
        game.performMove(move);
      }

      refreshDisplay();
      resetDragState();
    }
  };

  var mousemoveHandler = function(moveEvent) {
    if (processingPieceDrag) {
      updateDraggedPiecePosition(moveEvent, false);
    }
  };

  var incrementViewedState = function() {
    if (game.stateBeingViewedIndex < game.stateLog.length - 1) {
      game.stateBeingViewedIndex++;
      refreshDisplay();
    }
  };

  var decrementViewedState = function() {
    if (game.stateBeingViewedIndex > 0) {
      game.stateBeingViewedIndex--;
      refreshDisplay();
    }
  };

  var viewStart = function() {
    game.stateBeingViewedIndex = 0;
    refreshDisplay();
  };

  var viewEnd = function() {
    game.stateBeingViewedIndex = game.stateLog.length - 1;
    refreshDisplay();
  };

  var viewCurrent = function() {
    game.stateBeingViewedIndex = game.currentStateIndex;
    refreshDisplay();
  }

  var clickMoveLogCellHandler = function() {
    game.stateBeingViewedIndex = $(this).data('index');
    refreshDisplay();
  };

  var togglePlanningMode = function() {
    if (game.planningMode) {
      game.exitPlanningMode();
    } else {
      game.enterPlanningMode();
    }

    refreshDisplay();
  };

  var commitFirstMove = function() {
    game.commitFirstPlannedMove();
    refreshDisplay();
  }

  $("#chess-board").on("mousedown", ".chess-piece", mousedownHandler);
  $('body').on('mousemove', mousemoveHandler);
  $("#chess-board").on("mouseup", mouseupHandler);
  $("#step-backward-button").on("click", decrementViewedState);
  $("#step-forward-button").on("click", incrementViewedState);
  $("#to-start-button").on("click", viewStart);
  $("#to-end-button").on("click", viewEnd);
  $("#current-move-button").on("click", viewCurrent);
  $("#move-record-table").on('click', '.move-log-cell', clickMoveLogCellHandler);
  $('#planning-mode-toggle-button').on('click', togglePlanningMode);
  $('#commit-move-button').on('click', commitFirstMove);

  refreshDisplay();
});
