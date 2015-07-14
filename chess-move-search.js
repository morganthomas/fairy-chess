function alphaBetaMax(state, color, alpha, beta, depth) {
  if (depth === 0) {
    return playerScoreLead(state.board, color);
  } else {
    var moves = legalMoves(state);

    for (var i = 0; i < moves.length; i++) {
      var newState = copyGameStateLean(state);
      executeMove(newState, moves[i]);
      var moveScore = alphaBetaMin(newState, color, alpha, beta, depth - 1);

      if (moveScore >= beta) {
        return beta;
      }

      if (moveScore > alpha) {
        alpha = moveScore;
      }
    }

    return alpha;
  }
}

function alphaBetaMin(state, color, alpha, beta, depth) {
  if (depth === 0) {
    return playerScoreLead(state.board, color);
  } else {
    var moves = legalMoves(state);

    for (var i = 0; i < moves.length; i++) {
      var newState = copyGameStateLean(state);
      executeMove(newState, moves[i]);
      var moveScore = alphaBetaMax(newState, color, alpha, beta, depth - 1);

      if (moveScore <= alpha) {
        return alpha;
      }

      if (moveScore < beta) {
        beta = moveScore;
      }
    }

    return beta;
  }
}

// Given a game state, returns the score lead the given player
// will achieve after the given number of plies, assuming perfect play by
// both sides.
function bestScoreLead(state, color, depth) {
  // The maximum score of a player is less than 160, so these alpha-beta
  // values act as positive and negative infinity.
  return alphaBetaMax(state, color, -160, 160, depth);
}

// Naive min-max search.

// function bestScoreLead(state, color, plies) {
//   if (plies === 0) {
//     return playerScoreLead(state.board, color);
//   } else {
//     var moves = legalMoves(state);
//     var reducer = state.playerToMove === color ?
//       Math.max : Math.min;
//
//     return reducer.apply(Math, moves.map(function(move) {
//       var newState = copyGameStateLean(state);
//       executeMove(newState, move);
//       return bestScoreLead(newState, color, plies - 1);
//     }));
//   }
// }
