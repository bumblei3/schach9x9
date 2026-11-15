import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  APP_VERSION,
  bindIssueReporter,
  buildIssueReport,
  githubIssueUrl,
  type IssueEnvironment,
  type IssueGame,
} from '../../js/ui/issueReporter.js';

const env: IssueEnvironment = {
  version: '2.0.0',
  href: 'https://bumblei3.github.io/schach9x9/',
  userAgent: 'TestBrowser',
  viewport: '1280×720',
  language: 'de',
  online: true,
  now: '2026-11-15T22:00:00.000Z',
};

function game(): IssueGame {
  return {
    mode: 'campaign',
    phase: 'PLAY',
    turn: 'white',
    boardSize: 9,
    isAI: true,
    difficulty: 'medium',
    currentLevelId: 'chapter_19',
    moveHistory: [
      { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } },
      { from: { r: 0, c: 4 }, to: { r: 1, c: 4 } },
    ],
    board: Array.from({ length: 9 }, () => Array(9).fill(null)),
    puzzleState: null,
  };
}

describe('buildIssueReport', () => {
  it('prints version, mode, chapter, moves and position', () => {
    const position = game();
    position.board![6][4] = { color: 'white', type: 'p' };
    const { title, body } = buildIssueReport({
      kind: 'Fehler',
      summary: 'Matt zählt nicht',
      detail: 'Kapitel 19, Matt in einem Zug, kein Stern.',
      game: position,
      errors: ['[App] boom'],
      env,
    });
    expect(title).toBe('[Fehler] Matt zählt nicht');
    expect(body).toContain('Version: 2.0.0');
    expect(body).toContain('Modus: campaign');
    expect(body).toContain('Kapitel: chapter_19');
    expect(body).toContain('e3–e5');
    expect(body).toContain('wp');
    expect(body).toContain('[App] boom');
    expect(body).not.toContain('localStorage');
  });

  it('says there is no game yet', () => {
    const { body } = buildIssueReport({
      kind: 'Vorschlag',
      summary: '',
      detail: 'Die Karte sollte weiter vorne stehen.',
      game: null,
      errors: [],
      env,
    });
    expect(body).toContain('Partie: noch keine');
    expect(body).toContain('- keine');
  });

  it('uses the detail as title when the summary is empty', () => {
    const { title } = buildIssueReport({
      kind: 'Unklar',
      summary: '   ',
      detail: 'Wohin mit dem Erzbischof?',
      game: null,
      errors: [],
      env,
    });
    expect(title).toBe('[Unklar] Wohin mit dem Erzbischof?');
  });
});

describe('githubIssueUrl', () => {
  it('points at the schach9x9 new-issue form and stays short', () => {
    const url = githubIssueUrl('[Fehler] Matt', 'x'.repeat(20000));
    expect(url.startsWith('https://github.com/bumblei3/schach9x9/issues/new?')).toBe(true);
    expect(url).toContain('labels=playtest');
    expect(url.length).toBeLessThanOrEqual(7000);
    expect(decodeURIComponent(url)).toContain('[gekürzt]');
  });
});

describe('bindIssueReporter', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="report-issue-btn" type="button"></button>
      <div id="issue-report-overlay" class="hidden">
        <select id="issue-report-kind"><option value="Fehler">Fehler</option></select>
        <input id="issue-report-summary" />
        <textarea id="issue-report-detail"></textarea>
        <p id="issue-report-error" hidden></p>
        <button id="issue-report-cancel" type="button"></button>
        <button id="issue-report-copy" type="button"></button>
        <button id="issue-report-open" type="button"></button>
      </div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('refuses a short description and does not open GitHub', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    bindIssueReporter(() => null);
    (document.getElementById('issue-report-detail') as HTMLTextAreaElement).value = 'kurz';
    document.getElementById('issue-report-open')!.click();
    expect(document.getElementById('issue-report-error')!.hidden).toBe(false);
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('opens a prefilled issue for the current game', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    bindIssueReporter(() => game());
    const detail = document.getElementById('issue-report-detail') as HTMLTextAreaElement;
    const summary = document.getElementById('issue-report-summary') as HTMLInputElement;
    summary.value = 'Matt zählt nicht';
    detail.value = 'Kapitel 19 erkennt das Matt nicht.';
    document.getElementById('issue-report-open')!.click();
    expect(open).toHaveBeenCalledTimes(1);
    const url = String(open.mock.calls[0][0]);
    const decoded = decodeURIComponent(url.replace(/\+/g, ' '));
    expect(url).toContain('github.com/bumblei3/schach9x9/issues/new');
    expect(decoded).toContain('Matt zählt nicht');
    expect(decoded).toContain('Modus: campaign');
    expect(decoded).toContain(APP_VERSION);
    expect(document.getElementById('issue-report-overlay')!.classList.contains('hidden')).toBe(
      true
    );
    open.mockRestore();
  });
});
