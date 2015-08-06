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

$(function() {
  $('#send-challenge-button').on('click', function() {
    sendChallenge();
  });

  $('#initiate-challenge-form').on('submit', function(e) {
    e.preventDefault();
    sendChallenge();
  });

  registerChallengeUpdate('accept');
  registerChallengeUpdate('reject');
  registerChallengeUpdate('withdraw');

  $('body').on('click', '.play-game-button', function(e) {
    e.preventDefault();
    showGameView($(this).attr('data-id'));
  })
});
