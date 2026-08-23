import { PuzzleGenerator } from './puzzleGenerator.js';
import { ProceduralGenerator } from './puzzle/ProceduralGenerator.js';
import type { MoveResult } from './aiEngine.js';
import type { GameLike, PieceType } from './types/game.js';

export interface Puzzle {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  fen?: string;
  setupStr?: string;
  setup?: (_game: GameLike) => void;
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
        fen: '',
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
        fen: '',
        solution: [{ from: { r: 7, c: 0 }, to: { r: 0, c: 0 } }],
      },
      {
        id: 'mate-in-1-arch',
        title: 'Puzzle 3: Die Kraft des Erzbischofs',
        description: 'Weiß zieht. Setze matt mit dem Erzbischof.',
        difficulty: 'Mittel',
        setupStr: '..'.repeat(3) + 'bk' + '..'.repeat(16) + 'wawk' + '..'.repeat(81 - 22) + 'w',
        fen: '',
        solution: [{ from: { r: 2, c: 2 }, to: { r: 1, c: 4 } }],
      },
      {
        id: 'mate-in-1-queen-001',
        title: 'Puzzle 4: Damenmatt',
        description: 'Setze matt mit der Dame.',
        difficulty: 'Einfach',
        setupStr:
          'bk' + '..'.repeat(13) + 'wq' + '..'.repeat(4) + 'wk' + '..'.repeat(81 - 20) + 'w',
        fen: '',
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
        fen: '',
        solution: [
          { from: { r: 2, c: 0 }, to: { r: 1, c: 0 } }, // White Rook 1
          { from: { r: 0, c: 4 }, to: { r: 0, c: 3 } }, // Black King (Forced)
          { from: { r: 3, c: 1 }, to: { r: 0, c: 1 } }, // White Rook 2 (Mate)
        ],
      },
      // =====================================================================
      // Feenfiguren-Taktik (M2.2) — jede Lösung ist engine-verifiziert Matt
      // in 1 (PuzzleGenerator.findMateSequence).
      // =====================================================================
      {
        id: 'fairy-archbishop-corner',
        title: 'Feenpuzzle 1: Erzbischof am Rand',
        description:
          'Der Erzbischof greift diagonal und per Springersprung an. Setze matt!',
        difficulty: 'Mittel',
        setupStr:
          'bk....wa..........' +
          '..................' +
          '..................' +
          '..................' +
          '..................' +
          '..................' +
          '..................' +
          '..................' +
          'wk................' +
          'w',
        fen: '',
        solution: [{ from: { r: 0, c: 3 }, to: { r: 2, c: 2 } }],
      },
      {
        id: 'fairy-archbishop-center',
        title: 'Feenpuzzle 2: Der lange Arm des Erzbischofs',
        description: 'Der Erzbischof braucht nur einen Zug — findest du ihn?',
        difficulty: 'Schwer',
        setupStr:
          'bk................' +
          '..................' +
          '..............wr..' +
          '..................' +
          '........wa........' +
          '..................' +
          '..................' +
          '..................' +
          '................wk' +
          'w',
        fen: '',
        solution: [{ from: { r: 4, c: 4 }, to: { r: 2, c: 2 } }],
      },
      {
        id: 'fairy-archbishop-end',
        title: 'Feenpuzzle 3: Spieß von hinten',
        description: 'Nutze die doppelte Natur des Erzbischofs für das Matt.',
        difficulty: 'Schwer',
        setupStr:
          '..................' +
          '..................' +
          '..................' +
          '..................' +
          '........wa........' +
          '..................' +
          '..wr..............' +
          '..................' +
          'wk..............bk' +
          'w',
        fen: '',
        solution: [{ from: { r: 4, c: 4 }, to: { r: 6, c: 6 } }],
      },
      {
        id: 'fairy-angel-basic',
        title: 'Feenpuzzle 4: Der Engel greift an',
        description: 'Königin plus Springer: Der Engel mattiert in einem Zug.',
        difficulty: 'Mittel',
        setupStr:
          'bk....we..........' +
          '..................' +
          '..................' +
          '..................' +
          '..................' +
          '..................' +
          '..................' +
          '..................' +
          'wk................' +
          'w',
        fen: '',
        solution: [{ from: { r: 0, c: 3 }, to: { r: 2, c: 2 } }],
      },
      {
        id: 'fairy-angel-mirror',
        title: 'Feenpuzzle 5: Engel von der anderen Seite',
        description: 'Diesmal von rechts — wo landet der Mattzug?',
        difficulty: 'Mittel',
        setupStr:
          '..........we....bk' +
          '..................' +
          '..................' +
          '..................' +
          '..................' +
          '..................' +
          '..................' +
          '..................' +
          '................wk' +
          'w',
        fen: '',
        solution: [{ from: { r: 0, c: 5 }, to: { r: 2, c: 6 } }],
      },
      {
        id: 'fairy-angel-shield',
        title: 'Feenpuzzle 6: Bauernschild durchbrechen',
        description: 'Ein Bauer schützt den König — der Engel kümmert sich drum.',
        difficulty: 'Schwer',
        setupStr:
          'wk................' +
          '..................' +
          '..................' +
          '..................' +
          '........we........' +
          '..................' +
          '................wr' +
          '..............bp..' +
          '................bk' +
          'w',
        fen: '',
        solution: [{ from: { r: 4, c: 4 }, to: { r: 3, c: 2 } }],
      },
      {
        id: 'fairy-chancellor-rookline',
        title: 'Feenpuzzle 7: Kanzlerin auf der Linie',
        description: 'Turm-Linie + Springer-Sprung: Die Kanzlerin setzt matt.',
        difficulty: 'Mittel',
        setupStr:
          'bk................' +
          '......wr..........' +
          '..................' +
          '..................' +
          '..................' +
          '..........wc......' +
          '..................' +
          '..................' +
          '................wk' +
          'w',
        fen: '',
        solution: [{ from: { r: 5, c: 5 }, to: { r: 0, c: 5 } }],
      },
      {
        id: 'fairy-chancellor-mirror',
        title: 'Feenpuzzle 8: Kanzlerin spiegelt',
        description: 'Gleiche Idee, gespiegeltes Brett — sitzt das Matt?',
        difficulty: 'Mittel',
        setupStr:
          '................bk' +
          '..........wr......' +
          '..................' +
          '..................' +
          '..................' +
          '......wc..........' +
          '..................' +
          '..................' +
          'wk................' +
          'w',
        fen: '',
        solution: [{ from: { r: 5, c: 3 }, to: { r: 0, c: 3 } }],
      },
    ];
  }

  public getPuzzle(id: string): Puzzle | undefined {
    return this.puzzles.find(p => p.id === id);
  }

  public loadPuzzle(game: GameLike, index: number = 0): Puzzle | boolean {
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
      id: puzzle.id,
      active: true,
      currentMoveIndex: 0,
      puzzleId: puzzle.id,
      solved: false,
      failed: false,
      solution: puzzle.solution.map(m => ({
        from: m.from,
        to: m.to,
        promotion: undefined,
        piece: m.piece ?? 'p',
      })) as Array<{
        from: { r: number; c: number };
        to: { r: number; c: number };
        promotion?: PieceType;
        piece: PieceType;
      }>,
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

  public checkMove(game: GameLike, move: MoveResult): 'solved' | 'continue' | 'wrong' | false {
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

  public nextPuzzle(game: GameLike): Puzzle | boolean {
    const nextIndex = this.currentPuzzleIndex + 1;
    return this.loadPuzzle(game, nextIndex);
  }

  public generateAndLoad(game: GameLike, depth: number = 2): Puzzle | boolean {
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
