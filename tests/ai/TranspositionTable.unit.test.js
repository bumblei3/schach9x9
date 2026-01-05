import {
  computeZobristHash,
  clearTT,
  getXORSideToMove,
  storeTT,
  probeTT,
  getTTMove,
  getZobristKey,
  TT_EXACT,
} from '../../js/ai/TranspositionTable.js';
import {
  // BOARD_SIZE,
  SQUARE_COUNT,
  COLOR_WHITE,
  // COLOR_BLACK,
  PIECE_PAWN,
} from '../../js/ai/BoardDefinitions.js';

describe('Zobrist Hashing Verification', () => {
  beforeEach(() => {
    clearTT();
  });

  test('getXORSideToMove should return side to move hash', () => {
    const sideHash = getXORSideToMove();
    expect(typeof sideHash).toBe('bigint'); // Changed to bigint expectation
    expect(sideHash).not.toBe(0n);
  });

  test('Incremental vs Full Hashing consistency', () => {
    const board = new Int8Array(SQUARE_COUNT).fill(0);
    const from = 10,
      to = 20;
    const pawn = PIECE_PAWN | COLOR_WHITE;
    board[from] = pawn;

    // Initial Full Hash
    let hash = computeZobristHash(board, 'white');

    // Simulate Move: Pawn 10 -> 20
    board[from] = 0;
    board[to] = pawn;

    // Incremental Update
    hash ^= getZobristKey(pawn, from);
    hash ^= getZobristKey(pawn, to);
    hash ^= getXORSideToMove(); // Flip side

    // Compare with Full Hash
    const fullHash = computeZobristHash(board, 'black');
    expect(hash).toBe(fullHash);
  });
});

describe('Transposition Table Logic (Two-Tier)', () => {
  beforeEach(() => {
    clearTT();
  });

  test('Deep Entry Protection: Should prefer deep entry from ttDeep', () => {
    const hash = 12345;
    const deepMove = { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } };
    const shallowMove = { from: { r: 2, c: 2 }, to: { r: 3, c: 3 } };

    // 1. Store Deep Entry (Depth 5)
    storeTT(hash, 5, 100, TT_EXACT, deepMove);

    // 2. Store Shallow Entry (Depth 1)
    storeTT(hash, 1, 50, TT_EXACT, shallowMove);

    // 3. Probe - Should return Deep Score
    const score = probeTT(hash, 1, -Infinity, Infinity);
    const bestMove = getTTMove(hash);

    expect(score).toBe(100);
    expect(bestMove).toEqual(deepMove);
  });

  test('Recent Entry Update: Should always update ttRecent', () => {
    const hash = 67890;
    const move1 = { from: { r: 0, c: 0 }, to: { r: 0, c: 1 } };
    const move2 = { from: { r: 0, c: 0 }, to: { r: 0, c: 2 } };

    // 1. Store Move 1 (Depth 2)
    storeTT(hash, 2, 100, TT_EXACT, move1);

    // 2. Store Move 2 (Depth 2)
    storeTT(hash, 2, 200, TT_EXACT, move2);

    // 3. Probe
    const score = probeTT(hash, 1, -Infinity, Infinity);
    const bestMove = getTTMove(hash);

    expect(score).toBe(200);
    expect(bestMove).toEqual(move2);
  });

  test('Deep Entry Replacement: Should update ttDeep if new depth is better', () => {
    const hash = 11111;
    const deepMove1 = { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } };
    const deepMove2 = { from: { r: 0, c: 0 }, to: { r: 2, c: 2 } };

    // 1. Store Depth 4
    storeTT(hash, 4, 100, TT_EXACT, deepMove1);

    // 2. Store Depth 6
    storeTT(hash, 6, 150, TT_EXACT, deepMove2);

    // 3. Probe
    const score = probeTT(hash, 1, -Infinity, Infinity);
    const bestMove = getTTMove(hash);

    expect(score).toBe(150);
    expect(bestMove).toEqual(deepMove2);
  });

  test('Probe Priority: Should return whichever is deeper', () => {
    const hash = 22222;
    const deepEntry = { from: { r: 0, c: 0 }, to: { r: 5, c: 5 } };
    const recentEntry = { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } };

    // Store Deep (Depth 5)
    storeTT(hash, 5, 500, TT_EXACT, deepEntry);

    // Store Recent (Depth 2)
    storeTT(hash, 2, 200, TT_EXACT, recentEntry);

    // Probe Depth 4.
    const score = probeTT(hash, 4, -Infinity, Infinity);
    const bestMove = getTTMove(hash);

    expect(score).toBe(500);
    expect(bestMove).toEqual(deepEntry);
  });
});
