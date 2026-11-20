/**
 * Boot-Zeitmessung unter realistischer Netzwerk- und CPU-Drosselung.
 *
 * Hintergrund: die Lighthouse-Messung auf dieser Maschine ist bimodal — LCP
 * mal 1,5 s, mal 4,85 s bei identischem Build. Ein Einzelwert traegt also
 * keine Aussage. Dieses Skript trennt die beiden Faktoren, die LCP bestimmen:
 *
 *   1. Ausfuehrungszeit der App      -> `node tools/boot-timing.mjs <url> 10`
 *   2. Transferzeit (slow 4G)        -> `... --netzwerk`
 *
 * Misst je Lauf: domContentLoaded, erste Menue-Karte, loadEvent, LCP, Bytes.
 * Das Brett (#board) ist auf der Startseite leer — es wird erst beim
 * Partiestart gefuellt, darum ist die Menue-Karte der Messpunkt.
 */
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const netzwerk = args.includes('--netzwerk');
const rest = args.filter(a => a !== '--netzwerk');
const url = rest[0] ?? 'http://localhost:8080/';
const runs = Math.max(1, Number(rest[1] ?? 10) || 10);

// Slow 4G, vergleichbar mit Lighthouse-Standard.
const NET = {
  offline: false,
  latency: 150,
  downloadThroughput: 200 * 1024,
  uploadThroughput: 100 * 1024,
};

// Der Playwright-Default sucht den headless-shell-Build des jeweils
// installierten Playwright; auf dieser Maschine liegt nur chromium-1248.
const executablePath =
  process.env.CHROME_PATH ?? '/home/tobber/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath });
const rows = [];

for (let i = 1; i <= runs; i++) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  if (netzwerk) await cdp.send('Network.emulateNetworkConditions', NET);

  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const dcl = Date.now() - t0;

  // Erster sichtbarer Inhalt der Startseite: die Menue-Karten.
  await page.waitForFunction(
    () => document.querySelectorAll('#main-menu .gamemode-card').length > 0,
    null,
    { timeout: 60000 }
  );
  const menueMs = Date.now() - t0;

  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    let lcp = 0;
    for (const e of performance.getEntriesByType('largest-contentful-paint')) {
      lcp = Math.max(lcp, e.startTime);
    }
    return {
      domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : 0,
      load: nav ? Math.round(nav.loadEventEnd) : 0,
      lcp: Math.round(lcp),
      bytes: performance
        .getEntriesByType('resource')
        .reduce((s, r) => s + (r.transferSize || r.encodedBodySize || 0), 0),
    };
  });

  rows.push({ lauf: i, menueMs, dcl, ...m });
  await context.close();
  console.log(
    `  ${i}/${runs}  menue=${menueMs}ms  dcl=${dcl}ms  lcp=${m.lcp}ms  load=${m.load}ms  ${Math.round(m.bytes / 1024)}KiB`
  );
}

await browser.close();

const zahlen = f => rows.map(f).filter(v => typeof v === 'number').sort((a, b) => a - b);
const median = a => (a.length ? a[Math.floor(a.length / 2)] : 0);
const zeile = (name, a) =>
  a.length
    ? `  ${name.padEnd(16)} median=${median(a)}ms  min=${a[0]}ms  max=${a[a.length - 1]}ms`
    : `  ${name.padEnd(16)} —`;

console.log(
  `\n${url} — ${runs} Läufe, CPU 4x${netzwerk ? ', Netzwerk slow-4G' : ', keine Netzwerkdrosselung'}`
);
console.log(zeile('menue', zahlen(r => r.menueMs)));
console.log(zeile('domContentLoaded', zahlen(r => r.domContentLoaded)));
console.log(zeile('LCP', zahlen(r => r.lcp)));
console.log(zeile('load', zahlen(r => r.load)));
console.log(zeile('Bytes (KiB)', zahlen(r => Math.round(r.bytes / 1024))));
