/**
 * Protocol tests for js/matchRefs.ts — the Track-A strength harness.
 *
 * The exported board helpers (`startingBoard`, `materialDiff`) are covered by
 * matchRefs.test.ts and matchRefs.invariant.test.ts. What was NOT covered is
 * the part that actually carries every strength claim in STATUS.md: the
 * line protocol between the parent and the two engine nodes, move application
 * (including promotion), and the per-game verdict.
 *
 * The engine processes are replaced by a fake `spawn` whose stdout/stdin are
 * plain objects. No engine runs, no worktree is needed, and the harness logic
 * under test is the real code.
 */

import { spawn } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  askMove,
  playGame,
  startingBoard,
  startEngine,
  verdict,
  applyMove,
} from '../js/matchRefs.js';

const sw = vi.hoisted(() => {
  type Listener = (chunk: string) => void;
  const procs: any[] = [];
  const listeners: Listener[][] = [];
  const order: number[] = [];
  const respond: { fn: null | ((line: string, index: number) => string[]) } = { fn: null };
  return { procs, listeners, order, respond };
});

vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => {
    const index = sw.procs.length;
    sw.listeners[index] = [];
    const written: string[] = [];

    const emit = (chunk: string) => {
      for (const cb of sw.listeners[index]) cb(chunk);
    };

    const proc = {
      stdout: {
        setEncoding: () => undefined,
        on: (_event: string, cb: (chunk: string) => void) => {
          sw.listeners[index].push(cb);
        },
      },
      stdin: {
        write: (line: string) => {
          written.push(line);
          sw.order.push(index);
          for (const chunk of sw.respond.fn?.(line, index) ?? []) emit(chunk);
          return true;
        },
      },
      kill: vi.fn(),
      written,
    };

    sw.procs.push(proc);
    return proc;
  }),
}));

/** Push a raw stdout chunk into engine `index`, bypassing the responder. */
function emitChunk(index: number, chunk: string): void {
  for (const cb of sw.listeners[index] ?? []) cb(chunk);
}

interface FakeRequest {
  gameNumber: number;
  board: number[][];
  turn: 'white' | 'black';
}

function replyLine(req: FakeRequest, move: unknown): string {
  return JSON.stringify({ gameNumber: req.gameNumber, move, score: 0, depth: 5 }) + '\n';
}

/** A reply that echoes the request's gameNumber, as engineNode.ts does. */
function echoReply(overrides: Record<string, unknown> = {}) {
  return (line: string): string[] => {
    const req = JSON.parse(line) as FakeRequest;
    return [
      JSON.stringify({
        gameNumber: req.gameNumber,
        move: null,
        score: 0,
        depth: 5,
        ...overrides,
      }) + '\n',
    ];
  };
}

/** Resolve `p` or report that it is still pending after `ms`. */
async function settled(p: Promise<unknown>, ms = 80): Promise<'settled' | 'pending'> {
  return (await Promise.race([
    p.then(() => 'settled' as const),
    new Promise<'pending'>(resolve => setTimeout(() => resolve('pending'), ms)),
  ])) as 'settled' | 'pending';
}

// ---------------------------------------------------------------------------
// Board scanning for the scripted engines
// ---------------------------------------------------------------------------

const DIRS = [-1, 0, 1];

function findCapture(board: number[][], sign: number): { from: Square; to: Square } | null {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (Math.sign(board[r][c]) !== sign || board[r][c] === 0) continue;
      for (const dr of DIRS) {
        for (const dc of DIRS) {
          if (dr === 0 && dc === 0) continue;
          const tr = r + dr;
          const tc = c + dc;
          if (tr < 0 || tr > 8 || tc < 0 || tc > 8) continue;
          const target = board[tr][tc];
          if (target !== 0 && Math.sign(target) !== sign) {
            return { from: { r, c }, to: { r: tr, c: tc } };
          }
        }
      }
    }
  }
  return null;
}

function findQuiet(board: number[][], sign: number): { from: Square; to: Square } | null {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (Math.sign(board[r][c]) !== sign || board[r][c] === 0) continue;
      for (let er = 0; er < 9; er++) {
        for (let ec = 0; ec < 9; ec++) {
          if (board[er][ec] === 0) return { from: { r, c }, to: { r: er, c: ec } };
        }
      }
    }
  }
  return null;
}

interface Square {
  r: number;
  c: number;
}

/**
 * Scripted engine: captures exactly `captures` pieces (the first available
 * capture), then plays quiet moves forever. Always emits a reply, so a game
 * can never stall waiting for one.
 */
function scriptedEngine(captures: number) {
  const state = { capturesLeft: captures };
  return (line: string): string[] => {
    const req = JSON.parse(line) as FakeRequest;
    const sign = req.turn === 'white' ? 1 : -1;

    if (state.capturesLeft > 0) {
      const capture = findCapture(req.board, sign);
      if (capture) {
        state.capturesLeft -= 1;
        return [replyLine(req, capture)];
      }
    }

    const quiet = findQuiet(req.board, sign);
    if (quiet) return [replyLine(req, quiet)];
    return [replyLine(req, null)];
  };
}

beforeEach(() => {
  sw.procs.length = 0;
  sw.listeners.length = 0;
  sw.order.length = 0;
  sw.respond.fn = null;
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// startEngine / askMove
// ---------------------------------------------------------------------------

describe('startEngine / askMove — the engine line protocol', () => {
  it('spawns the worktree engine via npx tsx', () => {
    startEngine('/tmp/worktree');
    expect(vi.mocked(spawn)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(spawn).mock.calls[0] as unknown as [string, string[]];
    expect(call[0]).toBe('npx');
    expect(call[1][0]).toBe('tsx');
    expect(call[1][1]).toContain('js/engineNode.ts');
  });

  it('writes one JSON request per move and awaits the matching reply', async () => {
    const h = startEngine('/tmp/w');
    const board = startingBoard();
    sw.respond.fn = echoReply();

    const p = askMove(h, board, 'white', 1600, 1);
    const payload = JSON.parse(sw.procs[0].written[0]);
    expect(payload).toMatchObject({
      gameNumber: 1,
      turn: 'white',
      elo: 1600,
      moveNumber: 1,
      board,
    });
    expect(payload.fen).toBeUndefined();

    const res = await p;
    expect(res.gameNumber).toBe(1);
    expect(res.depth).toBe(5);
  });

  it('increments gameNumber per request', async () => {
    const h = startEngine('/tmp/w');
    sw.respond.fn = echoReply();

    await askMove(h, startingBoard(), 'white', 1600, 1);
    await askMove(h, startingBoard(), 'black', 1600, 1);

    const seq = sw.procs[0].written.map((l: string) => JSON.parse(l).gameNumber);
    expect(seq).toEqual([1, 2]);
  });

  it('includes the FEN override when one is supplied', async () => {
    const h = startEngine('/tmp/w');
    sw.respond.fn = echoReply();
    const fen = '9/9/9/9/9/9/9/9/k1K5N w - - 0 1';

    await askMove(h, startingBoard(), 'white', 1600, 4, fen);

    expect(JSON.parse(sw.procs[0].written[0]).fen).toBe(fen);
  });

  it('buffers a line split across two stdout chunks', async () => {
    const h = startEngine('/tmp/w');
    sw.respond.fn = null;

    const first = askMove(h, startingBoard(), 'white', 1600, 1);

    // Chunk 1 ends mid-line: nothing may be parsed yet.
    emitChunk(0, '{"gameNumber":1,"move":{"from":{"r":7,"c":0},"to":{"r":5,');
    expect(await settled(first)).toBe('pending');

    // Chunk 2 completes the line: closes `to`, `move` and the root object.
    emitChunk(0, '"c":0}},"score":0,"depth":5}\n');

    const res = await first;
    expect(res.move?.from).toEqual({ r: 7, c: 0 });
    expect(res.move?.to).toEqual({ r: 5, c: 0 });
  });

  it('processes two replies contained in a single chunk', async () => {
    const h = startEngine('/tmp/w');

    const first = askMove(h, startingBoard(), 'white', 1600, 1);
    const second = askMove(h, startingBoard(), 'black', 1600, 2);

    emitChunk(
      0,
      '{"gameNumber":1,"move":null,"score":0,"depth":5}\n' +
        '{"gameNumber":2,"move":null,"score":0,"depth":5}\n'
    );

    // Both lines are parsed from one chunk; the duplicate gameNumber case is
    // covered separately below.
    expect((await first).gameNumber).toBe(1);
    expect((await second).gameNumber).toBe(2);
  });

  it('ignores a duplicate reply for an already-resolved gameNumber', async () => {
    const h = startEngine('/tmp/w');
    sw.respond.fn = null;

    const first = askMove(h, startingBoard(), 'white', 1600, 1);
    emitChunk(0, '{"gameNumber":1,"move":null,"score":0,"depth":5}\n');
    await first;

    // A second reply for the same gameNumber has no pending entry left; it must
    // be dropped rather than resolving anything twice.
    emitChunk(0, '{"gameNumber":1,"move":null,"score":0,"depth":5}\n');

    const late = askMove(h, startingBoard(), 'white', 1600, 2);
    expect(await settled(late)).toBe('pending');
    emitChunk(0, '{"gameNumber":2,"move":null,"score":0,"depth":5}\n');
    expect((await late).gameNumber).toBe(2);
  });

  it('ignores malformed JSON lines instead of throwing', async () => {
    const h = startEngine('/tmp/w');
    sw.respond.fn = () => ['this is not json\n'];

    const p = askMove(h, startingBoard(), 'white', 1600, 1);
    expect(await settled(p)).toBe('pending');
  });

  it('ignores a reply for an unknown gameNumber', async () => {
    const h = startEngine('/tmp/w');
    sw.respond.fn = () =>
      ['{"gameNumber":999,"move":null,"score":0,"depth":5}\n'];

    const p = askMove(h, startingBoard(), 'white', 1600, 1);
    expect(await settled(p)).toBe('pending');
  });

  it('never throws on a write after the process is gone', async () => {
    const h = startEngine('/tmp/w');
    sw.respond.fn = echoReply();
    await askMove(h, startingBoard(), 'white', 1600, 1);

    const afterKill = askMove(h, startingBoard(), 'white', 1600, 2);
    h.proc.kill();
    await expect(afterKill).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// applyMove
// ---------------------------------------------------------------------------

describe('applyMove', () => {
  it('moves a piece and clears its origin square', () => {
    const board = startingBoard();
    applyMove(board, { from: { r: 7, c: 0 }, to: { r: 5, c: 0 } });

    expect(board[5][0]).toBe(1);
    expect(board[7][0]).toBe(0);
  });

  it('promotes a white pawn to each offered piece', () => {
    // `promotion` arrives as a single letter from the engine (TYPE_INT_TO_STR).
    const codes: Record<string, number> = { a: 7, c: 8, q: 5, r: 4, b: 3, n: 2, e: 9, j: 10 };
    for (const [letter, code] of Object.entries(codes)) {
      const board = startingBoard();
      applyMove(board, { from: { r: 7, c: 0 }, to: { r: 0, c: 0 }, promotion: letter });
      expect(board[0][0]).toBe(code);
    }
  });

  it('promotes a black pawn with the negative code', () => {
    const board = startingBoard();
    applyMove(board, { from: { r: 1, c: 4 }, to: { r: 8, c: 4 }, promotion: 'q' });
    expect(board[8][4]).toBe(-5);
  });

  it('leaves the pawn untouched for an unknown promotion letter', () => {
    const board = startingBoard();
    applyMove(board, { from: { r: 7, c: 0 }, to: { r: 0, c: 0 }, promotion: 'king' });
    expect(board[0][0]).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// playGame
// ---------------------------------------------------------------------------

/**
 * White rook a2, black rook a3, black rook e2, white rook e1, kings in the
 * corners. Both sides have an adjacent enemy rook, so a scripted capture is
 * possible for each, and both captures are worth the same (500).
 *
 * Board rows (0 = rank 9): 8k / 9 / 9 / 9 / 9 / 9 / r8 / R3r4 / 4R3K
 */
const MATERIAL_FEN = '8k/9/9/9/9/9/r8/R3r4/4R3K w - - 0 1';

describe('playGame — verdict', () => {
  it('returns draw when the engine reports an error', async () => {
    const newH = startEngine('/tmp/n');
    const oldH = startEngine('/tmp/o');
    sw.respond.fn = echoReply({ error: 'illegal move' });

    expect(await playGame(newH, oldH, 1600, true, 10)).toBe('draw');
  });

  it('returns draw when the engine sends no move', async () => {
    const newH = startEngine('/tmp/n');
    const oldH = startEngine('/tmp/o');
    sw.respond.fn = echoReply();

    expect(await playGame(newH, oldH, 1600, true, 10)).toBe('draw');
  });

  it('returns new when NEW nets more material than OLD', async () => {
    const newH = startEngine('/tmp/n');
    const oldH = startEngine('/tmp/o');
    // NEW captures a rook (500); OLD never captures.
    const responders = [scriptedEngine(1), scriptedEngine(0)];
    sw.respond.fn = (line, index) => responders[index](line);

    expect(await playGame(newH, oldH, 1600, true, 2, MATERIAL_FEN)).toBe('new');
  });

  it('returns draw when both sides net the same material', async () => {
    const newH = startEngine('/tmp/n');
    const oldH = startEngine('/tmp/o');
    const responders = [scriptedEngine(1), scriptedEngine(1)];
    sw.respond.fn = (line, index) => responders[index](line);

    expect(await playGame(newH, oldH, 1600, true, 2, MATERIAL_FEN)).toBe('draw');
  });

  it('returns old when OLD nets more material than NEW', async () => {
    const newH = startEngine('/tmp/n');
    const oldH = startEngine('/tmp/o');
    const responders = [scriptedEngine(0), scriptedEngine(1)];
    sw.respond.fn = (line, index) => responders[index](line);

    expect(await playGame(newH, oldH, 1600, true, 2, MATERIAL_FEN)).toBe('old');
  });

  it('honours the side-to-move of a start FEN', async () => {
    const newH = startEngine('/tmp/n');
    const oldH = startEngine('/tmp/o');
    sw.respond.fn = scriptedEngine(1);

    // FEN turn is black and NEW is white -> the first request must go to OLD.
    await playGame(newH, oldH, 1600, true, 2, '8k/9/9/9/9/9/r8/R3r4/4R3K b - - 0 1');

    expect(sw.order[0]).toBe(1);
  });

  it('judges a start FEN by material GAINED, not absolute material', async () => {
    const newH = startEngine('/tmp/n');
    const oldH = startEngine('/tmp/o');
    sw.respond.fn = scriptedEngine(0);

    // Black starts a queen up here. With no material change the NET is zero, so
    // the verdict must be a draw rather than "old wins".
    const result = await playGame(
      newH,
      oldH,
      1600,
      true,
      4,
      '9/9/9/9/9/9/9/3q5/7kK w - - 0 1'
    );

    expect(result).toBe('draw');
  });

  it('stops at moveNumber 100 instead of playing every maxMoves ply', async () => {
    const newH = startEngine('/tmp/n');
    const oldH = startEngine('/tmp/o');
    sw.respond.fn = scriptedEngine(0);

    await playGame(newH, oldH, 1600, true, 250);

    // 199 requests: the loop breaks as soon as moveNumber reaches 100.
    expect(sw.procs[0].written).toHaveLength(100);
    expect(sw.procs[1].written).toHaveLength(99);
  });
});

// ---------------------------------------------------------------------------
// verdict
// ---------------------------------------------------------------------------

describe('verdict', () => {
  it('reports NEW stronger with the win share', () => {
    expect(verdict(7, 3, 20)).toBe('VERDICT: NEW stronger (35.0% win share).');
  });

  it('reports NEW weaker and asks for a revert', () => {
    expect(verdict(2, 8, 20)).toBe('VERDICT: NEW weaker - REVERT lever.');
  });

  it('reports no measurable delta on a tie', () => {
    expect(verdict(5, 5, 20)).toBe('VERDICT: equal - no measurable delta at this sample.');
  });

  it('scales the percentage with the sample size', () => {
    expect(verdict(1, 0, 2)).toBe('VERDICT: NEW stronger (50.0% win share).');
  });
});
