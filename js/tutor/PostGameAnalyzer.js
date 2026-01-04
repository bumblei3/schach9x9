/**
 * Post-Game Analyzer for Schach 9x9
 * Classifies moves based on evaluation changes and calculates accuracy.
 */

export const MOVE_QUALITY = {
  BRILLIANT: 'brilliant',
  GREAT: 'great',
  BEST: 'best',
  EXCELLENT: 'excellent',
  GOOD: 'good',
  INACCURACY: 'inaccuracy',
  MISTAKE: 'mistake',
  BLUNDER: 'blunder',
  BOOK: 'book',
};

export const QUALITY_METADATA = {
  [MOVE_QUALITY.BRILLIANT]: { label: 'Brilliant', symbol: '!!', color: '#31c48d' },
  [MOVE_QUALITY.GREAT]: { label: 'Großartig', symbol: '!', color: '#31c48d' },
  [MOVE_QUALITY.BEST]: { label: 'Bester Zug', symbol: '★', color: '#9f5fef' },
  [MOVE_QUALITY.EXCELLENT]: { label: 'Exzellent', symbol: '□', color: '#93c5fd' },
  [MOVE_QUALITY.GOOD]: { label: 'Gut', symbol: '✔', color: '#d1d5db' },
  [MOVE_QUALITY.INACCURACY]: { label: 'Ungelauigkeit', symbol: '?!', color: '#facc15' },
  [MOVE_QUALITY.MISTAKE]: { label: 'Fehler', symbol: '?', color: '#f97316' },
  [MOVE_QUALITY.BLUNDER]: { label: 'Patzer', symbol: '??', color: '#f87171' },
  [MOVE_QUALITY.BOOK]: { label: 'Buch', symbol: '📖', color: '#a78bfa' },
};

/**
 * Classifies a move based on evaluation change.
 * @param {number} prevEval - Evaluation before the move (from mover's perspective)
 * @param {number} currentEval - Evaluation after the move (from mover's perspective)
 * @param {number} bestEval - Evaluation of the best possible move (from mover's perspective)
 * @returns {string} One of MOVE_QUALITY constants
 */
export function classifyMove(prevEval, currentEval, bestEval) {
  const evalLoss = bestEval - currentEval;

  if (evalLoss <= 0) return MOVE_QUALITY.BEST;
  if (evalLoss < 25) return MOVE_QUALITY.EXCELLENT;
  if (evalLoss < 60) return MOVE_QUALITY.GOOD;
  if (evalLoss < 150) return MOVE_QUALITY.INACCURACY;
  if (evalLoss < 300) return MOVE_QUALITY.MISTAKE;
  return MOVE_QUALITY.BLUNDER;
}

/**
 * Calculates accuracy percentage based on move qualities.
 * @param {Array<Object>} classifications - Array of MOVE_QUALITY strings or objects containing them
 * @returns {number} 0-100 accuracy
 */
export function calculateAccuracy(classifications) {
  if (!classifications || classifications.length === 0) return 0;

  const weights = {
    [MOVE_QUALITY.BRILLIANT]: 100,
    [MOVE_QUALITY.GREAT]: 100,
    [MOVE_QUALITY.BEST]: 100,
    [MOVE_QUALITY.BOOK]: 100,
    [MOVE_QUALITY.EXCELLENT]: 100,
    [MOVE_QUALITY.GOOD]: 80,
    [MOVE_QUALITY.INACCURACY]: 50,
    [MOVE_QUALITY.MISTAKE]: 20,
    [MOVE_QUALITY.BLUNDER]: 0,
  };

  const totalPoints = classifications.reduce((sum, c) => {
    const quality = typeof c === 'string' ? c : c.quality;
    return sum + (weights[quality] || 0);
  }, 0);

  return Math.round(totalPoints / classifications.length);
}

/**
 * Summarizes a game's move qualities.
 * @param {Array} moveHistory
 * @param {string} playerColor
 * @returns {Object} Summary counts and accuracy
 */
export function analyzeGame(moveHistory, playerColor) {
  const playerMoves = moveHistory.filter(m => m.piece.color === playerColor);
  const counts = {
    [MOVE_QUALITY.BRILLIANT]: 0,
    [MOVE_QUALITY.GREAT]: 0,
    [MOVE_QUALITY.BEST]: 0,
    [MOVE_QUALITY.EXCELLENT]: 0,
    [MOVE_QUALITY.GOOD]: 0,
    [MOVE_QUALITY.INACCURACY]: 0,
    [MOVE_QUALITY.MISTAKE]: 0,
    [MOVE_QUALITY.BLUNDER]: 0,
    [MOVE_QUALITY.BOOK]: 0,
  };

  playerMoves.forEach(m => {
    if (m.classification) {
      counts[m.classification]++;
    }
  });

  return {
    counts,
    accuracy: calculateAccuracy(playerMoves.map(m => m.classification || MOVE_QUALITY.GOOD)),
    totalMoves: playerMoves.length,
  };
}
