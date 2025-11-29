import { jest } from '@jest/globals';
import { debounce, deepCopy, coordToAlgebraic } from '../js/utils.js';

describe('Utils', () => {
    describe('debounce', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.runOnlyPendingTimers();
            jest.useRealTimers();
        });

        test('should delay function execution', () => {
            const mockFn = jest.fn();
            const debouncedFn = debounce(mockFn, 100);

            debouncedFn();
            expect(mockFn).not.toHaveBeenCalled();

            jest.advanceTimersByTime(100);
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        test('should cancel previous call if called again within delay', () => {
            const mockFn = jest.fn();
            const debouncedFn = debounce(mockFn, 100);

            debouncedFn();
            jest.advanceTimersByTime(50);
            debouncedFn();
            jest.advanceTimersByTime(50);

            expect(mockFn).not.toHaveBeenCalled();

            jest.advanceTimersByTime(50);
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        test('should pass arguments to debounced function', () => {
            const mockFn = jest.fn();
            const debouncedFn = debounce(mockFn, 100);

            debouncedFn('arg1', 'arg2');
            jest.advanceTimersByTime(100);

            expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
        });

        test('should use default delay of 150ms when not specified', () => {
            const mockFn = jest.fn();
            const debouncedFn = debounce(mockFn);

            debouncedFn();
            jest.advanceTimersByTime(100);
            expect(mockFn).not.toHaveBeenCalled();

            jest.advanceTimersByTime(50);
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        test('should handle multiple rapid calls correctly', () => {
            const mockFn = jest.fn();
            const debouncedFn = debounce(mockFn, 100);

            debouncedFn();
            jest.advanceTimersByTime(20);
            debouncedFn();
            jest.advanceTimersByTime(20);
            debouncedFn();
            jest.advanceTimersByTime(20);
            debouncedFn();

            expect(mockFn).not.toHaveBeenCalled();

            jest.advanceTimersByTime(100);
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        test('should preserve context when calling debounced function', () => {
            const obj = {
                value: 42,
                method: jest.fn(function () { return this.value; })
            };
            const debouncedMethod = debounce(obj.method.bind(obj), 100);

            debouncedMethod();
            jest.advanceTimersByTime(100);

            expect(obj.method).toHaveBeenCalled();
        });
    });

    describe('deepCopy', () => {
        test('should deep copy simple objects', () => {
            const obj = { a: 1, b: 2 };
            const copy = deepCopy(obj);

            expect(copy).toEqual(obj);
            expect(copy).not.toBe(obj);
        });

        test('should deep copy nested objects', () => {
            const obj = { a: { b: { c: 3 } } };
            const copy = deepCopy(obj);

            copy.a.b.c = 5;
            expect(obj.a.b.c).toBe(3);
            expect(copy.a.b.c).toBe(5);
        });

        test('should deep copy arrays', () => {
            const arr = [1, 2, [3, 4]];
            const copy = deepCopy(arr);

            copy[2][0] = 10;
            expect(arr[2][0]).toBe(3);
            expect(copy[2][0]).toBe(10);
        });

        test('should handle null and undefined values', () => {
            const obj = { a: null, b: undefined, c: 1 };
            const copy = deepCopy(obj);

            expect(copy.a).toBeNull();
            expect(copy.b).toBeUndefined();
            expect(copy.c).toBe(1);
        });

        test('should deep copy objects with various data types', () => {
            const obj = {
                string: 'test',
                number: 123,
                boolean: true,
                array: [1, 2, 3],
                nested: { a: 1, b: 2 }
            };
            const copy = deepCopy(obj);

            expect(copy).toEqual(obj);
            expect(copy).not.toBe(obj);
            expect(copy.nested).not.toBe(obj.nested);
            expect(copy.array).not.toBe(obj.array);
        });

        test('should handle empty objects and arrays', () => {
            const emptyObj = {};
            const emptyArr = [];

            expect(deepCopy(emptyObj)).toEqual({});
            expect(deepCopy(emptyArr)).toEqual([]);
        });

        test('should deep copy multi-level nested structures', () => {
            const obj = {
                level1: {
                    level2: {
                        level3: {
                            level4: {
                                value: 'deep'
                            }
                        }
                    }
                }
            };
            const copy = deepCopy(obj);

            copy.level1.level2.level3.level4.value = 'modified';
            expect(obj.level1.level2.level3.level4.value).toBe('deep');
            expect(copy.level1.level2.level3.level4.value).toBe('modified');
        });

        test('should handle arrays of objects', () => {
            const arr = [
                { id: 1, name: 'one' },
                { id: 2, name: 'two' }
            ];
            const copy = deepCopy(arr);

            copy[0].name = 'modified';
            expect(arr[0].name).toBe('one');
            expect(copy[0].name).toBe('modified');
        });
    });

    describe('coordToAlgebraic', () => {
        test('should convert coordinates to algebraic notation', () => {
            expect(coordToAlgebraic(0, 0)).toBe('a9');
            expect(coordToAlgebraic(8, 8)).toBe('i1');
            expect(coordToAlgebraic(4, 4)).toBe('e5');
        });

        test('should handle all files (columns a-i)', () => {
            expect(coordToAlgebraic(0, 0)).toBe('a9');
            expect(coordToAlgebraic(0, 1)).toBe('b9');
            expect(coordToAlgebraic(0, 2)).toBe('c9');
            expect(coordToAlgebraic(0, 3)).toBe('d9');
            expect(coordToAlgebraic(0, 4)).toBe('e9');
            expect(coordToAlgebraic(0, 5)).toBe('f9');
            expect(coordToAlgebraic(0, 6)).toBe('g9');
            expect(coordToAlgebraic(0, 7)).toBe('h9');
            expect(coordToAlgebraic(0, 8)).toBe('i9');
        });

        test('should handle all ranks (rows 1-9)', () => {
            expect(coordToAlgebraic(0, 0)).toBe('a9');
            expect(coordToAlgebraic(1, 0)).toBe('a8');
            expect(coordToAlgebraic(2, 0)).toBe('a7');
            expect(coordToAlgebraic(3, 0)).toBe('a6');
            expect(coordToAlgebraic(4, 0)).toBe('a5');
            expect(coordToAlgebraic(5, 0)).toBe('a4');
            expect(coordToAlgebraic(6, 0)).toBe('a3');
            expect(coordToAlgebraic(7, 0)).toBe('a2');
            expect(coordToAlgebraic(8, 0)).toBe('a1');
        });

        test('should handle corner coordinates', () => {
            expect(coordToAlgebraic(0, 0)).toBe('a9'); // top-left
            expect(coordToAlgebraic(0, 8)).toBe('i9'); // top-right
            expect(coordToAlgebraic(8, 0)).toBe('a1'); // bottom-left
            expect(coordToAlgebraic(8, 8)).toBe('i1'); // bottom-right
        });

        test('should handle center coordinates', () => {
            expect(coordToAlgebraic(4, 4)).toBe('e5');
        });

        test('should convert various middle positions', () => {
            expect(coordToAlgebraic(2, 3)).toBe('d7');
            expect(coordToAlgebraic(6, 7)).toBe('h3');
            expect(coordToAlgebraic(5, 2)).toBe('c4');
            expect(coordToAlgebraic(1, 6)).toBe('g8');
        });
    });
});
