declare module 'gifenc' {
  export function GIFEncoder(): {
    writeFrame(
      data: Uint8Array,
      width: number,
      height: number,
      options?: { palette?: number[][]; delay?: number; transparent?: boolean; transparentIndex?: number; first?: boolean; repeat?: number }
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
  };
  export function quantize(data: Uint8Array, colors: number, options?: any): number[][];
  export function applyPalette(data: Uint8Array, palette: number[][]): Uint8Array;
}