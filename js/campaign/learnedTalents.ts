import { campaignManager } from './CampaignManager.js';
import { UNIT_TALENT_TREES } from './talents.js';

/** Names of talents this piece type has already learned, in tree order. */
export function learnedTalentNames(unitType: string): string[] {
  const tree = UNIT_TALENT_TREES[unitType];
  if (!tree) return [];
  return tree.talents
    .filter(talent => campaignManager.isTalentUnlocked(talent.id))
    .map(talent => talent.name);
}
