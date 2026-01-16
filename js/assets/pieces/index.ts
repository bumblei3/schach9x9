import { classic } from './classic';
import { modern } from './modern';
import { pixel } from './pixel';
import { infernale } from './infernale';
import { wood } from './wood';
import { neon } from './neon';
import { minimalist } from './minimalist';

import { frost } from './frost';

export const PIECE_SETS: Record<string, any> = {
  classic,
  modern,
  pixel,
  infernale,
  wood,
  neon,
  minimalist,
  frost,
};

let currentSkin = 'classic';
export let PIECE_SVGS = PIECE_SETS[currentSkin];

if (typeof window !== 'undefined') {
  (window as any).PIECE_SVGS = PIECE_SVGS;
}

export function setPieceSkin(skinName: string): boolean {
  if (PIECE_SETS[skinName]) {
    currentSkin = skinName;
    PIECE_SVGS = PIECE_SETS[skinName];
    if (typeof window !== 'undefined') {
      (window as any).PIECE_SVGS = PIECE_SVGS;
    }
    return true;
  }
  return false;
}

export function getAvailableSkins(): { id: string; name: string }[] {
  return [
    { id: 'classic', name: 'Klassisch' },
    { id: 'modern', name: 'Modern' },
    { id: 'pixel', name: 'Pixel' },
    { id: 'infernale', name: 'Infernale' },
    { id: 'wood', name: 'Holz' },
    { id: 'neon', name: 'Neon' },
    { id: 'minimalist', name: 'Minimalistisch' },
    { id: 'frost', name: 'Frost' },
  ];
}
