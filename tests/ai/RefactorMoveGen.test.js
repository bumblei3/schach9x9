import {
  getAllLegalMoves,
  // makeMove,
  // undoMove,
  // isSquareAttacked,
  isInCheck,
  // findKing
} from '../../js/ai/MoveGenerator.js';
import {
  SQUARE_COUNT,
  PIECE_NONE,
  WHITE_PAWN,
  WHITE_KNIGHT,
  WHITE_KING,
  // WHITE_ROOK,
  // BLACK_PAWN,
  // BLACK_KING,
  BLACK_ROOK,
  coordsToIndex,
  COLOR_WHITE,
  // COLOR_BLACK
} from '../../js/ai/BoardDefinitions.js';

describe('Integer MoveGenerator', () => {
  let board;

  beforeEach(() => {
    board = new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
  });

  test('should generate simple pawn moves', () => {
    // White Pawn at 4,4 (Index 40)
    const idx = coordsToIndex(4, 4);
    board[idx] = WHITE_PAWN;

    // Move Up (-9) -> 3,4 (Index 31)
    const moves = getAllLegalMoves(board, 'white');
    expect(moves.length).toBeGreaterThan(0);
    const basicPush = moves.find(m => m.to === coordsToIndex(3, 4));
    expect(basicPush).toBeDefined();
  });

  test('should generate knight jumps', () => {
    const idx = coordsToIndex(4, 4);
    board[idx] = WHITE_KNIGHT;
    const moves = getAllLegalMoves(board, 'white');

    // 8 moves for center knight
    expect(moves.length).toBe(8);

    // specific jump: 2,3 (Up 2, Left 1) -> Index 21
    const jump = moves.find(m => m.to === coordsToIndex(2, 3));
    expect(jump).toBeDefined();
  });

  test('should detect check', () => {
    // White King at 0,0
    // Black Rook at 0,8
    board[coordsToIndex(0, 0)] = WHITE_KING;
    board[coordsToIndex(0, 8)] = BLACK_ROOK;

    expect(isInCheck(board, COLOR_WHITE)).toBe(true);
  });

  test('should filter illegal moves (check)', () => {
    // White King at 0,0
    // Black Rook at 0,8
    // King cannot move to 0,1 (still attacked)
    // King can move to 1,0 (safe)

    board[coordsToIndex(0, 0)] = WHITE_KING;
    board[coordsToIndex(0, 8)] = BLACK_ROOK;

    const moves = getAllLegalMoves(board, 'white');

    const safeMove = moves.find(m => m.to === coordsToIndex(1, 0));
    const unsafeMove = moves.find(m => m.to === coordsToIndex(0, 1));

    expect(safeMove).toBeDefined();
    expect(unsafeMove).toBeUndefined();
  });
});
