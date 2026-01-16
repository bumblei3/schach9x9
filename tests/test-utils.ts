import * as fs from 'fs';
import * as path from 'path';
import { vi } from 'vitest';

// Remove conflicting global declaration and rely on existing types if possible,
// or strictly match the expected type if we must declare it.
// The error indicated PIECE_SVGS is already declared with a specific type including 'j'.
// We will simply populate the window object matching that expectation without redeclaring the interface strictly if not needed,
// or we can just cast it to any to avoid the specific strict shape check if local compilation is the goal.
// However, best to match the shape.

/**
 * Sets up a standard JSDOM environment for Schach 9x9 tests.
 */
export function setupJSDOM(): void {
  // Use process.cwd() to locate index.html generic to the project root
  const htmlPath = path.resolve(process.cwd(), 'index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  document.body.innerHTML = htmlContent;

  // Add 'j' (Jester) to match the expected Record<..., string> type
  (window as any).PIECE_SVGS = {
    white: {
      p: 'wp',
      r: 'wr',
      n: 'wn',
      b: 'wb',
      q: 'wq',
      k: 'wk',
      e: 'we',
      a: 'wa',
      c: 'wc',
      j: 'wj',
    },
    black: {
      p: 'bp',
      r: 'br',
      n: 'bn',
      b: 'bb',
      q: 'bq',
      k: 'bk',
      e: 'be',
      a: 'ba',
      c: 'bc',
      j: 'bj',
    },
  };
  (window as any)._svgCache = {};

  // Mock HTMLCanvasElement.prototype.getContext to prevent 3D test failures
  HTMLCanvasElement.prototype.getContext = (_contextId: string) =>
    ({
      fillStyle: '',
      fillRect: vi.fn(),
      font: '',
      textAlign: '',
      textBaseline: '',
      strokeStyle: '',
      lineWidth: 0,
      strokeText: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 0 })),
    }) as any;
}

/**
 * Creates a mock game object with common methods and properties.
 */
export function createMockGame(overrides: Record<string, any> = {}) {
  const PHASES = {
    PLAY: 'play',
    SETUP_WHITE_KING: 'setup_white_king',
    SETUP_WHITE_PIECES: 'setup_white_pieces',
    SETUP_BLACK_KING: 'setup_black_king',
    SETUP_BLACK_PIECES: 'setup_black_pieces',
    GAME_OVER: 'game_over',
  };

  return {
    board: Array(9)
      .fill(null)
      .map(() => Array(9).fill(null)),
    phase: PHASES.PLAY,
    turn: 'white',
    whiteTime: 300,
    blackTime: 300,
    points: 15,
    initialPoints: 15,
    whiteCorridor: { rowStart: 6, colStart: 3 },
    blackCorridor: { rowStart: 0, colStart: 3 },
    moveHistory: [],
    positionHistory: [],
    capturedPieces: { white: [], black: [] },
    stats: { totalMoves: 0, playerMoves: 0, playerBestMoves: 0, captures: 0, accuracies: [] },
    clockEnabled: true,
    isAI: false,
    isAnimating: false,
    replayMode: false,
    log: vi.fn(),
    getValidMoves: vi.fn(() => []),
    handleCellClick: vi.fn(),
    isInCheck: vi.fn(() => false),
    isSquareUnderAttack: vi.fn(() => false),
    isInsufficientMaterial: vi.fn(() => false),
    calculateMaterialAdvantage: vi.fn(() => 0),
    acceptDraw: vi.fn(),
    declineDraw: vi.fn(),
    offerDraw: vi.fn(),
    undoMove: vi.fn(),
    updateBestMoves: vi.fn(),
    gameStartTime: Date.now(),
    ...overrides,
  };
}

/**
 * Mocks Three.js basics for testing 3D components without loading the full library.
 */
export function mockThreeJS() {
  const mockScene = { add: vi.fn(), remove: vi.fn(), traverse: vi.fn() };
  const mockCamera = {
    position: { set: vi.fn() },
    lookAt: vi.fn(),
    updateProjectionMatrix: vi.fn(),
  };
  const mockRenderer = {
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    domElement: document.createElement('canvas'),
  };

  return { mockScene, mockCamera, mockRenderer };
}

/**
 * Creates a simple seeded pseudo-random number generator.
 * @param seed
 * @returns A random function and a reset function
 */
export function createPRNG(seed: number = 12345) {
  let currentSeed = seed;
  const random = () => {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };
  const reset = () => {
    currentSeed = seed;
  };
  return { random, reset };
}

interface Piece {
  type: string;
  color: string;
  hasMoved?: boolean;
}

/**
 * Generates a random board state for testing.
 * @param whitePieceCount - Number of non-king white pieces.
 * @param blackPieceCount - Number of non-king black pieces.
 * @param randomFunc - Optional PRNG function.
 */
export function generateRandomBoard(
  whitePieceCount: number = 5,
  blackPieceCount: number = 5,
  randomFunc: () => number = Math.random
): (Piece | null)[][] {
  const board: (Piece | null)[][] = Array(9)
    .fill(null)
    .map(() => Array(9).fill(null));
  const BOARD_SIZE = 9;

  const getRandomCoord = () => ({
    r: Math.floor(randomFunc() * BOARD_SIZE),
    c: Math.floor(randomFunc() * BOARD_SIZE),
  });

  const isOccupied = (r: number, c: number) => board[r][c] !== null;

  // Place Kings
  let wkr: number, wkc: number, bkr: number, bkc: number;
  do {
    ({ r: wkr, c: wkc } = getRandomCoord());
  } while (isOccupied(wkr, wkc));
  board[wkr][wkc] = { type: 'k', color: 'white' };

  do {
    ({ r: bkr, c: bkc } = getRandomCoord());
  } while (isOccupied(bkr, bkc));
  board[bkr][bkc] = { type: 'k', color: 'black' };

  const pieceTypes = ['p', 'n', 'b', 'r', 'q', 'a', 'c', 'e'];

  const placeRandomPieces = (count: number, color: string) => {
    for (let i = 0; i < count; i++) {
      let r: number, c: number;
      do {
        ({ r, c } = getRandomCoord());
      } while (isOccupied(r, c));

      const type = pieceTypes[Math.floor(randomFunc() * pieceTypes.length)];
      // Avoid pawns on promotion ranks
      if (type === 'p' && (r === 0 || r === 8)) {
        i--;
        continue;
      }
      board[r][c] = { type, color, hasMoved: randomFunc() > 0.5 };
    }
  };

  placeRandomPieces(whitePieceCount, 'white');
  placeRandomPieces(blackPieceCount, 'black');

  return board;
}
