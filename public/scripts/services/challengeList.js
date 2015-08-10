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

// The challenge list contains all challenges which are not deleted
// (rejected or withdrawn).
chessApp.factory('challengeList', function(socket, $rootScope) {
  var challengeList = [];

  socket.on('create-challenge', function(challenge) {
    challengeList.unshift(challenge);
  });

  socket.on('challenge-error', function(message) {
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

  return challengeList;
});
