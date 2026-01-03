import { classic } from './classic.js';
import { modern } from './modern.js';
import { pixel } from './pixel.js';
import { infernale } from './infernale.js';
import { wood } from './wood.js';
import { neon } from './neon.js';
import { minimalist } from './minimalist.js';

export const PIECE_SETS = {
  classic,
  modern,
  pixel,
  infernale,
  wood,
  neon,
  minimalist,
};

let currentSkin = 'classic';
export let PIECE_SVGS = PIECE_SETS[currentSkin];
// Maintain global window access for backward compatibility if needed, though module usage is preferred
if (typeof window !== 'undefined') {
  window.PIECE_SVGS = PIECE_SVGS;
}

export function setPieceSkin(skinName) {
  if (PIECE_SETS[skinName]) {
    currentSkin = skinName;
    PIECE_SVGS = PIECE_SETS[skinName];
    if (typeof window !== 'undefined') {
      window.PIECE_SVGS = PIECE_SVGS;
    }
    return true;
  }
  return false;
}

export function getAvailableSkins() {
  return [
    { id: 'classic', name: 'Klassisch' },
    { id: 'modern', name: 'Modern' },
    { id: 'pixel', name: 'Pixel' },
    { id: 'infernale', name: 'Infernale' },
    { id: 'wood', name: 'Holz' },
    { id: 'neon', name: 'Neon' },
    { id: 'minimalist', name: 'Minimalistisch' },
  ];
}
