/**
 * `getTopMoves` muss eine Knotenzahl liefern, nicht dauerhaft 0.
 *
 * Befund: Der Analyse-Panel-Zeile `Tiefe: d | Knoten: -` war die Knotenzahl
 * tot — `getTopMoves` setzte fuer jeden Kandidaten `nodes: 0`, `updatePanel`
 * schrieb daher immer `-`. `runJsSearch` hat die Zahl lokal, sie ging nur in
 * der Rückgabe verloren. Die Anzeige ist im README als „Engine-Statistiken"
 * beworben, also kein Kosmetikum.
 */
import { describe, test, expect, afterEach } from 'vitest';
import { getTopMoves } from '../js/aiEngine.js';
import { createEmptyBoard } from '../js/gameEngine.js';
import { EVAL_VALUES } from '../js/evaluate.js';
import type { Board } from '../js/types/core.js';

// quickEval in aiEngine.ts liest EVAL_VALUES vom Global — ohne diesen Eintrag
// wirft die Suchschleife.
(globalThis as Record<string, unknown>).EVAL_VALUES = EVAL_VALUES;

function board(): Board {
  const b = createEmptyBoard();
  b[8][4] = { type: 'k', color: 'white', hasMoved: false };
  b[0][4] = { type: 'k', color: 'black', hasMoved: false };
  b[7][4] = { type: 'p', color: 'white', hasMoved: false };
  b[6][3] = { type: 'p', color: 'white', hasMoved: false };
  return b;
}

describe('getTopMoves: Knotenzahl', () => {
  afterEach(() => {
    (globalThis as Record<string, unknown>).EVAL_VALUES = EVAL_VALUES;
  });

  test('es gibt mindestens einen Kandidaten mit einer echten Knotenzahl', async () => {
    const results = await getTopMoves(board(), 'white', 3, 2, 5000);
    expect(results.length).toBeGreaterThan(0);
    // Vor dem Fix war hier dauerhaft 0 — die Anzeige blieb auf "-" stehen.
    expect(results.some(r => r.nodes > 0)).toBe(true);
  });

  test('die Knotenzahl ist fuer jeden Eintrag eine Zahl', async () => {
    const results = await getTopMoves(board(), 'white', 3, 2, 5000);
    for (const r of results) {
      expect(typeof r.nodes).toBe('number');
      expect(r.nodes).toBeGreaterThanOrEqual(0);
    }
  });
});
