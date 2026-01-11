import { BOARD_SIZE } from './config.js';
import * as TacticsDetector from './tutor/TacticsDetector.js';
import * as aiEngine from './aiEngine.js';
import type { Player, Piece } from './types/game.js';

/**
 * Manages tactical and strategic analysis for visualization.
 */
export class AnalysisManager {
  private game: any;
  public showThreats: boolean = false;
  public showOpportunities: boolean = false;
  public showBestMove: boolean = false;

  constructor(game: any) {
    this.game = game;
  }

  public toggleThreats(): boolean {
    this.showThreats = !this.showThreats;
    this.updateArrows();
    return this.showThreats;
  }

  public toggleOpportunities(): boolean {
    this.showOpportunities = !this.showOpportunities;
    this.updateArrows();
    return this.showOpportunities;
  }

  public toggleBestMove(): boolean {
    this.showBestMove = !this.showBestMove;
    this.updateArrows();
    return this.showBestMove;
  }

  public updateArrows(): void {
    if (!this.game.arrowRenderer) return;

    const arrows: any[] = [];

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

  public getThreatArrows(): any[] {
    const arrows: any[] = [];
    const opponentColor: Player = this.game.turn === 'white' ? 'black' : 'white';

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = this.game.board[r][c] as Piece | null;
        if (piece && piece.color === opponentColor) {
          const threatened = (TacticsDetector as any).getThreatenedPieces(
            this.game,
            this.game.tutorController,
            { r, c },
            opponentColor
          ) as any[];

          threatened.forEach(t => {
            const defenders = (TacticsDetector as any).countDefenders(
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

  public getPieceValue(type: string): number {
    const values: Record<string, number> = {
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

  public getOpportunityArrows(): any[] {
    const arrows: any[] = [];
    const myColor: Player = this.game.turn;

    // Find tactical patterns for all legal moves (limited to high severity)
    const moves = this.game.getAllLegalMoves(myColor) as any[];

    moves.forEach(move => {
      const patterns = (TacticsDetector as any).detectTacticalPatterns(
        this.game,
        this.game.tutorController,
        move
      ) as any[];
      const highSeverity = patterns.some(p => p.severity === 'high');

      if (highSeverity) {
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

  public getBestMoveArrows(): any[] {
    const arrows: any[] = [];
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
