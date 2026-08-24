// Rank DOM-free logic modules by lowest branch%/statement% from v8 coverage-final.json
const fs = require('fs');
const cov = JSON.parse(fs.readFileSync('/home/tobber/schach9x9/coverage/coverage-final.json', 'utf8'));

function pct(covMap, countMap) {
  let total = 0, hit = 0;
  for (const k of Object.keys(covMap)) {
    const v = countMap[k];
    const counts = Array.isArray(v) ? v : [v];
    total += counts.length;
    hit += counts.filter((c) => c > 0).length;
  }
  return total === 0 ? null : [hit, total];
}

const rows = [];
for (const [path, file] of Object.entries(cov)) {
  if (!path.includes('/js/') || path.includes('node_modules')) continue;
  const s = pct(file.statementMap, file.s);
  const b = pct(file.branchMap, file.b);
  const f = pct(file.fnMap, file.f);
  if (!s || !b) continue;
  const sPct = 100 * s[0] / s[1], bPct = 100 * b[0] / b[1];
  // skip trivial files and known UI/3D renderers
  if (/Renderer|3[dD]|battleChess|ui\.ts$|\/ui\//.test(path)) continue;
  if (s[1] < 20 && b[1] < 10) continue; // too small to matter
  rows.push({ path: path.replace('/home/tobber/schach9x9/', ''), sPct, bPct, st: s[1], bt: b[1] });
}
rows.sort((a, c) => (a.bPct + a.sPct) / 2 - (c.bPct + c.sPct) / 2);
for (const r of rows.slice(0, 25)) {
  console.log(`${r.bPct.toFixed(1).padStart(5)}% B ${r.sPct.toFixed(1).padStart(5)}% S  (${r.bt}b/${r.st}s) ${r.path}`);
}
