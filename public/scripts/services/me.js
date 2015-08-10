chessApp.factory('me', function(socket) {
  var me = {};

  socket.on('you-are', function(user) {
    me.username = user.username;
    me._id = user._id;
  });

  return me;
})
