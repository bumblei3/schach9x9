/**
 * Dynamische i18n — Game-over-Durchlauf.
 *
 * Die Schale (`data-i18n`) ist abgedeckt durch `tests/i18n.test.ts` und
 * `e2e/i18n.spec.ts`. Dieser Spec prüft den zweiten Schwung: Texte, die die
 * App zur Laufzeit per `t()` setzt (Statuspille, Sieger-Zeile, Modals).
 *
 * Relevant, weil `applyI18n` nur einmal beim Boot/`setLocale` läuft — ein
 * dynamisch gesetzter Text bliebe sonst deutsch, egal welche Sprache gilt.
 */
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { setLocale, getLocale, de, en } from '../js/i18n.js';

const { updateStatus } = await import('../js/ui/GameStatusUI.js');

function gameWith(phase: string, turn: 'white' | 'black', winner?: 'white' | 'black' | 'draw') {
  return {
    phase,
    turn,
    winner: winner ?? null,
    moveHistory: [],
    board: [],
    isInCheck: () => false,
  } as never;
}

describe('dynamische Texte (Game-over-Durchlauf)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="status-display"></div>';
  });

  afterEach(() => {
    setLocale('de');
  });

  test('de ist der Quelltext', () => {
    setLocale('de');
    updateStatus(gameWith('GAME_OVER', 'black', 'white'));
    expect(document.getElementById('status-display')!.textContent).toBe(
      'Spiel vorbei! Weiß hat gewonnen!'
    );
  });

  test('en schaltet die Statuspille um', () => {
    setLocale('en');
    updateStatus(gameWith('GAME_OVER', 'black', 'white'));
    expect(document.getElementById('status-display')!.textContent).toBe(
      'Game over! White has won!'
    );
  });

  test('Unentschieden und Zuganzeige sind ebenfalls zweisprachig', () => {
    setLocale('en');
    updateStatus(gameWith('GAME_OVER', 'white', 'draw'));
    expect(document.getElementById('status-display')!.textContent).toBe('Game over! Draw.');

    updateStatus(gameWith('PLAY', 'black'));
    expect(document.getElementById('status-display')!.textContent).toBe(
      'Game in progress - Black to move'
    );

    setLocale('de');
    updateStatus(gameWith('PLAY', 'black'));
    expect(document.getElementById('status-display')!.textContent).toBe(
      'Spiel läuft - Schwarz am Zug'
    );
  });

  test('toast-Schlüssel sind tatsächlich übersetzt', () => {
    const toastKeys = Object.keys(de).filter(k => k.startsWith('toast.'));
    expect(toastKeys.length).toBeGreaterThan(20);
    // `undo`/`redo` sind in beiden Sprachen gleich, der Emergency-Text ist
    // bewusst englisch — der Rest muss sich unterscheiden, sonst hätte das
    // Kopieren des Deutschen nach Englisch kein Effekt.
    const identical = new Set(['toast.undo', 'toast.redo', 'toast.emergencyRecovery']);
    for (const k of toastKeys) {
      if (identical.has(k)) continue;
      expect(en[k as keyof typeof en], k).not.toBe(de[k as keyof typeof de]);
    }
  });

  test('die Wahl bleibt persistent und wird sofort angewendet', () => {
    setLocale('en');
    expect(getLocale()).toBe('en');
    updateStatus(gameWith('GAME_OVER', 'white', 'black'));
    expect(document.getElementById('status-display')!.textContent).toBe(
      'Game over! Black has won!'
    );
    // Der Sprachschalter rendert die Statuspille sofort neu (DOMHandler).
    setLocale('de');
    updateStatus(gameWith('GAME_OVER', 'white', 'black'));
    expect(document.getElementById('status-display')!.textContent).toBe(
      'Spiel vorbei! Schwarz hat gewonnen!'
    );
  });
});
