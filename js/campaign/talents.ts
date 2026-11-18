import { t, type I18nKey } from '../i18n.js';

export interface TalentNode {
  id: string;
  name: string;
  description: string;
  tier: number; // 1, 2, 3
  reqLevel: number; // tier 1: 3 (queen 4), tier 2: 5, tier 3: 7
  cost: number; // One-time gold cost or skill points (using Gold for now)
  icon: string;
  effectType: 'passive_gold' | 'stat_boost' | 'mechanic';
  effectValue?: number;
}

export interface UnitTalentTree {
  unitType: string; // 'p', 'n', 'b', 'r', 'q', 'k', 'a', 'c', 'e', 'j'
  talents: TalentNode[];
}

/**
 * Zuordnung Talent-ID → i18n-Schlüssel. Übersetzt wird erst beim Rendern; die
 * Talent-Daten selbst bleiben unangetastet.
 */
const TALENT_I18N_KEYS: Record<string, { name: I18nKey; description: I18nKey }> = {
  p_scavenger: { name: 'talent.p_scavenger.name', description: 'talent.p_scavenger.description' },
  p_marsch: { name: 'talent.p_marsch.name', description: 'talent.p_marsch.description' },
  p_veteran: { name: 'talent.p_veteran.name', description: 'talent.p_veteran.description' },
  n_sprungfeder: {
    name: 'talent.n_sprungfeder.name',
    description: 'talent.n_sprungfeder.description',
  },
  n_taktiker: { name: 'talent.n_taktiker.name', description: 'talent.n_taktiker.description' },
  n_meister: { name: 'talent.n_meister.name', description: 'talent.n_meister.description' },
  b_pfeilschnell: {
    name: 'talent.b_pfeilschnell.name',
    description: 'talent.b_pfeilschnell.description',
  },
  b_diagonal: { name: 'talent.b_diagonal.name', description: 'talent.b_diagonal.description' },
  b_lichtbringer: {
    name: 'talent.b_lichtbringer.name',
    description: 'talent.b_lichtbringer.description',
  },
  r_festung: { name: 'talent.r_festung.name', description: 'talent.r_festung.description' },
  r_belagerer: { name: 'talent.r_belagerer.name', description: 'talent.r_belagerer.description' },
  r_zitadelle: { name: 'talent.r_zitadelle.name', description: 'talent.r_zitadelle.description' },
  q_majestaet: { name: 'talent.q_majestaet.name', description: 'talent.q_majestaet.description' },
  q_inspiration: {
    name: 'talent.q_inspiration.name',
    description: 'talent.q_inspiration.description',
  },
  q_omnipraesenz: {
    name: 'talent.q_omnipraesenz.name',
    description: 'talent.q_omnipraesenz.description',
  },
  k_fuehrung: { name: 'talent.k_fuehrung.name', description: 'talent.k_fuehrung.description' },
  k_aura: { name: 'talent.k_aura.name', description: 'talent.k_aura.description' },
  k_koenig: { name: 'talent.k_koenig.name', description: 'talent.k_koenig.description' },
  a_gabelmeister: {
    name: 'talent.a_gabelmeister.name',
    description: 'talent.a_gabelmeister.description',
  },
  c_xrayauge: { name: 'talent.c_xrayauge.name', description: 'talent.c_xrayauge.description' },
  e_engelsfluegel: {
    name: 'talent.e_engelsfluegel.name',
    description: 'talent.e_engelsfluegel.description',
  },
  j_spurwechsel: {
    name: 'talent.j_spurwechsel.name',
    description: 'talent.j_spurwechsel.description',
  },
};

/** Übersetzter Talent-Name (Fallback: deutscher Quelltext). */
export function talentName(node: TalentNode): string {
  const e = TALENT_I18N_KEYS[node.id];
  return e ? t(e.name) : node.name;
}

/** Übersetzte Talent-Beschreibung (Fallback: deutscher Quelltext). */
export function talentDescription(node: TalentNode): string {
  const e = TALENT_I18N_KEYS[node.id];
  return e ? t(e.description) : node.description;
}

export const UNIT_TALENT_TREES: Record<string, UnitTalentTree> = {
  p: {
    unitType: 'p',
    talents: [
      {
        id: 'p_scavenger',
        name: 'Plünderer',
        description: 'Jedes Anwerbe-Kapitel beginnt mit einem Extra-Bauern.',
        tier: 1,
        reqLevel: 3,
        cost: 50,
        icon: '💰',
        effectType: 'mechanic',
        effectValue: 1,
      },
      {
        id: 'p_marsch',
        name: 'Marsch',
        description: 'Bauern-Schläge geben +3 XP (schnellere Unit-Levels).',
        tier: 2,
        reqLevel: 5,
        cost: 120,
        icon: '🚶',
        effectType: 'stat_boost',
        effectValue: 3,
      },
      {
        id: 'p_veteran',
        name: 'Veteran',
        description: 'Bauern-Schläge geben +5 XP.',
        tier: 3,
        reqLevel: 7,
        cost: 300,
        icon: '🎖️',
        effectType: 'stat_boost',
        effectValue: 5,
      },
    ],
  },
  n: {
    unitType: 'n',
    talents: [
      {
        id: 'n_sprungfeder',
        name: 'Sprungfeder',
        description:
          'Jedes Anwerbe-Kapitel beginnt mit einem Extra-Springer. Springer-Schläge geben +5 XP.',
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
        description:
          'Springer-Schläge bringen +2 Gold. Jedes Anwerbe-Kapitel startet mit +5 Budget.',
        tier: 2,
        reqLevel: 5,
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
        reqLevel: 7,
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
        description: 'Läufer-Schläge bringen +2 Gold. Im Anwerbe-Shop kostet der Läufer 2 Punkte.',
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
        reqLevel: 5,
        cost: 150,
        icon: '♝',
        effectType: 'stat_boost',
        effectValue: 5,
      },
      {
        id: 'b_lichtbringer',
        name: 'Lichtbringer',
        description: 'Läufer-Schläge bringen +4 Gold.',
        tier: 3,
        reqLevel: 7,
        cost: 300,
        icon: '✨',
        effectType: 'passive_gold',
        effectValue: 4,
      },
    ],
  },
  r: {
    unitType: 'r',
    talents: [
      {
        id: 'r_festung',
        name: 'Festung',
        description: 'Turm-Schläge geben +5 XP. Im Anwerbe-Shop kostet der Turm 3 Punkte.',
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
        reqLevel: 5,
        cost: 175,
        icon: '⚔️',
        effectType: 'passive_gold',
        effectValue: 3,
      },
      {
        id: 'r_zitadelle',
        name: 'Zitadelle',
        description: 'Turm-Schläge geben +8 XP.',
        tier: 3,
        reqLevel: 7,
        cost: 325,
        icon: '🛡️',
        effectType: 'stat_boost',
        effectValue: 8,
      },
    ],
  },
  q: {
    unitType: 'q',
    talents: [
      {
        id: 'q_majestaet',
        name: 'Majestät',
        description: 'Damen-Schläge bringen +4 Gold. Im Anwerbe-Shop kostet die Dame 7 Punkte.',
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
        reqLevel: 5,
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
        reqLevel: 7,
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
        reqLevel: 5,
        cost: 160,
        icon: '🌟',
        effectType: 'passive_gold',
        effectValue: 2,
      },
      {
        id: 'k_koenig',
        name: 'König',
        description: 'König-Schläge geben +8 XP.',
        tier: 3,
        reqLevel: 7,
        cost: 320,
        icon: '👑',
        effectType: 'stat_boost',
        effectValue: 8,
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
        description: 'Erzbischof-Schläge bringen Bonus-Gold beim Schlagen (+2 Gold pro Schlag).',
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
