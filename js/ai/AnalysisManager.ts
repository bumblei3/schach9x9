import { logger } from '../logger.js';
import { drawArrow } from '../ui/ArrowRenderer.js';
import type { Square } from '../types/game.js';

export interface RatedMove {
  moveNumber: number;
  color: string;
  from: string;
  to: string;
  score: number;
  rating: string; // 'brilliant' | 'good' | 'inaccurate' | 'mistake' | 'blunder'
  explanation: string;
}

export interface AnalysisSummary {
  whiteAccuracy: number;
  blackAccuracy: number;
  mistakes: number;
  blunders: number;
  keyMoments: RatedMove[];
}

interface GameStatsLike {
  totalMoves: number;
  captures?: { white: number; black: number } | number;
}

interface AnalysisUILike {
  topMovesContainer?: HTMLElement | null;
}

interface GameWithStats {
  stats: GameStatsLike;
  aiController?: {
    analysisUI?: AnalysisUILike | null;
  };
}

export class AnalysisManager {
  private game: GameWithStats;
  public showBestMove: boolean = false;
  private bestMoveArrow: SVGSVGElement | null = null;

  constructor(game: GameWithStats) {
    this.game = game;
  }

  public async runPostGameAnalysis(): Promise<AnalysisSummary> {
    logger.info('[AnalysisManager] Starting post-game analysis...');

    const stats = this.game.stats;
    const accuracy = this.calculateAccuracy(stats);

    return {
      whiteAccuracy: accuracy,
      blackAccuracy: 75,
      mistakes: 0,
      blunders: 0,
      keyMoments: [],
    };
  }

  private calculateAccuracy(stats: GameStatsLike): number {
    const totalMoves = stats.totalMoves || 0;
    let captures = 0;
    if (typeof stats.captures === 'object' && stats.captures !== null) {
      captures = stats.captures.white || 0;
    } else if (typeof stats.captures === 'number') {
      captures = stats.captures;
    }

    let base = 75;
    if (totalMoves > 0) {
      const captureRatio = (captures * 10) / totalMoves;
      base += Math.min(20, captureRatio * 5);
    }

    if (totalMoves > 60) base -= 5;
    if (totalMoves > 100) base -= 10;

    return Math.max(40, Math.min(98, Math.round(base)));
  }

  public getMentorAdvice(summary: AnalysisSummary): string {
    const accuracy = summary.whiteAccuracy;

    if (accuracy > 90) {
      return 'Hervorragendes Spiel! Deine taktische Übersicht war makellos. Du hast fast jeden Vorteil direkt genutzt.';
    } else if (accuracy > 80) {
      return 'Starke Leistung. Du hast die Kontrolle behalten, auch wenn es kleine Ungenauigkeiten gab.';
    } else if (accuracy > 65) {
      return 'Ein solider Sieg. Achte in Zukunft darauf, deine Figuren noch besser zu koordinieren, um schneller zum Ziel zu kommen.';
    } else if (accuracy > 50) {
      return 'Du hast gewonnen, aber es gab viele brenzlige Momente. Versuche, mehr auf die Drohungen des Gegners zu achten.';
    } else {
      return 'Ein harter Kampf. Du solltest an deiner Taktik arbeiten und weniger voreilige Züge machen.';
    }
  }

  public toggleBestMove(): boolean {
    this.showBestMove = !this.showBestMove;
    this.updateArrows();
    return this.showBestMove;
  }

  public updateArrows(): void {
    // Remove existing best move arrow
    if (this.bestMoveArrow) {
      this.bestMoveArrow.remove();
      this.bestMoveArrow = null;
    }

    // Get best move from AI analysis
    const topMoves = this.game.aiController?.analysisUI?.topMovesContainer;
    if (!this.showBestMove || !topMoves) return;

    // Get best move from analysis panel's first top move
    const firstTopMove = topMoves.querySelector('.top-move-item') as HTMLElement | null;
    if (!firstTopMove) return;

    const from = firstTopMove.dataset.from?.split(',').map(Number);
    const to = firstTopMove.dataset.to?.split(',').map(Number);
    if (!from || !to || from.length !== 2 || to.length !== 2) return;

    const fromSquare: Square = { r: from[0], c: from[1] };
    const toSquare: Square = { r: to[0], c: to[1] };

    const boardContainer = document.getElementById('board-container');
    if (!boardContainer) return;

    // Blue arrow for best move suggestion
    this.bestMoveArrow = drawArrow(boardContainer, {
      from: fromSquare,
      to: toSquare,
      color: '#4f9cf9', // Blue color for best move
      headSize: 16,
      strokeWidth: 5,
      animate: true,
    });
  }
}
