
import { Game } from '../js/gameEngine.js';
import { generateRandomBoard, createPRNG } from './test-utils.js';
import { PHASES } from '../js/config.js';

// Mock UI and sounds to avoid initialization issues
vi.mock('../js/ui.js', () => ({
  renderBoard: vi.fn(),
  updateStatus: vi.fn(),
  updateCapturedUI: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
}));

vi.mock('../js/sounds.js', () => ({
  soundManager: { playMove: vi.fn(), playCapture: vi.fn() },
}));

describe('Game Engine Property-Based Tests', () => {
  const NUM_ITERATIONS = 50;
  const SEED = 42; // Deterministic seed
  const { random: seededRandom } = createPRNG(SEED);

  function countKings(board) {
    let white = 0,
      black = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p && p.type === 'k') {
          if (p.color === 'white') white++;
          else black++;
        }
      }
    }
    return { white, black };
  }

  test('Invariants should hold after random moves', () => {
    for (let i = 0; i < NUM_ITERATIONS; i++) {
      const game = new Game();
      game.phase = PHASES.PLAY;
      game.board = generateRandomBoard(8, 8, seededRandom);
      game.turn = seededRandom() > 0.5 ? 'white' : 'black';

      const opponentColor = game.turn === 'white' ? 'black' : 'white';
      if (game.isInCheck(game.turn)) {
        game.turn = opponentColor;
        if (game.isInCheck(game.turn)) continue;
      }

      const allMoves = game.getAllLegalMoves(game.turn);
      if (allMoves.length === 0) continue;

      const move = allMoves[Math.floor(seededRandom() * allMoves.length)];
      const movingColor = game.turn;

      const kingsBefore = countKings(game.board);
      expect(kingsBefore.white).toBe(1);
      expect(kingsBefore.black).toBe(1);

      const piece = game.board[move.from.r][move.from.c];
      game.board[move.to.r][move.to.c] = piece;
      game.board[move.from.r][move.from.c] = null;
      if (piece) piece.hasMoved = true;

      const kingsAfter = countKings(game.board);
      expect(kingsAfter.white).toBe(1);
      expect(kingsAfter.black).toBe(1);

      expect(game.isInCheck(movingColor)).toBe(false);
    }
  });

  test('getAllLegalMoves should never include moves into check', () => {
    for (let i = 0; i < NUM_ITERATIONS; i++) {
      const game = new Game();
      game.phase = PHASES.PLAY;
      game.board = generateRandomBoard(5, 5, seededRandom);
      game.turn = 'white';

      const moves = game.getAllLegalMoves('white');

      moves.forEach(move => {
        const originalBoard = JSON.parse(JSON.stringify(game.board));

        const piece = game.board[move.from.r][move.from.c];
        game.board[move.to.r][move.to.c] = piece;
        game.board[move.from.r][move.from.c] = null;

        const inCheck = game.isInCheck('white');
        game.board = originalBoard;

        expect(inCheck).toBe(false);
      });
    }
  });
});
