/**
 * Puzzletexte sind zweisprachig — die Datenfelder bleiben deutsche Quelle,
 * übersetzt wird an der Setzstelle (`puzzleTitle`/`puzzleDescription`/
 * `puzzleDifficultyText`).
 *
 * Warum ein eigener Spec: der i18n-Audit sieht nur Struktur (Marker, `t()`,
 * Literal-Maps), nicht ob die englischen Werte sich von den deutschen
 * unterscheiden. Genau das prüft dieser Test für die Puzzle-Gruppe.
 */
import { describe, test, expect, afterEach } from 'vitest';
import { puzzleManager, puzzleTitle, puzzleDescription, puzzleDifficultyText } from '../../js/puzzleManager.js';
import { setLocale, getLocale } from '../../js/i18n.js';

afterEach(() => {
  setLocale('de');
});

describe('Puzzletexte i18n', () => {
  const statisch = puzzleManager.puzzles.find((p) => p.id === 'mate-in-1-001')!;
  const prozedural = {
    id: 'proc-1-0',
    title: 'Generiert: Matt in 2',
    description: 'Weiß am Zug. Finde das Matt in 2 Zügen.',
    difficulty: 'Mittel',
    solution: [],
    generated: true,
    mateIn: 2,
  };

  test('deutsche Quellsprache bleibt unverändert', () => {
    expect(puzzleTitle(statisch)).toBe('Puzzle 1: Der Gnadenstoß');
    expect(puzzleDescription(statisch)).toBe('Weiß zieht und setzt in 1 Zug matt.');
    expect(puzzleTitle(prozedural)).toBe('Generiert: Matt in 2');
    expect(puzzleDescription(prozedural)).toBe('Weiß am Zug. Finde das Matt in 2 Zügen.');
  });

  test('englische Ausgabe unterscheidet sich wirklich', () => {
    setLocale('en');
    expect(getLocale()).toBe('en');
    expect(puzzleTitle(statisch)).toBe('Puzzle 1: The Death Blow');
    expect(puzzleDescription(statisch)).toBe('White to move and mate in 1.');
    expect(puzzleTitle(prozedural)).toBe('Generated: Mate in 2');
    expect(puzzleDescription(prozedural)).toBe('White to move. Find mate in 2 moves.');
  });

  test('Schwierigkeitslabels je Sprache', () => {
    expect(puzzleDifficultyText('Einfach')).toBe('Einfach');
    expect(puzzleDifficultyText('Mittel')).toBe('Mittel');
    expect(puzzleDifficultyText('Schwer')).toBe('Schwer');
    setLocale('en');
    expect(puzzleDifficultyText('Einfach')).toBe('Easy');
    expect(puzzleDifficultyText('Mittel')).toBe('Medium');
    expect(puzzleDifficultyText('Schwer')).toBe('Hard');
    // Unbekannte Werte werden nicht verfälscht.
    expect(puzzleDifficultyText('Leicht')).toBe('Leicht');
  });

  test('jedes statische Puzzle ist in beiden Sprachen übersetzt', () => {
    setLocale('en');
    for (const p of puzzleManager.puzzles) {
      expect(puzzleTitle(p), `Titel ${p.id}`).not.toBe('');
      expect(puzzleDescription(p), `Beschreibung ${p.id}`).not.toBe('');
      expect(puzzleTitle(p), `Titel ${p.id} soll sich unterscheiden`).not.toBe(p.title);
      expect(puzzleDescription(p), `Beschreibung ${p.id} soll sich unterscheiden`).not.toBe(p.description);
    }
  });
});
