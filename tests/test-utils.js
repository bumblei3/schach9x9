import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Sets up a standard JSDOM environment for Schach 9x9 tests.
 */
export function setupJSDOM() {
  const htmlPath = path.resolve(__dirname, '../index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  document.body.innerHTML = htmlContent;

  global.window.PIECE_SVGS = {
    white: { p: 'wp', r: 'wr', n: 'wn', b: 'wb', q: 'wq', k: 'wk', e: 'we', a: 'wa', c: 'wc' },
    black: { p: 'bp', r: 'br', n: 'bn', b: 'bb', q: 'bq', k: 'bk', e: 'be', a: 'ba', c: 'bc' },
  };
  global.window._svgCache = {};
}

/**
 * Creates a mock game object with common methods and properties.
 */
export function createMockGame(overrides = {}) {
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
    log: jest.fn(),
    getValidMoves: jest.fn(() => []),
    handleCellClick: jest.fn(),
    isInCheck: jest.fn(() => false),
    isSquareUnderAttack: jest.fn(() => false),
    isInsufficientMaterial: jest.fn(() => false),
    calculateMaterialAdvantage: jest.fn(() => 0),
    acceptDraw: jest.fn(),
    declineDraw: jest.fn(),
    offerDraw: jest.fn(),
    undoMove: jest.fn(),
    updateBestMoves: jest.fn(),
    gameStartTime: Date.now(),
    ...overrides,
  };
}

/**
 * Mocks Three.js basics for testing 3D components without loading the full library.
 */
export function mockThreeJS() {
  const mockScene = { add: jest.fn(), remove: jest.fn(), traverse: jest.fn() };
  const mockCamera = {
    position: { set: jest.fn() },
    lookAt: jest.fn(),
    updateProjectionMatrix: jest.fn(),
  };
  const mockRenderer = {
    setSize: jest.fn(),
    setPixelRatio: jest.fn(),
    render: jest.fn(),
    dispose: jest.fn(),
    domElement: document.createElement('canvas'),
  };

  return { mockScene, mockCamera, mockRenderer };
}

/**
 * Creates a simple seeded pseudo-random number generator.
 * @param {number} seed
 * @returns {Array<Function>} A random function and a reset function
 */
export function createPRNG(seed = 12345) {
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

/**
 * Generates a random board state for testing.
 * @param {number} whitePieceCount - Number of non-king white pieces.
 * @param {number} blackPieceCount - Number of non-king black pieces.
 * @param {Function} randomFunc - Optional PRNG function.
 */
export function generateRandomBoard(
  whitePieceCount = 5,
  blackPieceCount = 5,
  randomFunc = Math.random
) {
  const board = Array(9)
    .fill(null)
    .map(() => Array(9).fill(null));
  const BOARD_SIZE = 9;

  const getRandomCoord = () => ({
    r: Math.floor(randomFunc() * BOARD_SIZE),
    c: Math.floor(randomFunc() * BOARD_SIZE),
  });

  const isOccupied = (r, c) => board[r][c] !== null;

  // Place Kings
  let wkr, wkc, bkr, bkc;
  do {
    ({ r: wkr, c: wkc } = getRandomCoord());
  } while (isOccupied(wkr, wkc));
  board[wkr][wkc] = { type: 'k', color: 'white' };

  do {
    ({ r: bkr, c: bkc } = getRandomCoord());
  } while (isOccupied(bkr, bkc));
  board[bkr][bkc] = { type: 'k', color: 'black' };

  const pieceTypes = ['p', 'n', 'b', 'r', 'q', 'a', 'c', 'e'];

  const placeRandomPieces = (count, color) => {
    for (let i = 0; i < count; i++) {
      let r, c;
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
