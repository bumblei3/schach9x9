import { campaignManager } from './CampaignManager.js';

/**
 * One tutor pass when a campaign mission becomes playable.
 * The hint button stays free for every player.
 */
export function offerTaktikGenieTip(controller: {
  requestHint?: () => Promise<void> | void;
}): void {
  if (!campaignManager.isPerkUnlocked('taktik_genie')) return;
  void controller.requestHint?.();
}
