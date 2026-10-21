import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameLike } from '../../js/types/core';
import { notificationUI } from '../../js/ui/NotificationUI';
import { exportReplayGIF, renderReplayGifBytes } from '../../js/utils/GIFExporter';

const gifControl = vi.hoisted(() => ({ failOnFrame: -1, frames: 0 }));

vi.mock('gifenc', async () => {
  const actual = await vi.importActual<typeof import('gifenc')>('gifenc');
  return {
    ...actual,
    GIFEncoder() {
      const gif = actual.GIFEncoder();
      return {
        writeFrame(
          index: Uint8Array,
          width: number,
          height: number,
          opts?: { palette?: number[][]; delay?: number; first?: boolean }
        ) {
          const n = gifControl.frames++;
          if (gifControl.failOnFrame >= 0 && n >= gifControl.failOnFrame) {
            throw new Error('gifenc');
          }
          gif.writeFrame(index, width, height, opts);
        },
        finish: () => gif.finish(),
        bytes: () => gif.bytes(),
      };
    },
  };
});

function twoMoveGame() {
  const board = Array.from({ length: 9 }, () => Array(9).fill(null));
  board[5][0] = { type: 'p', color: 'white', hasMoved: true };
  board[2][0] = { type: 'p', color: 'black', hasMoved: true };
  const selected = { r: 4, c: 4 };
  const saved = { sentinel: true };
  return {
    board,
    turn: 'black' as const,
    boardSize: 3,
    selectedSquare: selected,
    validMoves: [],
    lastMoveHighlight: { from: { r: 1, c: 0 }, to: { r: 2, c: 0 } },
    replayMode: false,
    savedGameState: saved,
    moveHistory: [
      {
        from: { r: 6, c: 0 },
        to: { r: 5, c: 0 },
        piece: { type: 'p', color: 'white', hasMoved: false },
        captured: null,
      },
      {
        from: { r: 1, c: 0 },
        to: { r: 2, c: 0 },
        piece: { type: 'p', color: 'black', hasMoved: false },
        captured: null,
      },
    ],
    selected,
    saved,
  };
}

describe('GIFExporter', () => {
  let restoreCanvas: (() => void) | null = null;

  beforeEach(() => {
    gifControl.failOnFrame = -1;
    gifControl.frames = 0;
    const original = HTMLCanvasElement.prototype.getContext;
    (
      HTMLCanvasElement.prototype as unknown as {
        getContext: (type: string) => CanvasRenderingContext2D | null;
      }
    ).getContext = function (this: HTMLCanvasElement, type: string) {
      if (type !== '2d') return null;
      const pixels = new Uint8ClampedArray(this.width * this.height * 4);
      pixels.fill(180);
      return {
        fillStyle: '',
        font: '',
        textAlign: '',
        textBaseline: '',
        fillRect() {},
        fillText() {},
        getImageData: () => ({ data: pixels }),
      } as unknown as CanvasRenderingContext2D;
    };
    restoreCanvas = () => {
      HTMLCanvasElement.prototype.getContext = original;
    };
  });

  afterEach(() => {
    restoreCanvas?.();
    restoreCanvas = null;
  });

  it('returns gif bytes and leaves the live game untouched', async () => {
    const game = twoMoveGame();
    const boardRef = game.board;
    const historyRef = game.moveHistory;

    const bytes = await renderReplayGifBytes(game as unknown as GameLike);

    expect(bytes[0]).toBe(0x47);
    expect(String.fromCharCode(...bytes.slice(0, 6))).toBe('GIF89a');
    expect(game.board).toBe(boardRef);
    expect(game.turn).toBe('black');
    expect(game.selectedSquare).toBe(game.selected);
    expect(game.savedGameState).toBe(game.saved);
    expect(game.moveHistory).toBe(historyRef);
    expect(game.board[5][0]).toEqual({ type: 'p', color: 'white', hasMoved: true });
    expect(game.board[2][0]).toEqual({ type: 'p', color: 'black', hasMoved: true });
  });

  it('leaves the live game untouched when gifenc throws mid-replay', async () => {
    gifControl.failOnFrame = 1;
    const game = twoMoveGame();
    const boardRef = game.board;

    await expect(renderReplayGifBytes(game as unknown as GameLike)).rejects.toThrow('gifenc');

    expect(game.board).toBe(boardRef);
    expect(game.turn).toBe('black');
    expect(game.selectedSquare).toBe(game.selected);
    expect(game.savedGameState).toBe(game.saved);
    expect(game.board[5][0]?.hasMoved).toBe(true);
  });

  it('warns instead of alerting when there are no moves', async () => {
    const show = vi.spyOn(notificationUI, 'show').mockImplementation(() => {});
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    await exportReplayGIF({ moveHistory: [] } as unknown as GameLike);

    expect(alertSpy).not.toHaveBeenCalled();
    expect(show).toHaveBeenCalledWith('Keine Züge zum Exportieren!', 'warning');
    show.mockRestore();
    alertSpy.mockRestore();
  });
});
