// The chess board is written in jQuery. I tried using a drag and drop library
// for Angular, but I couldn't get it to work and it was slow.

function displayState(game) {
  var state = getCurrentState(game);

  $(".chess-piece").remove();

  forEachLoc(state.board, function(loc) {
    var piece = getSquare(state.board, loc);
    if (piece) {
      displayPiece(loc, piece);
    }
  });
}

// Gives the filename of the image for the given piece.
function pieceImageName(piece) {
  // XXX
  return "images/WhitePawn.png";
}

function makePieceImage(piece) {
  var $piece = $('<div><img src="' + pieceImageName(piece) + '"></div>');
  return $piece;
}

var getSquareSize = function() {
  return parseInt($(".chess-board-origin").css('width'));
}

// Creates a DOM object displaying the given piece.
function displayPiece(loc, piece) {
  var squareSize = getSquareSize();
  console.log(squareSize);
  var $piece = makePieceImage(piece);
  $piece.addClass('chess-piece');
  $piece.css("top", (7 - loc.row) * 100 + "%");
  $piece.css("left", loc.col * 100 + "%");
  // Necessary to prevent the browser from interpreting the user as
  // attempting an image drag when they drag a piece.
  $piece.on('dragstart', function(event) {
    event.preventDefault();
  });
  $(".chess-board-origin").append($piece);
}

// Converts mouse coordinates to a location on the chess board, assuming
// the mouse coordinates are within the chess board.
function mouseToLoc(mouseX, mouseY) {
  var squareSize = getSquareSize();
  var boardPos = $(".chess-board-origin").offset();
  return { row: 7 - Math.floor((mouseY - boardPos.top) / squareSize),
           col: Math.floor((mouseX - boardPos.left) / squareSize) };
}

// Gives the CSS classes for a square, based on its location.
var squareClasses = function(loc) {
  var classes = "";

  if (loc.col === 0 && loc.row === 7) {
    classes += "chess-board-origin ";
  }

  if (loc.row % 2 === loc.col % 2) {
    classes += "black-square ";
  } else {
    classes += "white-square ";
  }

  return classes;
};


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

chessApp.controller('chessBoardController', function($scope, challengeList) {
  var game = null;
  var processingPieceDrag = false;
  var dragStartLoc = null;
  var pieceBeingDragged = null;

  $scope.squareClasses = squareClasses;

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
    dragStartLoc = mouseToLoc(downEvent.pageX, downEvent.pageY);
    processingPieceDrag = true;
    pieceBeingDragged = $(this);
    $(this).addClass("piece-being-dragged");
    updateDraggedPiecePosition(downEvent, false);
  };

  var mouseupHandler = function(upEvent) {
    if (processingPieceDrag) {
      endLoc = mouseToLoc(upEvent.pageX, upEvent.pageY);
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
  };

  // The move event is trigged by the challengeList service when we receive
  // a new move in a game from the server.
  $scope.$on('move', function() {
    refreshDisplay();
  });

  // This handler gets called by the elem-ready directive on the chess board
  // when the chess board is finished rendering.
  $scope.boardReady = function() {
    $("#chess-board").on("mousedown", ".chess-piece", mousedownHandler);
    $('body').on('mousemove', mousemoveHandler);
    $("#chess-board").on("mouseup", mouseupHandler);
    $(window).on('resize', refreshDisplay);
  };

  var whenPlayControllerInitialized = function() {
    game = $scope.$parent.game;

    var numSquaresInitialized = 0;

    // Call this handler (triggered by an elem-ready directive) each time
    // a square gets rendered. Count up the number of squares rendered, and
    // once all of them are rendered, refresh the display.
    $scope.squareReady = function() {
      numSquaresInitialized++;

      if (numSquaresInitialized >= game.boardInfo.numRows * game.boardInfo.numCols) {
        refreshDisplay();
      }
    }

    // Populate the board with squares.
    $scope.boardLocs = [];
    for (var row = game.boardInfo.numRows - 1; row >= 0; row--) {
      for (var col = 0; col < game.boardInfo.numCols; col++) {
        $scope.boardLocs.push({ row: row, col: col })
      }
    }
  }

  if ($scope.$parent.playControllerInitialized) {
    whenPlayControllerInitialized();
  } else {
    $scope.$on('play-controller-initialized', whenPlayControllerInitialized);
  }

  setTimeout(refreshDisplay, 1000);
})
