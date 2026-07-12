# Plan: Tägliches Puzzle (v1.2.0)

Solo-Feature: ein deterministisch nach Datum gewähltes Puzzle, das einmal täglich
wechselt und pro Tag nur einmal als "gelöst" markiert wird. Reuse der bestehenden
`puzzleManager`-Infrastruktur (eingebettete Puzzles + `loadPuzzle`).

## Kontext / Reuse-Punkte (verifiziert)

- `js/puzzleManager.ts` — Singleton `puzzleManager`, `puzzles: Puzzle[]` (eingebettet,
  ~6 Puzzles), `loadPuzzle(game, index)` lädt Puzzle[index] (Infinite-Mode-Fallback
  für index >= length via `ProceduralGenerator`). `getPuzzle(id)`.
- Puzzle-Daten: `Puzzle { id, title, fen, solution: Move[] }` (Move = `{from, to}`).
- Gelöste Puzzles: `localStorage['schach_solved_puzzles']` (JSON-Array von Puzzle-IDs).
- Main-Menu: `index.html` `.gamemode-card[data-mode="..."]` mit
  `onclick="window.app.init(0, '<mode>')"`. Trainer-Karte nutzt `data-mode="opening-trainer"`.
- `gameController.initGame(initialPoints, mode)` — `mode === 'puzzle'` zweigt legacy ab
  (`currentModeStrategy = null`, `puzzleMenu.show()`, `game.mode = 'puzzle'`).

## Design

1. **Datums-basierte Auswahl** — `getDailyPuzzleIndex(date = new Date()): number`
   = `Math.floor(date.getTime() / 86400000) % puzzleManager.puzzles.length`.
   (Tag-Index = Tage seit Epoch; modulo Anzahl Puzzles → stabil pro Tag, wechselt
   um Mitternacht.)
2. **Tages-Schlüssel** — `getDailyKey(date): string` = `YYYY-MM-DD` (local).
   Dient als localStorage-Schlüssel für "heute gelöst".
3. **DailyPuzzleManager** (neu, `js/dailyPuzzle.ts`):
   - `getTodaysPuzzle(): Puzzle | null` — `puzzleManager.puzzles[dailyIndex]`.
   - `isSolvedToday(): boolean` — `localStorage['dailyPuzzle.solved.<YYYY-MM-DD>'] === '1'`.
   - `markSolvedToday(): void` — setzt obigen Key + fügt Puzzle-ID zu
     `schach_solved_puzzles` hinzu (reuse existierende Konvention).
   - `getStreak(): number` — optional: zähle aufeinanderfolgende Tage mit solve-Key.
4. **UI-Einstiegspunkt** — neue Main-Menu-Karte `data-mode="daily-puzzle"` mit
   Titel "Tägliches Puzzle" + onclick `window.app.init(0, 'daily-puzzle')`.
   Zeigt Badge "Heute gelöst ✓" wenn `isSolvedToday()`.
5. **gameController.startDailyPuzzleMode()** — setzt `game.mode = 'puzzle'`,
   `phase = PLAY`, lädt `puzzleManager.loadPuzzle(game, dailyIndex)`,
   zeigt `puzzleMenu`, rendert Brett. (Reuse des Puzzle-Modus, nur anderer Index +
   Daily-Markierung nach Lösung.)
   - `initGame` erhält `else if (mode === 'daily-puzzle')` → `startDailyPuzzleMode()`.
6. **Lösungs-Erkennung** — nach erfolgreichem Puzzle-Solve: `dailyPuzzle.markSolvedToday()`.
   (Puzzle-Manager hat bereits eine Solved-Callback-Struktur? Prüfen: `onPuzzleSolved`
   oder ähnlich; sonst in `submitPuzzleMove`/Solve-Handler hooken.)

## Tasks

- **T1 (Implementer)**: `js/dailyPuzzle.ts` (DailyPuzzleManager) + Main-Menu-Karte
  - `gameController.startDailyPuzzleMode()` + `initGame`-Branch + Solve-Hook
    (markSolvedToday) + Tests (`tests/dailyPuzzle.test.ts`): dailyIndex deterministisch,
    isSolvedToday/markSolvedToday Round-Trip, getStreak, getTodaysPuzzle.
- **T2 (Quality + Release)**: Spec-Review + Quality-Review (2-Stufen) → Fixes →
  v1.2.0 Release (Version-Bump 1.1.2→1.2.0, CHANGELOG [1.2.0], PR, merge, Tag, Release).

## Guardrails

- Reuse `puzzleManager` (kein neues Puzzle-Format). Ohne eingebettete Puzzles →
  DailyPuzzleManager.getTodaysPuzzle liefert null → Menu zeigt "Heute keine Puzzles".
- Kein Multiplayer. Kein neues StorageManager-Format (reuse localStorage direkt, wie Trainer).
- tsc / eslint `--max-warnings=0` / prettier repo-weit sauber.
- Keine `any` in src.
- Backward compatible: `puzzle`-Modus unverändert; nur neuer `daily-puzzle`-Mode.
