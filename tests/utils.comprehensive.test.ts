import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    deepCopy,
    coordToAlgebraic,
    debounce,
    safeJSONParse,
    parseFEN,
} from '../js/utils.js';

describe('Utils - Comprehensive Tests', () => {
    describe('deepCopy', () => {
        it('should create a deep copy of an object', () => {
            const original = { a: 1, b: { c: 2 } };
            const copy = deepCopy(original);
            expect(copy).toEqual(original);
            expect(copy).not.toBe(original);
            expect(copy.b).not.toBe(original.b);
        });

        it('should handle arrays', () => {
            const original = [1, [2, 3], { a: 4 }];
            const copy = deepCopy(original);
            expect(copy).toEqual(original);
            expect(copy[1]).not.toBe(original[1]);
        });

        it('should handle null and undefined', () => {
            expect(deepCopy(null)).toBe(null);
            expect(deepCopy({ a: undefined })).toEqual({});
        });

        it('should handle empty objects', () => {
            expect(deepCopy({})).toEqual({});
            expect(deepCopy([])).toEqual([]);
        });
    });

    describe('coordToAlgebraic', () => {
        it('should convert (0,0) to a9', () => {
            expect(coordToAlgebraic(0, 0)).toBe('a9');
        });

        it('should convert (8,8) to i1', () => {
            expect(coordToAlgebraic(8, 8)).toBe('i1');
        });

        it('should convert (4,4) to e5', () => {
            expect(coordToAlgebraic(4, 4)).toBe('e5');
        });

        it('should handle all corners of 9x9 board', () => {
            expect(coordToAlgebraic(0, 0)).toBe('a9'); // Top-left
            expect(coordToAlgebraic(0, 8)).toBe('i9'); // Top-right
            expect(coordToAlgebraic(8, 0)).toBe('a1'); // Bottom-left
            expect(coordToAlgebraic(8, 8)).toBe('i1'); // Bottom-right
        });

        it('should convert center square', () => {
            expect(coordToAlgebraic(4, 4)).toBe('e5');
        });
    });

    describe('debounce', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should delay function execution', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, 100);

            debounced();
            expect(fn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(100);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should cancel previous calls on rapid invocations', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, 100);

            debounced();
            debounced();
            debounced();

            vi.advanceTimersByTime(100);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should pass arguments to the debounced function', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, 100);

            debounced('arg1', 'arg2');
            vi.advanceTimersByTime(100);

            expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
        });

        it('should use default delay of 150ms', () => {
            const fn = vi.fn();
            const debounced = debounce(fn);

            debounced();
            vi.advanceTimersByTime(149);
            expect(fn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(1);
            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    describe('safeJSONParse', () => {
        it('should parse valid JSON', () => {
            expect(safeJSONParse('{"a":1}', {})).toEqual({ a: 1 });
            expect(safeJSONParse('[1,2,3]', [])).toEqual([1, 2, 3]);
        });

        it('should return fallback for invalid JSON', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            expect(safeJSONParse('invalid-json', { default: true })).toEqual({ default: true });
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it('should return fallback for empty string', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            expect(safeJSONParse('', [])).toEqual([]);
            consoleSpy.mockRestore();
        });

        it('should handle null and undefined strings', () => {
            expect(safeJSONParse('null', 'fallback')).toBe(null);
        });
    });

    describe('parseFEN', () => {
        it('should parse a simple FEN with white turn', () => {
            const fen = '9/9/9/9/4K4/9/9/9/9 w';
            const result = parseFEN(fen);
            expect(result.turn).toBe('white');
            expect(result.board[4][4]).toEqual({ type: 'k', color: 'white' });
        });

        it('should parse a simple FEN with black turn', () => {
            const fen = '4k4/9/9/9/9/9/9/9/9 b';
            const result = parseFEN(fen);
            expect(result.turn).toBe('black');
            expect(result.board[0][4]).toEqual({ type: 'k', color: 'black' });
        });

        it('should parse FEN with multiple pieces', () => {
            const fen = 'rnbqkbnr1/9/9/9/9/9/9/9/RNBQKBNR1 w';
            const result = parseFEN(fen);

            // Black pieces on row 0
            expect(result.board[0][0]).toEqual({ type: 'r', color: 'black' });
            expect(result.board[0][4]).toEqual({ type: 'k', color: 'black' });

            // White pieces on row 8
            expect(result.board[8][0]).toEqual({ type: 'r', color: 'white' });
            expect(result.board[8][4]).toEqual({ type: 'k', color: 'white' });
        });

        it('should handle empty squares with numbers', () => {
            const fen = '4k4/9/9/9/9/9/9/9/4K4 w';
            const result = parseFEN(fen);

            // Most squares should be null
            expect(result.board[0][0]).toBe(null);
            expect(result.board[0][3]).toBe(null);
            expect(result.board[0][5]).toBe(null);

            // Kings should be present
            expect(result.board[0][4]).toEqual({ type: 'k', color: 'black' });
            expect(result.board[8][4]).toEqual({ type: 'k', color: 'white' });
        });

        it('should parse fairy pieces correctly', () => {
            const fen = '4a4/4c4/9/9/9/9/9/4C4/4A4 w';
            const result = parseFEN(fen);

            expect(result.board[0][4]).toEqual({ type: 'a', color: 'black' }); // Archbishop
            expect(result.board[1][4]).toEqual({ type: 'c', color: 'black' }); // Chancellor
            expect(result.board[7][4]).toEqual({ type: 'c', color: 'white' });
            expect(result.board[8][4]).toEqual({ type: 'a', color: 'white' });
        });
    });
});
