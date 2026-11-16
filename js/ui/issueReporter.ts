/**
 * In-game issue reporter.
 *
 * Anyone can describe what happened. The dialog opens a prefilled GitHub
 * issue with mode, position, and the last client errors. There is no
 * backend and no token: GitHub only receives the report after the tester
 * submits it in their own browser.
 */

import pkg from '../../package.json';
import { showToast } from './OverlayManager.js';
import { errorManager } from '../utils/ErrorManager.js';

export const APP_VERSION: string = pkg.version;

const ISSUE_NEW_URL = 'https://github.com/bumblei3/schach9x9/issues/new';
/** Browsers and GitHub drop very long new-issue URLs. Stay under this. */
const MAX_ISSUE_URL_LENGTH = 7000;
const MIN_DETAIL_LENGTH = 8;
const MAX_DETAIL_LENGTH = 2000;
const MAX_MOVES = 16;

export type IssueKind = 'Fehler' | 'Unklar' | 'Vorschlag';

export interface IssueSquare {
  r: number;
  c: number;
}

export interface IssueGame {
  mode?: string;
  phase?: string;
  turn?: string;
  boardSize?: number;
  isAI?: boolean;
  difficulty?: string;
  currentLevelId?: string;
  puzzleState?: {
    id?: string;
    puzzleId?: string;
    solved?: boolean;
    failed?: boolean;
    active?: boolean;
  } | null;
  moveHistory?: { from?: IssueSquare; to?: IssueSquare }[];
  board?: ({ color?: string; type?: string } | null)[][] | null;
}

export interface IssueEnvironment {
  version: string;
  href: string;
  userAgent: string;
  viewport: string;
  language: string;
  online: boolean;
  now: string;
}

export interface IssueReportInput {
  kind: IssueKind;
  summary: string;
  detail: string;
  game: IssueGame | null;
  errors: string[];
  env: IssueEnvironment;
}

export function currentEnvironment(): IssueEnvironment {
  const href = typeof location !== 'undefined' ? location.href : '';
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const lang = typeof navigator !== 'undefined' ? navigator.language : '';
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const width = typeof window !== 'undefined' ? window.innerWidth : 0;
  const height = typeof window !== 'undefined' ? window.innerHeight : 0;
  return {
    version: APP_VERSION,
    href: clip(href, 300),
    userAgent: clip(ua, 180),
    viewport: `${width}×${height}`,
    language: lang || 'unbekannt',
    online,
    now: new Date().toISOString(),
  };
}

export function buildIssueReport(input: IssueReportInput): { title: string; body: string } {
  const detail = clip(clean(input.detail), MAX_DETAIL_LENGTH);
  const summary = clip(clean(input.summary), 120) || clip(detail.replace(/\s+/g, ' '), 80);
  const title = `[${input.kind}] ${summary || 'Meldung'}`;
  const lines = [
    '### Meldung',
    `Art: ${input.kind}`,
    `Kurz: ${summary || '—'}`,
    '',
    '### Was ist passiert?',
    detail || '—',
    '',
    '### Spiel',
    `- Version: ${input.env.version}`,
    `- Seite: ${input.env.href || '—'}`,
    ...gameLines(input.game),
    '',
    '### Umgebung',
    `- Browser: ${input.env.userAgent || '—'}`,
    `- Fenster: ${input.env.viewport}`,
    `- Sprache: ${input.env.language}`,
    `- Online: ${input.env.online ? 'ja' : 'nein'}`,
    `- Zeitpunkt: ${input.env.now}`,
    '',
    '### Letzte Fehler',
    ...errorLines(input.errors),
    '',
  ];
  return { title, body: lines.join('\n') };
}

/**
 * Prefilled new-issue URL. Shrinks the body until the URL fits.
 */
export function githubIssueUrl(title: string, body: string): string {
  let report = body;
  let url = issueUrl(title, report);
  while (url.length > MAX_ISSUE_URL_LENGTH && report.length > 200) {
    report = report.slice(0, Math.floor(report.length * 0.75)).trimEnd() + '\n\n[gekürzt]';
    url = issueUrl(title, report);
  }
  return url;
}

export function bindIssueReporter(getGame: () => IssueGame | null): void {
  const openBtn = document.getElementById('report-issue-btn');
  const overlay = document.getElementById('issue-report-overlay');
  const cancelBtn = document.getElementById('issue-report-cancel');
  const copyBtn = document.getElementById('issue-report-copy');
  const submitBtn = document.getElementById('issue-report-open');
  const errorEl = document.getElementById('issue-report-error');
  if (!openBtn || !overlay || !cancelBtn || !copyBtn || !submitBtn || !errorEl) return;
  if (openBtn.dataset.bound === '1') return;
  openBtn.dataset.bound = '1';

  const close = (): void => {
    overlay.classList.add('hidden');
  };

  const showError = (message: string): void => {
    errorEl.textContent = message;
    errorEl.hidden = false;
  };

  const readForm = (): { kind: IssueKind; summary: string; detail: string } | null => {
    const kindEl = document.getElementById('issue-report-kind') as HTMLSelectElement | null;
    const summaryEl = document.getElementById('issue-report-summary') as HTMLInputElement | null;
    const detailEl = document.getElementById('issue-report-detail') as HTMLTextAreaElement | null;
    const detail = detailEl?.value.trim() ?? '';
    if (detail.length < MIN_DETAIL_LENGTH) {
      showError('Beschreibe kurz, was passiert ist.');
      detailEl?.focus();
      return null;
    }
    errorEl.hidden = true;
    const kind = (kindEl?.value || 'Fehler') as IssueKind;
    return { kind, summary: summaryEl?.value.trim() ?? '', detail };
  };

  const compose = (form: {
    kind: IssueKind;
    summary: string;
    detail: string;
  }): { title: string; body: string } => {
    return buildIssueReport({
      ...form,
      game: getGame(),
      errors: errorManager.recentErrors(),
      env: currentEnvironment(),
    });
  };

  openBtn.addEventListener('click', () => {
    errorEl.hidden = true;
    overlay.classList.remove('hidden');
    document.getElementById('issue-report-detail')?.focus();
  });

  cancelBtn.addEventListener('click', close);

  overlay.addEventListener('click', event => {
    if (event.target === overlay) close();
  });

  document.addEventListener(
    'keydown',
    event => {
      if (event.key !== 'Escape' || overlay.classList.contains('hidden')) return;
      event.stopImmediatePropagation();
      close();
    },
    true
  );

  copyBtn.addEventListener('click', async () => {
    const form = readForm();
    if (!form) return;
    const { body } = compose(form);
    const copied = await copyText(body);
    showToast(
      copied ? 'Bericht kopiert.' : 'Kopieren fehlgeschlagen.',
      copied ? 'success' : 'error'
    );
  });

  submitBtn.addEventListener('click', async () => {
    const form = readForm();
    if (!form) return;
    const { title, body } = compose(form);
    const url = githubIssueUrl(title, body);
    const popup = window.open(url, '_blank', 'noopener,noreferrer');
    if (!popup) {
      const copied = await copyText(body);
      showToast(
        copied
          ? 'Popup blockiert. Bericht ist kopiert — auf GitHub einfügen.'
          : 'Popup blockiert. Bericht konnte nicht kopiert werden.',
        copied ? 'warning' : 'error'
      );
      return;
    }
    close();
  });
}

function issueUrl(title: string, body: string): string {
  const params = new URLSearchParams({
    labels: 'playtest',
    title,
    body,
  });
  return `${ISSUE_NEW_URL}?${params.toString()}`;
}

function gameLines(game: IssueGame | null): string[] {
  if (!game) {
    return ['- Partie: noch keine'];
  }
  const lines = [
    `- Modus: ${game.mode || '—'}`,
    `- Phase: ${game.phase || '—'}`,
    `- Am Zug: ${game.turn || '—'}`,
    `- KI: ${game.isAI ? `ja (${game.difficulty || '—'})` : 'nein'}`,
  ];
  if (game.currentLevelId) lines.push(`- Kapitel: ${game.currentLevelId}`);
  const puzzle = game.puzzleState;
  if (puzzle && (puzzle.id || puzzle.puzzleId)) {
    const id = puzzle.puzzleId || puzzle.id;
    const state = puzzle.solved
      ? 'gelöst'
      : puzzle.failed
        ? 'fehlgeschlagen'
        : puzzle.active
          ? 'offen'
          : '—';
    lines.push(`- Puzzle: ${id} (${state})`);
  }
  const moves = game.moveHistory ?? [];
  lines.push(`- Züge: ${moves.length}`);
  const recent = formatMoves(moves, game.boardSize || 9);
  if (recent) lines.push(`- Letzte Züge: ${recent}`);
  lines.push(`- Stellung: ${formatPosition(game)}`);
  return lines;
}

function formatMoves(moves: { from?: IssueSquare; to?: IssueSquare }[], boardSize: number): string {
  const tail = moves.slice(-MAX_MOVES);
  const text = tail
    .map(move => {
      if (!move.from || !move.to) return '';
      return `${algebraic(move.from, boardSize)}–${algebraic(move.to, boardSize)}`;
    })
    .filter(Boolean)
    .join(', ');
  if (!text) return '';
  return moves.length > tail.length ? `… ${text}` : text;
}

function formatPosition(game: IssueGame): string {
  const board = game.board;
  const size = game.boardSize || board?.length || 0;
  if (!board || size === 0) return 'nicht verfügbar';
  let pieces = 0;
  let encoded = '';
  for (let r = 0; r < size; r++) {
    const row = board[r] || [];
    for (let c = 0; c < size; c++) {
      const piece = row[c];
      if (!piece || !piece.type || !piece.color) {
        encoded += '..';
        continue;
      }
      pieces += 1;
      encoded += `${piece.color[0]}${piece.type}`;
    }
  }
  if (pieces === 0 && (game.moveHistory?.length ?? 0) === 0) return 'leer';
  const turn = game.turn ? game.turn[0] : '?';
  return `\`${encoded}${turn}\``;
}

function algebraic(square: IssueSquare, boardSize: number): string {
  const file = String.fromCharCode(97 + square.c);
  const rank = boardSize - square.r;
  return `${file}${rank}`;
}

function errorLines(errors: string[]): string[] {
  if (errors.length === 0) return ['- keine'];
  return errors.slice(-8).map(line => `- ${clip(clean(line), 400)}`);
}

function clean(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
}

function clip(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max - 1) + '…';
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the textarea path.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
