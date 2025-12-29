import { BOARD_SIZE } from './config.js';
import { PuzzleGenerator } from './puzzleGenerator.js';

export class PuzzleManager {
  constructor() {
    this.puzzles = [
      {
        id: 'mate-in-1-001',
        title: 'Puzzle 1: Der Gnadenstoß',
        description: 'Weiß zieht und setzt in 1 Zug matt.',
        difficulty: 'Einfach',
        // (0,2) bk (index 2); (1,7) wr (index 16); (2,2) wk (index 20)
        setupStr: '..'.repeat(2) + 'bk' + '..'.repeat(13) + 'wr' + '..'.repeat(3) + 'wk' + '..'.repeat(81 - 21) + 'w',
        solution: [
          { from: { r: 1, c: 7 }, to: { r: 0, c: 7 } }
        ]
      },
      {
        id: 'mate-in-2-001',
        title: 'Puzzle 2: Taktischer Schlag',
        description: 'Weiß am Zug. Matt in 2.',
        difficulty: 'Mittel',
        // (0,4) bk (index 4); (2,4) wk (index 22); (6,4) wr (index 58); (2,0) wr (index 18)
        setupStr: '..'.repeat(4) + 'bk' + '..'.repeat(13) + 'wr' + '..'.repeat(3) + 'wk' + '..'.repeat(35) + 'wr' + '..'.repeat(81 - 59) + 'w',
        solution: [
          { from: { r: 6, c: 4 }, to: { r: 1, c: 4 } },
          { from: { r: 2, c: 0 }, to: { r: 0, c: 0 } }
        ]
      },
      {
        id: 'mate-in-1-arch',
        title: 'Puzzle 3: Die Kraft des Erzbischofs',
        description: 'Weiß zieht. Setze matt mit dem Erzbischof.',
        difficulty: 'Mittel',
        // (0,3) bk (index 3); (2,2) wa (index 20); (2,3) wk (index 21)
        setupStr: '..'.repeat(3) + 'bk' + '..'.repeat(16) + 'wawk' + '..'.repeat(81 - 22) + 'w',
        solution: [
          { from: { r: 2, c: 2 }, to: { r: 1, c: 4 } }
        ]
      }
    ];

    this.currentPuzzleIndex = 0;
  }

  getPuzzle(id) {
    return this.puzzles.find(p => p.id === id);
  }

  loadPuzzle(game, index = 0) {
    if (index < 0 || index >= this.puzzles.length) return false;

    this.currentPuzzleIndex = index;
    const puzzle = this.puzzles[index];

    // Reset game to a clean state
    game.phase = 'play';
    game.mode = 'puzzle';
    game.points = 0;
    game.capturedPieces = { white: [], black: [] };
    game.moveHistory = [];
    game.puzzleState = {
      active: true,
      currentMoveIndex: 0,
      puzzleId: puzzle.id,
      solved: false
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
        return 'solved';
      }
      return 'continue';
    } else {
      return 'wrong';
    }
  }

  nextPuzzle(game) {
    const nextIndex = this.currentPuzzleIndex + 1;
    if (nextIndex < this.puzzles.length) {
      return this.loadPuzzle(game, nextIndex);
    }
    return null;
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
      solution: solution.filter((_, i) => i % 2 === 0) // Only our moves
    };

    // Add to list and load
    this.puzzles.push(puzzle);
    return this.loadPuzzle(game, this.puzzles.length - 1);
  }
}

export const puzzleManager = new PuzzleManager();
