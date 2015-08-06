var User = require('../models/user');
var Challenge = require('../models/challenge');
var Game = require('../models/game');
var _ = require('../public/scripts/lodash');

// Constructs a new Game object, with the two specified players (given as user IDs),
// who are randomly selected to be black and white.
var newGame = function(player1, player2) {
  var shuffledPlayers = _.shuffle([player1, player2]);
  var players = {};
  players.white = shuffledPlayers[0];
  players.black = shuffledPlayers[1];

  return new Game({
    players: players,
    pieceTypes: {}, // XXX
    states: [], // XXX
    moves: []
  });
}

var gameSocketServer = function(httpServer, sessionMiddleware) {
  var io = require('socket.io')(httpServer);

  io.use(function(socket, next) {
    sessionMiddleware(socket.request, {}, next);
  });

  io.on('connection', function(socket) {
    // XXX: Look up the user
    var userId = socket.request.session && socket.request.session.passport && socket.request.session.passport.user;
    var user = { id: userId }

    if (!userId) {
      return;
    }

    socket.on('create-challenge', function(receiverUsername) {
      createChallenge(socket, user, receieverUsername);
    });

    socket.on('delete-challenge', function(challengeId) {
      deleteChallenge(socket, user, challengeId);
    });

    socket.on('accept-challenge', function(challengeId) {
      acceptChallenge(socket, user, challengeId);
    });

    sendInitialState(socket, user);
  });
}

var sendInitialState = function(socket, user) {
  Challenge.find({
    $and: [{$or: [ { receiver: user.id }, { sender: user.id } ]},
           { status: { $in: ['open', 'accepted'] } }]
    })
    .populate('receiver sender')
    .exec(function(err, challenges) {
      if (err) {
        return socket.emit('challenge-error', "Database error finding challenges.");
      }

      challenges.forEach(function(challenge) {
        socket.emit('create-challenge', challenge);

        if (challenge.status === 'accepted') {
          socket.emit('challenge-status-change', { id: challenge.id, status: challenge.status });
        }
      });
    });
}

var createChallenge = function(socket, sender, receiverUsername) {
  User.findOne({ username: receiverUsername }, function(err, receiver) {
    if (err) {
      return socket.emit('challenge-error', "Database error.");
    } else if (!receiver) {
      return socket.emit('challenge-error', "User does not exist.");
    } else {
      if (receiver.id === sender.id) {
        return socket.emit('challenge-error', "You cannot challenge yourself to a game!");
      } else {
        var challenge = new Challenge({
          sender: sender.id,
          receiver: receiver.id
        });

        challenge.save(function(err) {
          if (err) {
            return socket.emit('challenge-error', "Database error.");
          } else {
            return socket.emit('new-challenge', { sender: sender.id, receiver: receiver.id });
          }
        });
      }
    }
  });
}

// A function for both withdrawing and rejecting challenges.
// Takes an argument saying who can do this, and the status that results.
var deleteChallenge = function(socket, user, challengeId) {
  Challenge.findById(challengeId, function(err, challenge) {
    if (err) {
      return socket.emit('challenge-error', "Database error.");
    } else if (!challenge) {
      return socket.emit('challenge-error', "Challenge does not exist.");
    } else {
      if (!challenge.receiver.equals(user.id) && !challenge.sender.equals(user.id)) {
        return socket.emit('challenge-error', "You cannot delete this challenge!");
      }

      challenge.status = challenge.receiver.equals(user.id) ? 'rejected' : 'withdrawn';

      challenge.save(function(err) {
        if (err) {
          return socket.emit('challenge-error', "Database error.");
        }

        return socket.emit('delete-challenge', challenge.id);
      });
    }
  });
}

var acceptChallenge = function(socket, user, challengeId) {
  Challenge.findById(challengeId, function(err, challenge) {
    if (err) {
      return socket.emit('challenge-error', "Database error.");
    } else if (!challenge) {
      return socket.emit('challenge-error', "Challenge does not exist.");
    } else {
      if (!challenge.receiver.equals(user.id)) {
        return socket.emit('challenge-error', "You are not the recipient of this challenge!");
      }

      challenge.status = 'accepted';
      var game = newGame(challenge.sender, challenge.receiver);

      game.save(function(err) {
        if (err) {
          return socket.emit('challenge-error', "Database error.");
        }

        challenge.game = game.id;

        challenge.save(function(err) {
          if (err) {
            return socket.emit('challenge-error', "Database error.");
          }

          return socket.emit('challenge-status-change', { id: challenge.id, status: 'accepted' });
        });
      });
    }
  })
}

module.exports = gameSocketServer;
