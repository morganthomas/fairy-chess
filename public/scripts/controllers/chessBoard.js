// The chess board is written in jQuery. I tried using a drag and drop library
// for Angular, but I couldn't get it to work and it was slow.

function displayState(game, myColor) {
  var state = getCurrentState(game);

  $(".chess-piece").remove();

  forEachLoc(state.board, function(loc) {
    var piece = getSquare(state.board, loc);
    if (piece) {
      displayPiece(game, myColor, loc, piece);
    }
  });
}

// Gives the filename of the image for the given piece.
function pieceImageName(game, piece) {
  var colorName = piece.color === 'white' ? 'White' : 'Black';

  return "images/" + colorName + game.pieceTypes[piece.type].icon + ".png";
}

function makePieceImage(game, piece) {
  var $piece = $('<div><img src="' + pieceImageName(game, piece) + '"></div>');
  return $piece;
}

var getSquareSize = function() {
  return parseInt($(".chess-board-origin").css('width'));
}

// Creates a DOM object displaying the given piece.
function displayPiece(game, myColor, loc, piece) {
  var $piece = makePieceImage(game, piece);
  $piece.addClass('chess-piece');

  var top = myColor === 'white' ? (game.boardInfo.numRows - 1) - loc.row : loc.row;
  var left = myColor === 'black' ? (game.boardInfo.numCols - 1) - loc.col : loc.col;
  $piece.css('top', top * 100 + "%");
  $piece.css('left', left * 100 + "%");

  // Necessary to prevent the browser from interpreting the user as
  // attempting an image drag when they drag a piece.
  $piece.on('dragstart', function(event) {
    event.preventDefault();
  });

  $(".chess-board-origin").append($piece);
}

// Converts mouse coordinates to a location on the chess board, assuming
// the mouse coordinates are within the chess board.
function mouseToLoc(game, myColor, mouseX, mouseY) {
  var squareSize = getSquareSize();
  var boardPos = $(".chess-board-origin").offset();

  var col = Math.floor((mouseX - boardPos.left) / squareSize);
  var row = Math.floor((mouseY - boardPos.top) / squareSize);

  if (myColor === 'white') {
    row = (game.boardInfo.numRows - 1) - row;
  }

  if (myColor === 'black') {
    col = (game.boardInfo.numCols - 1) - col;
  }

  return { row: row, col: col };
}

// This directive is attached to an element to trigger a function when the
// element is finished loading. It is used to set up the jQuery event handlers
// and display the chess board after Angular has finished rendering the chess
// board.
chessApp.directive( 'elemReady', function( $parse, $timeout ) {
   return {
       restrict: 'A',
       link: function( $scope, elem, attrs ) {
          elem.ready(function(){
            // $timeout is needed to take this out of the digest cycle. Without
            // $timeout, this will trigger an error for using $scope.$apply inside
            // the digest cycle. However, without $scope.$apply, it doesn't work.
            // I don't know what exactly is going on here, but this seems to work.
            $timeout(function() {
              $scope.$apply(function(){
                  var func = $parse(attrs.elemReady);
                  func($scope);
              })
            }, 0);
          })
       }
    }
});

chessApp.controller('chessBoardController', function($scope, challengeList, me) {
  // game and highlightBoard are initialized in whenPlayControllerInitialized.
  var game = null;
  // A board which contains 'true' in the locations which are highlighted.
  $scope.highlightBoard = null;

  var processingPieceDrag = false;
  var dragStartLoc = null;
  var pieceBeingDragged = null;

  // Gives the CSS classes for a square, based on its location.
  var squareClasses = function(loc) {
    var classes = "";

    var origin = $scope.myColor === 'white' ?
      { row: game.boardInfo.numRows - 1, col: 0 } :
      { row: 0, col: game.boardInfo.numCols - 1 };

    if (loc.row === origin.row && loc.col === origin.col) {
      classes += "chess-board-origin ";
    }

    if (loc.row % 2 === loc.col % 2) {
      classes += "black-square ";
    } else {
      classes += "white-square ";
    }

    if (getSquare($scope.highlightBoard, loc)) {
      classes += "chess-square-highlighted ";
    }

    return classes;
  };

  var resetDragState = function() {
    processingPieceDrag = false;
    dragStartLoc = null;
    pieceBeingDragged.removeClass("piece-being-dragged");
    pieceBeingDragged = null;
  };

  var refreshDisplay = function() {
    displayState(game, $scope.myColor);
  };

  // Returns the CSS for the position of a piece being dragged, given the
  // event containing the mouse coordinates.
  var getDraggedPiecePosition = function(event) {
    var boardPos = $(".chess-board-origin").offset();
    var squareSize = getSquareSize();

    return {
      top: (event.pageY - (squareSize / 2) - boardPos.top) + "px",
      left: (event.pageX - (squareSize / 2) - boardPos.left) + "px"
    };
  };

  // Updates the position of the piece being dragged, given the event containing the
  // mouse coordinates. If smooth is true, animates the position change.
  var updateDraggedPiecePosition = function(event, smooth) {
    var newPos = getDraggedPiecePosition(event);
    pieceBeingDragged.css(newPos);
  }

  var mousedownHandler = function(downEvent) {
    dragStartLoc = mouseToLoc(game, $scope.myColor, downEvent.pageX, downEvent.pageY);
    processingPieceDrag = true;
    pieceBeingDragged = $(this);
    $(this).addClass("piece-being-dragged");
    updateDraggedPiecePosition(downEvent, false);
  };

  var mouseupHandler = function(upEvent) {
    if (processingPieceDrag) {
      endLoc = mouseToLoc(game, $scope.myColor, upEvent.pageX, upEvent.pageY);
      var state = getCurrentState(game);

      // XXX: Dummy code
      $scope.$apply(function() {
        $scope.$parent.performMove(dragStartLoc, endLoc);
      });

      refreshDisplay();
      resetDragState();
    }
  };

  var mousemoveHandler = function(moveEvent) {
    if (processingPieceDrag) {
      updateDraggedPiecePosition(moveEvent, false);
    }

    $scope.$apply(function() {
      forEachLoc($scope.highlightBoard, function(loc) {
        setSquare($scope.highlightBoard, loc, null);
      });

      $scope.$parent.pieceTypeToDisplay = null;

      var state = getCurrentState(game);
      var loc = mouseToLoc(game, $scope.myColor, moveEvent.pageX, moveEvent.pageY);

      if (!isInBounds(state.board, loc)) {
        return;
      }

      var pieceBeingHovered = getSquare(state.board, loc);

      if (pieceBeingHovered && !processingPieceDrag) {
        $scope.$parent.pieceTypeToDisplay = getPieceType(game, pieceBeingHovered);

        // XXX: Show legal moves only
        semiLegalMovesForPiece(game, state, pieceBeingHovered)
          .forEach(function (move) {
            // XXX: Assumes all moves have a "to" parameter. Currently correct,
            // but may change.
            setSquare($scope.highlightBoard, move.params.to, true);
          });
      }
    })
  }

  // The move event is trigged by the challengeList service when we receive
  // a new move in a game from the server.
  $scope.$on('move', function() {
    refreshDisplay();
  });

  var whenPlayControllerInitialized = function() {
    game = $scope.$parent.game;
    $scope.game = game;
    $scope.myColor = game.players.black === me._id ? 'black' : 'white';

    // This is in here so that this function doesn't run until $scope.myColor,
    // which it depends on, is set.
    $scope.squareClasses = squareClasses;

    $scope.highlightBoard = makeEmptyBoard(game.boardInfo);

    var numSquaresInitialized = 0;

    // Call this handler (triggered by an elem-ready directive) each time
    // a square gets rendered. Count up the number of squares rendered, and
    // once all of them are rendered, register event handlers and refresh the display.
    $scope.squareReady = function() {
      numSquaresInitialized++;

      if (numSquaresInitialized >= game.boardInfo.numRows * game.boardInfo.numCols) {
        $("#chess-board").on("mousedown", ".chess-piece", mousedownHandler);
        $('body').on('mousemove', mousemoveHandler);
        $("#chess-board").on("mouseup", mouseupHandler);
        $(window).on('resize', refreshDisplay);
        refreshDisplay();
      }
    }

    // Populate the board with squares.
    $scope.boardLocs = [];

    var rows = _.range(game.boardInfo.numRows);
    if ($scope.myColor === 'white') {
      rows = rows.reverse();
    }

    rows.forEach(function(row) {
      var cols = _.range(game.boardInfo.numCols);
      if ($scope.myColor === 'black') {
        cols = cols.reverse();
      }

      cols.forEach(function(col) {
        $scope.boardLocs.push({ row: row, col: col })
      });
    });

    $scope.colLabels = "abcdefghijklmnopqrstuvwxyz";
  }

  if ($scope.$parent.playControllerInitialized) {
    whenPlayControllerInitialized();
  } else {
    $scope.$on('play-controller-initialized', whenPlayControllerInitialized);
  }

  // This handler gets called by the elem-ready directive on the chess board
  // when the chess board is finished rendering. Remove if we don't want to use.
  $scope.boardReady = function() {

  };
})
