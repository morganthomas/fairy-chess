function assert(cond, name) {
  if (!cond) {
    console.log("Test fail: " + name);
  }
}

function allBoardLocs_test() {
  iter = allBoardLocs();
  var loc;

  do {
    loc = iter();
    if (loc) {
      console.log("(" + loc.row + ", " + loc.col + ")");
    } else {
      console.log("End!")
    }

  } while (loc != null)
}
