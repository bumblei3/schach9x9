import { describe, expect, test, beforeEach, afterEach, jest } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('../js/config.js', () => ({
  BOARD_SIZE: 9,
  PHASES: {
    PLAY: 'play',
    SETUP_WHITE_KING: 'setup_white_king',
    SETUP_BLACK_KING: 'setup_black_king',
    SETUP_WHITE_PIECES: 'setup_white_pieces',
    SETUP_BLACK_PIECES: 'setup_black_pieces',
    ANALYSIS: 'analysis',
  },
}));

jest.unstable_mockModule('../js/utils.js', () => ({
  debounce: fn => fn, // No delay for tests
}));

jest.unstable_mockModule('../js/effects.js', () => ({
  particleSystem: { spawn: jest.fn() },
  floatingTextManager: { show: jest.fn() },
}));

const BoardRenderer = await import('../js/ui/BoardRenderer.js');
const { particleSystem } = await import('../js/effects.js');

describe('BoardRenderer Full Coverage', () => {
  let game;

  beforeEach(() => {
    document.body.innerHTML = '<div id="board"></div><div id="board-wrapper"></div>';

    // Mock global PIECE_SVGS
    window.PIECE_SVGS = {
      white: { p: '<svg>wp</svg>', r: '<svg>wr</svg>' },
      black: { p: '<svg>bp</svg>', k: '<svg>bk</svg>' },
    };

    // Mock elementFromPoint (missing in JSDOM)
    if (!document.elementFromPoint) {
      document.elementFromPoint = jest.fn();
    } else {
      // If it exists (e.g. from previous tests), ensure it's a mock
      if (!jest.isMockFunction(document.elementFromPoint)) {
        document.elementFromPoint = jest.fn();
      } else {
        document.elementFromPoint.mockReset();
      }
    }

    // Mock BoardRenderer cache
    BoardRenderer.clearPieceCache();

    game = {
      board: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
      phase: 'play',
      turn: 'white',
      handleCellClick: jest.fn(),
      getValidMoves: jest.fn(() => []),
      replayMode: false,
      isAI: false,
      isAnimating: false,
      selectedSquare: null,
      validMoves: [],
      // Mocks for interaction
      isSquareUnderAttack: jest.fn(() => false),
      isTutorMove: jest.fn(() => false),
    };

    // Initialize UI
    BoardRenderer.initBoardUI(game);
  });

  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
    jest.useRealTimers();
  });

  test('getPieceSymbol returns correct SVG/HTML', () => {
    const p1 = { type: 'p', color: 'white' };
    const html1 = BoardRenderer.getPieceSymbol(p1);
    expect(html1).toContain('<svg>wp</svg>');

    // Test cache
    const html2 = BoardRenderer.getPieceSymbol(p1);
    expect(html2).toBe(html1); // Should be identical string from cache

    // Test empty
    expect(BoardRenderer.getPieceSymbol(null)).toBe('');
  });

  test('getPieceText returns correct unicode', () => {
    expect(BoardRenderer.getPieceText({ type: 'p', color: 'white' })).toBe('♙');
    expect(BoardRenderer.getPieceText({ type: 'k', color: 'black' })).toBe('♚');
    expect(BoardRenderer.getPieceText(null)).toBe('');
  });

  test('initBoardUI creates coordinates', () => {
    const wrapper = document.getElementById('board-wrapper');
    expect(wrapper.querySelectorAll('.coord-label').length).toBe(18); // 9 cols + 9 rows
    expect(wrapper.textContent).toContain('a');
    expect(wrapper.textContent).toContain('9');
  });

  test('Interaction: Click calls handleCellClick', () => {
    const cell00 = document.querySelector('.cell[data-r="0"][data-c="0"]');
    cell00.click();
    expect(game.handleCellClick).toHaveBeenCalledWith(0, 0);
  });

  test('Drag: Start valid drag', () => {
    game.board[0][0] = { type: 'p', color: 'white' };
    game.phase = 'play';
    game.turn = 'white';
    game.getValidMoves.mockReturnValue([{ r: 1, c: 0 }]);

    const cell = document.querySelector('.cell[data-r="0"][data-c="0"]');

    const dragStartEvent = new Event('dragstart', { bubbles: true });
    const dt = {
      setData: jest.fn(),
      setDragImage: jest.fn(),
      effectAllowed: '',
    };
    Object.defineProperty(dragStartEvent, 'dataTransfer', { value: dt });

    const originalCloneNode = cell.cloneNode;
    cell.cloneNode = jest.fn(() => document.createElement('div'));

    cell.dispatchEvent(dragStartEvent);

    expect(dt.setData).toHaveBeenCalledWith('text/plain', '0,0');
    expect(cell.classList.contains('dragging')).toBe(true);

    jest.useFakeTimers();
    jest.runAllTimers();
    jest.useRealTimers();
  });

  test('Drag: Prevent invalid drag (wrong turn)', () => {
    game.board[0][0] = { type: 'p', color: 'black' };
    game.turn = 'white';

    const cell = document.querySelector('.cell[data-r="0"][data-c="0"]');
    const event = new Event('dragstart', { bubbles: true });
    Object.defineProperty(event, 'preventDefault', { value: jest.fn() });

    cell.dispatchEvent(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  test('Drag: Prevent drag in replay mode', () => {
    game.replayMode = true;
    const cell = document.querySelector('.cell[data-r="0"][data-c="0"]');
    const event = new Event('dragstart', { bubbles: true });
    const spy = jest.spyOn(event, 'preventDefault');
    cell.dispatchEvent(event);
    expect(spy).toHaveBeenCalled();
  });

  test('Drop: Handle drop', () => {
    game.board[0][0] = { type: 'p', color: 'white' };
    game.phase = 'play';
    game.turn = 'white';

    game.getValidMoves.mockReturnValue([{ r: 2, c: 0 }]);

    const targetCell = document.querySelector('.cell[data-r="2"][data-c="0"]');
    const dropEvent = new Event('drop', { bubbles: true });
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { getData: () => '0,0' },
    });

    targetCell.dispatchEvent(dropEvent);

    expect(game.handleCellClick).toHaveBeenCalledWith(2, 0); // Destination
  });

  test('Touch: Start valid drag', () => {
    game.board[0][0] = { type: 'p', color: 'white' };
    game.phase = 'play';
    game.turn = 'white';

    const cell = document.querySelector('.cell[data-r="0"][data-c="0"]');
    cell.innerHTML = '<div class="piece-svg"></div>';

    const touchEvent = new Event('touchstart', { bubbles: true });
    const touch = { clientX: 100, clientY: 100 };
    Object.defineProperty(touchEvent, 'touches', { value: [touch] });
    Object.defineProperty(touchEvent, 'preventDefault', { value: jest.fn() });

    cell.dispatchEvent(touchEvent);

    expect(touchEvent.preventDefault).toHaveBeenCalled();
    expect(cell.classList.contains('dragging')).toBe(true);

    const dragged = document.body.lastElementChild;
    expect(dragged.style.position).toBe('fixed');

    const moveEvent = new Event('touchmove', { bubbles: true });
    Object.defineProperty(moveEvent, 'touches', { value: [{ clientX: 150, clientY: 150 }] });
    cell.dispatchEvent(moveEvent);

    expect(dragged.style.left).toContain('150');

    const endEvent = new Event('touchend', { bubbles: true });
    Object.defineProperty(endEvent, 'changedTouches', { value: [{ clientX: 150, clientY: 150 }] });
    Object.defineProperty(endEvent, 'touches', { value: [] });

    // Mock elementFromPoint for cleanup check
    document.elementFromPoint.mockReturnValue(null);

    cell.dispatchEvent(endEvent);

    expect(document.body.contains(dragged)).toBe(false);
    expect(cell.classList.contains('dragging')).toBe(false);
  });

  test('renderBoard highlights', () => {
    game.lastMoveHighlight = { from: { r: 0, c: 0 }, to: { r: 1, c: 0 } };
    BoardRenderer.renderBoard(game);
    const cell00 = document.querySelector('.cell[data-r="0"][data-c="0"]');
    expect(cell00.classList.contains('last-move')).toBe(true);

    game.validMoves = [{ r: 2, c: 2 }];
    game.isTutorMove = jest.fn(() => true);
    BoardRenderer.renderBoard(game);
    const cell22 = document.querySelector('.cell[data-r="2"][data-c="2"]');
    expect(cell22.classList.contains('valid-move')).toBe(true);
    expect(cell22.classList.contains('tutor-move')).toBe(true);

    game.board[0][0] = { type: 'p', color: 'white' };
    game.isSquareUnderAttack = jest.fn(() => true);
    BoardRenderer.renderBoard(game);
    const cellThreat = document.querySelector('.cell[data-r="0"][data-c="0"]');
    expect(cellThreat.classList.contains('threatened')).toBe(true);
  });

  test('renderBoard corridors in setup phase', () => {
    game.phase = 'setup_white_king';
    BoardRenderer.renderBoard(game);
    const cell60 = document.querySelector('.cell[data-r="6"][data-c="0"]');
    expect(cell60.classList.contains('selectable-corridor')).toBe(true);

    game.phase = 'setup_white_pieces';
    game.whiteCorridor = { rowStart: 6, colStart: 3 };
    BoardRenderer.renderBoard(game);
    const cell63 = document.querySelector('.cell[data-r="6"][data-c="3"]');
    expect(cell63.classList.contains('selectable-corridor')).toBe(true);
  });

  test('animateMove moves piece and spawns particles', async () => {
    jest.useFakeTimers();
    const from = { r: 0, c: 0 };
    const to = { r: 1, c: 1 };
    const piece = { type: 'p', color: 'white' };

    const fromCell = document.querySelector('.cell[data-r="0"][data-c="0"]');
    const toCell = document.querySelector('.cell[data-r="1"][data-c="1"]');

    jest
      .spyOn(fromCell, 'getBoundingClientRect')
      .mockReturnValue({ left: 0, top: 0, width: 50, height: 50 });
    jest
      .spyOn(toCell, 'getBoundingClientRect')
      .mockReturnValue({ left: 100, top: 100, width: 50, height: 50 });

    const promise = BoardRenderer.animateMove(game, from, to, piece);

    expect(game.isAnimating).toBe(true);

    // Execute animation end
    jest.runAllTimers();

    await promise;

    expect(game.isAnimating).toBe(false);
    expect(particleSystem.spawn).toHaveBeenCalled();
  });

  test('showMoveQuality highlights cell', () => {
    const move = { to: { r: 5, c: 5 } };
    BoardRenderer.showMoveQuality(game, move, 'brilliant');
    const cell = document.querySelector('.cell[data-r="5"][data-c="5"]');
    expect(cell.classList.contains('quality-brilliant')).toBe(true);

    BoardRenderer.showMoveQuality(game, move, 'normal');
    expect(cell.classList.contains('quality-brilliant')).toBe(false);
  });

  test('Drag: End cleans up', () => {
    const cell = document.querySelector('.cell[data-r="0"][data-c="0"]');
    cell.classList.add('dragging');
    const target = document.querySelector('.cell[data-r="1"][data-c="1"]');
    target.classList.add('drag-target');

    cell.dispatchEvent(new Event('dragend', { bubbles: true }));

    expect(cell.classList.contains('dragging')).toBe(false);
    expect(target.classList.contains('drag-target')).toBe(false);
  });

  test('Hover shows valid moves', () => {
    game.phase = 'play';
    game.board[0][0] = { type: 'p', color: 'white' };
    game.getValidMoves.mockReturnValue([{ r: 1, c: 0 }]);

    const cell = document.querySelector('.cell[data-r="0"][data-c="0"]');

    // Trigger mouseenter
    cell.dispatchEvent(new Event('mouseenter', { bubbles: true }));

    // Since debounce is mocked to execute immediately:
    expect(game.getValidMoves).toHaveBeenCalledWith(0, 0, game.board[0][0]);

    const target = document.querySelector('.cell[data-r="1"][data-c="0"]');
    expect(target.classList.contains('hover-move')).toBe(true);
    expect(cell.classList.contains('hover-piece')).toBe(true);

    // Mouseleave
    cell.dispatchEvent(new Event('mouseleave', { bubbles: true }));
    expect(target.classList.contains('hover-move')).toBe(false);
  });

  test('renderBoard highlights black corridor', () => {
    game.phase = 'setup_black_pieces';
    game.blackCorridor = { rowStart: 0, colStart: 3 };
    BoardRenderer.renderBoard(game);
    const cell03 = document.querySelector('.cell[data-r="0"][data-c="3"]');
    expect(cell03.classList.contains('selectable-corridor')).toBe(true);
  });

  test('animateMove handles capture', async () => {
    jest.useFakeTimers();
    const from = { r: 0, c: 0 };
    const to = { r: 1, c: 1 };
    const piece = { type: 'p', color: 'white' };
    // Target has piece
    game.board[1][1] = { type: 'p', color: 'black' };

    const fromCell = document.querySelector('.cell[data-r="0"][data-c="0"]');
    const toCell = document.querySelector('.cell[data-r="1"][data-c="1"]');
    jest
      .spyOn(fromCell, 'getBoundingClientRect')
      .mockReturnValue({ right: 0, top: 0, width: 50, height: 50 });
    jest
      .spyOn(toCell, 'getBoundingClientRect')
      .mockReturnValue({ left: 100, top: 100, width: 50, height: 50 });

    const promise = BoardRenderer.animateMove(game, from, to, piece);

    jest.runAllTimers();
    await promise;

    expect(particleSystem.spawn).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      'CAPTURE',
      expect.any(String)
    );
  });
});
