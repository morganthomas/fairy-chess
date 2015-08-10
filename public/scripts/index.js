// In-place filter function
var filterInPlace = function(array, pred) {
  var i = 0;

  while (i < array.length) {
    if (pred(array[i])) {
      array.splice(i, 1);
    } else {
      i++;
    }
  }
}

chessApp.factory('socket', function(socketFactory) {
  return socketFactory();
});

chessApp.factory('me', function(socket) {
  var me = {};

  socket.on('you-are', function(user) {
    me.username = user.username;
    me._id = user._id;
  });

  return me;
})

// The challenge list contains all challenges which are not deleted
// (rejected or withdrawn).
chessApp.factory('challengeList', function(socket, $rootScope) {
  var challengeList = [];

  socket.on('create-challenge', function(challenge) {
    challengeList.unshift(challenge);
  });

  socket.on('challenge-error', function(message) {
    // XXX
    alert(message);
  });

  socket.on('delete-challenge', function(challengeId) {
    filterInPlace(challengeList, function(challenge) {
      return challenge._id === challengeId;
    });
  });

  socket.on('challenge-status-change', function(data) {
    for (var i = 0; i < challengeList.length; i++) {
      if (challengeList[i]._id === data.id) {
        challengeList[i].status = data.status;

        if (data.newGame) {
          challengeList[i].game = data.newGame;
        }
      }
    }
  });

  socket.on('move', function(data) {
    console.log("move", data)

    for (var i = 0; i < challengeList.length; i++) {
      var game = challengeList[i].game;
      if (game._id === data.game &&
            getCurrentStateIndex(game) < data.index) {
        executeMove(game, data.move);
        $rootScope.$broadcast('move', {move : game.moves.length});
      }
    }
  });

  socket.on('move-rejected', function(data) {
    console.log('move-rejected', data);
  });

  // XXX

  return challengeList;
});

chessApp.controller('indexController', function($scope, me, challengeList) {
  $scope.me = me;
  $scope.notAtHome = false;
});

chessApp.controller('viewChallengesController', function($scope, socket, me, challengeList) {
  $scope.$parent.notAtHome = false;
  $scope.challengeList = challengeList;
  $scope.me = me;

  $scope.isMe = function(user) {
    return user._id === me._id;
  }

  $scope.isOpen = function(challenge) {
    return challenge.status === 'open';
  }

  $scope.isAccepted = function(challenge) {
    return challenge.status === 'accepted';
  }

  $scope.formatUsername = function(user) {
    return user._id === me._id ? 'me' : user.username;
  }

  $scope.deleteChallenge = function(challenge) {
    socket.emit('delete-challenge', challenge._id);
  }

  $scope.acceptChallenge = function(challenge) {
    socket.emit('accept-challenge', challenge._id);
  }
});

chessApp.controller('initiateChallengeController', function($scope, $location, socket) {
  $scope.$parent.notAtHome = true;

  $scope.sendChallenge = function() {
    socket.emit('create-challenge', $scope.userToChallenge);
    $location.path('/');
  }
});

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
