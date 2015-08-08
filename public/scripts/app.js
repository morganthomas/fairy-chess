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
