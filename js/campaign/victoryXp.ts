/** First clear of a chapter. Three clears reach level 3 (300 XP). */
export const VICTORY_XP = 100;

const PIECE_NAMES: Record<string, string> = {
  p: 'Bauer',
  n: 'Springer',
  b: 'Läufer',
  r: 'Turm',
  q: 'Dame',
  k: 'König',
  a: 'Erzbischof',
  c: 'Kanzler',
  e: 'Engel',
  j: 'Nachtreiter',
};

type MovePiece = { type?: string; color?: string } | string | undefined;

/**
 * King, plus every friendly piece type that moved. Captures are not required.
 * The king is included even when it stayed put, matching the old victory bonus.
 */
export function victoryUnitTypes(
  moves: Array<{ piece?: MovePiece }> | undefined,
  playerColor: string
): string[] {
  const types = ['k'];
  const seen = new Set(types);
  for (const move of moves ?? []) {
    const piece = move.piece;
    if (!piece || typeof piece === 'string') continue;
    if (piece.color !== playerColor || !piece.type || seen.has(piece.type)) continue;
    seen.add(piece.type);
    types.push(piece.type);
  }
  return types;
}

export function victoryXpLine(types: string[]): string {
  const names = types.map(type => PIECE_NAMES[type] || type);
  return `Mission erfüllt! +${VICTORY_XP} XP für ${names.join(', ')}.`;
}
