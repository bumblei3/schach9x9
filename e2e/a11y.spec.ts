import { test, expect, Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { domClick } from './helpers/E2EHelper.js';

/**
 * A11y-Gate gegen die gebaute Live-Seite.
 *
 * Warum ein eigener Spec und nicht nur die Unit-Snapshots: Die Unit-Snapshots
 * prüfen `innerHTML`, aber ob eine `role`-Zuordnung im Accessibility-Tree
 * überhaupt ankommt (aria-required-children/parent, Landmarks, heading-order),
 * sieht nur der Browser. Die Befunde, die diesen Spec weitergaben, stammten
 * aus genau einer Axe-Auffahrt: 81 gridcells ohne role="row"-Ebene, ein
 * inaktives #main-menu im Tree, eine display:none-H1, h1→h3-Überschritte.
 *
 * Tags: WCAG 2.0 A/AA, 2.1 A/AA plus best-practice.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] as const;

async function scan(
  page: Page
): Promise<{ id: string; impact: string; help: string; nodes: number }[]> {
  const r = await new AxeBuilder({ page }).withTags([...TAGS]).analyze();
  return r.violations.map(v => ({
    id: v.id,
    impact: v.impact ?? 'n/a',
    help: v.help,
    nodes: v.nodes.length,
  }));
}

function format(violations: { id: string; impact: string; help: string; nodes: number }[]): string {
  return violations.map(v => `  - ${v.id} [${v.impact}] ${v.help} (${v.nodes} Knoten)`).join('\n');
}

async function startClassic(page: Page): Promise<void> {
  await page.locator('[data-mode="classic"]').click();
  await page.waitForSelector('#modal-actions');
  await page.locator('#modal-actions').getByRole('button', { name: 'Sofort spielen' }).click();
  await page.waitForFunction(() => document.querySelectorAll('#board .cell').length > 0);
}

test.describe('A11y @a11y', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?disable-sw');
    await page.waitForSelector('#board');
    await page.waitForFunction(() => document.body.classList.contains('app-ready'));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => document.fonts.ready);
  });

  test('Menü', async ({ page }) => {
    const v = await scan(page);
    expect(v, format(v)).toEqual([]);
  });

  test('Partie', async ({ page }) => {
    await startClassic(page);

    const v = await scan(page);
    expect(v, format(v)).toEqual([]);
  });

  test('Overflow-Menü', async ({ page }) => {
    await startClassic(page);
    await domClick(page, '#action-more-btn');
    await expect(page.locator('#action-overflow-menu')).not.toHaveClass(/hidden/);

    const v = await scan(page);
    expect(v, format(v)).toEqual([]);
  });

  test('Analyse-Panel', async ({ page }) => {
    await startClassic(page);
    await domClick(page, '#toggle-analysis-btn');
    await expect(page.locator('#analysis-panel')).not.toHaveClass(/hidden/, { timeout: 20000 });

    const v = await scan(page);
    expect(v, format(v)).toEqual([]);
  });

  test('Einstellungen', async ({ page }) => {
    await page.locator('.menu-tab-btn[data-tab="settings"]').click();
    await expect(page.locator('#view-settings')).toBeVisible();

    const v = await scan(page);
    expect(v, format(v)).toEqual([]);
  });

  test('Mehr-Modi-Grid', async ({ page }) => {
    // Unter navigator.webdriver klappt der Toggle schon beim Laden auf
    // (E2E-Erreichbarkeit) — dann wäre ein Klick ein Zuklappen.
    const toggle = page.locator('#toggle-more-modes');
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
      await toggle.click();
    }
    await expect(page.locator('#more-modes-grid')).toBeVisible();

    const v = await scan(page);
    expect(v, format(v)).toEqual([]);
  });

  test('Menü-Overlay über der Partie', async ({ page }) => {
    await startClassic(page);
    await domClick(page, '#menu-btn');
    await expect(page.locator('#main-menu')).toHaveClass(/active/);

    const v = await scan(page);
    expect(v, format(v)).toEqual([]);
  });
});
