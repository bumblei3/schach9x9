#!/usr/bin/env node
/**
 * Generate CHANGELOG.md from git history since the last version tag.
 *
 * Uses Conventional Commits: groups entries by type (feat/fix/ci/...).
 * The current version is read from package.json; the previous released
 * version is derived from the most recent `v*` tag.
 *
 * Usage:
 *   node scripts/changelog.mjs            # rewrite CHANGELOG.md in place
 *   node scripts/changelog.mjs --dry-run  # print to stdout, no file write
 *
 * No external dependencies, no network. Pure child_process + fs.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function run(args, opts = {}) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opts }).trim();
}

function readPkgVersion() {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
  return pkg.version || '0.0.0';
}

// Find the most recent version tag (vX.Y.Z[-suffix]). Returns null if none.
function lastVersionTag() {
  try {
    const tags = run(['tag', '--list', 'v*.*.*', '--sort=-v:refname']).split('\n').filter(Boolean);
    return tags[0] ?? null;
  } catch {
    return null;
  }
}

// Conventional commit types -> changelog section headers (ordered).
const SECTIONS = [
  ['feat', 'Features'],
  ['fix', 'Bug Fixes'],
  ['perf', 'Performance'],
  ['security', 'Security'],
  ['revert', 'Reverts'],
  ['docs', 'Documentation'],
  ['refactor', 'Refactoring'],
  ['test', 'Tests'],
  ['build', 'Build'],
  ['ci', 'CI / Automation'],
  ['chore', 'Chores'],
  ['style', 'Style'],
  ['wip', 'Work in Progress'],
];
const TYPE_ORDER = new Map(SECTIONS.map(([t], i) => [t, i]));
const TYPE_LABEL = new Map(SECTIONS);

// Parse "type(scope): subject" -> { type, scope, subject }
function parseCommit(line) {
  const m = line.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);
  if (!m) return { type: 'chore', scope: null, subject: line.trim() };
  return { type: m[1], scope: m[2] ?? null, subject: m[3].trim() };
}

function collectCommits(range) {
  // %H %s  -> hash + subject
  const raw = run(['log', '--no-merges', '--pretty=format:%H %s', range]);
  if (!raw) return [];
  return raw.split('\n').map(l => {
    const sp = l.indexOf(' ');
    const hash = l.slice(0, sp);
    const subject = l.slice(sp + 1);
    return { hash, ...parseCommit(subject) };
  });
}

function buildSection(entries) {
  return entries
    .sort((a, b) => (a.scope || '').localeCompare(b.scope || ''))
    .map(e => {
      const scope = e.scope ? `**${e.scope}:** ` : '';
      return `- ${scope}${e.subject} (${e.hash.slice(0, 7)})`;
    })
    .join('\n');
}

function generate({ version, prevTag, entries, date }) {
  // Group by type, preserving known order; unknown types go under Chores.
  const grouped = new Map();
  for (const e of entries) {
    const key = TYPE_ORDER.has(e.type) ? e.type : 'chore';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(e);
  }

  const sectionKeys = [...grouped.keys()].sort((a, b) => {
    const ia = TYPE_ORDER.get(a) ?? 99;
    const ib = TYPE_ORDER.get(b) ?? 99;
    return ia - ib;
  });

  const body = sectionKeys
    .map(k => `### ${TYPE_LABEL.get(k) || 'Chores'}\n\n${buildSection(grouped.get(k))}`)
    .join('\n\n');

  const rangeNote = prevTag ? `Changes since \`${prevTag}\`.` : 'Initial changelog.';
  return `# Changelog

Alle nennenswerten Änderungen an Schach 9x9. Versionierung folgt [SemVer](https://semver.org/lang/de/).
Generiert aus den Git-Commits via \`npm run changelog\`.

## [${version}] – ${date}

${rangeNote}

${body}
`;
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const version = readPkgVersion();
  const prevTag = lastVersionTag();
  const range = prevTag ? `${prevTag}..HEAD` : 'HEAD';
  const entries = collectCommits(range);
  const date = new Date().toISOString().slice(0, 10);

  const content = generate({ version, prevTag, entries, date });

  if (dryRun) {
    process.stdout.write(content);
    return;
  }
  writeFileSync(resolve(ROOT, 'CHANGELOG.md'), content, 'utf8');
  const since = prevTag ? `since ${prevTag}` : 'full history';
  console.log(`CHANGELOG.md updated: version ${version}, ${entries.length} commits ${since}.`);
}

main();
