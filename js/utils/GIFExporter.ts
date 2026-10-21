import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { reconstructBoardAtMove } from '../move/GameStateManager.js';
import { getPieceText } from '../ui/BoardRenderer.js';
import { notificationUI } from '../ui/NotificationUI.js';
import type { GameLike, Board } from '../types/core.js';
import type { Game } from '../gameEngine.js';

const CELL = 60;

/**
 * Deep-copied position for the replay frames.
 * `moveHistory` is the live array and is only read. `reconstructBoardAtMove`
 * runs on this shell, never on the live game, so a throw in gifenc cannot
 * leave `game.board` mid-replay. A try/finally around the live game is
 * unnecessary for that reason.
 */
function replayShell(game: GameLike): Game {
  const finalBoard = JSON.parse(JSON.stringify(game.board)) as Board;
  return {
    board: JSON.parse(JSON.stringify(finalBoard)) as Board,
    turn: game.turn,
    selectedSquare: null,
    validMoves: null,
    lastMoveHighlight: null,
    moveHistory: game.moveHistory,
    boardSize: game.boardSize || 9,
    savedGameState: {
      board: finalBoard,
      turn: game.turn,
      selectedSquare: null,
      validMoves: null,
      lastMoveHighlight: null,
    },
  } as unknown as Game;
}

/** Encode the replay. Does not read or write the live board after the copy. */
export async function renderReplayGifBytes(game: GameLike): Promise<Uint8Array> {
  if (!game?.moveHistory?.length) {
    throw new Error('Keine Züge zum Exportieren');
  }

  const shell = replayShell(game);
  const size = shell.boardSize || 9;
  const canvasSize = size * CELL;
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas nicht verfügbar');
  }

  const gif = GIFEncoder();

  for (let i = -1; i < shell.moveHistory.length; i++) {
    reconstructBoardAtMove(shell, i);

    ctx.fillStyle = '#f0d9b5';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const isLight = (r + c) % 2 === 0;
        ctx.fillStyle = isLight ? '#f0d9b5' : '#b58863';
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);

        const piece = shell.board?.[r]?.[c];
        if (piece) {
          const symbol = getPieceText(piece);
          ctx.fillStyle = piece.color === 'white' ? '#ffffff' : '#000000';
          ctx.font = `${CELL * 0.7}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(symbol, c * CELL + CELL / 2, r * CELL + CELL / 2);
        }
      }
    }

    const hl = shell.lastMoveHighlight;
    if (hl) {
      ctx.fillStyle = 'rgba(255, 255, 0, 0.4)';
      ctx.fillRect(hl.from.c * CELL, hl.from.r * CELL, CELL, CELL);
      ctx.fillRect(hl.to.c * CELL, hl.to.r * CELL, CELL, CELL);
    }

    const imageData = ctx.getImageData(0, 0, canvasSize, canvasSize);
    const rgba = new Uint8Array(imageData.data.buffer);
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);

    gif.writeFrame(index, canvasSize, canvasSize, {
      palette,
      delay: 800,
      first: i === -1,
    });
  }

  gif.finish();
  return gif.bytes();
}

export async function exportReplayGIF(game: GameLike): Promise<void> {
  if (!game?.moveHistory?.length) {
    notificationUI.show('Keine Züge zum Exportieren!', 'warning');
    return;
  }

  const bytes = await renderReplayGifBytes(game);
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'image/gif' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'schach9x9-replay.gif';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  notificationUI.show('GIF exportiert!', 'success');
}
