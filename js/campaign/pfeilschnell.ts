import { PIECE_VALUES } from '../config.js';
import { campaignManager } from './CampaignManager.js';

export const PFEILSCHNELL_BISHOP_COST = 2;

export interface ShopPriceGame {
  campaignMode?: boolean;
  currentLevelId?: string | null;
  phase?: string;
  playerColor?: string;
}

const WHITE_SHOP = new Set(['SETUP_WHITE_KING', 'SETUP_WHITE_PIECES']);
const BLACK_SHOP = new Set(['SETUP_BLACK_KING', 'SETUP_BLACK_PIECES']);

/** True while the player is hiring on an Anwerbe-Kapitel and owns Pfeilschnell. */
export function pfeilschnellShop(game: ShopPriceGame): boolean {
  if (!game.campaignMode || !game.currentLevelId) return false;
  const level = campaignManager.getLevel(game.currentLevelId);
  if (!level || level.setupType !== 'budget') return false;
  if (!campaignManager.isTalentUnlocked('b_pfeilschnell')) return false;
  const phase = String(game.phase ?? '');
  return game.playerColor === 'black' ? BLACK_SHOP.has(phase) : WHITE_SHOP.has(phase);
}

/** Shop price. Pfeilschnell charges 2 for a bishop; every other piece stays on the table. */
export function shopPieceCost(pieceType: string, game: ShopPriceGame): number {
  if (pieceType === 'b' && pfeilschnellShop(game)) return PFEILSCHNELL_BISHOP_COST;
  return PIECE_VALUES[pieceType] ?? 0;
}
