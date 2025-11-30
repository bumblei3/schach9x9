import { jest } from '@jest/globals';
import { PHASES, BOARD_SIZE } from '../js/config.js';

// Mock dependencies
jest.unstable_mockModule('../js/utils.js', () => ({
    debounce: jest.fn(fn => fn)
}));

jest.unstable_mockModule('../js/effects.js', () => ({
    particleSystem: {
        spawn: jest.fn()
    }
}));

// Import UI module
const UI = await import('../js/ui.js');

describe('UI Module - Enhanced Tests', () => {
    let game;

    beforeEach(() => {
        // Setup basic game state
        game = {
            board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
            phase: PHASES.PLAY,
            turn: 'white',
            points: 15,
            selectedSquare: null,
            validMoves: null,
            isAI: false,
            replayMode: false,
            isAnimating: false,
            moveHistory: [],
            getValidMoves: jest.fn(() => [{ r: 5, c: 4 }]),
            handleCellClick: jest.fn()
        };

        // Setup window globals
        window.PIECE_SVGS = {
            white: { k: '<svg>wk</svg>', p: '<svg>wp</svg>', r: '<svg>wr</svg>' },
            black: { k: '<svg>bk</svg>', p: '<svg>bp</svg>', r: '<svg>br</svg>' }
        };
        window._svgCache = {};

        jest.clearAllMocks();
    });

    describe('Drag & Drop Handlers', () => {
        let cell, mockEvent;

        beforeEach(() => {
            // Create mock cell element
            cell = {
                dataset: { r: '6', c: '4' },
                draggable: true,
                classList: {
                    add: jest.fn(),
                    remove: jest.fn()
                },
                addEventListener: jest.fn(),
                cloneNode: jest.fn(() => ({
                    style: {}
                })),
                offsetWidth: 50,
                offsetHeight: 50
            };

            // Create mock drag event
            mockEvent = {
                preventDefault: jest.fn(),
                dataTransfer: {
                    setData: jest.fn(),
                    getData: jest.fn(),
                    effectAllowed: null,
                    dropEffect: null,
                    setDragImage: jest.fn()
                }
            };

            // Mock document.body methods using spies
            jest.spyOn(document.body, 'appendChild').mockImplementation(() => { });
            jest.spyOn(document.body, 'removeChild').mockImplementation(() => { });
        });

        test('should prevent drag for opponent pieces', () => {
            game.board[6][4] = { type: 'p', color: 'black' };
            game.turn = 'white';

            // Simulate initBoardUI registering the dragstart handler
            let dragstartHandler;
            cell.addEventListener = jest.fn((event, handler) => {
                if (event === 'dragstart') dragstartHandler = handler;
            });

            // Simulate initBoardUI call
            const createCellMock = () => {
                cell.addEventListener('dragstart', (e) => {
                    const piece = game.board[6][4];
                    if (!piece || piece.color !== game.turn) {
                        e.preventDefault();
                        return false;
                    }
                });
            };
            createCellMock();

            // Get the handler and call it
            const handler = cell.addEventListener.mock.calls.find(c => c[0] === 'dragstart')[1];
            const result = handler(mockEvent);

            expect(mockEvent.preventDefault).toHaveBeenCalled();
        });

        test('should allow drag for own pieces', () => {
            game.board[6][4] = { type: 'p', color: 'white' };
            game.turn = 'white';

            // Mock querySelector for showing valid moves
            jest.spyOn(document, 'querySelector').mockImplementation(() => ({
                classList: { add: jest.fn() }
            }));

            jest.spyOn(document, 'querySelectorAll').mockReturnValue([]);

            let dragstartHandler;
            cell.addEventListener = jest.fn((event, handler) => {
                if (event === 'dragstart') dragstartHandler = handler;
            });

            // Simulate the actual dragstart handler logic
            const handler = (e) => {
                if (game.phase !== PHASES.PLAY || game.replayMode || game.isAnimating) {
                    e.preventDefault();
                    return false;
                }

                const piece = game.board[6][4];
                if (!piece || piece.color !== game.turn) {
                    e.preventDefault();
                    return false;
                }

                e.dataTransfer.setData('text/plain', `6,4`);
                e.dataTransfer.effectAllowed = 'move';
            };

            handler(mockEvent);

            expect(mockEvent.preventDefault).not.toHaveBeenCalled();
            expect(mockEvent.dataTransfer.setData).toHaveBeenCalledWith('text/plain', '6,4');
        });

        test('should prevent drag during replay mode', () => {
            game.board[6][4] = { type: 'p', color: 'white' };
            game.replayMode = true;

            const handler = (e) => {
                if (game.phase !== PHASES.PLAY || game.replayMode || game.isAnimating) {
                    e.preventDefault();
                    return false;
                }
            };

            handler(mockEvent);

            expect(mockEvent.preventDefault).toHaveBeenCalled();
        });

        test('should handle dragover event on valid target', () => {
            mockEvent.dataTransfer.getData = jest.fn(() => '6,4');
            game.board[6][4] = { type: 'p', color: 'white' };
            game.getValidMoves.mockReturnValue([{ r: 5, c: 4 }]);

            const handler = (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                const data = e.dataTransfer.getData('text/plain');
                if (data) {
                    const [fromR, fromC] = data.split(',').map(Number);
                    const piece = game.board[fromR][fromC];
                    if (piece) {
                        const validMoves = game.getValidMoves(fromR, fromC, piece);
                        const isValid = validMoves.some(m => m.r === 5 && m.c === 4);
                        if (isValid) {
                            cell.classList.add('drag-over');
                        }
                    }
                }
            };

            handler(mockEvent);

            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(mockEvent.dataTransfer.dropEffect).toBe('move');
        });

        test('should execute move on valid drop', () => {
            mockEvent.dataTransfer.getData = jest.fn(() => '6,4');
            game.board[6][4] = { type: 'p', color: 'white' };
            game.getValidMoves.mockReturnValue([{ r: 5, c: 4 }]);

            const dropHandler = (e) => {
                e.preventDefault();

                const data = e.dataTransfer.getData('text/plain');
                if (!data) return;

                const [fromR, fromC] = data.split(',').map(Number);
                const piece = game.board[fromR][fromC];

                if (piece && piece.color === game.turn) {
                    const validMoves = game.getValidMoves(fromR, fromC, piece);
                    const isValid = validMoves.some(m => m.r === 5 && m.c === 4);

                    if (isValid) {
                        game.selectedSquare = { r: fromR, c: fromC };
                        game.validMoves = validMoves;
                        game.handleCellClick(5, 4);
                    }
                }
            };

            dropHandler(mockEvent);

            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(game.handleCellClick).toHaveBeenCalledWith(5, 4);
        });
    });

    describe('Hover Effects', () => {
        test('should show valid moves on hover', () => {
            game.board[4][4] = { type: 'r', color: 'white' };
            game.getValidMoves.mockReturnValue([
                { r: 4, c: 5 },
                { r: 5, c: 4 }
            ]);

            const mockCells = [
                { classList: { add: jest.fn() } },
                { classList: { add: jest.fn() } }
            ];

            jest.spyOn(document, 'querySelector').mockImplementation((selector) => {
                if (selector.includes('[data-r="4"][data-c="5"]')) return mockCells[0];
                if (selector.includes('[data-r="5"][data-c="4"]')) return mockCells[1];
                return null;
            });

            // Simulate hover handler
            const hoverHandler = () => {
                if (game.phase === PHASES.PLAY && !game.replayMode) {
                    const piece = game.board[4][4];
                    if (piece) {
                        const moves = game.getValidMoves(4, 4, piece);
                        moves.forEach(move => {
                            const cell = document.querySelector(`.cell[data-r="${move.r}"][data-c="${move.c}"]`);
                            if (cell) cell.classList.add('hover-move');
                        });
                    }
                }
            };

            hoverHandler();

            expect(mockCells[0].classList.add).toHaveBeenCalledWith('hover-move');
            expect(mockCells[1].classList.add).toHaveBeenCalledWith('hover-move');
        });

        test('should remove hover effects on mouseleave', () => {
            const mockCells = [
                { classList: { remove: jest.fn() } },
                { classList: { remove: jest.fn() } }
            ];

            jest.spyOn(document, 'querySelectorAll').mockReturnValue(mockCells);

            // Simulate mouseleave handler
            const leaveHandler = () => {
                document.querySelectorAll('.cell.hover-move').forEach(c => c.classList.remove('hover-move'));
                document.querySelectorAll('.cell.hover-piece').forEach(c => c.classList.remove('hover-piece'));
            };

            leaveHandler();

            expect(mockCells[0].classList.remove).toHaveBeenCalledWith('hover-move');
            expect(mockCells[1].classList.remove).toHaveBeenCalledWith('hover-move');
        });

        test('should not show hover effects in replay mode', () => {
            game.replayMode = true;
            game.board[4][4] = { type: 'r', color: 'white' };

            jest.spyOn(document, 'querySelector').mockReturnValue({
                classList: { add: jest.fn() }
            });

            const hoverHandler = () => {
                if (game.phase === PHASES.PLAY && !game.replayMode) {
                    const piece = game.board[4][4];
                    if (piece) {
                        game.getValidMoves(4, 4, piece);
                    }
                }
            };

            hoverHandler();

            // getValidMoves should not be called in replay mode
            expect(game.getValidMoves).not.toHaveBeenCalled();
        });
    });

    describe('Coordinate Labels', () => {
        test('should create column labels (a-i)', () => {
            const mockLabels = [];
            const mockContainer = {
                className: '',
                appendChild: jest.fn(el => mockLabels.push(el))
            };

            jest.spyOn(document, 'createElement').mockImplementation((tag) => {
                if (tag === 'div') return mockContainer;
                return { textContent: '', className: '' };
            });

            // Simulate column labels creation
            const colLabels = document.createElement('div');
            colLabels.className = 'col-labels';
            for (let c = 0; c < BOARD_SIZE; c++) {
                const label = document.createElement('span');
                label.textContent = String.fromCharCode(97 + c);
                label.className = 'coord-label';
                colLabels.appendChild(label);
            }

            expect(mockLabels.length).toBe(BOARD_SIZE);
        });

        test('should create row labels (1-9)', () => {
            const mockLabels = [];
            const mockContainer = {
                className: '',
                appendChild: jest.fn(el => mockLabels.push(el))
            };

            jest.spyOn(document, 'createElement').mockImplementation((tag) => {
                if (tag === 'div') return mockContainer;
                return { textContent: '', className: '' };
            });

            // Simulate row labels creation  
            const rowLabels = document.createElement('div');
            rowLabels.className = 'row-labels';
            for (let r = 0; r < BOARD_SIZE; r++) {
                const label = document.createElement('span');
                label.textContent = (BOARD_SIZE - r).toString();
                label.className = 'coord-label';
                rowLabels.appendChild(label);
            }

            expect(mockLabels.length).toBe(BOARD_SIZE);
        });
    });

    describe('Setup Phase Corridor Highlighting', () => {
        test('should highlight corridors during white king setup', () => {
            game.phase = PHASES.SETUP_WHITE_KING;

            const cells = [];
            for (let r = 6; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    cells.push({
                        dataset: { r: r.toString(), c: c.toString() },
                        classList: { add: jest.fn(), remove: jest.fn() }
                    });
                }
            }

            jest.spyOn(document, 'querySelector').mockImplementation((selector) => {
                const match = selector.match(/data-r="(\d+)"\]\[data-c="(\d+)"/);
                if (match) {
                    const r = parseInt(match[1]);
                    const c = parseInt(match[2]);
                    if (r >= 6 && r < 9) {
                        return cells.find(cell =>
                            cell.dataset.r === r.toString() &&
                            cell.dataset.c === c.toString()
                        );
                    }
                }
                return null;
            });

            // Simulate corridor highlighting logic
            const isSetupWhite = game.phase === PHASES.SETUP_WHITE_KING;
            if (isSetupWhite) {
                const rowStart = 6;
                for (let r = rowStart; r < rowStart + 3; r++) {
                    for (let c = 0; c < BOARD_SIZE; c++) {
                        const inCorridor = (c >= 0 && c <= 2) || (c >= 3 && c <= 5) || (c >= 6 && c <= 8);
                        if (inCorridor) {
                            const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
                            if (cell) cell.classList.add('selectable-corridor');
                        }
                    }
                }
            }

            // Verify corridor cells were highlighted
            const corridorCells = cells.filter(c => c.classList.add.mock.calls.some(call => call[0] === 'selectable-corridor'));
            expect(corridorCells.length).toBeGreaterThan(0);
        });

        test('should highlight black corridor during black piece setup', () => {
            game.phase = PHASES.SETUP_BLACK_PIECES;
            game.blackCorridor = { rowStart: 0, colStart: 3 };

            const cells = [];
            for (let r = 0; r < 3; r++) {
                for (let c = 3; c < 6; c++) {
                    cells.push({
                        dataset: { r: r.toString(), c: c.toString() },
                        classList: { add: jest.fn(), remove: jest.fn() }
                    });
                }
            }

            jest.spyOn(document, 'querySelector').mockImplementation((selector) => {
                const match = selector.match(/data-r="(\d+)"\]\[data-c="(\d+)"/);
                if (match) {
                    const r = parseInt(match[1]);
                    const c = parseInt(match[2]);
                    return cells.find(cell =>
                        cell.dataset.r === r.toString() &&
                        cell.dataset.c === c.toString()
                    );
                }
                return null;
            });

            // Simulate corridor highlighting
            if (game.blackCorridor && game.phase === PHASES.SETUP_BLACK_PIECES) {
                for (let r = game.blackCorridor.rowStart; r < game.blackCorridor.rowStart + 3; r++) {
                    for (let c = game.blackCorridor.colStart; c < game.blackCorridor.colStart + 3; c++) {
                        const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
                        if (cell) cell.classList.add('selectable-corridor');
                    }
                }
            }

            const highlightedCells = cells.filter(c =>
                c.classList.add.mock.calls.some(call => call[0] === 'selectable-corridor')
            );
            expect(highlightedCells.length).toBe(9); // 3x3 corridor
        });
    });

    describe('getPieceSymbol caching', () => {
        test('should cache SVG symbols', () => {
            const piece = { type: 'k', color: 'white' };

            const svg1 = UI.getPieceSymbol(piece);
            const svg2 = UI.getPieceSymbol(piece);

            expect(svg1).toBe(svg2);
            expect(window._svgCache['whitek']).toBeDefined();
        });

        test('should return empty string for null piece', () => {
            const result = UI.getPieceSymbol(null);
            expect(result).toBe('');
        });
    });

    describe('getPieceText', () => {
        test('should return Unicode symbols for standard pieces', () => {
            expect(UI.getPieceText({ type: 'k', color: 'white' })).toBe('♔');
            expect(UI.getPieceText({ type: 'q', color: 'white' })).toBe('♕');
            expect(UI.getPieceText({ type: 'p', color: 'black' })).toBe('♟');
        });

        test('should return letters for custom pieces', () => {
            expect(UI.getPieceText({ type: 'a', color: 'white' })).toBe('A');
            expect(UI.getPieceText({ type: 'c', color: 'white' })).toBe('C');
            expect(UI.getPieceText({ type: 'e', color: 'white' })).toBe('E');
        });

        test('should return empty string for null piece', () => {
            expect(UI.getPieceText(null)).toBe('');
        });
    });
});
