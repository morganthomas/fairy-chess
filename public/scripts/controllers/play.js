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

chessApp.controller('playController', function($scope, $routeParams, me, challengeList, socket, $rootScope) {
  $scope.$parent.notAtHome = true;
  $scope.pieceTypeToDisplay = null; // set by chessBoard.js

  $scope.displayMovementVectors = displayMovementVectors;
  $scope.isNestable = function(rule) {
    return _.include(nestableMovementTypes, rule.type);
  }

  // Say when user is in check
  $scope.statusText = function() {
    var state = getCurrentState($scope.game);

    if (state.status === 'game not over') {
      return _.capitalize(state.playerToMove) + ' to move.';
    } else if (state.status === 'checkmate') {
      return "Checkmate! " + _.capitalize(colorOpponent(state.playerToMove)) + " won.";
    } else if (state.status === 'stalemate') {
      return "Stalemate! " + _.capitalize(state.playerToMove) + " has no moves.";
    }
  }

  $scope.statusClass = function() {
    var state = getCurrentState($scope.game);

    if (state.status === 'game not over') {
      return 'alert-info';
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

    $scope.playControllerInitialized = true;
    $scope.$broadcast('play-controller-initialized');
  });
})
