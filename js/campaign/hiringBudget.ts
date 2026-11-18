import { t } from '../i18n.js';

export const ELITE_GARDE_BUDGET = 10;
export const TAKTIKER_BUDGET = 5;

export interface HiringBudget {
  total: number;
  label: string;
}

/** Purse for an Anwerbe-Kapitel. Elite-Garde and Taktiker stack on the chapter base. */
export function hiringBudget(base: number, elite: boolean, taktiker: boolean): HiringBudget {
  // Talente bleiben Eigennamen; das Label wird je Sprache gesetzt.
  const parts: string[] = [];
  let total = base;
  if (elite) {
    total += ELITE_GARDE_BUDGET;
    parts.push(`${ELITE_GARDE_BUDGET} ${t('campaign.budget.eliteGarde')}`);
  }
  if (taktiker) {
    total += TAKTIKER_BUDGET;
    parts.push(`${TAKTIKER_BUDGET} ${t('campaign.budget.taktiker')}`);
  }
  const label =
    parts.length === 0
      ? t('campaign.budget.label', { total })
      : t('campaign.budget.breakdown', { total, base, parts: parts.join(' + ') });
  return { total, label };
}
