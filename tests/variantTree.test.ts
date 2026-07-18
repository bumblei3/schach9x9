import { describe, it, expect } from 'vitest';
import { buildVariantTree } from '../js/analyze/variantTree.js';
import { BoardFactory } from '../js/campaign/BoardFactory.js';

/**
 * Task 1 (Solo-UX plan): DOM-free variant-tree builder on top of getTopMoves.
 *
 * NOTE on API: the plan's snippet assumed getTopMoves returns SearchResult
 * `{ bestMove, pv: Move[] }`. In this codebase getTopMoves actually returns
 * `{ move: MoveResult, score, depth, nodes }` and does NOT expose a PV.
 * We stay faithful to the plan's *objective* ("pro Zug die beste
 * gegnerische Antwort zeigen") by deriving each node's continuation from the
 * opponent's best reply, obtained by reusing getTopMoves (no new search code).
 */
describe('buildVariantTree', () => {
  it('returns top moves with score and an opponent continuation array', async () => {
    const board = BoardFactory.createLevel1Board();
    const tree = await buildVariantTree(board, 'white', 3, 2);

    // Returns an array of nodes.
    expect(Array.isArray(tree)).toBe(true);
    expect(tree.length).toBeGreaterThan(0);
    expect(tree.length).toBeLessThanOrEqual(3);

    const root = tree[0];
    // move is a fully-formed Move (from/to/piece).
    expect(root.move).toBeDefined();
    expect(root.move.from).toBeDefined();
    expect(root.move.to).toBeDefined();
    expect(typeof root.move.piece).toBe('string');
    // score is numeric.
    expect(typeof root.score).toBe('number');
    // continuation is always an array (opponent best replies).
    expect(Array.isArray(root.continuation)).toBe(true);
    for (const reply of root.continuation) {
      expect(reply.from).toBeDefined();
      expect(reply.to).toBeDefined();
      expect(typeof reply.piece).toBe('string');
    }
  });

  it('does not mutate the input board (pure function)', async () => {
    const board = BoardFactory.createLevel1Board();
    const snapshot = board.map((row) => row.map((p) => (p ? { ...p } : null)));
    await buildVariantTree(board, 'white', 2, 1);
    expect(board).toEqual(snapshot);
  });

  it('respects the requested count when that many legal moves exist', async () => {
    const board = BoardFactory.createLevel1Board();
    const tree = await buildVariantTree(board, 'white', 2, 1);
    expect(tree.length).toBe(2);
    for (const node of tree) {
      expect(Array.isArray(node.continuation)).toBe(true);
    }
  });
});
