import { describe, it, expect } from 'vitest';
import * as ChessPieces from '../js/chess-pieces.js';

describe('Chess Pieces Barrel File', () => {
    it('should export all required modules', () => {
        expect(ChessPieces.PIECE_SETS).toBeDefined();
        expect(ChessPieces.setPieceSkin).toBeDefined();
        expect(ChessPieces.getAvailableSkins).toBeDefined();
    });

    it('should verify export types', () => {
        expect(typeof ChessPieces.setPieceSkin).toBe('function');
        expect(typeof ChessPieces.getAvailableSkins).toBe('function');
        expect(typeof ChessPieces.PIECE_SETS).toBe('object');
    });
});
