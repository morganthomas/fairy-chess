// Returns a string representing the given vector.
var displayMovementVector = function(vec) {
  return vec.row === 0 ?
    (vec.col === 1 ? '→' : '←') :
    (vec.row === 1 ?
      (vec.col === 0 ? '↑' :
        (vec.col === 1 ? '↗' : '↖')) :
      (vec.col === 0 ? '↓' :
        (vec.col === 1 ? '↘' : '↙')));
}

var displayMovementVectors = function(vectors) {
  var symmetricVectors = makeHorizontalSymmetry(vectors);
  return symmetricVectors.map(displayMovementVector).join('');
}

chessApp.directive('chessPieceTypeDisplay', function() {
  return {
    restrict: 'E',
    templateUrl: '/templates/piece-type-display',
    scope: {
      pieceType: '=chessPieceType',
      displayMovementVectors: '=chessDisplayMovementVectors',
      isNestable: '=chessIsNestable',
      game: '=chessGame'
    }
  }
});

chessApp.directive('chessMoveRuleDisplay', function() {
  return {
    restrict: 'E',
    templateUrl: '/templates/move-rule-display',
    scope: {
      rule: '=chessRule',
      displayMovementVectors: '=chessDisplayMovementVectors',
      isNestable: '=chessIsNestable',
      game: '=chessGame'
    }
  }
});

chessApp.directive('chessNestableMoveRuleDisplay', function() {
  return {
    restrict: 'E',
    templateUrl: '/templates/nestable-move-rule-display',
    scope: {
      rule: '=chessRule',
      displayMovementVectors: '=chessDisplayMovementVectors'
    }
  }
});

chessApp.filter('moveDisplayFilter', function() {
  var lastResult = [];
  var lastLength = 0;

  return function(moves) {
    // Only return a new array when the move list changes (which happens iff
    // the length changes). This prevents an infinite digest loop.
    if (moves.length === lastLength) {
      return lastResult;
    } else {
      lastLength = moves.length;

      var moveNotations = moves.map(function(move) {
        return move.algebraicNotation;
      });

      lastResult = _.chunk(moveNotations, 2);
      return lastResult;
    }
  }
})

chessApp.controller('playController', function($scope, $routeParams, me, challengeList, socket, $rootScope) {
  $scope.$parent.notAtHome = true;
  $scope.pieceTypeToDisplay = null; // set by chessBoard.js

  $scope.displayMovementVectors = displayMovementVectors;
  $scope.isNestable = function(rule) {
    return _.include(nestableMovementTypes, rule.type);
  }

  // Say when user is in check
  $scope.statusText = function() {
    if (!$scope.game) {
      return '';
    }

    var state = getCurrentState($scope.game);

    if (state.status === 'game not over') {
      if (!isInCheck($scope.game, state, state.playerToMove)) {
        return _.capitalize(state.playerToMove) + ' to move.';
      } else {
        return _.capitalize(state.playerToMove) + ' to move; ' +
          state.playerToMove + ' is in check!';
      }
    } else if (state.status === 'checkmate') {
      return "Checkmate! " + _.capitalize(colorOpponent(state.playerToMove)) + " won.";
    } else if (state.status === 'stalemate') {
      return "Stalemate! " + _.capitalize(state.playerToMove) + " has no moves.";
    }
  }

  $scope.statusClass = function() {
    if (!$scope.game) {
      return '';
    }

    var state = getCurrentState($scope.game);

    if (state.status === 'game not over') {
      if (!isInCheck($scope.game, state, state.playerToMove)) {
        return 'alert-info';
      } else {
        return 'alert-warning';
      }
    } else if (state.status === 'checkmate') {
      return 'alert-danger';
    } else if (state.status === 'stalemate') {
      return 'alert-danger';
    }
  }

  // Checks if a move from startLoc to endLoc is legal. If so, updates the
  // game state to reflect the move and sends the move to the server.
  $scope.performMove = function(startLoc, endLoc) {
    var state = getCurrentState($scope.game);
    var move = constructMove(state, startLoc, endLoc);

    if (moveIsLegalInCurrentState($scope.game, move) &&
          me._id === $scope.game.players[state.playerToMove]) {
      executeMoveInGame($scope.game, move);

      socket.emit('move', {
        game: $scope.game._id,
        move: move,
        index: getCurrentStateIndex($scope.game)
      });
    }
  }

  var capturedPieceImages = function(color) {
    return function() {
      if (!$scope.game) {
        return [];
      }

      return getCurrentState($scope.game).capturedPieces.filter(function(piece) {
        return piece.color === color;
      }).map(function(piece) {
        return pieceImageName($scope.game, piece)
      })
    }
  }

  $scope.blackCapturedPieceImages = capturedPieceImages('black');
  $scope.whiteCapturedPieceImages = capturedPieceImages('white');

  whenActiveChallengesLoaded($scope, challengeList, function() {
    var challengeId = $routeParams.id;
    var challenge = _.find(challengeList, function(challenge) {
      return challenge._id === challengeId;
    });
    $scope.game = challenge.game;
    console.log(challenge.game.pieceTypes);

    // Find the white and black players so we know their usernames in the view.
    // The game object just includes the player IDs.
    $scope.players = {};
    var players = [challenge.sender, challenge.receiver];
    var whitePlayer = challenge.sender._id === $scope.game.players.white ? 0 : 1;
    $scope.players.white = players[whitePlayer];
    $scope.players.black = players[1 - whitePlayer];

    $scope.moveRecord = $scope.game.moves;

    $scope.playControllerInitialized = true;
    $scope.$broadcast('play-controller-initialized');
  });
})
