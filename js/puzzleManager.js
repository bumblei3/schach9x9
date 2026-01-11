// import { BOARD_SIZE } from './config.js';
import { PuzzleGenerator } from './puzzleGenerator.js';
import { ProceduralGenerator } from './puzzle/ProceduralGenerator.js';

export class PuzzleManager {
  constructor() {
    this.puzzles = [
      {
        id: 'mate-in-1-001',
        title: 'Puzzle 1: Der Gnadenstoß',
        description: 'Weiß zieht und setzt in 1 Zug matt.',
        difficulty: 'Einfach',
        // (0,2) bk (index 2); (1,7) wr (index 16); (2,2) wk (index 20)
        setupStr:
          '..'.repeat(2) +
          'bk' +
          '..'.repeat(13) +
          'wr' +
          '..'.repeat(3) +
          'wk' +
          '..'.repeat(81 - 21) +
          'w',
        solution: [{ from: { r: 1, c: 7 }, to: { r: 0, c: 7 } }],
      },
      {
        id: 'mate-in-1-rook',
        title: 'Puzzle 2: Turm-Mattangriff',
        description: 'Weiß zieht und setzt in 1 Zug matt.',
        difficulty: 'Einfach',
        // Black king at (0,4), blocked by pawns at (1,3), (1,4), (1,5)
        // White king at (7,4), White rook at (7,0)
        // Rook to (0,0) is back-rank mate
        // Board:
        // Row 0: .. .. .. .. bk .. .. .. ..   <- Black king
        // Row 1: .. .. .. bp bp bp .. .. ..   <- Blocking pawns
        // Row 7: wr .. .. .. wk .. .. .. ..   <- White rook and king
        // Index: bk=4, bp=12,13,14, wr=63, wk=67
        setupStr:
          '..'.repeat(4) +
          'bk' +
          '..'.repeat(7) +
          'bpbpbp' +
          '..'.repeat(48) +
          'wr' +
          '..'.repeat(3) +
          'wk' +
          '..'.repeat(13) +
          'w',
        solution: [{ from: { r: 7, c: 0 }, to: { r: 0, c: 0 } }],
      },
      {
        id: 'mate-in-1-arch',
        title: 'Puzzle 3: Die Kraft des Erzbischofs',
        description: 'Weiß zieht. Setze matt mit dem Erzbischof.',
        difficulty: 'Mittel',
        setupStr: '..'.repeat(3) + 'bk' + '..'.repeat(16) + 'wawk' + '..'.repeat(81 - 22) + 'w',
        solution: [{ from: { r: 2, c: 2 }, to: { r: 1, c: 4 } }],
      },
      {
        id: 'mate-in-1-queen-001',
        title: 'Puzzle 4: Damenmatt',
        description: 'Setze matt mit der Dame.',
        difficulty: 'Einfach',
        setupStr: 'bk' + '..'.repeat(8) + 'wq' + '..'.repeat(9) + 'wk' + '..'.repeat(81 - 20) + 'w',
        solution: [{ from: { r: 1, c: 0 }, to: { r: 0, c: 0 } }],
      },
      {
        id: 'double-rook-mate',
        title: 'Puzzle 5: Die Treppenmatt',
        description: 'Klassisches Treppenmatt mit zwei Türmen.',
        difficulty: 'Mittel',
        setupStr:
          '..'.repeat(4) +
          'bk' +
          '..'.repeat(13) +
          'wr' +
          '..'.repeat(9) + // Increased gap to place next rook at (3,1)
          'wr' +
          '..'.repeat(8) +
          'wk' +
          '..'.repeat(81 - 38) +
          'w',
        solution: [
          { from: { r: 2, c: 0 }, to: { r: 1, c: 0 } }, // White Rook 1
          { from: { r: 0, c: 4 }, to: { r: 0, c: 3 } }, // Black King (Forced)
          { from: { r: 3, c: 1 }, to: { r: 0, c: 1 } }, // White Rook 2 (Mate)
        ],
      },
    ];

    this.currentPuzzleIndex = 0;
  }

  getPuzzle(id) {
    return this.puzzles.find(p => p.id === id);
  }

  loadPuzzle(game, index = 0) {
    this.currentPuzzleIndex = index;
    let puzzle = this.puzzles[index];

    // Check for Infinite Mode loading
    if (!puzzle && index >= this.puzzles.length) {
      // Generate on the fly if index is out of bounds
      const diff = index % 2 === 0 ? 'easy' : 'medium'; // Alternating difficulty
      const genPuzzle = ProceduralGenerator.generatePuzzle(diff);
      if (genPuzzle) {
        genPuzzle.title = `Infinite Puzzle #${index + 1}`;
        this.puzzles[index] = genPuzzle; // Cache it
        puzzle = genPuzzle;
      } else {
        return false; // Generation failed
      }
    }

    if (!puzzle) return false;

    this.currentPuzzleIndex = index;

    // Reset game to a clean state
    game.phase = 'PLAY';
    game.mode = 'puzzle';
    game.points = 0;
    game.capturedPieces = { white: [], black: [] };
    game.moveHistory = [];
    game._forceFullRender = true;
    game.puzzleState = {
      active: true,
      currentMoveIndex: 0,
      puzzleId: puzzle.id,
      solved: false,
    };

    // Apply setup from string or function
    if (puzzle.setupStr) {
      const { board, turn } = PuzzleGenerator.stringToBoard(puzzle.setupStr);
      game.board = board;
      game.turn = turn;
    } else if (puzzle.setup) {
      puzzle.setup(game);
    }

    return puzzle;
  }

  checkMove(game, move) {
    if (!game.puzzleState || !game.puzzleState.active) return false;

    const puzzle = this.puzzles[this.currentPuzzleIndex];
    const expectedMove = puzzle.solution[game.puzzleState.currentMoveIndex];

    // Simple coordinate check
    const isCorrectParams =
      move.from.r === expectedMove.from.r &&
      move.from.c === expectedMove.from.c &&
      move.to.r === expectedMove.to.r &&
      move.to.c === expectedMove.to.c;

    if (isCorrectParams) {
      game.puzzleState.currentMoveIndex++;
      if (game.puzzleState.currentMoveIndex >= puzzle.solution.length) {
        game.puzzleState.solved = true;
        game.puzzleState.active = false;
        this.markSolved(puzzle.id);
        return 'solved';
      }
      return 'continue';
    } else {
      return 'wrong';
    }
  }

  nextPuzzle(game) {
    const nextIndex = this.currentPuzzleIndex + 1;
    // Always try to load next, even if out of bounds (loadPuzzle will handle generation)
    return this.loadPuzzle(game, nextIndex);
  }

  /**
   * Dynamically generates a puzzle from a game state
   */
  generateAndLoad(game, depth = 2) {
    const solution = PuzzleGenerator.findMateSequence(game.board, game.turn, depth);
    if (!solution) return null;

    const puzzle = {
      id: 'gen-' + Date.now(),
      title: 'Generiertes Puzzle',
      description: `Setze matt in ${depth} Zügen.`,
      difficulty: depth === 1 ? 'Einfach' : 'Mittel',
      setupStr: PuzzleGenerator.boardToString(game.board, game.turn),
      solution: solution.filter((_, i) => i % 2 === 0), // Only our moves
    };

    // Add to list and load
    this.puzzles.push(puzzle);
    return this.loadPuzzle(game, this.puzzles.length - 1);
  }

  /**
   * Returns all static puzzles
   */
  getPuzzles() {
    return this.puzzles;
  }

  /**
   * Checks if a puzzle is solved (persisted in localStorage)
   */
  isSolved(id) {
    try {
      const solved = JSON.parse(localStorage.getItem('schach_solved_puzzles') || '[]');
      return solved.includes(id);
    } catch (e) {
      console.warn('LocalStorage error:', e);
      return false;
    }
  }

  /**
   * Marks a puzzle as solved
   */
  markSolved(id) {
    try {
      const solved = JSON.parse(localStorage.getItem('schach_solved_puzzles') || '[]');
      if (!solved.includes(id)) {
        solved.push(id);
        localStorage.setItem('schach_solved_puzzles', JSON.stringify(solved));
      }
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }
}

export const puzzleManager = new PuzzleManager();
