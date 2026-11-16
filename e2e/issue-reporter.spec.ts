import { test, expect } from '@playwright/test';
import { domClick } from './helpers/E2EHelper.js';

test('settings issue reporter prefills a GitHub issue', async ({ page }) => {
  await page.goto('/?disable-sw');
  await page.waitForFunction(() => document.body.classList.contains('app-ready'));

  await page.evaluate(() => {
    const opened: string[] = [];
    (window as unknown as { __opened: string[] }).__opened = opened;
    window.open = (url?: string | URL) => {
      opened.push(String(url ?? ''));
      return { closed: false, focus() {} } as Window;
    };
  });

  await domClick(page, '.menu-tab-btn[data-tab="settings"]');
  await domClick(page, '#report-issue-btn');
  await expect(page.locator('#issue-report-overlay')).toBeVisible();

  await page.locator('#issue-report-open').click();
  await expect(page.locator('#issue-report-error')).toBeVisible();

  await domClick(page, '#issue-report-cancel');
  await expect(page.locator('#issue-report-overlay')).toBeHidden();

  await domClick(page, '.menu-tab-btn[data-tab="play"]');
  await domClick(page, '.gamemode-card[data-mode="classic"]');
  await page
    .locator('#modal-actions')
    .getByRole('button', { name: 'Sofort spielen', exact: true })
    .click();
  await expect(page.locator('#main-menu')).not.toHaveClass(/active/);
  await domClick(page, '#menu-btn');
  await domClick(page, '.menu-tab-btn[data-tab="settings"]');
  await domClick(page, '#report-issue-btn');
  await page.locator('#issue-report-summary').fill('Matt zählt nicht');
  await page.locator('#issue-report-detail').fill('Kapitel 19 erkennt das Matt nicht.');
  await page.locator('#issue-report-open').click();

  const url = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened[0]);
  expect(url).toContain('https://github.com/bumblei3/schach9x9/issues/new?');
  const decoded = decodeURIComponent(url.replace(/\+/g, ' '));
  expect(decoded).toContain('[Fehler] Matt zählt nicht');
  expect(decoded).toContain('Modus: classic');
  expect(decoded).toContain('Version: 2.0.0');
  await expect(page.locator('#issue-report-overlay')).toBeHidden();
});
