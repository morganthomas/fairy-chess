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
chessApp.factory('challengeList', function(socket) {
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

chessApp.controller('playController', function($scope, $routeParams, me, challengeList) {
  $scope.$parent.notAtHome = true;

  var challengeId = $routeParams.id;
  var challenge = _.cloneDeep(_.find(challengeList, function(challenge) {
    return challenge._id === challengeId;
  }));
  var game = challenge.game;

  // Populate the players.white and players.black fields.
  var players = [challenge.sender, challenge.receiver];
  var whitePlayer = challenge.sender._id === game.players.white ? 0 : 1;
  game.players.white = players[whitePlayer];
  game.players.black = players[1 - whitePlayer];

  console.log(game);

  // Dummy board
  var boardLocs = [];
  for (var row = 7; row >= 0; row--) {
    for (var col = 0; col < 8; col++) {
      boardLocs.push({ row: row, col: col });
    }
  }

  $scope.boardLocs = boardLocs;
  $scope.game = game;

  $scope.squareClasses = function(loc) {
    var classes = "";

    if (loc.col === 0 && loc.row === 7) {
      classes += "chess-board-origin ";
    }

    if (loc.col === 0) {
      classes += "col-leftmost ";
    } else if (loc.col === 7) {
      classes += "col-rightmost ";
    }

    if (loc.row === 7) {
      classes += "row-top ";
    } else if (loc.row === 0) {
      classes += "row-bottom ";
    }

    if (loc.row % 2 === loc.col % 2) {
      classes += "black-square ";
    } else {
      classes += "white-square ";
    }

    return classes;
  }
})
