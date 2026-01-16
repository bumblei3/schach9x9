import { initBoardUI, getPieceSymbol as _getPieceSymbol } from '../js/ui/BoardRenderer.js';
import { PHASES } from '../js/config.js';

// Mock PIECE_SVGS globally
window.PIECE_SVGS = {
  white: { p: '<svg>white p</svg>' },
  black: { p: '<svg>black p</svg>' },
};

describe('BoardRenderer Touch Interactions', () => {
  let gameMock;
  let _boardElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="board"></div>';
    _boardElement = document.getElementById('board');

    gameMock = {
      board: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
      handleCellClick: vi.fn(),
      getValidMoves: vi.fn().mockReturnValue([]),
      phase: PHASES.PLAY,
      isAI: false,
      turn: 'white',
      isAnimating: false,
      replayMode: false,
    };

    // Setup a piece at (4, 4)
    gameMock.board[4][4] = { type: 'p', color: 'white' };

    initBoardUI(gameMock);

    // Mock elementFromPoint globally for all tests in this suite
    // Note: in JSDOM, document.elementFromPoint might not exist or be writable directly on document
    // We use defineProperty to force it.
    Object.defineProperty(document, 'elementFromPoint', {
      value: vi.fn((x, y) => {
        // Simple hit testing for our specific test coords
        if (x === 200 && y === 200) {
          // Return the cell at 5,4 if matched
          return document.querySelector('.cell[data-r="5"][data-c="4"]');
        }
        return null;
      }),
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createTouch(target, identifier = 0, x = 0, y = 0) {
    return {
      identifier,
      target,
      clientX: x,
      clientY: y,
      screenX: x,
      screenY: y,
      pageX: x,
      pageY: y,
      force: 1,
      radiusX: 1,
      radiusY: 1,
      rotationAngle: 0,
    };
  }

  function dispatchTouchEvent(type, element, touches) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    // JSDOM Event doesn't have touches by default?
    // We need to ensure properties are readable.
    Object.defineProperty(event, 'touches', { value: touches });
    Object.defineProperty(event, 'targetTouches', { value: touches });
    Object.defineProperty(event, 'changedTouches', { value: touches });
    element.dispatchEvent(event);
    return event;
  }

  test('should initiate drag on touchstart for valid piece', () => {
    const cell = document.querySelector('.cell[data-r="4"][data-c="4"]');

    // Bounds mocking
    Object.defineProperty(cell, 'offsetWidth', { value: 64, configurable: true });
    Object.defineProperty(cell, 'offsetHeight', { value: 64, configurable: true });

    // Pre-populate with piece-svg so querySelector('.piece-svg') works
    const wrapper = document.createElement('div');
    wrapper.className = 'piece-svg';
    wrapper.innerHTML = window.PIECE_SVGS.white.p;
    cell.appendChild(wrapper);

    const touch = createTouch(cell, 0, 100, 100);
    const _event = dispatchTouchEvent('touchstart', cell, [touch]);

    expect(cell.classList.contains('dragging')).toBe(true);
    // Check if clone exists in body
    // The clone is appended to document.body and has position: fixed
    // Since initBoardUI puts cells in #board, the only direct children of body should be #board and our clones (and maybe scripts)
    const clones = Array.from(document.body.children).filter(
      el => el.style && el.style.position === 'fixed' && el.classList.contains('piece-svg')
    );
    expect(clones.length).toBeGreaterThan(0);

    // Cleanup
    if (clones.length > 0) document.body.removeChild(clones[0]);
  });

  test('should move dragged element on touchmove', () => {
    const cell = document.querySelector('.cell[data-r="4"][data-c="4"]');

    Object.defineProperty(cell, 'offsetWidth', { value: 64, configurable: true });
    Object.defineProperty(cell, 'offsetHeight', { value: 64, configurable: true });

    // Pre-populate
    const wrapper = document.createElement('div');
    wrapper.className = 'piece-svg';
    cell.appendChild(wrapper);

    // Start
    const startTouch = createTouch(cell, 0, 100, 100);
    dispatchTouchEvent('touchstart', cell, [startTouch]);

    // Move
    const moveTouch = createTouch(cell, 0, 200, 200);
    const moveEvent = dispatchTouchEvent('touchmove', cell, [moveTouch]);

    expect(moveEvent.defaultPrevented).toBe(true);

    // Verify position update of clone
    const clone = Array.from(document.body.children).find(
      el => el.style.position === 'fixed' && el.classList.contains('piece-svg')
    );
    expect(clone).toBeTruthy();
    // Logic: left = clientX - width/2.
    // 200 - 32 = 168.
    expect(clone.style.left).toBe('168px');
    expect(clone.style.top).toBe('168px');
  });

  test('should execute move on touchend if valid target', () => {
    const fromCell = document.querySelector('.cell[data-r="4"][data-c="4"]');
    const toCell = document.querySelector('.cell[data-r="5"][data-c="4"]');

    Object.defineProperty(fromCell, 'offsetWidth', { value: 64, configurable: true });
    Object.defineProperty(fromCell, 'offsetHeight', { value: 64, configurable: true });

    const wrapper = document.createElement('div');
    wrapper.className = 'piece-svg';
    fromCell.appendChild(wrapper);

    // Valid moves setup
    const validMoves = [{ r: 5, c: 4 }];
    gameMock.getValidMoves.mockReturnValue(validMoves);

    // Start
    const startTouch = createTouch(fromCell, 0, 100, 100);
    dispatchTouchEvent('touchstart', fromCell, [startTouch]);

    // End at toCell coordinates
    const endTouch = createTouch(toCell, 0, 200, 200);
    dispatchTouchEvent('touchend', fromCell, [endTouch]);

    expect(gameMock.handleCellClick).toHaveBeenCalledWith(5, 4);
    expect(gameMock.selectedSquare).toEqual({ r: 4, c: 4 });
  });
});
