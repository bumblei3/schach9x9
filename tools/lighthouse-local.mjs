#!/usr/bin/env node
/**
 * Lokale Lighthouse-Messung mit Median statt Einzellauf.
 *
 * Warum: der Performance-Score ist auf dieser Maschine bimodal — sechs Läufe
 * hintereinander auf einem identischen Build lieferten 0.81/4,6 s und
 * 0.97/2,0 s LCP. Ein Einzellauf ist deshalb keine Aussage. Dieses Skript
 * misst N Läufe und gibt Median plus Streuung aus, und kann damit einen
 * Vorher/Nachher-Vergleich tragen.
 *
 * Aufruf:
 *   node tools/lighthouse-local.mjs [url] [laeufe]
 *   node tools/lighthouse-local.mjs http://localhost:5050/ 5
 *
 * Voraussetzung: ein laufender Server (z. B. `npx http-server dist -p 5050 -s`)
 * und ein Chrome; das Skript nutzt CHROME_PATH, falls gesetzt.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://localhost:5050/';
const runs = Math.max(1, Number(process.argv[3] ?? 5) || 5);
const chrome =
  process.env.CHROME_PATH ??
  '/home/tobber/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';

const METRICS = [
  ['perf', d => d.categories.performance.score],
  ['FCP', d => d.audits['first-contentful-paint'].numericValue],
  ['LCP', d => d.audits['largest-contentful-paint'].numericValue],
  ['TTI', d => d.audits.interactive.numericValue],
  ['Boot', d => d.audits['bootup-time'].numericValue],
  [
    'Bytes',
    d =>
      (d.audits['total-byte-weight'].details.items ?? []).reduce(
        (sum, item) => sum + (item.totalBytes ?? 0),
        0
      ),
  ],
];

const dir = mkdtempSync(join(tmpdir(), 'lh-local-'));
const rows = [];

for (let i = 1; i <= runs; i++) {
  const out = join(dir, `r${i}.json`);
  execFileSync(
    'npx',
    [
      '-y',
      'lighthouse@latest',
      url,
      '--only-categories=performance',
      '--output=json',
      `--output-path=${out}`,
      `--chrome-flags=--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage`,
      '--quiet',
    ],
    { stdio: 'ignore', env: { ...process.env, CHROME_PATH: chrome } }
  );
  const lhr = JSON.parse(readFileSync(out, 'utf8'));
  const row = { run: i };
  for (const [name, pick] of METRICS) row[name] = pick(lhr);
  rows.push(row);
  console.log(
    `  ${i}/${runs}  perf=${row.perf}  LCP=${(row.LCP / 1000).toFixed(1)}s  ` +
      `Bytes=${(row.Bytes / 1024).toFixed(0)}KiB`
  );
}

rmSync(dir, { recursive: true, force: true });

const median = values => {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

console.log(`\n${url} — ${runs} Läufe`);
for (const [name] of METRICS) {
  const values = rows.map(r => r[name]);
  const unit = name === 'Bytes' ? 'KiB' : name === 'perf' ? '' : 's';
  const scale = name === 'Bytes' ? 1024 : name === 'perf' ? 1 : 1000;
  const fmt = v => `${(v / scale).toFixed(name === 'Bytes' ? 0 : 2)}${unit}`;
  console.log(
    `  ${name.padEnd(6)} median=${fmt(median(values))}  ` +
      `min=${fmt(Math.min(...values))}  max=${fmt(Math.max(...values))}`
  );
}
