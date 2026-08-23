export interface TalentNode {
  id: string;
  name: string;
  description: string;
  tier: number; // 1, 2, 3
  reqLevel: number; // e.g. 3, 7, 10
  cost: number; // One-time gold cost or skill points (using Gold for now)
  icon: string;
  effectType: 'passive_gold' | 'stat_boost' | 'mechanic' | 'setup_bonus';
  effectValue?: number;
}

export interface UnitTalentTree {
  unitType: string; // 'p', 'n', 'b', 'r', 'q', 'k', 'a', 'c', 'e'
  talents: TalentNode[];
}

export const UNIT_TALENT_TREES: Record<string, UnitTalentTree> = {
  p: {
    unitType: 'p',
    talents: [
      {
        id: 'p_scavenger',
        name: 'Plünderer',
        description: 'Erhält +2 Gold für jede geschlagene Figur durch einen Bauern.',
        tier: 1,
        reqLevel: 3,
        cost: 50,
        icon: '💰',
        effectType: 'passive_gold',
        effectValue: 2,
      },
      {
        id: 'p_shieldwall',
        name: 'Schildwall',
        description: 'Bauernstruktur wird von der Analyse positiver bewertet (+0.2 Eval).',
        tier: 2,
        reqLevel: 7,
        cost: 150,
        icon: '🛡️',
        effectType: 'stat_boost',
        effectValue: 20,
      },
      {
        id: 'p_veteran',
        name: 'Veteran',
        description: 'Startet Missionen mit 1 freiem Bauern-Upgrade (falls verfügbar).',
        tier: 3,
        reqLevel: 10,
        cost: 300,
        icon: '🎖️',
        effectType: 'setup_bonus',
        effectValue: 1,
      },
    ],
  },
  n: {
    unitType: 'n',
    talents: [
      {
        id: 'n_agile',
        name: 'Flinkheit',
        description: '+10% Chance, dass ein Springer einen Angriff "überlebt" (RPG-Mechanik).',
        tier: 1,
        reqLevel: 3,
        cost: 75,
        icon: '🐎',
        effectType: 'mechanic', // Placeholder for now
        effectValue: 10,
      },
      {
        id: 'n_outpost',
        name: 'Vorposten',
        description: 'Springer im Zentrum generieren +1 XP pro Runde.',
        tier: 2,
        reqLevel: 7,
        cost: 200,
        icon: 'd4',
        effectType: 'mechanic',
        effectValue: 1,
      },
    ],
  },
  // Add basic defaults for others to avoid errors
  b: { unitType: 'b', talents: [] },
  r: { unitType: 'r', talents: [] },
  q: { unitType: 'q', talents: [] },
  k: { unitType: 'k', talents: [] },
  a: {
    unitType: 'a',
    talents: [
      {
        id: 'a_gabelmeister',
        name: 'Gabelmeister',
        description:
          'Erzbischof-Schläge bringen Bonus-Gold beim Schlagen (+2 Gold pro Schlag).',
        tier: 1,
        reqLevel: 3,
        cost: 100,
        icon: '⚔️',
        effectType: 'passive_gold',
        effectValue: 2,
      },
    ],
  }, // Erzbischof
  c: {
    unitType: 'c',
    talents: [
      {
        id: 'c_xrayauge',
        name: 'Röntgenblick',
        description: 'Kanzler-Schläge geben +5 XP pro Schlag (schnellere Unit-Levels).',
        tier: 1,
        reqLevel: 3,
        cost: 100,
        icon: '👁️',
        effectType: 'stat_boost',
        effectValue: 5,
      },
    ],
  }, // Kanzler
  e: {
    unitType: 'e',
    talents: [
      {
        id: 'e_engelsfluegel',
        name: 'Engelsflügel',
        description: 'Engel-Schläge bringen Bonus-Gold beim Schlagen (+3 Gold pro Schlag).',
        tier: 1,
        reqLevel: 3,
        cost: 125,
        icon: '🪽',
        effectType: 'passive_gold',
        effectValue: 3,
      },
    ],
  }, // Engel
  j: {
    unitType: 'j',
    talents: [
      {
        id: 'j_spurwechsel',
        name: 'Spurwechsel',
        description: 'Nachtreiter-Schläge geben +5 XP pro Schlag.',
        tier: 1,
        reqLevel: 3,
        cost: 100,
        icon: '🐎',
        effectType: 'stat_boost',
        effectValue: 5,
      },
    ],
  }, // Nachtreiter
};
