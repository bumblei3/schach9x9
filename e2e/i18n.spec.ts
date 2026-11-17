import { test, expect } from '@playwright/test';

/**
 * Sprachumschaltung (Pilot: statische UI-Schale).
 *
 * Die deutschen Texte stehen im Markup, `applyI18n` schreibt auch für `de`,
 * damit eine Rückschaltung nicht am überschriebenen Englischen hängenbleibt.
 * Der deutschsprachige Standard muss deshalb unverändert bleiben — das prüft
 * dieser Spec zusätzlich zur Umschaltung.
 *
 * Bewusst kein `addInitScript`, das `chess_locale` löscht: das liefe auf jeder
 * Navigation und hätte den Reload-Test genau dann gescheitert, wenn die
 * Persistenz funktioniert. Der Speicherstand (`e2e/.storageState.json`) enthält
 * den Schlüssel ohnehin nicht, also startet ein neuer Kontext deutsch.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.body.classList.contains('app-ready'), {
    timeout: 20000,
  });
});

test('Standard ist Deutsch, Englisch hält einen Reload über', async ({ page }) => {
  await expect(page.locator('#menu-btn')).toHaveAttribute('aria-label', 'Menü öffnen');
  await expect(page.locator('#view-play .section-title')).toHaveText('Neues Spiel');

  await page.locator('.menu-tab-btn[data-tab="settings"]').click();
  await page.selectOption('#language-select', 'en');

  await expect(page.locator('#menu-btn')).toHaveAttribute('aria-label', 'Open menu');
  await expect(page.locator('#view-play .section-title')).toHaveText('New game');
  await expect(page.locator('#view-play .gamemode-card').first().locator('.card-title')).toHaveText(
    'Continue'
  );
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.reload();
  await page.waitForFunction(() => document.body.classList.contains('app-ready'), {
    timeout: 20000,
  });
  await expect(page.locator('#menu-btn')).toHaveAttribute('aria-label', 'Open menu');
  await expect(page.locator('#view-play .section-title')).toHaveText('New game');
});

test('Rückschaltung auf Deutsch', async ({ page }) => {
  await page.locator('.menu-tab-btn[data-tab="settings"]').click();
  await page.selectOption('#language-select', 'en');
  await expect(page.locator('#menu-btn')).toHaveAttribute('aria-label', 'Open menu');

  await page.selectOption('#language-select', 'de');
  await expect(page.locator('#menu-btn')).toHaveAttribute('aria-label', 'Menü öffnen');
  await expect(page.locator('#view-play .section-title')).toHaveText('Neues Spiel');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
});
