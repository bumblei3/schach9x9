declare module 'gifenc' {
  export function GIFEncoder(): {
    writeFrame(
      _data: Uint8Array,
      _width: number,
      _height: number,
      _options?: { palette?: number[][]; delay?: number; transparent?: boolean; transparentIndex?: number; first?: boolean; repeat?: number }
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
  };
  export function quantize(_data: Uint8Array, _colors: number, _options?: unknown): number[][];
  export function applyPalette(_data: Uint8Array, _palette: number[][]): Uint8Array;
}

