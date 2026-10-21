import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { reconstructBoardAtMove } from '../move/GameStateManager.js';
import { getPieceText } from '../ui/BoardRenderer.js';
import type { GameLike } from '../types/core.js';
import type { Game } from '../gameEngine.js';
import type { Board } from '../types/core.js';

const CELL = 60;

export async function exportReplayGIF(game: GameLike): Promise<void> {
  if (!game || !game.moveHistory || game.moveHistory.length === 0) {
    alert('Keine Züge zum Exportieren!');
    return;
  }

  const size = game.boardSize || 9;
  const canvasSize = size * CELL;
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Save state
  const savedBoard = JSON.parse(JSON.stringify(game.board)) as Board;
  const savedTurn = game.turn;
  const savedSelected = game.selectedSquare;
  const savedValid = game.validMoves;
  const savedHighlight = game.lastMoveHighlight;
  const savedReplay = game.replayMode;
  const gameExt = game as GameLike & { savedGameState?: unknown };
  const savedSavedState = gameExt.savedGameState;

  // Enter replay-like state
  gameExt.savedGameState = {
    board: JSON.parse(JSON.stringify(game.board)),
    turn: game.turn,
    selectedSquare: game.selectedSquare,
    validMoves: game.validMoves,
    lastMoveHighlight: game.lastMoveHighlight,
  };

  const gif = GIFEncoder();


  for (let i = -1; i < game.moveHistory.length; i++) {
    reconstructBoardAtMove(game as unknown as Game, i);

    // Draw board
    ctx.fillStyle = '#f0d9b5';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const isLight = (r + c) % 2 === 0;
        ctx.fillStyle = isLight ? '#f0d9b5' : '#b58863';
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);

        const piece = game.board?.[r]?.[c];
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

    // Highlight last move
    const hl = game.lastMoveHighlight;
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
  const bytes = gif.bytes();
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'image/gif' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'schach9x9-replay.gif';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Restore state
  game.board = savedBoard;
  game.turn = savedTurn;
  game.selectedSquare = savedSelected;
  game.validMoves = savedValid;
  game.lastMoveHighlight = savedHighlight;
  game.replayMode = savedReplay;
  gameExt.savedGameState = savedSavedState;
}
