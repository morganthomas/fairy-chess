chessApp.controller('playController', function($scope, $routeParams, me, challengeList, socket) {
  $scope.$parent.notAtHome = true;

  var challengeId = $routeParams.id;
  var challenge = _.find(challengeList, function(challenge) {
    return challenge._id === challengeId;
  });
  var game = challenge.game;

  // Find the white and black players so we know their usernames in the view.
  // The game object just includes the player IDs.
  $scope.players = {};
  var players = [challenge.sender, challenge.receiver];
  var whitePlayer = challenge.sender._id === game.players.white ? 0 : 1;
  $scope.players.white = players[whitePlayer];
  $scope.players.black = players[1 - whitePlayer];

  $scope.game = game;

  $scope.squareClasses = squareClasses;

  // Checks if a move from startLoc to endLoc is legal. If so, updates the
  // game state to reflect the move and sends the move to the server.
  $scope.performMove = function(startLoc, endLoc) {
    var move = {
      template: 'dummy',
      params: {
        from: startLoc,
        to: endLoc
      }
    };

    executeMove(game, move);

    socket.emit('move', {
      game: game._id,
      move: move,
      index: getCurrentStateIndex(game)
    });
  }

  $scope.numMoves = function() {
    return game.moves.length;
  }
})
