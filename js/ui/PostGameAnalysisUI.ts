/**
 * Post-Game Analysis UI - Shows game stats and analysis button in game-over overlay
 */
import * as PostGameAnalyzerModule from '../tutor/PostGameAnalyzer.js';
import { analyzeGame } from '../tutor/PostGameAnalyzer.js';

/**
 * Displays game stats and shows the "Nachspiel-Analyse" button
 */
export function showPostGameStats(
  game: { moveHistory: any[]; playerColor: 'white' | 'black' },
  _result: 'win' | 'draw',
  _winnerColor: 'white' | 'black' | null
): void {
  const statsEl = document.getElementById('game-over-stats');
  const btnEl = document.getElementById('postgame-analysis-btn');

  if (!statsEl || !btnEl) return;

  // Analyze both sides
  const whiteAnalysis = analyzeGame(game.moveHistory, 'white');
  const blackAnalysis = analyzeGame(game.moveHistory, 'black');

  // Build stats HTML
  const renderCounts = (counts: Record<string, number>): string => {
    const order: string[] = [
      'brilliant', 'great', 'best', 'excellent', 'good',
      'inaccuracy', 'mistake', 'blunder', 'book'
    ];
    return order
      .filter(q => counts[q] > 0)
      .map(q => {
        const meta = PostGameAnalyzerModule.QUALITY_METADATA[q as keyof typeof PostGameAnalyzerModule.QUALITY_METADATA];
        if (!meta) return '';
        return `<span style="display:inline-flex;align-items:center;gap:4px;margin:2px 6px;padding:2px 8px;border-radius:4px;background:${meta.color}22;border:1px solid ${meta.color}44;color:${meta.color};font-size:0.75rem;font-weight:600;">
          ${meta.symbol} ${meta.label}: ${counts[q]}
        </span>`;
      })
      .join('');
  };

  statsEl.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:1rem;justify-content:center;margin-bottom:0.5rem;">
      <div style="flex:1;min-width:140px;text-align:center;">
        <div style="font-weight:bold;color:#4ade80;margin-bottom:4px;">Weiß</div>
        <div style="font-size:1.5rem;font-weight:bold;color:#4ade80;">${whiteAnalysis.accuracy}%</div>
        <div style="font-size:0.7rem;color:#94a3b8;margin-top:2px;">${whiteAnalysis.totalMoves} Züge</div>
      </div>
      <div style="flex:1;min-width:140px;text-align:center;">
        <div style="font-weight:bold;color:#f87171;margin-bottom:4px;">Schwarz</div>
        <div style="font-size:1.5rem;font-weight:bold;color:#f87171;">${blackAnalysis.accuracy}%</div>
        <div style="font-size:0.7rem;color:#94a3b8;margin-top:2px;">${blackAnalysis.totalMoves} Züge</div>
      </div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center;max-height:120px;overflow-y:auto;">
      <div style="flex:1;min-width:160px;">
        <div style="font-size:0.7rem;color:#94a3b8;margin-bottom:4px;text-align:center;">Weiß</div>
        <div style="text-align:center;">${renderCounts(whiteAnalysis.counts)}</div>
      </div>
      <div style="flex:1;min-width:160px;">
        <div style="font-size:0.7rem;color:#94a3b8;margin-bottom:4px;text-align:center;">Schwarz</div>
        <div style="text-align:center;">${renderCounts(blackAnalysis.counts)}</div>
      </div>
    </div>
  `;

  // Show stats and button
  statsEl.style.display = 'block';
  btnEl.style.display = 'inline-block';

  // Wire button click
  const oldBtn = btnEl;
  const newBtn = oldBtn.cloneNode?.(true) as HTMLButtonElement | null;
  if (newBtn && oldBtn.parentNode) {
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);

    newBtn.addEventListener('click', () => {
      void showPostGameAnalysis(game);
    });
  }
}

/**
 * Triggers the full post-game analysis using AnalysisUI
 */
async function showPostGameAnalysis(game: { moveHistory: any[]; playerColor: 'white' | 'black'; gameController?: { jumpToMove: (n: number) => void } }): Promise<void> {
  // Import dynamically to avoid circular deps
  const mod = await import('./AnalysisUI.js');

  // Create a minimal app object that satisfies AnalysisUI's requirements
  // Use `any` for the bridge since we only need moveHistory, playerColor, and gameController.jumpToMove
  const app = {
    game: {
      ...game,
      moveHistory: game.moveHistory,
      playerColor: game.playerColor,
      gameController: game.gameController
        ? { ...game.gameController, jumpToMove: game.gameController.jumpToMove }
        : undefined
    }
  } as any;

  const AnalysisUI = mod.AnalysisUI;
  const analysisUI = new AnalysisUI(app);

  // Use existing AnalysisUI method to show summary
  const analysisUI_ = analysisUI as unknown as { showSummaryModal: (w: unknown, b: unknown) => void };

  const { analyzeGame: analyzeGameLocal } = await import('../tutor/PostGameAnalyzer.js');
  const whiteStats = analyzeGameLocal(app.game.moveHistory, 'white');
  const blackStats = analyzeGameLocal(app.game.moveHistory, 'black');

  analysisUI_.showSummaryModal(whiteStats, blackStats);
}

/**
 * Hides the post-game stats and analysis button
 */
export function hidePostGameStats(): void {
  const statsEl = document.getElementById('game-over-stats');
  const btnEl = document.getElementById('postgame-analysis-btn');
  if (statsEl) statsEl.style.display = 'none';
  if (btnEl) btnEl.style.display = 'none';
}