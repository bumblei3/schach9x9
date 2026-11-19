import { test, expect, type Page } from '@playwright/test';
import { CAMPAIGN_LEVELS } from '../js/campaign/campaignData.js';

/**
 * E2E-Smoke über jedes Kampagnen-Kapitel.
 *
 * M2.1 in `docs/ROADMAP.md` verlangte je Kapitel „einzigartige FEN,
 * Persönlichkeit, 2★/3★-Ziele, E2E-Smoke". Die E2E-Seite blieb bei zwei
 * Kapiteln stehen (`campaign.spec.ts` startet Kapitel 1 und 4); von den 25
 * Kapiteln war keins dauerhaft gegen Regressionen gedeckt — weder FEN noch
 * Persönlichkeit noch dass der Level überhaupt startet.
 *
 * Zwei Ebenen:
 *
 *  1. Struktur-Invariante (ein Test): jedes Kapitel in `CAMPAIGN_LEVELS`
 *     trägt FEN, `opponentPersonality` und 2★/3★-Ziele. Das ist die
 *     M2.1-Akzeptanz, die bislang nur behauptet war.
 *  2. Lauf (ein Test pro Kapitel): der Level wird über
 *     `App.startCampaignLevel(id)` gestartet — derselbe Pfad wie der Klick
 *     auf die Kapitel-Karte in `CampaignUI` — und das Ergebnis an vier
 *     Stellen geprüft, an denen ein Authoring-Fehler brechen würde.
 *
 * Bewusst nicht geprüft: ob jedes Kapitel gewinnbar ist. Das wäre ein
 * Solver-Lauf pro Kapitel und ein anderes Stück Arbeit.
 */

const LEVELS = CAMPAIGN_LEVELS;

test.describe('Kampagnen-Struktur', () => {
  test('jedes Kapitel trägt FEN, Persönlichkeit und 2★/3★-Ziele', () => {
    expect(LEVELS.length, 'Kampagne ohne Kapitel').toBeGreaterThan(20);

    const defekte = LEVELS.filter(l => {
      const hatFen = typeof l.fen === 'string' && l.fen.length > 0;
      const hatPersoenlichkeit = !!l.opponentPersonality;
      const ziele = Object.keys(l.goals ?? {});
      const hatZwei = ziele.includes('2');
      const hatDrei = ziele.includes('3');
      return !(hatFen && hatPersoenlichkeit && hatZwei && hatDrei);
    }).map(l => l.id);

    expect(
      defekte,
      `Kapitel ohne FEN/Persönlichkeit/2★/3★: ${defekte.join(', ')}`
    ).toEqual([]);
  });

  test('Kapitel-IDs sind eindeutig', () => {
    const ids = LEVELS.map(l => l.id);
    expect(new Set(ids).size, 'doppelte Kapitel-ID').toBe(ids.length);
  });
});

test.describe('Kampagnen-Smoke über alle Kapitel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?disable-sw');
    await page.waitForFunction(() => document.body.classList.contains('app-ready'));
    await expect(page.locator('#main-menu')).toBeVisible();
  });

  for (const level of LEVELS) {
    test(`Kapitel "${level.id}" startet mit FEN und Persönlichkeit`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() !== 'error') return;
        if (/Failed to load resource/i.test(msg.text())) return;
        errors.push(msg.text());
      });
      page.on('pageerror', err => errors.push(err.message));

      const stand = await page.evaluate(async (levelId: string) => {
        const app = (window as any).app;
        // `App.startCampaignLevel` erzeugt den Controller bei Bedarf (vorher
        // war er null, solange kein Spiel gestartet war) und leitet an
        // `GameController.startCampaignLevel` weiter — derselbe Pfad wie der
        // Klick auf die Kapitel-Karte in `CampaignUI`.
        await app.startCampaignLevel(levelId);
        const game = app.game;
        let pieces = 0;
        for (const row of game.board) {
          for (const cell of row) {
            if (cell) pieces++;
          }
        }
        return {
          boardSize: game.board.length,
          pieces,
          personality: game.aiPersonality,
          currentLevelId: game.currentLevelId,
          campaignMode: game.campaignMode,
        };
      }, level.id);

      expect(stand.currentLevelId, `${level.id}: currentLevelId nicht gesetzt`).toBe(level.id);
      expect(stand.campaignMode, `${level.id}: campaignMode nicht aktiv`).toBe(true);
      expect(stand.boardSize, `${level.id}: Brettgröße`).toBeGreaterThanOrEqual(8);
      expect(stand.pieces, `${level.id}: FEN erzeugte keine Figuren`).toBeGreaterThan(0);
      // Die Persönlichkeit muss der Kapitel-Angabe entsprechen, nicht der
      // Default `'balanced'`. `level` kommt aus dem Node-Import, `stand` aus
      // dem Vite-Bundle im Browser — zwei Laufzeitumgebungen derselben
      // Quelldatei. Fällt die Übernahme in `CampaignMode` weg, wird
      // `stand.personality` zum Default und der Test rot (gegenproebelt:
      // 30/32 rot). Acht Kapitel sind legitimerweise `'balanced'`, darum
      // vergleicht der Test gegen den Kapitel-Wert und nicht gegen "nicht
      // balanced".
      expect(
        stand.personality,
        `${level.id}: Kapitel-Persönlichkeit wurde nicht übernommen`
      ).toBe(level.opponentPersonality);
      expect(errors, `${level.id}: Konsolenfehler\n${errors.join('\n')}`).toHaveLength(0);
    });
  }
});
