/**
 * DOM-free variant-tree builder.
 *
 * Builds a tree of the top-N candidate moves for the side to move, each node
 * carrying its evaluation score and a short continuation (the opponent's best
 * reply, followed by the side-to-move's best reply, …) so the UI can show a
 * "what-if" line per candidate move.
 *
 * Implementation notes:
 * - It is a PURE function: it never mutates the input board.
 * - It reuses the existing `getTopMoves()` from `js/aiEngine.ts` for every
 *   ply. No new search code is introduced.
 * - The plan snippet assumed `getTopMoves` returns `SearchResult { bestMove,
 *   pv: Move[] }`. In this codebase `getTopMoves` actually returns
 *   `{ move: MoveResult, score, depth, nodes }` and does NOT expose a PV, so
 *   the continuation is derived by re-querying `getTopMoves` for the opponent.
 */

import type { Move, Piece, PieceType } from '../types/core.js';
import { getTopMoves } from '../aiEngine.js';

export interface VariantNode {
  /** The candidate move for the side to move. */
  move: Move;
  /** Evaluation score of this candidate (from getTopMoves). */
  score: number;
  /**
   * Best-reply chain after this move: the opponent's best reply, then the
   * side-to-move's best reply, etc. Derived from getTopMoves (no PV field
   * exists on getTopMoves' result in this codebase).
   */
  continuation: Move[];
}

/** Return a shallow-cloned board with `move` applied. Does NOT mutate input. */
function applyMove(
  board: (Piece | null)[][],
  move: { from: { r: number; c: number }; to: { r: number; c: number }; promotion?: PieceType },
): (Piece | null)[][] {
  const next = board.map((row) => row.map((p) => (p ? { ...p } : null)));
  const piece = next[move.from.r]?.[move.from.c];
  if (!piece) return next;
  const moved: Piece = { ...piece, hasMoved: true };
  if (move.promotion) moved.type = move.promotion;
  next[move.to.r][move.to.c] = moved;
  next[move.from.r][move.from.c] = null;
  return next;
}

function toFullMove(
  board: (Piece | null)[][],
  result: { from: { r: number; c: number }; to: { r: number; c: number }; promotion?: string | PieceType },
): Move | null {
  const from = result.from;
  const to = result.to;
  const pieceType = board[from.r]?.[from.c]?.type ?? null;
  return {
    from,
    to,
    piece: pieceType,
    promotion: (result.promotion as PieceType | undefined) ?? undefined,
  };
}

export async function buildVariantTree(
  uiBoard: (Piece | null)[][],
  turnColor: 'white' | 'black',
  count = 3,
  depth = 2,
): Promise<VariantNode[]> {
  const rootResults = await getTopMoves(uiBoard, turnColor, count, depth);

  const opponent: 'white' | 'black' = turnColor === 'white' ? 'black' : 'white';
  const replyDepth = Math.max(1, depth - 1);
  const maxReplies = Math.max(0, depth - 1);

  const nodes: VariantNode[] = [];

  for (const result of rootResults) {
    const rootMove = result.move;
    if (!rootMove) continue;

    const rootFull = toFullMove(uiBoard, rootMove);
    if (!rootFull) continue;

    const continuation: Move[] = [];
    let boardAfter = applyMove(uiBoard, rootFull);
    let side = opponent;
    for (let i = 0; i < maxReplies; i++) {
      const replies = await getTopMoves(boardAfter, side, 1, replyDepth);
      const reply = replies[0]?.move;
      if (!reply) break;

      const replyFull = toFullMove(boardAfter, reply);
      if (!replyFull) break;

      continuation.push(replyFull);
      boardAfter = applyMove(boardAfter, replyFull);
      side = side === 'white' ? 'black' : 'white';
    }

    nodes.push({
      move: rootFull,
      score: result.score,
      continuation,
    });
  }

  return nodes;
}
