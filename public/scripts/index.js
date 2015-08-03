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

var withdrawChallenge = function(id) {
  $.ajax({
    url: '/game/withdraw-challenge',
    type: 'POST',
    data: { challenge: id },

    success: function(res) {
      alert(res);
    }
  })
}

var rejectChallenge = function(id) {
  $.ajax({
    url: '/game/reject-challenge',
    type: 'POST',
    data: { challenge: id },

    success: function(res) {
      alert(res);
    }
  })
}

var acceptChallenge = function(id) {
  $.ajax({
    url: '/game/accept-challenge',
    type: 'POST',
    data: { challenge: id },

    success: function(res) {
      alert(res);
    }
  })
}

var showGameView = function(id) {
  $('#game-view-modal').modal('show');
}

$(function() {
  $('#send-challenge-button').on('click', function() {
    sendChallenge();
  });

  $('#initiate-challenge-form').on('submit', function(e) {
    e.preventDefault();
    sendChallenge();
  });

  $('body').on('click', '.withdraw-challenge-button', function(e) {
    e.preventDefault();
    withdrawChallenge($(this).attr('data-id'));
  });

  $('body').on('click', '.reject-challenge-button', function(e) {
    e.preventDefault();
    rejectChallenge($(this).attr('data-id'));
  });

  $('body').on('click', '.accept-challenge-button', function(e) {
    e.preventDefault();
    acceptChallenge($(this).attr('data-id'));
  });

  $('body').on('click', '.play-game-button', function(e) {
    e.preventDefault();
    showGameView($(this).attr('data-id'));
  })
});
