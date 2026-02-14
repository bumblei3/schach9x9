import { PuzzleGenerator } from './puzzleGenerator.js';
import { ProceduralGenerator } from './puzzle/ProceduralGenerator.js';
import type { MoveResult } from './aiEngine.js';

export interface Puzzle {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  setupStr?: string;
  setup?: (game: any) => void;
  solution: MoveResult[];
}

export class PuzzleManager {
  public puzzles: Puzzle[];
  public currentPuzzleIndex: number = 0;

  constructor() {
    this.puzzles = [
      {
        id: 'mate-in-1-001',
        title: 'Puzzle 1: Der Gnadenstoß',
        description: 'Weiß zieht und setzt in 1 Zug matt.',
        difficulty: 'Einfach',
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
        setupStr:
          'bk' + '..'.repeat(13) + 'wq' + '..'.repeat(4) + 'wk' + '..'.repeat(81 - 20) + 'w',
        solution: [{ from: { r: 1, c: 5 }, to: { r: 1, c: 1 } }],
      },
      {
        id: 'double-rook-mate',
        title: 'Puzzle 5: Die Treppenmatt',
        description: 'Klassisches Treppenmatt mit zwei Türmen.',
        difficulty: 'Mittel',
        setupStr:
          '..'.repeat(4) +
          'bk' +
          'bp' +
          '..'.repeat(8) +
          'wp' +
          '..'.repeat(3) +
          'wr' +
          '..'.repeat(9) +
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
  }

  public getPuzzle(id: string): Puzzle | undefined {
    return this.puzzles.find(p => p.id === id);
  }

  public loadPuzzle(game: any, index: number = 0): Puzzle | boolean {
    this.currentPuzzleIndex = index;
    let puzzle = this.puzzles[index];

    // Check for Infinite Mode loading
    if (!puzzle && index >= this.puzzles.length) {
      const diff = index % 2 === 0 ? 'easy' : 'medium';
      const genPuzzle = ProceduralGenerator.generatePuzzle(diff);
      if (genPuzzle) {
        const newPuzzle: Puzzle = {
          ...genPuzzle,
          title: `Infinite Puzzle #${index + 1}`,
        };
        this.puzzles[index] = newPuzzle;
        puzzle = newPuzzle;
      } else {
        return false;
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

  public checkMove(game: any, move: MoveResult): 'solved' | 'continue' | 'wrong' | false {
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

  public nextPuzzle(game: any): Puzzle | boolean {
    const nextIndex = this.currentPuzzleIndex + 1;
    return this.loadPuzzle(game, nextIndex);
  }

  public generateAndLoad(game: any, depth: number = 2): Puzzle | boolean {
    const solution = PuzzleGenerator.findMateSequence(game.board, game.turn, depth);
    if (!solution) return false;

    const puzzle: Puzzle = {
      id: 'gen-' + Date.now(),
      title: 'Generiertes Puzzle',
      description: `Setze matt in ${depth} Zügen.`,
      difficulty: depth === 1 ? 'Einfach' : 'Mittel',
      setupStr: PuzzleGenerator.boardToString(game.board, game.turn),
      solution: solution.filter((_, i) => i % 2 === 0), // Only our moves
    };

    this.puzzles.push(puzzle);
    return this.loadPuzzle(game, this.puzzles.length - 1);
  }

  public getPuzzles(): Puzzle[] {
    return this.puzzles;
  }

  public isSolved(id: string): boolean {
    try {
      const solved = JSON.parse(localStorage.getItem('schach_solved_puzzles') || '[]');
      return solved.includes(id);
    } catch (e) {
      console.warn('LocalStorage error:', e);
      return false;
    }
  }

  public markSolved(id: string): void {
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
