import { describe, test, expect, vi } from 'vitest';

// Mocks must be hoisted above imports. HintGenerator pulls in ui + aiEngine,
// so we stub both to keep the pure-logic tests fast and dependency-free.
vi.mock('../../js/ui.js', () => ({
  showTutorSuggestions: vi.fn(),
  renderBoard: vi.fn(),
  updateShopUI: vi.fn(),
  getPieceText: vi.fn((p: any) => (p ? p.type : '')),
  setTutorLoading: vi.fn(),
}));

vi.mock('../../js/aiEngine.js', () => ({
  getBestMoveDetailed: vi.fn(),
  getTopMoves: vi.fn(() => []),
  extractPV: vi.fn(() => []),
  evaluatePosition: vi.fn(() => 0),
  isSquareAttacked: vi.fn(() => false),
  see: vi.fn(() => 0),
  getAllThreats: vi.fn(() => []),
  getKingThreats: vi.fn(() => []),
  getXRayThreats: vi.fn(() => []),
  getDiscoveredAttackPotential: vi.fn(() => []),
  PIECE_PAWN: 1, PIECE_KNIGHT: 2, PIECE_BISHOP: 3, PIECE_ROOK: 4,
  PIECE_QUEEN: 5, PIECE_KING: 6, PIECE_ARCHBISHOP: 7, PIECE_CHANCELLOR: 8,
  PIECE_ANGEL: 9, PIECE_NIGHTRIDER: 10, PIECE_NONE: 0,
  COLOR_WHITE: 16, COLOR_BLACK: 32,
}));

const UI = await import('../../js/ui.js');
const {
  calculatePieceCost,
  getSquareScore,
  getOptimalSquare,
  getSetupTemplates,
  placePiece,
  isTutorMove,
  applySetupTemplate,
} = await import('../../js/tutor/HintGenerator.js');

// Minimal Game stub covering only what the pure helpers touch.
function makeGame(overrides: any = {}): any {
  const g: any = {
    board: Array(9).fill(null).map(() => Array(9).fill(null)),
    rulesEngine: { findKing: vi.fn(() => ({ r: 8, c: 4 })) },
    whiteCorridor: 3,
    blackCorridor: 3,
    initialPoints: 15,
    points: 15,
    phase: 'SETUP_WHITE_PIECES',
    log: vi.fn(),
    ...overrides,
  };
  return g;
}

describe('HintGenerator.calculatePieceCost', () => {
  test('sums known piece values', () => {
    expect(calculatePieceCost(['q', 'r', 'p'])).toBe(9 + 5 + 1);
    expect(calculatePieceCost(['c', 'a', 'e'])).toBe(8 + 7 + 12);
    expect(calculatePieceCost(['n', 'b', 'k'])).toBe(3 + 3 + 0);
  });

  test('treats unknown piece symbols as 0', () => {
    expect(calculatePieceCost(['x', 'y', 'z'])).toBe(0);
    expect(calculatePieceCost([])).toBe(0);
  });
});

describe('HintGenerator.getSquareScore — per piece-type heuristics', () => {
  const base = makeGame();

  test('pawn in front row scores highest, more with a king nearby', () => {
    const noKing = getSquareScore(6, 4, 'p', true, { ...base, rulesEngine: { findKing: () => null } });
    const withKingFront = getSquareScore(7, 4, 'p', true, base); // king at (8,4) -> in front
    expect(withKingFront).toBeGreaterThan(noKing);
    // middle row (7) = 20, king at (8,4) in front (+50) -> 70
    expect(withKingFront).toBe(70);
  });

  test('knight prefers center column and middle row, avoids corners', () => {
    const center = getSquareScore(7, 4, 'n', true, base); // center col + middle row
    const corner = getSquareScore(6, 3, 'n', true, base); // corner col + front row
    expect(center).toBeGreaterThan(corner);
  });

  test('bishop/archbishop prefer back row and back-row-center', () => {
    const backCenter = getSquareScore(8, 4, 'b', true, base); // back row (+30) + center col (+10)
    const archFront = getSquareScore(6, 4, 'a', true, base); // front row, no bishop/arch bonus
    expect(backCenter).toBe(40);
    expect(archFront).toBe(0);
  });

  test('rook/chancellor prefer back row and corner columns', () => {
    const backCorner = getSquareScore(8, 3, 'r', true, base); // back row(+40) + corner col(+20)
    expect(backCorner).toBe(60);
    const chancellorBack = getSquareScore(8, 4, 'c', true, base); // back row, center col (no corner bonus)
    expect(chancellorBack).toBe(40);
  });

  test('queen/angel prefer back row and proximity to king', () => {
    const backNearKing = getSquareScore(8, 4, 'q', true, base); // back row(+50) + adjacent king(+10)
    expect(backNearKing).toBe(60);
    const angelMiddle = getSquareScore(7, 4, 'e', true, base); // middle row(+10) + adjacent king(+10)
    expect(angelMiddle).toBe(20);
  });

  test('black orientation maps rows symmetrically', () => {
    // black back row is 0, front row is 2
    const blackPawnFront = getSquareScore(2, 4, 'p', false, { ...base, rulesEngine: { findKing: () => ({ r: 0, c: 4 }) } });
    expect(blackPawnFront).toBe(40); // front row only (king at row 0 is 2 away, no bonus)
  });

  test('uses provided availableKingPos over rulesEngine lookup', () => {
    const g = { ...base, availableKingPos: { r: 7, c: 4 }, rulesEngine: { findKing: vi.fn(() => null) } };
    const score = getSquareScore(8, 4, 'p', true, g); // pawn back row, king at (7,4) -> diag front (+30)
    expect(score).toBe(50);
  });
});

describe('HintGenerator.getOptimalSquare', () => {
  test('returns the highest-scoring empty square in the corridor', () => {
    const g = makeGame();
    const sq = getOptimalSquare(g, 'q', true);
    expect(sq).not.toBeNull();
    expect(g.board[sq!.r][sq!.c]).toBeNull();
    // Queen best on back row (8) adjacent to king (8,4) -> (8,3) or (8,5)
    expect(sq!.r).toBe(8);
  });

  test('skips occupied squares', () => {
    const g = makeGame();
    // Fill the entire corridor
    for (let r = 6; r <= 8; r++) for (let c = 3; c <= 5; c++) g.board[r][c] = { type: 'p' };
    expect(getOptimalSquare(g, 'r', true)).toBeNull();
  });

  test('black corridor uses black rows (0..2)', () => {
    const g = makeGame({ phase: 'SETUP_BLACK_PIECES' });
    const sq = getOptimalSquare(g, 'r', false);
    expect(sq!.r).toBeLessThanOrEqual(2);
  });
});

describe('HintGenerator.getSetupTemplates — buckets & fallback', () => {
  test('returns 12/15/18/20/25/30/50 point templates with correct cost', () => {
    for (const pts of [12, 15, 18, 20, 25, 30, 50]) {
      const g = makeGame({ initialPoints: pts });
      const t = getSetupTemplates(g);
      expect(t.length).toBeGreaterThan(0);
      expect(t[0].cost).toBe(pts);
      // recommended flag preserved where set
      expect(t.some(tpl => tpl.isRecommended)).toBe(true);
    }
  });

  test('15-point fallback set does not require a controller and returns valid costs', () => {
    const g = makeGame({ initialPoints: 15 });
    const t = getSetupTemplates(g);
    expect(t.every(tpl => tpl.cost === 15)).toBe(true);
  });

  test('dynamic generation for odd budgets (e.g. 11) matches available points', () => {
    const g = makeGame({ initialPoints: 11 });
    const t = getSetupTemplates(g);
    expect(t[0].cost).toBe(11);
    expect(t[0].pieces.length).toBeLessThanOrEqual(8);
  });

  test('dynamic generation respects MAX_PIECES (8) for huge budgets', () => {
    const g = makeGame({ initialPoints: 500 });
    const t = getSetupTemplates(g);
    expect(t[0].pieces.length).toBeLessThanOrEqual(8);
  });

  test('unknown mid budget like 22 still produces valid templates', () => {
    const g = makeGame({ initialPoints: 22 });
    const t = getSetupTemplates(g);
    expect(Array.isArray(t)).toBe(true);
    expect(t[0].cost).toBeGreaterThan(0);
  });
});

describe('HintGenerator.placePiece', () => {
  test('creates a piece object with correct color and deducts points', () => {
    const g = makeGame({ points: 15 });
    placePiece(g, 0, 0, 'q', true);
    expect(g.board[0][0]).toEqual({ type: 'q', color: 'white', hasMoved: false });
    expect(g.points).toBe(15 - 9);
  });

  test('black placement sets black color and deducts value', () => {
    const g = makeGame({ points: 15 });
    placePiece(g, 1, 1, 'r', false);
    expect(g.board[1][1].color).toBe('black');
    expect(g.points).toBe(15 - 5);
  });

  test('unknown piece type deducts 0', () => {
    const g = makeGame({ points: 15 });
    placePiece(g, 2, 2, '?', true);
    expect(g.board[2][2].type).toBe('?');
    expect(g.points).toBe(15);
  });
});

describe('HintGenerator.isTutorMove', () => {
  test('returns false when no bestMoves', () => {
    const g = makeGame({ bestMoves: null });
    expect(isTutorMove(g, { r: 0, c: 0 }, { r: 1, c: 1 })).toBe(false);
  });

  test('matches an exact move and rejects a mismatch', () => {
    const from = { r: 6, c: 4 };
    const to = { r: 4, c: 4 };
    const g = makeGame({ bestMoves: [{ move: { from, to } }] });
    expect(isTutorMove(g, from, to)).toBe(true);
    expect(isTutorMove(g, { r: 0, c: 0 }, { r: 1, c: 1 })).toBe(false);
  });

  test('skips malformed best-move entries', () => {
    const g = makeGame({ bestMoves: [null, { move: null }, { score: 5 }] });
    expect(isTutorMove(g, { r: 0, c: 0 }, { r: 1, c: 1 })).toBe(false);
  });
});

describe('HintGenerator.applySetupTemplate — guards', () => {
  test('returns early when template id is not found', () => {
    const g = makeGame({ phase: 'SETUP_WHITE_PIECES' });
    const ctrl = { getSetupTemplates: () => [] as any[] };
    applySetupTemplate(g, ctrl, 'missing');
    // nothing placed, no crash
    expect(UI.renderBoard).not.toHaveBeenCalled();
  });

  test('returns early when corridor is not a number', () => {
    const g = makeGame({ phase: 'SETUP_WHITE_PIECES', whiteCorridor: undefined });
    const ctrl = { getSetupTemplates: () => [{ id: 'x', name: 'x', description: '', pieces: ['r'], cost: 5 }] };
    applySetupTemplate(g, ctrl, 'x');
    expect(UI.renderBoard).not.toHaveBeenCalled();
  });

  test('falls back to getSetupTemplates when controller provides no getter', () => {
    const g = makeGame({ phase: 'SETUP_WHITE_PIECES', initialPoints: 12 });
    applySetupTemplate(g, {}, 'fortress_12');
    // fortress_12 places a rook -> something landed in the white corridor
    const placed = [6, 7, 8].some(r => [3, 4, 5].some(c => g.board[r][c] && g.board[r][c].type === 'r'));
    expect(placed).toBe(true);
    expect(UI.renderBoard).toHaveBeenCalled();
  });
});
