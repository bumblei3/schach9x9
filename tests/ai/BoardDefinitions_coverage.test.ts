import { describe, it, expect } from 'vitest';
import * as BoardDefinitions from '../../js/ai/BoardDefinitions.js';

describe('BoardDefinitions Types and Helpers', () => {
  it('isWhite / isBlack checks', () => {
    expect(BoardDefinitions.isWhite(BoardDefinitions.WHITE_PAWN)).toBe(true);
    expect(BoardDefinitions.isWhite(BoardDefinitions.BLACK_PAWN)).toBe(false);
    expect(BoardDefinitions.isBlack(BoardDefinitions.BLACK_KING)).toBe(true);
    expect(BoardDefinitions.isBlack(BoardDefinitions.WHITE_KING)).toBe(false);
  });

  it('getPieceType extracts type correctly', () => {
    expect(BoardDefinitions.getPieceType(BoardDefinitions.WHITE_ROOK)).toBe(
      BoardDefinitions.PIECE_ROOK
    );
    expect(BoardDefinitions.getPieceType(BoardDefinitions.BLACK_KNIGHT)).toBe(
      BoardDefinitions.PIECE_KNIGHT
    );
  });

  it('getPieceColor extracts color correctly', () => {
    expect(BoardDefinitions.getPieceColor(BoardDefinitions.WHITE_BISHOP)).toBe(
      BoardDefinitions.COLOR_WHITE
    );
    expect(BoardDefinitions.getPieceColor(BoardDefinitions.BLACK_QUEEN)).toBe(
      BoardDefinitions.COLOR_BLACK
    );
  });

  it('coordinate conversions', () => {
    // 9x9 board
    expect(BoardDefinitions.indexToRow(0)).toBe(0);
    expect(BoardDefinitions.indexToRow(9)).toBe(1);
    expect(BoardDefinitions.indexToRow(80)).toBe(8);

    expect(BoardDefinitions.indexToCol(0)).toBe(0);
    expect(BoardDefinitions.indexToCol(10)).toBe(1); // 10 % 9 = 1

    expect(BoardDefinitions.coordsToIndex(2, 2)).toBe(20); // 2*9 + 2 = 20
  });

  it('pieceToString converts correctly', () => {
    expect(BoardDefinitions.pieceToString(BoardDefinitions.PIECE_NONE)).toBe('.');
    expect(BoardDefinitions.pieceToString(BoardDefinitions.WHITE_PAWN)).toBe('P');
    expect(BoardDefinitions.pieceToString(BoardDefinitions.BLACK_PAWN)).toBe('p');
    expect(BoardDefinitions.pieceToString(BoardDefinitions.WHITE_KNIGHT)).toBe('N');
    // Unknown
    expect(BoardDefinitions.pieceToString(BoardDefinitions.COLOR_WHITE | 15)).toBe('?');
  });
});
