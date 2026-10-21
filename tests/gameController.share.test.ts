/**
 * Share / FEN coverage for js/gameController.ts.
 *
 * Targets the previously-uncovered share/FEN block (getCurrentFEN,
 * getShareUrl, loadSharedPosition, shareCurrentPosition).
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// --- Mocks (mirror gameController.test.ts) ---------------------------------
vi.mock('../js/statisticsManager.js', () => ({ StatisticsManager: class { constructor() {} } }));
vi.mock('../js/TimeManager.js', () => ({ TimeManager: class { constructor() {} stopClock() {} startClock() {} tickClock() {} } }));
vi.mock('../js/shop/ShopManager.js', () => ({ ShopManager: class { constructor() {} } }));
vi.mock('../js/AnalysisController.js', () => ({ AnalysisController: class { constructor() {} enterAnalysisMode() { return true; } requestPositionAnalysis() {} exitAnalysisMode() { return true; } } }));
vi.mock('../js/ui/AnalysisUI.js', () => ({ AnalysisUI: class { constructor() {} } }));
vi.mock('../js/ui/PuzzleMenu.js', () => ({ PuzzleMenu: class { constructor() {} } }));
vi.mock('../js/ui.js', () => ({
  renderBoard: vi.fn(), updateStatus: vi.fn(), updateShopUI: vi.fn(), updateStatistics: vi.fn(),
  updateClockUI: vi.fn(), updateClockDisplay: vi.fn(), updateCapturedUI: vi.fn(),
  updateMoveHistoryUI: vi.fn(), showShop: vi.fn(), showModal: vi.fn(),
}));
vi.mock('../js/sounds.js', () => ({ soundManager: { playGameOver: vi.fn(), playGameStart: vi.fn(), playMove: vi.fn() } }));
vi.mock('../js/effects.js', () => ({ confettiSystem: { spawn: vi.fn() } }));
vi.mock('../js/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), context: () => ({ debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() }) } }));
vi.mock('../js/ui/NotificationUI.js', () => ({ notificationUI: { show: vi.fn() } }));

vi.stubGlobal('document', {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [] as any[],
  body: { contains: () => true, appendChild: vi.fn(), removeChild: vi.fn() },
  createElement: () => ({ getContext: () => null }),
});
vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
vi.stubGlobal('location', { origin: 'https://example.test', pathname: '/schach9x9/' });

const { GameController } = await import('../js/gameController.js');
const { PHASES } = await import('../js/gameEngine.js');

function makeGame(over: any = {}): any {
  return {
    phase: PHASES.PLAY,
    turn: 'white',
    playerColor: 'white',
    isAI: false,
    drawOffered: false,
    drawOfferedBy: null,
    boardSize: 9,
    board: Array.from({ length: 9 }, () => Array(9).fill(null)),
    log: vi.fn(),
    campaignMode: false,
    initialPoints: 0,
    halfMoveClock: 0,
    ...over,
  };
}

let controller: any;
let game: any;

beforeEach(() => {
  game = makeGame();
  controller = new GameController(game);
  vi.spyOn(controller, 'handleGameEnd').mockImplementation(() => {});
  vi.spyOn(controller, 'saveGameToStatistics').mockImplementation(() => {});
  vi.spyOn(controller as any, 'stopClock').mockImplementation(() => {});
});

describe('share / FEN', () => {
  test('getCurrentFEN returns a FEN string', () => {
    expect(typeof controller.getCurrentFEN()).toBe('string');
    expect(controller.getCurrentFEN()).toContain('/');
  });

  test('getShareUrl returns a non-empty url', () => {
    const url = controller.getShareUrl();
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
    expect(url).toContain('fen=');
  });

  test('loadSharedPosition returns false on invalid FEN', () => {
    expect(controller.loadSharedPosition('not a fen')).toBe(false);
  });

  test('loadSharedPosition returns true on a valid FEN', () => {
    const fen = '9/9/9/9/9/9/9/9/9 w';
    expect(controller.loadSharedPosition(fen)).toBe(true);
  });

  test('shareCurrentPosition returns false when no board', async () => {
    const g = controller.game;
    controller.game = null;
    const r = await controller.shareCurrentPosition();
    expect(r).toBe(false);
    controller.game = g;
  });

  test('shareCurrentPosition returns true when clipboard available', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(() => Promise.resolve()) } });
    const r = await controller.shareCurrentPosition();
    expect(r).toBe(true);
    vi.unstubAllGlobals();
  });
});
