/**
 * engineNode.ts — one-shot engine node for cross-Ref match probing.
 *
 * Schach 9x9's JS engine is DETERMINISTIC (no randomness except elo < 1400
 * blunder injection, which we never use). Therefore balanced-vs-balanced
 * self-play is useless (both sides replay the identical game). To measure a
 * real strength delta of an Eval/Quiescence lever we run TWO engine builds
 * (two git Refs in two worktrees) head-to-head and count the result.
 *
 * This module exposes a single `evaluatePosition(boardNum, turn, elo)` that
 * calls the LOCAL (import-time) engine. matchRefs.ts runs two node processes,
 * one per worktree, and drives the same game state through both.
 *
 * Usage is driven by matchRefs.ts; this file just answers "what is the best
 * move from this exact board position under the engine compiled HERE".
 */

import { getBestMoveDetailed, type MoveResult } from './aiEngine.js';
import type { Piece } from './types/game.js';

function pieceCodeToPiece(code: number): Piece | null {
  switch (code) {
    case 1: return { type: 'p', color: 'white', hasMoved: false };
    case 2: return { type: 'n', color: 'white', hasMoved: false };
    case 3: return { type: 'b', color: 'white', hasMoved: false };
    case 4: return { type: 'r', color: 'white', hasMoved: false };
    case 5: return { type: 'q', color: 'white', hasMoved: false };
    case 6: return { type: 'k', color: 'white', hasMoved: false };
    case 7: return { type: 'a', color: 'white', hasMoved: false };
    case 8: return { type: 'c', color: 'white', hasMoved: false };
    case 9: return { type: 'e', color: 'white', hasMoved: false };
    case 10: return { type: 'j', color: 'white', hasMoved: false };
    case -1: return { type: 'p', color: 'black', hasMoved: false };
    case -2: return { type: 'n', color: 'black', hasMoved: false };
    case -3: return { type: 'b', color: 'black', hasMoved: false };
    case -4: return { type: 'r', color: 'black', hasMoved: false };
    case -5: return { type: 'q', color: 'black', hasMoved: false };
    case -6: return { type: 'k', color: 'black', hasMoved: false };
    case -7: return { type: 'a', color: 'black', hasMoved: false };
    case -8: return { type: 'c', color: 'black', hasMoved: false };
    case -9: return { type: 'e', color: 'black', hasMoved: false };
    case -10: return { type: 'j', color: 'black', hasMoved: false };
    default: return null;
  }
}

export interface NodeRequest {
  gameNumber: number;
  board: number[][];
  turn: 'white' | 'black';
  elo: number;
  moveNumber: number;
}

export interface NodeResponse {
  gameNumber: number;
  move: MoveResult | null;
  score: number | null;
  depth: number | null;
  error?: string;
}

export async function evaluatePosition(req: NodeRequest): Promise<NodeResponse> {
  try {
    const uiBoard = req.board.map(row => row.map(pieceCodeToPiece));
    const turnColor = req.turn;
    const result = await getBestMoveDetailed(
      uiBoard,
      turnColor,
      4, // base; adaptive allocation may raise it (elo 1600 -> depth 5)
      { elo: req.elo, personality: 'NORMAL', maxTimeMs: 60000 },
      req.moveNumber
    );
    return {
      gameNumber: req.gameNumber,
      move: result?.move ?? null,
      score: result?.score ?? null,
      depth: result?.depth ?? null,
    };
  } catch (err) {
    return {
      gameNumber: req.gameNumber,
      move: null,
      score: null,
      depth: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Read one line-delimited JSON request from stdin, respond with one line. */
export async function runNodeServer(): Promise<void> {
  const stdin = process.stdin;
  const stdout = process.stdout;
  let buffer = '';
  for await (const chunk of stdin) {
    buffer += chunk;
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        const req = JSON.parse(line) as NodeRequest;
        const res = await evaluatePosition(req);
        stdout.write(JSON.stringify(res) + '\n');
      } catch (err) {
        stdout.write(
          JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) + '\n'
        );
      }
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runNodeServer().catch(e => {
    process.stderr.write('engineNode fatal: ' + (e instanceof Error ? e.stack : String(e)) + '\n');
    process.exit(1);
  });
}
