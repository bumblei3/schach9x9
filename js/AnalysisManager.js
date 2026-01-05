import { BOARD_SIZE } from './config.js';
import * as TacticsDetector from './tutor/TacticsDetector.js';
import * as aiEngine from './aiEngine.js';

/**
 * Manages tactical and strategic analysis for visualization.
 */
export class AnalysisManager {
  constructor(game) {
    this.game = game;
    this.showThreats = false;
    this.showOpportunities = false;
    this.showBestMove = false;
  }

  toggleThreats() {
    this.showThreats = !this.showThreats;
    this.updateArrows();
    return this.showThreats;
  }

  toggleOpportunities() {
    this.showOpportunities = !this.showOpportunities;
    this.updateArrows();
    return this.showOpportunities;
  }

  toggleBestMove() {
    this.showBestMove = !this.showBestMove;
    this.updateArrows();
    return this.showBestMove;
  }

  updateArrows() {
    if (!this.game.arrowRenderer) return;

    const arrows = [];

    if (this.showThreats) {
      arrows.push(...this.getThreatArrows());
    }

    if (this.showOpportunities) {
      arrows.push(...this.getOpportunityArrows());
    }

    if (this.showBestMove) {
      arrows.push(...this.getBestMoveArrows());
    }

    this.game.arrowRenderer.highlightMoves(arrows);
  }

  getThreatArrows() {
    const arrows = [];
    const opponentColor = this.game.turn === 'white' ? 'black' : 'white';

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = this.game.board[r][c];
        if (piece && piece.color === opponentColor) {
          const threatened = TacticsDetector.getThreatenedPieces(
            this.game,
            this.game.tutorController,
            { r, c },
            opponentColor
          );

          threatened.forEach(t => {
            const defenders = TacticsDetector.countDefenders(
              this.game,
              t.pos.r,
              t.pos.c,
              this.game.turn
            );

            // Serious threat if:
            // 1. Hanging piece (no defenders)
            // 2. Trapped more valuable piece (attacker is less valuable)
            // Use SEE for a more definitive answer
            const seeScore = aiEngine.see(this.game.board, { r, c }, t.pos);
            const isSerious = defenders === 0 || seeScore > 0;

            if (isSerious) {
              arrows.push({
                fromR: r,
                fromC: c,
                toR: t.pos.r,
                toC: t.pos.c,
                colorKey: 'red',
              });
            }
          });
        }
      }
    }
    return arrows;
  }

  getPieceValue(type) {
    const values = {
      p: 1,
      n: 3,
      b: 3,
      r: 5,
      a: 7,
      c: 8,
      q: 9,
      e: 12,
      k: 0,
    };
    return values[type] || 0;
  }

  getOpportunityArrows() {
    const arrows = [];
    const myColor = this.game.turn;

    // Find tactical patterns for all legal moves (limited to high severity)
    const moves = this.game.getAllLegalMoves(myColor);

    moves.forEach(move => {
      const patterns = TacticsDetector.detectTacticalPatterns(
        this.game,
        this.game.tutorController,
        move
      );
      const highSeverity = patterns.some(p => p.severity === 'high');

      if (highSeverity) {
        console.log(
          `[Analysis] High severity pattern found for move ${move.from.r},${move.from.c} -> ${move.to.r},${move.to.c}:`,
          patterns
        );
        arrows.push({
          fromR: move.from.r,
          fromC: move.from.c,
          toR: move.to.r,
          toC: move.to.c,
          colorKey: 'orange',
        });
      }
    });

    // Limit number of opportunity arrows to avoid clutter
    return arrows.slice(0, 3);
  }

  getBestMoveArrows() {
    const arrows = [];
    const hints = this.game.bestMoves || [];

    if (hints.length > 0) {
      const best = hints[0];
      arrows.push({
        fromR: best.move.from.r,
        fromC: best.move.from.c,
        toR: best.move.to.r,
        toC: best.move.to.c,
        colorKey: 'green',
      });
    }
    return arrows;
  }
}
