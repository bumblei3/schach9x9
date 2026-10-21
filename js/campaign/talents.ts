export interface TalentNode {
  id: string;
  name: string;
  description: string;
  tier: number; // 1, 2, 3
  reqLevel: number; // e.g. 3, 7, 10
  cost: number; // One-time gold cost or skill points (using Gold for now)
  icon: string;
  effectType: 'passive_gold' | 'stat_boost' | 'mechanic';
  effectValue?: number;
}

export interface UnitTalentTree {
  unitType: string; // 'p', 'n', 'b', 'r', 'q', 'k', 'a', 'c', 'e', 'j'
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
        id: 'p_marsch',
        name: 'Marsch',
        description: 'Bauern-Schläge geben +3 XP (schnellere Unit-Levels).',
        tier: 2,
        reqLevel: 7,
        cost: 120,
        icon: '🚶',
        effectType: 'stat_boost',
        effectValue: 3,
      },
      {
        id: 'p_veteran',
        name: 'Veteran',
        description: 'Bauern-Schläge geben +2 XP.',
        tier: 3,
        reqLevel: 10,
        cost: 300,
        icon: '🎖️',
        effectType: 'stat_boost',
        effectValue: 2,
      },
    ],
  },
  n: {
    unitType: 'n',
    talents: [
      {
        id: 'n_sprungfeder',
        name: 'Sprungfeder',
        description: 'Springer-Schläge geben +5 XP (schnellere Unit-Levels).',
        tier: 1,
        reqLevel: 3,
        cost: 80,
        icon: '🦘',
        effectType: 'stat_boost',
        effectValue: 5,
      },
      {
        id: 'n_taktiker',
        name: 'Taktiker',
        description: 'Springer-Schläge bringen +2 Gold.',
        tier: 2,
        reqLevel: 7,
        cost: 150,
        icon: '♟️',
        effectType: 'passive_gold',
        effectValue: 2,
      },
      {
        id: 'n_meister',
        name: 'Springermeister',
        description: 'Springer erhalten +10% XP aus allen Quellen.',
        tier: 3,
        reqLevel: 10,
        cost: 300,
        icon: '♞',
        effectType: 'stat_boost',
        effectValue: 10,
      },
    ],
  },
  b: {
    unitType: 'b',
    talents: [
      {
        id: 'b_pfeilschnell',
        name: 'Pfeilschnell',
        description: 'Läufer-Schläge bringen +2 Gold.',
        tier: 1,
        reqLevel: 3,
        cost: 80,
        icon: '🏹',
        effectType: 'passive_gold',
        effectValue: 2,
      },
      {
        id: 'b_diagonal',
        name: 'Diagonalblick',
        description: 'Läufer-Schläge geben +5 XP.',
        tier: 2,
        reqLevel: 7,
        cost: 150,
        icon: '♝',
        effectType: 'stat_boost',
        effectValue: 5,
      },
      {
        id: 'b_lichtbringer',
        name: 'Lichtbringer',
        description: 'Läufer-Schläge bringen +2 Gold.',
        tier: 3,
        reqLevel: 10,
        cost: 300,
        icon: '✨',
        effectType: 'passive_gold',
        effectValue: 2,
      },
    ],
  },
  r: {
    unitType: 'r',
    talents: [
      {
        id: 'r_festung',
        name: 'Festung',
        description: 'Turm-Schläge geben +5 XP.',
        tier: 1,
        reqLevel: 3,
        cost: 90,
        icon: '🏰',
        effectType: 'stat_boost',
        effectValue: 5,
      },
      {
        id: 'r_belagerer',
        name: 'Belagerer',
        description: 'Turm-Schläge bringen +3 Gold.',
        tier: 2,
        reqLevel: 7,
        cost: 175,
        icon: '⚔️',
        effectType: 'passive_gold',
        effectValue: 3,
      },
      {
        id: 'r_zitadelle',
        name: 'Zitadelle',
        description: 'Turm-Schläge geben +4 XP.',
        tier: 3,
        reqLevel: 10,
        cost: 325,
        icon: '🛡️',
        effectType: 'stat_boost',
        effectValue: 4,
      },
    ],
  },
  q: {
    unitType: 'q',
    talents: [
      {
        id: 'q_majestaet',
        name: 'Majestät',
        description: 'Damen-Schläge bringen +4 Gold.',
        tier: 1,
        reqLevel: 4,
        cost: 120,
        icon: '👑',
        effectType: 'passive_gold',
        effectValue: 4,
      },
      {
        id: 'q_inspiration',
        name: 'Inspiration',
        description: 'Damen-Schläge geben +5 XP.',
        tier: 2,
        reqLevel: 8,
        cost: 200,
        icon: '💫',
        effectType: 'stat_boost',
        effectValue: 5,
      },
      {
        id: 'q_omnipraesenz',
        name: 'Omnipräsenz',
        description: 'Dame erhält +10% XP aus allen Quellen.',
        tier: 3,
        reqLevel: 11,
        cost: 400,
        icon: '♛',
        effectType: 'stat_boost',
        effectValue: 10,
      },
    ],
  },
  k: {
    unitType: 'k',
    talents: [
      {
        id: 'k_fuehrung',
        name: 'Führung',
        description: 'König-Schläge geben +5 XP.',
        tier: 1,
        reqLevel: 3,
        cost: 90,
        icon: '♚',
        effectType: 'stat_boost',
        effectValue: 5,
      },
      {
        id: 'k_aura',
        name: 'Aura',
        description: 'König-Schläge bringen +2 Gold.',
        tier: 2,
        reqLevel: 7,
        cost: 160,
        icon: '🌟',
        effectType: 'passive_gold',
        effectValue: 2,
      },
      {
        id: 'k_koenig',
        name: 'König',
        description: 'König-Schläge geben +4 XP.',
        tier: 3,
        reqLevel: 10,
        cost: 320,
        icon: '👑',
        effectType: 'stat_boost',
        effectValue: 4,
      },
    ],
  },
  // Add basic defaults for others to avoid errors
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
