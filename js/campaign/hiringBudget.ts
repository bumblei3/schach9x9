export const ELITE_GARDE_BUDGET = 10;
export const TAKTIKER_BUDGET = 5;

export interface HiringBudget {
  total: number;
  label: string;
}

/** Purse for an Anwerbe-Kapitel. Elite-Garde and Taktiker stack on the chapter base. */
export function hiringBudget(base: number, elite: boolean, taktiker: boolean): HiringBudget {
  const parts: string[] = [];
  let total = base;
  if (elite) {
    total += ELITE_GARDE_BUDGET;
    parts.push(`${ELITE_GARDE_BUDGET} Elite-Garde`);
  }
  if (taktiker) {
    total += TAKTIKER_BUDGET;
    parts.push(`${TAKTIKER_BUDGET} Taktiker`);
  }
  const label =
    parts.length === 0 ? `Budget ${total}` : `Budget ${total} (${base} + ${parts.join(' + ')})`;
  return { total, label };
}
