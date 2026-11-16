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

export const FESTUNG_ROOK_COST = 3;
export const MAJESTAET_QUEEN_COST = 7;

/** True while this side is hiring on an Anwerbe-Kapitel and owns the talent. */
function hiringDiscount(game: ShopPriceGame, talentId: string): boolean {
  if (!game.campaignMode || !game.currentLevelId) return false;
  const level = campaignManager.getLevel(game.currentLevelId);
  if (!level || level.setupType !== 'budget') return false;
  if (!campaignManager.isTalentUnlocked(talentId)) return false;
  const phase = String(game.phase ?? '');
  return game.playerColor === 'black' ? BLACK_SHOP.has(phase) : WHITE_SHOP.has(phase);
}

/** True while the player is hiring on an Anwerbe-Kapitel and owns Pfeilschnell. */
export function pfeilschnellShop(game: ShopPriceGame): boolean {
  return hiringDiscount(game, 'b_pfeilschnell');
}

/** True while the player is hiring on an Anwerbe-Kapitel and owns Festung. */
export function festungShop(game: ShopPriceGame): boolean {
  return hiringDiscount(game, 'r_festung');
}

/** True while the player is hiring on an Anwerbe-Kapitel and owns Majestät. */
export function majestaetShop(game: ShopPriceGame): boolean {
  return hiringDiscount(game, 'q_majestaet');
}

/** Shop price. Pfeilschnell 2 for a bishop, Festung 3 for a rook, Majestät 7 for a queen. */
export function shopPieceCost(pieceType: string, game: ShopPriceGame): number {
  if (pieceType === 'b' && pfeilschnellShop(game)) return PFEILSCHNELL_BISHOP_COST;
  if (pieceType === 'r' && festungShop(game)) return FESTUNG_ROOK_COST;
  if (pieceType === 'q' && majestaetShop(game)) return MAJESTAET_QUEEN_COST;
  return PIECE_VALUES[pieceType] ?? 0;
}
