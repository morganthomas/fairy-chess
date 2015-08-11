import qualified Data.Map as Map

type Player = String
type Template = String
type Icon = String
type PieceTypeId = Int

data Loc = Loc { locRow :: Int, locCol :: Int }

data Color = White | Black

type Players = Map.Map Color Player

data PieceTemplate = XXX

data PieceType = PieceType {
  ptTemplate :: PieceTemplate, -- Includes params
  ptName :: String,
  ptIcon :: Icon,
  ptRoyal :: Bool
}

data Piece = Piece {
  pieceType :: PieceTypeId,
  pieceColor :: Color,
  pieceLoc :: Loc,
  pieceHasMoved :: Bool
}

type Board = Map.Map Loc (Maybe Piece)

data Move = SelfMove {
  smFrom :: Loc,
  smTo :: Loc
}

data GameStatus = GameNotOver | Stalemate | Checkmate

data GameState = GameState {
  gsBoard :: Board,
  gsPlayerToMove :: Color,
  gsStatus :: GameStatus,
  gsCapturedPieces :: [Piece]
}

data BoardInfo = BoardInfo {
  biNumRows :: Int,
  biNumCols :: Int
}

data Game = Game {
  gamePlayers :: Players,
  gamePieceTypes :: Map.Map PieceTypeId PieceType,
  gameBoardInfo :: BoardInfo,
  states :: Map.Map Int GameState,
  moves :: Map.Map Int Move
}
