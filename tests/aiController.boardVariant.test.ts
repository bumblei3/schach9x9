/**
 * 8×8 workers must receive board variant (geometry) — regression for standard8x8 AI.
 */
import { describe, expect, test, vi, beforeEach } from 'vitest';

vi.mock('../js/ai/aiWorker.ts?worker', () => {
  return {
    default: class MockWorker {
      onmessage: ((_e: MessageEvent) => void) | null = null;
      posts: unknown[] = [];
      postMessage(msg: unknown) {
        this.posts.push(msg);
      }
      terminate() {}
      addEventListener() {}
      removeEventListener() {}
    },
  };
});

import { AIController } from '../js/aiController.js';

describe('AIController board variant for 8x8', () => {
  beforeEach(() => {
    // Workers use navigator.hardwareConcurrency
    Object.defineProperty(globalThis.navigator, 'hardwareConcurrency', {
      value: 2,
      configurable: true,
    });
  });

  test('initWorkerPool posts setBoardVariant 8x8 in standard8x8 mode', () => {
    const mockGame = {
      mode: 'standard8x8',
      boardShape: 'standard',
      difficulty: 'medium',
    } as any;
    const controller = new AIController(mockGame);
    controller.initWorkerPool();
    expect(controller.aiWorkers.length).toBeGreaterThan(0);
    const posts = (controller.aiWorkers[0] as any).posts as Array<{ type: string; data?: { variant?: string } }>;
    const variantMsg = posts.find(p => p.type === 'setBoardVariant');
    expect(variantMsg).toBeDefined();
    expect(variantMsg!.data?.variant).toBe('8x8');
  });

  test('initWorkerPool posts setBoardVariant 9x9 in classic mode', () => {
    const mockGame = {
      mode: 'classic',
      boardShape: 'standard',
      difficulty: 'medium',
    } as any;
    const controller = new AIController(mockGame);
    controller.initWorkerPool();
    const posts = (controller.aiWorkers[0] as any).posts as Array<{ type: string; data?: { variant?: string } }>;
    const variantMsg = posts.find(p => p.type === 'setBoardVariant');
    expect(variantMsg).toBeDefined();
    expect(variantMsg!.data?.variant).toBe('9x9');
  });

  test('setBoardVariantForWorkers broadcasts to pool', () => {
    const mockGame = { mode: 'classic', boardShape: 'standard' } as any;
    const controller = new AIController(mockGame);
    controller.initWorkerPool();
    for (const w of controller.aiWorkers) {
      (w as any).posts = [];
    }
    controller.setBoardVariantForWorkers('8x8');
    for (const w of controller.aiWorkers) {
      const posts = (w as any).posts as Array<{ type: string; data?: { variant?: string } }>;
      expect(posts.some(p => p.type === 'setBoardVariant' && p.data?.variant === '8x8')).toBe(true);
    }
  });
});
