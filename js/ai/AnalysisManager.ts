import { logger } from '../logger.js';

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

export class AnalysisManager {
  private game: any;

  constructor(game: any) {
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

  private calculateAccuracy(stats: any): number {
    const totalMoves = stats.totalMoves || 0;
    const captures = stats.captures?.white || 0;

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
}
