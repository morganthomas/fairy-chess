var User = require('../models/user');
var Challenge = require('../models/challenge');
var Game = require('../models/game');
var _ = require('../public/scripts/lib/lodash');
var passport = require('passport');
var chess = require('../public/scripts/chess/chess.js');

// Emits the given message to the given users, if they are connected. Takes the
// connections map and an array of user ID hex strings.
var emitToUsers = function(connections, users, messageType, messageBody) {
  users.forEach(function(userId) {
    if (connections[userId]) {
      connections[userId].forEach(function(socket) {
        socket.emit(messageType, messageBody);
      });
    }
  })
}

var gameSocketServer = function(httpServer, sessionMiddleware) {
  var io = require('socket.io')(httpServer);

  // Passport middleware
  io.use(function(socket, next) {
    sessionMiddleware(socket.request, {}, next);
  });

  // A map from user IDs to arrays of connections (a user might have more than one
  // connection).
  var connections = {};

  io.on('connection', function(socket) {
    var userId = socket.request.session && socket.request.session.passport &&
      socket.request.session.passport.user;

    if (!userId) {
      return;
    }

    passport.deserializeUser(userId, function(err, user) {
      if (err) {
        return; // XXX
      }

      if (!connections[user.id]) {
        connections[user.id] = [];
      }

      connections[user.id].push(socket);

      socket.on('disconnect', function() {
        connections[user.id] = connections[user.id].filter(function(otherSocket) {
          return otherSocket.id !== socket.id;
        });

        if (connections[user.id].length === 0) {
          delete connections[user.id];
        }
      });

      socket.on('create-challenge', function(receiverUsername) {
        createChallenge(connections, socket, user, receiverUsername);
      });

      socket.on('delete-challenge', function(challengeId) {
        deleteChallenge(connections, socket, user, challengeId);
      });

      socket.on('accept-challenge', function(challengeId) {
        acceptChallenge(connections, socket, user, challengeId);
      });

      socket.on('move', function(data) {
        doMove(connections, socket, user, data);
      });

      sendInitialState(socket, user);
    })
  });
}

var sendInitialState = function(socket, user) {
  socket.emit('you-are', user);

  Challenge.find({
    $and: [{$or: [ { receiver: user.id }, { sender: user.id } ]},
           { status: { $in: ['open', 'accepted', 'completed'] } }]
    })
    .populate('receiver sender game')
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

      socket.emit('active-challenges-loaded');
    });
}

var createChallenge = function(connections, socket, sender, receiverUsername) {
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
            // Populate the sender and receiever fields of the challenge
            challenge.sender = sender;
            challenge.receiver = receiver;

            emitToUsers(connections, [challenge.sender.id, challenge.receiver.id],
              'create-challenge', challenge);
          }
        });
      }
    }
  });
}

// A function for both withdrawing and rejecting challenges.
// Takes an argument saying who can do this, and the status that results.
var deleteChallenge = function(connections, socket, user, challengeId) {
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

        emitToUsers(connections, [challenge.sender.toString(), challenge.receiver.toString()],
          'delete-challenge', challenge.id);
      });
    }
  });
}

var acceptChallenge = function(connections, socket, user, challengeId) {
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
      var game = new Game(chess.generateGame(challenge.sender, challenge.receiver));

      game.save(function(err) {
        if (err) {
          return socket.emit('challenge-error', "Database error.");
        }

        challenge.game = game.id;

        challenge.save(function(err) {
          if (err) {
            return socket.emit('challenge-error', "Database error.");
          }

          emitToUsers(connections, [challenge.sender.toString(), challenge.receiver.toString()],
            'challenge-status-change', { id: challenge.id, status: 'accepted', newGame: game });
        });
      });
    }
  })
}

var doMove = function(connections, socket, user, data) {
  var fail = function(why) {
   socket.emit('move-rejected', {
     game: data.game, move: data.move, why: why
   });
  }

  if (data.game && data.move && data.index) {
   Game.findById(data.game, function(err, game) {
     if (err) {
       return fail('Database error finding game.');
     }

     if (chess.moveIsLegalInCurrentState(game, data.move) &&
          user._id.equals(game.players[chess.getCurrentState(game).playerToMove])) {
       chess.executeMoveInGame(game, data.move);

       var finish = function(gameCompleted, challenge) {
         game.save(function(err) {
           if (err) {
             return fail('Database error saving game.');
           }

           emitToUsers(connections, [game.players.white, game.players.black],
             'move', data);

           if (gameCompleted) {
             emitToUsers(connections, [game.players.white, game.players.black],
              'challenge-status-change', {
                id: challenge.id,
                status: challenge.status
              });
           }
         })
       }

       if (chess.getCurrentState(game).status === 'game not over') {
         finish(false);
       } else {
         Challenge.findOne({ game: game._id }, function(err, challenge) {
           if (err || !challenge) {
             return fail('Database error finding challenge.');
           }

           challenge.status = 'completed';

           challenge.save(function(err) {
             if (err) {
               return fail('Database error updating challenge.')
             }

             finish(true, challenge);
           })
         });
       }
     } else {
       return fail('Move is illegal.');
     }
   })
  }
}

module.exports = gameSocketServer;
