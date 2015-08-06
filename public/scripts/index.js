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
    });
});

chessApp.factory('socket', function(socketFactory) {
  return socketFactory();
});

chessApp.factory('challengeList', function(socket) {
  var challengeList = [];

  socket.on('create-challenge', function(challenge) {
    challengeList.unshift(challenge);
  });

  // XXX

  return challengeList;
});

chessApp.controller('indexController', function($scope, challengeList) {
  // Dummy controller to make sure the socket connection gets established.
});

chessApp.controller('viewChallengesController', function($scope, challengeList) {
  // XXX
  $scope.challengeList = challengeList;
});

chessApp.controller('initiateChallengeController', function($scope, socket) {
  // XXX
})



// XXX

var sendChallenge = function() {
  var challenge = {
    receiver: $('#initiate-challenge-receiever').val()
  };

  $.ajax({
    url: '/game/initiate-challenge',
    type: 'POST',
    data: challenge,

    success: function(res) {
      alert(res);
      $('#initiate-challenge-modal').modal('hide');
    }
  });
}

var registerChallengeUpdate = function(updateType) {
  $('body').on('click', '.' + updateType + '-challenge-button', function(e) {
    e.preventDefault();

    $.ajax({
      url: '/game/' + updateType + '-challenge',
      type: 'POST',
      data: { challenge: $(this).attr('data-id') },

      success: function(res) {
        alert(res);
      }
    });
  });
}

var showGameView = function(id) {
  $('#game-view-modal').modal('show');
}
