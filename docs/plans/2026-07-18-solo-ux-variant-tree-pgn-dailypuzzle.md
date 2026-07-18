# Solo-UX Erweiterung: Variant-Tree + PGN-Kommentare + Daily-Puzzle

> **For Hermes:** Task-by-task umsetzen (TDD). Jede UI-Änderung braucht eine echte
> Playwright-E2E gegen `dist` (siehe `references/ui-feature-e2e-and-techdebt.md`).

**Goal:** Solo-Spieler bekommen echten, sichtbaren Mehrwert — einen
"Was-wäre-wenn"-Varianten-Baum, kommentiertes PGN nach dem Spiel, und ein
tägliches Puzzle (Mate-in-1/2 aus dem bereits existierenden `ProceduralGenerator`).

**Architecture:**
- Analyse-Funktionen DOM-frei in `js/analyze/` (wie `heatmap.ts`/`materialSeries.ts`),
  voll unit-getestet.
- Rendering in `js/ui/*UI.ts`, angelehnt an `renderEvalGraph`/`renderMaterialGraph`.
- Variant-Tree nutzt die VORHANDENE `getTopMoves()` aus `js/aiEngine.ts` (die PV
  liefert bereits die Folgezüge) — kein neuer Such-Code.
- Daily-Puzzle nutzt `ProceduralGenerator.generatePuzzle()` + `PuzzleGenerator.findMateSequence()`
  (bereits vorhanden in `js/puzzle/`).

**Tech Stack:** TypeScript, vitest (unit), Playwright (e2e), bestehende `js/search.ts`/`js/analyze/`.

---

## Verifizierte Bausteine (aus dem echten Code gelesen — nicht geraten)

```ts
// js/aiEngine.ts:99
export interface SearchResult {
  bestMove: Move | null;
  score: number;
  depth: number;
  nodes: number;
  timeMs: number;
  pv: Move[];          // <-- Principal Variation: die KI-Zugfolge. Rückgrat für Variant-Tree.
  stoppedEarly: boolean;
}

// js/aiEngine.ts:118  (Signatur verifiziert)
export async function getTopMoves(
  uiBoard: UiBoard,
  turnColor: Player,
  count: number = 3,
  searchDepth: number = 2,
  maxTimeMs: number = 5000,
  moveNumber?: number
): Promise<SearchResult[]>

// js/puzzle/ProceduralGenerator.ts:14
export class ProceduralGenerator {
  static generatePuzzle(difficulty: string = 'easy'): GeneratedPuzzle | null
}
// GeneratedPuzzle = { id, title, description, difficulty, setupStr, solution: MoveResult[] }

// js/puzzle/puzzleGenerator.ts:58
export class PuzzleGenerator {
  static findMateSequence(board: Board, turn: Player, depth: number): MoveResult[] | null
}

// js/analyze/heatmap.ts:47
export function computeHeatmap(history: MoveHistoryEntry[]): HeatmapSummary
// js/analyze/materialSeries.ts:58
export function computeMaterialSeries(history: MoveHistoryEntry[], initialWhite=0, initialBlack=0): MaterialSeries

// js/utils/PGNGenerator.ts
export async function copyPGNToClipboard(pgn: string): Promise<boolean>
export function downloadPGN(pgn: string, filename?: string): void
// DOMHandler.ts:790 ruft bereits generatePGN(this.game) auf -> PGN-String ist verfügbar

// js/ui/GameStatusUI.ts (Pattern für Post-Game-Charts)
export function renderEvalGraph(game: Game): void        // :283
export function renderMaterialGraph(game: Game): void     // :349
export function renderMoveTimeGraph(game: Game): void     // :400
```

---

## VERIFIZIERTE PLAN-KORREKTUREN (Step-0, vor Dispatch gelesen)

- `getTopMoves` ist **async** (`Promise<SearchResult[]>`) → `buildVariantTree` MUSS async sein.
- `UiBoard` ist KEIN exportierter Typ, sondern lokales `type UiBoard = (Piece | null)[][]`
  in `js/aiEngine.ts:113`. In `variantTree.ts` den Board-Param als `(Piece | null)[][]` typisieren.
- `Move`-Interface: `js/types/core.ts:41`. `Piece`: `js/types/core.ts`. Imports mit `.js`-Endung.
- **Task 2 — KEIN `moveToStr` im Repo.** Für Zug-Notation existiert `squareToAlgebraic(sq, boardSize=9)`
  in `js/openingTrainer.ts:33`. Besser: PV-String via `moveToNotation` (siehe Task 3) oder
  `squareToAlgebraic` pro Feld. Nicht `moveToStr` aufrufen (gibt es nicht).
- **Task 2 — `handleGameEnd` ruft direkt `renderMoveTimeGraph(this.game)` auf (`js/gameController.ts:1023`).**
  `renderVariantTree(this.game)` einfach daneben einfügen (kein extra Flag nötig).
- **Task 3 — PGN ist bereits kommentierfähig.** `moveToNotation(move, game, includeEngineAnnotations)`
  (`js/utils/PGNGenerator.ts:121`) liest bereits: `move.classification` (→ QUALITY_SYMBOLS, z.B. `!`, `?`),
  `move.evalScore` (→ `[%eval +xx]`), `move.timeUsed` (→ `[%clk m:ss]`), `move.pv` (→ PV-String).
  Die Aufgabe ist also: diese Felder auf `MoveHistoryEntry` befüllen (aus Tutor-Analyse /
  `HintGenerator` / `getTopMoves`-Eval), NICHT rohe `{gew. X}`-Strings anhängen.
- `generatePGN(game, options?, includeEngineAnnotations=true)` ist bereits default mit Annotationen.

---

## Task 1: Variant-Tree Analyse-Funktion (DOM-frei, unit-getestet)

**Objective:** Aus einer Stellung + den Top-N-KI-Zügen einen Baum bauen, der pro
Zug die beste gegnerische Antwort (aus der PV) zeigt.

**Files:**
- Create: `js/analyze/variantTree.ts`
- Test: `tests/variantTree.test.ts`

**Step 1: Write failing test**
```ts
import { buildVariantTree } from '../js/analyze/variantTree';
import type { UiBoard } from '../js/types/core';

test('buildVariantTree returns N root moves with PV continuation', () => {
  const board: UiBoard = createEmptyBoardForTest(); // minimale 9x9 Stellung
  const tree = buildVariantTree(board, 'white', 3, 2);
  expect(tree.length).toBe(3);
  expect(tree[0].move).toBeDefined();
  expect(Array.isArray(tree[0].continuation)).toBe(true); // PV als Move[]
});
```

**Step 2: Run to verify failure**
Run: `npx vitest run tests/variantTree.test.ts`
Expected: FAIL — module not found.

**Step 3: Write minimal implementation**
```ts
import { getTopMoves } from '../aiEngine';
import type { UiBoard, Move } from '../types/core';

export interface VariantNode {
  move: Move;
  score: number;
  continuation: Move[]; // PV nach diesem Zug (aus SearchResult.pv)
}

export function buildVariantTree(
  uiBoard: UiBoard,
  turnColor: 'white' | 'black',
  count = 3,
  depth = 2
): VariantNode[] {
  // getTopMoves liefert bereits pv[] -> keine eigene Suche nötig.
  return getTopMoves(uiBoard, turnColor, count, depth).map(r => ({
    move: r.bestMove!,
    score: r.score,
    continuation: r.pv.slice(1), // erster Eintrag ist bestMove selbst
  }));
}
```
Hinweis: `getTopMoves` ist `async` (liefert `Promise<SearchResult[]>`). Die
Analyse-Funktion muss daher `async` sein. Test dann mit `await buildVariantTree(...)`.

**Step 4: Run to verify pass**
Run: `npx vitest run tests/variantTree.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add js/analyze/variantTree.ts tests/variantTree.test.ts
git commit -m "feat(analyze): variant-tree builder on top of getTopMoves PV"
```

---

## Task 2: Variant-Tree Panel rendern (Post-Game + On-Demand)

**Objective:** Ein `#variant-tree`-Panel, das nach Solo-Spielen (wie der Move-Time-Graph)
den Baum zeichnet; Klick auf einen Root-Zug klappt die PV auf.

**Files:**
- Modify: `js/ui/GameStatusUI.ts` (neue `renderVariantTree(game)`)
- Modify: `js/gameController.ts` (`handleGameEnd` ruft es nach Solo-Spielen auf — siehe `renderMoveTimeGraph`-Aufruf)
- Modify: `index.html` (Container `#variant-tree` neben `#move-time-graph`)
- Test: `e2e/variant-tree.spec.ts`

**Step 1: Write failing e2e**
```ts
// e2e/variant-tree.spec.ts  (Helpers aus e2e/helpers/E2EHelper.ts)
import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper';

test('variant tree renders after solo game', async ({ page }) => {
  const h = new E2EHelper(page);
  await h.goto();
  await h.startGame('classic');
  await h.clickCell(7, 4); // weisser Bauer e
  await h.clickCell(6, 4);
  await h.resign('white'); // Solo-Ende erzwingen
  const tree = page.locator('#variant-tree .variant-root');
  const n = await tree.count();
  expect(n).toBeGreaterThan(0); // toHaveCount braucht konkrete Zahl!
});
```

**Step 2: Run e2e against dist to verify failure (build first!)**
```bash
npm run build && npx playwright test e2e/variant-tree.spec.ts --reporter=list
```
Expected: FAIL — `#variant-tree` existiert nicht / leer.

**Step 3: Implement `renderVariantTree`**
```ts
// in js/ui/GameStatusUI.ts
export async function renderVariantTree(game: Game): Promise<void> {
  const el = document.getElementById('variant-tree');
  if (!el) return;
  const board = game.board; // UiBoard
  const nodes = await buildVariantTree(board, game.turn, 3, 2);
  el.innerHTML = '';
  for (const node of nodes) {
    const root = document.createElement('div');
    root.className = 'variant-root';
    root.textContent = `${moveToStr(node.move)} (${node.score})`;
    const cont = document.createElement('div');
    cont.className = 'variant-continuation';
    cont.textContent = node.continuation.map(moveToStr).join(' → ');
    root.appendChild(cont);
    el.appendChild(root);
  }
}
```
`moveToStr` = bestehende Helfer-Funktion (aus `MoveExecutor`/`types` — beim
Implementieren den echten Namen via grep `export function.*[Mm]ove.*[Ss]tr` bestätigen).

**Step 4: Wire in `handleGameEnd`** (Spiegelung von `renderMoveTimeGraph`-Aufruf,
nur nach Solo-Spielen, NICHT `isAnimating` guarden — sonst leeres Panel).

**Step 5: Run e2e to verify pass**
```bash
npm run build && npx playwright test e2e/variant-tree.spec.ts --reporter=list
```
Expected: PASS

**Step 6: Commit**
```bash
git add js/ui/GameStatusUI.ts js/gameController.ts index.html e2e/variant-tree.spec.ts
git commit -m "feat(ui): variant-tree panel for solo games"
```

---

## Task 3: Kommentiertes PGN nach dem Spiel

**Objective:** Das bestehende `generatePGN(game)` um pro-Zug-Kommentare ergänzen
(z.B. wer Material gewinnt, ob ein Schach geboten wurde) — sichtbar im Export.

**Files:**
- Modify: `js/utils/PGNGenerator.ts` (`generatePGN` um Kommentar-Hook erweitern)
- Test: `tests/pgnComments.test.ts`
- Modify: `js/ui/DOMHandler.ts` (export-pgn-btn nutzt bereits `generatePGN`)

**Step 1: Write failing test**
```ts
test('generatePGN annotates captures with material comment', () => {
  const game = makeGameWithOneCapture(); // fixture: weiss schlaegt schwarz
  const pgn = generatePGN(game);
  expect(pgn).toMatch(/\{.*Material.*\}/); // Kommentar-Klammer vorhanden
});
```

**Step 2: Run to verify failure:** `npx vitest run tests/pgnComments.test.ts` → FAIL.

**Step 3: Implement** — in `generatePGN` pro Move: falls `move.captured`,
Kommentar `{gew. <Figur>}` an die SAN anhängen (PGN-Syntax: `e4 {gew. Springer}`).

**Step 4:** `npx vitest run tests/pgnComments.test.ts` → PASS.

**Step 5: Commit** `git commit -m "feat(pgn): annotate captures in export"`

---

## Task 4: Daily-Puzzle — BEREITS IM REPO VORHANDEN (Plan-Drift!)

VORAB-VERIFIKATION ergab: `daily-puzzle` ist bereits vollständig implementiert und getestet:
- `index.html:1181` hat die `daily-puzzle`-Card (`data-init-mode="daily-puzzle"`)
- `js/config.ts:156` (`DAILY_PUZZLE`), `js/types/gameMode.ts:16` (Mode-Type)
- `js/move/MoveExecutor.ts:316-321` (Badge/Streak-Logik)
- `js/App.ts:138,183` (`refreshDailyPuzzleBadge`)
- `js/puzzleManager.ts` + `js/puzzle/ProceduralGenerator.ts` (Infinite + generierte Puzzles)
- Tests bereits grün: `tests/dailyPuzzle.test.ts` (18 passed),
  `e2e/daily-puzzle.spec.ts`, `e2e/daily-puzzle-hints.spec.ts`, `e2e/smoke.spec.ts`

**Task 4 war ein Plan-Drift:** geschrieben bevor die existierende Puzzle-Infrastruktur
vollständig durchsucht war. KEIN Neubau — Feature + Tests sind bereits da.

LESSON (für Skill): Vor "Feature bauen" die existierende Feature-Abdeckung
(HTML-Cards, config-Modes, MoveExecutor-Branches, Tests) vollständig durchsuchen,
sonst wird doppelt gebaut.

---

## Status-Zusammenfassung (Stand 2026-07-18)

- Task 1: variantTree.ts — NEU gebaut + 2-Stage-Review PASS (+Hardening)
- Task 2: Variant-Tree Panel — NEU gebaut + E2E PASS + 2-Stage-Review PASS (+Hardening)
- Task 3: Kommentiertes PGN — Verifikations-Tests NEU (+7 Annotation-Tests, da Infra schon da)
- Task 4: Daily-Puzzle — BEREITS IM REPO (kein Neubau, bereits 18+ E2E-Tests grün)



**Objective:** Ein "Puzzle des Tages"-Button im Hauptmenü, der
`ProceduralGenerator.generatePuzzle('easy')` aufruft, die Stellung aufbaut und
die Lösung (Mate-in-1/2) abfragt.

**Files:**
- Modify: `js/App.ts` (Button + Stellungs-Setup aus `setupStr`)
- Modify: `index.html` (Button `#daily-puzzle-btn`)
- Test: `e2e/daily-puzzle.spec.ts`

**Step 1: Write failing e2e**
```ts
test('daily puzzle button sets up a solvable position', async ({ page }) => {
  const h = new E2EHelper(page);
  await h.goto();
  await page.click('#daily-puzzle-btn');
  // Nach Klick: ein Brett mit Figuren + ein "Lösung prüfen"-Button sichtbar
  await expect(page.locator('#solve-puzzle-btn')).toBeVisible();
});
```

**Step 2:** `npm run build && npx playwright test e2e/daily-puzzle.spec.ts` → FAIL.

**Step 3: Implement** — `ProceduralGenerator.generatePuzzle('easy')` liefert
`setupStr` (FEN-artig) + `solution`. App baut Brett aus `setupStr`, zeigt
`#solve-puzzle-btn`, vergleicht den Spieler-Zug mit `solution[0]`.

**Step 4:** e2e → PASS.

**Step 5: Commit** `git commit -m "feat(puzzle): daily puzzle from ProceduralGenerator"`

---

## Risiken / Gate (laut Skill)
- Jede UI-Änderung: echte Playwright-E2E gegen `dist` (nicht nur vitest).
- Variant-Tree: KI-Antwort braucht Zeit → `getTopMoves` ist async, Panel darf
  nicht vor Resolve rendern (Loading-State zeigen).
- 9x9-Koordinaten-Gotcha: White-Pawns auf row 7, nicht 8. Im E2E den
  `clickCell(7,4)→(6,4)`-Pfad nutzen.
- Kein Multiplayer (AGENTS.md: explizit ausgeschlossen). Puzzle bleibt Solo.

## Verifikation am Ende
1. `npm run typecheck` → 0 Fehler
2. `npm test` → alle 2917+ bestehenden Tests grün
3. `npm run build && npx playwright test e2e/variant-tree.spec.ts e2e/daily-puzzle.spec.ts` → grün
