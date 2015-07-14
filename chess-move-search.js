// Given a game state, returns the score lead the given player
// will achieve after the given number of plies, assuming perfect play by
// both sides.
function bestScoreLead(state, color, plies) {
  if (plies === 0) {
    return playerScoreLead(state.board, color);
  } else {
    var moves = legalMoves(state);
    var reducer = state.playerToMove === color ?
      Math.max : Math.min;

    return reducer.apply(Math, moves.map(function(move) {
      var newState = copyGameStateLean(state);
      executeMove(newState, move);
      return bestScoreLead(newState, color, plies - 1);
    }));
  }
}
