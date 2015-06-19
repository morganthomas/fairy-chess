import qualified Data.Map as Map
--import Test.HUnit

--
-- Utility
--

require :: (a -> Bool) -> a -> [a]
require p x =
  if p x then [x] else []

data IterControl = StopHereInclusive | StopHereExclusive | Continue

-- takeWhile3 :: (a -> IterControl) -> [a] -> [a]
-- takeWhile3 f [] = []
-- takeWhile3 f (x:xs) =
--   case f x of
--     StopHereInclusive -> [x]
--     StopHereExclusive -> []
--     Continue -> x : (takeWhile3 f xs)

--
-- Types
--

data Color = Black | White deriving (Eq,Show)

data Rank = Pawn | Rook | Knight | Bishop | Queen | King
  deriving (Eq,Ord,Show)

data BoardLoc = Loc { row :: Int, col :: Int }
  deriving (Eq,Ord,Show)

allBoardLocs :: [BoardLoc]
allBoardLocs = [Loc row col | row <- [0..7], col <- [0..7]]

inBounds :: BoardLoc -> Bool
inBounds = (`elem` allBoardLocs)

locPlus :: BoardLoc -> BoardLoc -> BoardLoc
locPlus (Loc r1 c1) (Loc r2 c2) = Loc (r1 + r2) (c1 + c2)

-- locSplay :: [BoardLoc] -> BoardLoc -> [BoardLoc]
-- locSplay locs loc = map (locPlus loc) locs

data Piece = Piece {
    color :: Color,
    rank :: Rank,
    nativeColumn :: Int
  }
  deriving (Eq,Show)

data LocatedPiece = LocatedPiece Piece BoardLoc

type BoardConfig = Map.Map BoardLoc (Maybe Piece)

data GameState = GameState {
    board :: BoardConfig,
    kingsAndRooksMoved :: [Piece],
    pawnsJustMovedDoubly :: [Piece],
    kingLocs :: Map Color BoardLoc
  }

-- Castling is represented by the move of the king.
data Move = Move {
    piece :: Piece,
    newLoc :: BoardLoc,
    flag :: Maybe MoveFlag
  } deriving (Eq,Show)

data MoveFlag =
    KingMove | -- For non-castling king moves
    RookMove |
    PawnDoubleMove | -- For the initial two-square move a pawn can do
    EnPassant |
    Castle |
    PawnPromotionTo Rank
  deriving (Eq,Show)

locToMove :: Piece -> BoardLoc -> Move
locToMove piece loc = Move piece loc Nothing

addFlag :: MoveFlag -> Move -> Move
addFlag flag move = move { flag = Just flag }

--
-- Starting game state
--

startingBackRow :: [Rank]
startingBackRow = [Rook, Knight, Bishop, Queen, King, Bishop, Knight, Rook]

startingBoardConfig :: BoardConfig
startingBoardConfig = Map.fromList $
    (makeBackRow White 0) ++
    (makePawnRow White 1) ++
    makeBlankRows ++
    (makePawnRow Black 6) ++
    (makeBackRow Black 7)
  where
    makeBackRow color rowNum =
      map (\(colNum, rank) -> (Loc { row = rowNum, col = colNum },
            Just $ Piece { color = color, rank = rank, nativeColumn = colNum })) $
          zip [0..] startingBackRow
    makePawnRow color rowNum =
      map (\colNum -> (Loc { row = rowNum, col = colNum },
            Just $ Piece { color = color, rank = Pawn, nativeColumn = colNum}))
          [0..7]
    makeBlankRows =
      map (\(rowNum, colNum) -> (Loc { row = rowNum, col = colNum }, Nothing))
          [(rowNum, colNum) | rowNum <- [2..5], colNum <- [0..7]]

startingGameState :: GameState
startingGameState = GameState {
    board = startingBoardConfig,
    kingsAndRooksMoved = [],
    pawnsJustMovedDoubly = [],
    kingLocs = Map.fromList [(White, Loc 0 4), (Black, Loc 7 4)]
  }

--
-- Listing all legal moves from a given game state.
--

-- A legal move is a semi-legal move which doesn't leave the player in
-- check, unless it is a castle, in which case the requirement is that the
-- king doesn't start in check, pass through check, or end up in check.
legalMoves :: GameState -> [Move]
legalMoves = undefined

-- XXX: Currently we don't add flags.

-- A semi-legal move is one which is legal except that it might leave the
-- player in check and/or capture the opponent's king.
semiLegalMoves :: GameState -> Color -> [Move]
semiLegalMoves state activeColor =
    concatMap (semiLegalMovesFromLoc state activeColor) allBoardLocs

semiLegalMovesFromLoc :: GameState -> Color -> BoardLoc -> [Move]
semiLegalMovesFromLoc state activeColor loc =
  case (board state) Map.! loc of
    (Just piece) -> if color piece == activeColor then
        pieceSemiLegalMoves state (LocatedPiece piece loc) else []
    Nothing -> []

-- The semi-legal moves for a given piece which is at the given location.
pieceSemiLegalMoves :: GameState -> LocatedPiece -> [Move]
pieceSemiLegalMoves state piece@(LocatedPiece piece' loc) =
  (semiLegalMoveFunctions Map.! (rank piece')) state piece

semiLegalMoveFunctions :: Map.Map Rank
  (GameState -> LocatedPiece -> [Move])
semiLegalMoveFunctions = Map.fromList
  [(Pawn, pawnMoves), (Rook, rookMoves), (Knight, knightMoves),
   (Bishop, bishopMoves), (Queen, queenMoves), (King, kingMoves)]

-- XXX: En passant
pawnMoves state lp@(LocatedPiece piece loc) =
    singleForwardMoves ++ doubleForwardMoves ++ captureMoves
  where
    singleForwardMoves = findMoves state
      (pawnSingleForwardMoves (color piece)) cannotCaptureControl lp
    doubleForwardMoves =
      if row loc == pawnHomeRow (color piece) then
        findMoves state (pawnDoubleForwardMoves (color piece))
          cannotCaptureControl lp else []
    captureMoves = findMoves state
      (pawnCaptureMoves (color piece)) mustCaptureControl lp

rookMoves state lp = findMoves state straightLineMoves canCaptureControl lp

knightMoves state lp = findMoves state knightMoveSpecs knightControl lp

bishopMoves state lp = findMoves state diagonalMoves canCaptureControl lp

queenMoves state lp = findMoves state (straightLineMoves ++ diagonalMoves)
  canCaptureControl lp

-- XXX: Castling
kingMoves state lp = findMoves state kingMoveSpecs canCaptureControl lp

straightLineMoves :: [MovementSpec]
straightLineMoves = linearMovementSpecs 8
  [Loc 1 0, Loc 0 1, Loc (-1) 0, Loc 0 (-1)]

diagonalMoves :: [MovementSpec]
diagonalMoves = linearMovementSpecs 8
  [Loc 1 1, Loc 1 (-1), Loc (-1) 1, Loc (-1) (-1)]

knightMoveSpecs :: [MovementSpec]
knightMoveSpecs = [[Loc a 0, Loc a 0, Loc 0 b] | a <- [-1,1], b <- [-1,1]]
           ++ [[Loc 0 a, Loc 0 a, Loc b 0] | a <- [-1,1], b <- [-1,1]]

kingMoveSpecs :: [MovementSpec]
kingMoveSpecs = [[Loc a b] | a <- [-1,0,1], b <- [-1,0,1], abs a + abs b > 0]

pawnSingleForwardMoves :: Color -> [MovementSpec]
pawnSingleForwardMoves color = [[Loc (pawnMoveDir color) 0]]

pawnDoubleForwardMoves :: Color -> [MovementSpec]
pawnDoubleForwardMoves color = [replicate 2 $ Loc (pawnMoveDir color) 0]

pawnCaptureMoves :: Color -> [MovementSpec]
pawnCaptureMoves color = [[Loc (pawnMoveDir color) a] | a <- [1,-1]]

pawnMoveDir :: Color -> Int
pawnMoveDir White = 1
pawnMoveDir Black = -1

pawnHomeRow :: Color -> Int
pawnHomeRow White = 1
pawnHomeRow Black = 6

--
-- Framework for listing semi-legal moves.
--

-- A board location differential which is in -1,0,1 in each dimension.
type UnitLocDifference = BoardLoc

-- A movement spec specifies how a piece moves, one square at a time.
type MovementSpec = [UnitLocDifference]

specToLoc :: BoardLoc -> MovementSpec -> BoardLoc
specToLoc loc spec = foldl locPlus loc spec)

-- Produces a list of movement specs by iterating application of each of the
-- the given differences a given number of times.
linearMovementSpecs :: Int -> [UnitLocDifference] -> [MovementSpec]
linearMovementSpecs n ds = concatMap
  (\d -> map (\m -> replicate m d) [1..n]) ds

type MovementControl = GameState -> LocatedPiece -> BoardLoc -> IterControl

-- This combinator creates a list of possible moves according to a certain
-- pattern. A list of movement specs are given. Each one is evaluated using
-- the given movement control function. The movement control function is
-- applied at each step to determine whether it is possible to continue.
-- It must give Continue for all steps except the last one, and
-- StopHereInclusive or Continue for the last step. This function also
-- automatically checks whether the move keeps the piece inside the board.
findMoves :: GameState -> [MovementSpec] -> MovementControl ->
  LocatedPiece -> [Move]
findMoves state specs ctrl lp@(LocatedPiece piece loc) =
  filter (\spec -> moveIsAllowed state spec ctrl lp) specs >>=
  return . specToLoc loc >>=
  return . locToMove piece

moveIsAllowed :: GameState -> MovementSpec -> MovementControl ->
  LocatedPiece -> Bool
moveIsAllowed _ [] _ _ = False -- No move goes for zero squares
moveIsAllowed state (d:[]) ctrl lp@(LocatedPiece piece loc) =
  let newLoc = locPlus d loc
      isInBounds = inBounds newLoc in
    if not $ inBounds newLoc then False else
      case ctrl state lp (locPlus d loc) of
        StopHereInclusive -> True
        StopHereExclusive -> False
        Continue -> True
moveIsAllowed state (d:ds) ctrl lp@(LocatedPiece piece loc) =
  let newLoc = locPlus d loc in
    if not $ inBounds newLoc then False else
      case ctrl state lp newLoc of
        StopHereInclusive -> False
        StopHereExclusive -> False
        Continue -> moveIsAllowed state ds ctrl
          (LocatedPiece piece newLoc)

--
-- Movement controls
--

-- Makes a movement control given specification for what iteration condition
-- to apply in the cases of moving into a friendly square, moving into
-- an enemy square, and moving into an empty square.
makeMovementControl :: IterControl -> IterControl -> IterControl -> MovementControl
makeMovementControl whenEmpty whenFriendly whenEnemy
    state (LocatedPiece piece loc) loc' =
  case (board state) Map.! loc' of
    Nothing -> whenEmpty
    Just piece' ->
      case color piece' == color piece of
        True -> whenFriendly
        False -> whenEnemy

canCaptureControl :: MovementControl
canCaptureControl = makeMovementControl
  Continue StopHereExclusive StopHereInclusive

cannotCaptureControl :: MovementControl
cannotCaptureControl = makeMovementControl
  Continue StopHereExclusive StopHereExclusive

knightControl :: MovementControl
knightControl = makeMovementControl Continue Continue Continue

mustCaptureControl :: MovementControl
mustCaptureControl = makeMovementControl
  StopHereExclusive StopHereExclusive StopHereInclusive
