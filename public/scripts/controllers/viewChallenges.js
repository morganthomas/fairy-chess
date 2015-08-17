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
    $scope.$on('create-challenge', function(e, challenge) {
      $location.path('/');
    });
    $scope.$on('challenge-error', function(e, message) {
      console.log(message);
      alert(message);
      $scope.userToChallenge = '';
    })
  }
});
