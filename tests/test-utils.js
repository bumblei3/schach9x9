import { jest } from '@jest/globals';

/**
 * Sets up a standard JSDOM environment for Schach 9x9 tests.
 */
export function setupJSDOM() {
  document.body.innerHTML = `
    <div id="board-wrapper">
        <div id="board"></div>
    </div>
    <div id="status-display"></div>
    <div id="move-history"></div>
    <div id="captured-white">
        <div class="material-advantage white-adv"></div>
    </div>
    <div id="captured-black">
        <div class="material-advantage black-adv"></div>
    </div>
    <div id="clock-white"></div>
    <div id="clock-black"></div>
    <div id="shop-panel" class="hidden"></div>
    <div id="points-display"></div>
    <div id="finish-setup-btn"></div>
    <div id="selected-piece-display"></div>
    <div id="tutor-overlay" class="hidden">
         <div id="tutor-hints-body"></div>
    </div>
    <div id="promotion-overlay" class="hidden">
        <div id="promotion-options"></div>
    </div>
    <div id="replay-status" class="hidden"></div>
    <div id="replay-exit" class="hidden"></div>
    <div id="tutor-recommendations-section" class="hidden"></div>
    <div id="stats-overlay" class="hidden">
         <div id="stat-moves"></div>
         <div id="stat-captures"></div>
         <div id="stat-accuracy"></div>
         <div id="stat-best-moves"></div>
         <div id="stat-material"></div>
    </div>
    <div id="generic-modal" style="display:none">
        <div id="modal-title"></div>
        <div id="modal-message"></div>
        <div id="modal-actions"></div>
    </div>
    <div id="game-over-overlay" class="hidden">
        <div id="winner-text"></div>
    </div>
    <div id="draw-offer-overlay" class="hidden">
        <div id="draw-offer-message"></div>
    </div>
    <div id="chess-clock" class="hidden"></div>
    <div id="puzzle-overlay" class="hidden">
        <div id="puzzle-title"></div>
        <div id="puzzle-description"></div>
        <div id="puzzle-status"></div>
        <button id="puzzle-next-btn"></button>
        <button id="puzzle-exit-btn"></button>
    </div>
  `;

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
