/**
 * Replay-Modus: der Ausgangszustand muss gesnapshott werden.
 *
 * Befund (2026-11-17): `reconstructBoardAtMove` baut auf `game.savedGameState`
 * auf — es stellt die Endstellung wieder her und zieht von dort aus Züge
 * zurück. Die Live-Replay-Funktion in `AnalysisUI` setzte den Snapshot nie,
 * also blieb `savedGameState` null und die Navigation heuerte nur die
 * Hervorhebung um, während das Brett auf der Endstellung stehen blieb.
 * Der GIF-Export setzt denselben Snapshot in `replayShell()` selbst und war
 * deshalb der einzige funktionierende Replay-Pfad.
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('../../js/tutor/PostGameAnalyzer.js', () => ({
  analyzeGame: vi.fn(),
  classifyMove: vi.fn(),
  QUALITY_METADATA: {},
}));

const { AnalysisUI } = await import('../../js/ui/AnalysisUI.js');

function el(id: string): HTMLElement {
  const e = document.createElement('div');
  e.id = id;
  document.body.appendChild(e);
  return e;
}

const REPLAY_IDS = [
  'replay-overlay',
  'replay-board',
  'replay-step-number',
  'replay-move-number',
  'replay-class-badge',
  'replay-class-label',
  'replay-eval-value',
  'replay-better-content',
  'replay-prev-btn',
  'replay-next-btn',
  'replay-close-btn',
];

/** Endstellung: der schwarze Kanzler steht auf b6 (2,6), weiß hat e2e4 gemacht. */
function endBoard(): unknown[][] {
  const board = Array.from({ length: 9 }, () => Array(9).fill(null));
  board[2][6] = { type: 'c', color: 'black', hasMoved: true };
  board[6][4] = { type: 'p', color: 'white', hasMoved: true };
  return board;
}

function makeGame() {
  return {
    moveHistory: [
      { from: { r: 7, c: 4 }, to: { r: 6, c: 4 }, notation: 'e2e4', captured: null, piece: null },
      { from: { r: 0, c: 5 }, to: { r: 2, c: 6 }, notation: 'c8b6', captured: null, piece: null },
    ],
    board: endBoard(),
    turn: 'black',
    selectedSquare: null,
    validMoves: null,
    lastMoveHighlight: null,
    savedGameState: null,
    replayMode: false,
    moveController: { reconstructBoardAtMove: vi.fn() },
  };
}

describe('AnalysisUI-Replay: Ausgangszustand', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    REPLAY_IDS.forEach(el);
  });

  test('enterReplayMode snapshottet die Endstellung', () => {
    const game = makeGame();
    const ui = new AnalysisUI({ game } as never);

    ui.enterReplayMode();

    // Ohne diesen Snapshot blieb das Brett bei der Navigation unverändert.
    const saved = game.savedGameState as { board: unknown[][] } | null;
    expect(saved).not.toBeNull();
    expect(saved?.board).toEqual(endBoard());
  });

  test('exitReplayMode stellt die Endstellung wieder her', () => {
    const game = makeGame();
    const ui = new AnalysisUI({ game } as never);
    ui.enterReplayMode();

    // Die Navigation verändert das Brett (hier simuliert).
    game.board = Array.from({ length: 9 }, () => Array(9).fill(null));

    ui.exitReplayMode();

    expect(game.board).toEqual(endBoard());
    expect(game.savedGameState).toBeNull();
  });

  test('reconstructBoardAtMove wird während des Replays aufgerufen', () => {
    const game = makeGame();
    const ui = new AnalysisUI({ game } as never);

    ui.enterReplayMode();

    expect(game.moveController.reconstructBoardAtMove).toHaveBeenCalled();
  });

  test('replayMode schottet das Brett ab und wird beim Verlassen gelöst', () => {
    const game = makeGame();
    const ui = new AnalysisUI({ game } as never);
    expect(game.replayMode).toBeFalsy();

    ui.enterReplayMode();
    // BoardRenderer (Drag/Hover) und GameController.handleCellClick lesen
    // genau diesen Schalter — ohne ihn ist das Brett im Replay klickbar.
    expect(game.replayMode).toBe(true);

    ui.exitReplayMode();
    expect(game.replayMode).toBe(false);
  });
});
