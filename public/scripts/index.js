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

var chessApp = angular.module('chessApp',
  ['btford.socket-io', 'ngRoute']);

chessApp.config(function($routeProvider) {
  $routeProvider
    .when('/', {
      templateUrl: '/templates/view-challenges',
      controller: 'viewChallengesController'
    })
    .when('/initiate-challenge', {
      templateUrl: '/templates/initiate-challenge',
      controller: 'initiateChallengeController'
    }).
    when('/play/:id', {
      templateUrl: '/templates/play',
      controller: 'playController'
    });
});

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
});

chessApp.controller('viewChallengesController', function($scope, socket, me, challengeList) {
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
  $scope.sendChallenge = function() {
    socket.emit('create-challenge', $scope.userToChallenge);
    $location.path('/');
  }
});

chessApp.controller('playController', function($scope, $routeParams, me, challengeList) {
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

  $scope.game = game;
})
