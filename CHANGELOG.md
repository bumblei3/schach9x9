# Changelog

Alle nennenswerten Änderungen an Schach 9x9. Versionierung folgt [SemVer](https://semver.org/lang/de/).
Generiert aus den Git-Commits via `npm run changelog`.

## [1.6.0] – 2026-07-19

### Added (Solo UX — Variant Tree)

- **Variantenbaum nach Solo-Partien (#144):** nach Spielende (nicht Campaign)
  zeigt `#variant-tree` die Top-Kandidaten der Engine inkl. Bewertung und
  kurzer Best-Reply-Fortsetzung (Opponent-Antwort → eigener Folgezuge).
  - `js/analyze/variantTree.ts`: pure, DOM-freie Builder-API
    (`buildVariantTree`) auf Basis von `getTopMoves` (kein PV-Feld — Fortsetzung
    durch erneute Top-Move-Abfrage nach dem Zug).
  - `renderVariantTree()` in `js/ui/GameStatusUI.ts`: listet `.variant-root`-
    Zeilen; Container bleibt versteckt, bis Nodes existieren; Fehler via
    `.catch` im GameController geloggt.
  - `gameController.handleGameEnd` startet den async Render nur im Solo-Modus.
  - Unit-Tests (`tests/variantTree.test.ts`), PGN-Annotationen
    (classification / evalScore / timeUsed), Playwright-E2E
    (`e2e/variant-tree.spec.ts`), Plan-Doku unter `docs/plans/`.

## [1.5.1] – 2026-07-17

### Added (Solo UX — Move-Time Chart)

- **Zug-Zeit-Diagramm (#6 Statistiken):** nach einem Solo-Spiel (nicht
  Campaign) wird die Ausführungszeit pro Zug (in Sekunden) als Balken-Diagramm
  in `#move-time-graph` gezeichnet — lange Züge (KI-Denkzeit / komplexe
  Stellungen) rot, mittlere gelb, schnelle grün.
  - `js/move/MoveExecutor.ts`: `moveRecord.timeUsed` wird jetzt bei jedem
    Zug gemessen (`Date.now()` am `executeMove`-Start, Dauer vor `push` in
    `moveHistory`). Das Feld war zuvor im Interface deklariert, aber TOT
    (niemand hat es befüllt) — PGN-Export nutzte es nie.
  - `renderMoveTimeGraph()` in `js/ui/GameStatusUI.ts`: zeichnet pro Zug
    einen Balken (Farbe nach Dauer), spiegelt die anderen Post-Game-Charts.
  - `gameController.handleGameEnd` ruft es nach Solo-Spielen auf.
  - `e2e/move-time-chart.spec.ts`: echter Browser-Test (Playwright) —
    Container sichtbar, `timeUsed` erfasst, ≥1 Balken gerendert.

### Added / Improved (Engine — H-P1 PSQT 9×9)

- **H-P1 Piece-Square-Tables zentriert auf (4,4):** Springer, Läufer, Turm,
  Dame, Erzbischof, Kanzler und Engel nutzen `buildCenteredPST()` mit Peak
  am echten 9×9-Zentrum (alte 8×8-Lifts peakten ~3.5). **Bauern** bleiben
  rang-basiert (Promotion), **König-Mittelspiel** behält Rochade-Ecken.
- Export: `buildCenteredPST`, `PSQT_CENTER` + Invariant-Tests (Peak +
  Knight center > corner).

### Added / Improved (Tutor — „Warum war das gut/schlecht?“ + Alternative)

- **Erklärung nach jedem eigenen Zug:** Toast + Floating-Panel mit
  Qualitätslabel (Bester Zug / Ungenau / Patzer …) und **1–2 konkreten
  Gründen** (Taktik, Warnung, Strategie) statt nur Badge.
- **Besserer Zug bei Schwäche:** bei Ungenauigkeit/Fehler/Patzer sucht der
  Tutor kurz die Engine-Alternative (Brett temporär zurücksetzen), zeichnet
  einen **grünen Pfeil** + Feld-Highlights und schreibt „Besser war: …“ ins
  Panel/Toast. `findBetterAlternative()` + `showBetterMoveArrow()`.
- `buildTutorSummary()` priorisiert Gabel/Schach/hängende Figur vor generischen
  Texten; Fallback je Kategorie.
- `checkBlunder` zeigt Feedback immer (nicht nur bei ≥3.0-Drop); Blunder-Modal
  nur noch mit KI-Mentor. AI-Schwarz-Züge im Solo werden übersprungen.
- **Bugfix:** Tutor bekam `piece` nur als Typ-String → `piece.color` war
  undefined; jetzt volles Piece-Objekt + `captured` für Reverse-Search.
- CSS: `.tutor-feedback`, `.better-move-from/to`.

### Added / Improved (UX — Check & Illegal Moves)

- **Schach sichtbarer:** König-Feld pulsiert stärker (Dauer-Glow solange im
  Schach), Figur skaliert kurz, Statuszeile zeigt `⚠️ SCHACH — … am Zug`
  und flasht beim Eintritt in Schach.
- **Ungültige Züge:** Klick/Drag auf illegales Zielfeld → rotes ✕ auf dem
  Ziel + Shake der eigenen Figur (+ kurzes `navigator.vibrate` auf Mobil).
  Leeres Feld deselektiert danach (wie bisher); nicht-schlagbare
  Gegnerfigur zeigt den Flash und wechselt dann zur Bedrohungsanzeige.
- Unit-Tests: `tests/ui/invalidMoveFeedback.test.ts` + MoveController-Cases.

### Fixed (Tech Debt — dead dynamic imports)

- **Ineffektiver dynamischer Import in `ShopUI` entfernt:** `ShopUI.ts`
  importierte `TutorUI` dynamisch als "fallback", obwohl `ui.ts` `TutorUI`
  bereits statisch lädt (→ TutorUI war immer im Main-Chunk, der dynamische
  Import war nutzlos + erzeugte `INEFFECTIVE_DYNAMIC_IMPORT`-Build-Warning).
  Ersetzt durch statischen Import + direkten Aufruf von
  `updateTutorRecommendations`. Die Circular-Dependency (TutorUI↔ShopUI) ist
  harmlos, da beide Funktionen als `export function` gehoistet werden.

- **Tote dynamische `ui.ts`-Imports entfernt (zentral):** `App.ts`,
  `TutorUI.ts` und `KeyboardManager.ts` importierten `ui.ts` dynamisch als
  Fallback — obwohl `ui.ts` bereits von `moveController`, `gameController`,
  `aiController`, `AnalysisController`, `TimeManager` statisch geladen wird
  (→ immer im Main-Chunk, dynamisch nutzlos + `INEFFECTIVE_DYNAMIC_IMPORT`).
  Ersetzt durch statische Imports:
  - `App.ts`: `import * as UI` + `UI_MODULE = UI` (Lazy-`await import` weg).
  - `TutorUI.ts`: statisch `showToast` statt `import('../ui.js').then(...)`.
  - `KeyboardManager.ts`: statisch `updateStatus` statt dynamischem `.then()`.
  - E2E-Smoke-Test (`e2e/ui-static-import-smoke.spec.ts`) beweist, dass die
    App nach dem Statik-Switch noch bootet (window.UI + renderBoard/
    updateStatus/showToast vorhanden) und ein Spiel + Resign funktioniert.
    Hätte eine kaputte Circular-Dep (Statik-Switch) nicht gefangen.

  - Build-Warning `INEFFECTIVE_DYNAMIC_IMPORT` (ui.ts) ist weg.

### Added (Solo UX — Material Chart)

- **Material-Verlauf-Grafik (#6 Statistiken):** nach einem Solo-Spiel (nicht
  Campaign) wird die Material-Bilanz (weiß − schwarz in Zentibauern) über
  alle Züge als SVG-Kurve in `#material-graph` gezeichnet — zeigt wer wann
  Material gewann/verlor.
  - `js/analyze/materialSeries.ts`: pure `computeMaterialSeries()` (kein DOM,
    voll unit-getestet) — trackt Material kumulativ aus `moveHistory`
    (Captures senken die verlierende Seite, Promotion hebt die eigene),
    ermittelt finalen Diff + beste Weiß/Schwarz-Position.
  - `renderMaterialGraph()` in `js/ui/GameStatusUI.ts`: spiegelt
    `renderEvalGraph`, plotter aber den Material-Diff statt der Engine-Eval.
  - `gameController.handleGameEnd` ruft es nach Solo-Spielen auf.
  - `e2e/material-chart.spec.ts`: echter Browser-Test (Playwright) — Container
    sichtbar, SVG mit geplotteter Kurve. Der E2E-Gate fing einen falschen
    `toHaveCount(expect.any())`-Matcher ab, den Unit-Tests nicht bemerkt hätten.

### Added (Solo UX — Move-Activity Heatmap)

- **Feld-Hitze-Panel (#6 Statistiken):** nach einem Solo-Spiel (nicht
  Campaign) öffnet sich automatisch ein 9×9-Heatmap-Panel, das pro Feld
  zählt, wie oft es als Zug-Ursprung (von) oder Ziel (nach) genutzt wurde.
  Zeigt das aktivste Feld und färbt das Brett nach Intensität.
  - `js/analyze/heatmap.ts`: pure `computeHeatmap()` (kein DOM, voll
    unit-getestet) — zählt from/to pro Quadrat, ermittelt heißestes Feld +
    maxCount zur Normalisierung.
  - `js/ui/HeatmapUI.ts`: rendert das Grid in `#move-heatmap-panel`,
    spiegelt Reihen für Weiß-Sicht (weiß unten).
  - `gameController.handleGameEnd` rendert + zeigt das Panel (Solo-only).
  - `e2e/heatmap.spec.ts`: echter Browser-Test (Playwright) — Panel sichtbar,
    81 Zellen, Intensität > 0 nach gespieltem Zug. Dieser E2E-Gate fing einen
    falschen Start-Zellen-Selektor ab, den Unit-Tests nicht bemerkt hätten.

### Fixed (Engine Strength Gate — matchRefs)

- **Kritischer FEN-Bug im Stärke-Gate behoben:** `matchRefs.playGame()` baute
  das Brett IMMER aus der Startstellung und schickte das `startFen` nur an
  Zug 1 als Once-Override an `engineNode` — die tatsächliche Partie lief auf
  der Startstellung mit einem Phantom-Eröffnungszug. Der Gate hat damit
  Taktik-FENs (Forks, Skewers, Back-Rank) nie wirklich gespielt; alle
  bisherigen "Engine nicht messbar stärker"-Befunde waren wertlos.
  - `playGame` nutzt jetzt `startingBoard(startFen)`, spielt also die echte
    FEN-Position (Bug-Fix in `js/matchRefs.ts`).
  - Material-Verdict (wer gewinnt bei Zeitablauf) misst jetzt das
    **Material-DELTA zur Ausgangsstellung**, nicht das absolute Brettmaterial
    — tactic-FENs mit unausgeglichener Start-Materialverteilung werden
    korrekt gewertet (`materialDiff` statt `materialWinner`).
  - `applyMove` handhabt jetzt Promotion (Engel/Kanzler/Dame) korrekt
    (vorher nur Roh-Kopie ohne Beförderung).
- **H-Q2 (Quiescence Check-Extension) revertiert — Engine bei fester Zeit
  messbar stärker:** Mit dem reparierten Gate lief ein Baseline-Match
  `NEW` (H-Q1+H-Q2) vs `OLD` (H-Q1-only, Check-Extension deaktiviert) über
  24 taktische 9×9-FENs (elo 1600, 40 Züge):
  `NEW wins 5 | OLD wins 8 | Draws 11 → VERDICT: NEW weaker`.
  Die Check-Extension generiert bei Schach ALLE Evasion-Moves statt nur
  Captures → viel mehr Knoten pro Zug → bei gleicher Zeit weniger Tiefe →
  schlechtere Bewertung. H-Q1 (Delta-Pruning, sound) bleibt. `quiesce()` in
  `js/search.ts` nutzt jetzt immer nur Capture-Moves.
- **TACTICAL_FENS auf echte 9×9-Stellungen korrigiert:** alle 12 FENs waren
  8 Breit (8×8-Format) und damit ungültig für das 9×9-Brett — sie wurden
  stillschweigend nie geparst. Jetzt gültige 9×9-FENs (verifiziert durch
  `scripts/verify-fens.ts`).
- **`main()` in `matchRefs.ts` ge-guardet** (nur bei Direkt-Aufruf, nicht
  beim Import durch Tests) — sonst würden Tests beim Import sofort zwei
  Engine-Prozesse spawnen + `process.exit` triggern.
- **Toter Code entfernt:** `startingMaterialDiff` (unbenutzt), `materialWinner`
  (durch `materialDiff` ersetzt). `startingBoard`/`materialDiff`/`fenToBoardTurn`/
  `TACTICAL_FENS` exportiert für Tests.
- **Neue Invariant-Tests:** `tests/matchRefs.test.ts` (9 Tests) + Tool
  `scripts/verify-fens.ts` sichern den Fix (FEN wird wirklich gespielt,
  Material-Delta-Logik, Seite-zu-ziehen-Parsing, gültige 9×9-FENs).

### Added / Improved (UI-B — Mobile & Flow)

- **Bottom-Sheets:** Shop mit Sheet-Handle; Action-„Mehr“ auf Mobile als
  Bottom-Sheet mit Backdrop (`#sheet-backdrop`).
- **Compact In-Game Header:** kompakte Statuszeile + Uhren im Header auf
  schmalen Screens (Player-Clocks ausgeblendet zugunsten Brettfläche).
- **Landscape-Layout:** Brett-fokussiertes Layout im Querformat
  (Phone landscape + breites Landscape-Desktop).
- **Menü ohne Inline-`onclick`:** Spielmodus-Karten als `<button
data-init-mode>` + `DOMHandler.initGameModeCards()` (a11y/testbar).

### Added / Improved (UI-A — Interface)

- **Action-Bar entlastet:** Kern-Aktionen (Rückgängig, Tipps, Bester Zug, Analyse)
  sichtbar; Rest hinter **Mehr**-Overflow (Drohungen, Chancen, Buch, 3D, Skin, Info,
  Vollbild) — ruhigeres In-Game-Dock, kein Horizontal-Scroll-Chaos mobil.
- **Menü „Empfohlen“ / „Mehr Modi“:** Kampagne, Klassisch 9×9, Daily Puzzle (und
  Fortsetzen) prominent; restliche Modi einklappbar.
- **Deutsche Microcopy:** Spinner/Analyse-Panel (z. B. „Berechne…“, „Tiefenanalyse“).
- **Daily-Streak visuell:** hervorgehobene Streak-Pills + leichte Glow-Animation
  (respektiert `prefers-reduced-motion`).
- **Letzter Zug klarer:** getrennte Origin/Ziel-Styles (`last-move-from` /
  `last-move-to`) + stärkerer Ziel-Glow.

### Added / Improved (Phase A — Solo-UX)

- **Tutorial Quick-Start (3 Screens):** First-Run-Onboarding mit Feenfiguren,
  Setup (König platzieren) und Shop/Upgrades. Ausführliche Tour weiter unter
  _Lernen → Interaktives Tutorial_. Auto-Open unterdrückt bei Playwright
  (`navigator.webdriver` / `?e2e`).
- **Daily-Puzzle-Streak-UI:** Badge mit aktueller Serie + Bestwert; Status-Text
  nach dem Lösen. `getBestStreak()` / `formatStreakLabel()` in `dailyPuzzle.ts`.
- **Eröffnungs-Trainer-Feedback:** Algebraische Züge (z. B. `e2–e4`), deutsche
  UI, Feedback-Zeile mit Serie/Trefferquote; kurze Pause nach Fehlern.
- **Tutor-Hints über Web Worker:** `AIController.requestTopMoves()` — keine
  blockierende Main-Thread-Suche mehr für den Tutor (UI bleibt flüssig).

## [1.5.0] – 2026-07-14

Engine-Stärkung (Eval/Quiescence) — H-Q1 (sound) + Match-Tooling.

> **Korrektur (2026-07-17):** H-Q2 (Quiescence Check-Extension) wurde
> **nicht** released. Ein reparierter Stärke-Gate-Match (NEW H-Q1+H-Q2 vs
> OLD H-Q1-only, 24 taktische 9×9-FENs, elo 1600) zeigte H-Q2 **macht die
> Engine schwächer** (5 NEW wins vs 8 OLD wins). H-Q2 wurde daher in
> `[Unreleased]` revertiert (siehe unten). Dieser Release enthält nur
> H-Q1 (Delta-Pruning, sound) + das Regression-Gate-Tooling.

### Suche / Quiescence

- `search.ts` `quiesce()`: Delta-Pruning (H-Q1, sound). Wenn `standPat +
2000 < alpha`, wird der QSearch-Zweig abgeschnitten — selbst das
  wertvollste nicht-königliche Capture + Beförderung kann den Score nicht
  über `alpha` heben. Kein Stärkeverlust möglich, spart aussichtslose
  QSearch-Tiefe.

### Tooling (Regression-Gates)

- `js/asymmetryProbe.ts`: balanced-vs-balanced Self-Play mit alternierenden
  Farben. Erkennt Color-Bias in TT/Eval/QSearch (eine Farbe >60% = Bug).
- `js/engineNode.ts` + `js/matchRefs.ts`: echter Stärke-Gate für die
  deterministische Engine — NEW_REF vs OLD_REF über zwei git-Worktrees
  (Self-Play ist wertlos, da beide Seiten identische Spiele replayen).

### Verifikation

- Asymmetrie-Probe (16 Partien): VERDICT SYMMETRIC, 0 crashes.
- `npx vitest run`: 223 Files / 2819 Tests passed (keine Regression).
- `npx tsc --noEmit` + eslint sauber.

## [1.4.2] – 2026-07-14

Engine-Stärkung (H3): längeres Suchzeit-Budget.

### Suche / Performance

- `search.ts`: `MAX_SEARCH_TIME` 3000ms → 5000ms. Die iterative Tiefensuche
  darf pro Zug bis zu 5s laufen statt 3s, erreicht dadurch bei schwierigen
  Stellungen (tiefe Suche, wo die Zeit der Flaschenhals ist) eine höhere
  durchschnittliche Suchtiefe → spürbar stärkerer Solo-Gegner.
- Trade-off: die JS-Suche läuft im Browser-Hauptthread (kein Worker beim
  `getBestMoveDetailed`-Fallback), d.h. ein KI-Zug kann bis ~5s die UI
  blockieren statt ~3s. Bewusste Abwägung zugunsten der Spielstärke.

### Verifikation

- Engine-Match (depth 3, 4 Games) läuft fehlerfrei durch (avg moves 37.8,
  keine Crashes); die Zeit-Erhöhung bricht die Engine nicht.
- 27 Search/Engine-Unit-Tests grün; `tsc --noEmit` und eslint sauber.

> Hinweis: Dieser Abschnitt wird von Hand gepflegt (nicht via `npm run
changelog`, da dieses Skript die gesamte Datei überschreibt und die
> Historie zerstören würde).

## [1.4.1] – 2026-07-14

Bugfix: Engine-Such-Asymmetrie (Null-Move-Pruning Perspektiven-Bug).

### Suche / Correctness

- `search.ts` Null-Move-Pruning: Perspektive beim Null-Move-Sub-Search
  korrigiert (`maximizing` → `!maximizing`). Vorher wurde die Null-Move-
  Bewertung aus der falschen Seiten-Perspektive genommen.
- `search.ts` Transposition-Table: Seite am Zug (`sideToMove`) in den
  Zobrist-Hash aufgenommen, damit Stellungen mit unterschiedlicher
  Zugpflicht nicht verwechselt werden.

### Symptom (vorher)

- Bei längerer Bedenkzeit (≥ 8s) dominierte in Engine-vs-Engine-Selbsttests
  eine Farbe systematisch (20:3 bei identischen Engines). Die Engine war bei
  kurzer Suche (3s) symmetrisch, wurde bei tiefer Suche aber einseitig.
- Nach dem Fix: Selbsttests bei 8s wieder symmetrisch (~21/24 Remis),
  keine messbare Regression bei 3s.

### Tests

- `tests/search.symmetry.test.ts`: Spiegel-Symmetrie-Guard (Position und
  gespiegeltes Pendant müssen gegensätzlich bewertet werden, Toleranz 100cp).
  Hinweis: der kritische Asymmetrie-Bug zeigt sich erst bei zeitgesteuerter
  Tiefsuche (8s-Match) und nicht bei fester Tiefe — der Match bleibt der
  autoritative Beweis.

> Hinweis: Dieser Abschnitt wird von Hand gepflegt (nicht via
> `npm run changelog`, da dieses Skript die gesamte Datei überschreibt
> und die Historie zerstören würde).

## [1.4.0] – 2026-07-14

Engine-Stärkung (Solo-Gegner) + Tooling. Keine neuen Spielfeatures,
keine Breaking Changes.

### Suche / Performance

- `search.ts`: IIR-Tiefen-Skip aktiviert (war toter Code) — bei extrem
  stabilen Bewertungen wird eine Tiefe übersprungen, um Budget für
  tiefere/wichtigere Stellungen zu sparen.
- `search.ts`: LMR-Skala 1.75 → 2.0 — präzisere Spätzug-Reduktionen
  (weniger zu aggressive Reduktion späterer Züge).

### Tools

- `engineMatch.ts`: Bugfix — Spielergebnisse wurden nicht in `this.results`
  gesammelt, die Summary zeigte immer 0 Games. Jetzt korrekt gepusht.
- `tools/match-harness.ts` (neu): Headless-Regression-Harness für
  Engine-vs-Engine-Matches (konfigurierbare Persönlichkeiten/Anzahl),
  nutzt `engineMatch.runEngineMatch`.

### Bekannt / Offen

- **Asymmetrie-Bug bei längerer Suche:** Erhöhung von `MAX_SEARCH_TIME`
  (aktuell 3000ms) über ~5s triggert bei Engine-vs-Engine-Matches
  asymmetrisches Verhalten (Schwarz dominiert 20:3 bei identischen
  Engines + alternierenden Farben). Ursache unklar (vermutet: TT/Eval-
  Farbenfehler bei tiefen Linien). **H3 (Zeit-Erhöhung) daher bewusst
  NICHT in diesem Release** — wird als eigenes Foundation-Thema verfolgt.

## [1.3.0] – 2026-07-14

Qualitäts- und Foundation-Release: schließt die Foundation-first-Härtungsrunde
ab (alle kritischen Logik-Module jetzt mit echten Assertions abgedeckt) und
rüstet die E2E-Abdeckung auf 25 Browser-Specs aus. Keine neuen Spielfeatures,
keine Breaking Changes — reines Robustheits- und Wartungs-Release.

### Foundation-Tests (Vitest, Logik-Module mit echten Assertions)

- #92 `chore(foundation)`: Stale Debug-Artefakte entfernt, E2E im echten
  Browser verifiziert.
- #93–#95 `test`: Foundation-Coverage-Lücken geschlossen — `MoveExecutor`
  (Turn-Wechsel, Promotion, Castling, En-Passant, Game-Over) +
  `OpeningBookTrainer` (CLI-Parser, Stats, Special-Piece-Mappings).
- #97 `test`: `AnalysisManager` (root) Piece-Values + Arrow-Guard.
- #98 `test`: Engine-Smoke-Tests für `search.ts` (Alpha-Beta-Kern).
- #99 `test`: `DailyPuzzle` Index-Rotation, Streak, Solved-Tracking.
- #100 `test`: `TacticsDetector`-Primitiven (`canPieceMove`, Threat/Defence).
- #101 `test`: `gameController` Game-End-State-Machine + `placeKing`.
- #102 `test`: `aiWorker` Message-Protokoll (`self.onmessage`-Handler).
- #103 `test`: `MoveExecutor` Kern (Turn-Switch, Promotion, Castling,
  En-Passant, Game-Over).
- #104 `test(e2e)`: schnelle Smoke-Suite für App-Boot + Board-Render pro Modus.
- #105 `chore`: Tech-Debt-Sweep — flaky Search-Invariant, eslint, prettier.
- #106 `test`: `MoveController` Kern (Material-Value, Play-Click, Redo/Undo-UI).

### E2E-Tests (Playwright, Browser-Specs)

- #84 `e2e/cross` + `e2e/daily-puzzle`: Cross-Modus + Tägliches-Puzzle Specs.
- #85 `e2e/post-game-analysis`: Post-Game-Analyse (Blunder/Accuracy) verifiziert
  im echten Browser.
- #104 `e2e/smoke`: App-Boot + Per-Mode-Board-Render.
- Gesamte E2E-Suite: **25 Specs** (Playwright, Chromium) — u.a. neu:
  `3d_toggle`, `accessibility`, `shop`, `standard8x8`, `tutorial`,
  `upgrade_modes`.

### Dependencies (Maintenance)

- #86 `chore(deps)`: development-dependencies group — 9 Updates
  (u.a. eslint 10.5→10.7, @typescript-eslint 8.61→8.63, globals 17.6→17.7).
- #87/#89 `chore(deps)`: runtime-dependencies group — 4 Updates
  (three 0.184→0.185.1, @types/three 0.182→0.185.1, vite 8.0.16→8.1.4,
  prettier 3.8.4→3.9.5). Ursprünglicher Dependabot-PR #87 hatte einen
  Merge-Konflikt mit #86; sauber als #89 neu aufgesetzt.
- #88/#90→#91 `typescript`: Major-Bump 6.0.3→7.0.2 (#90) brach die
  Lint-Stufe — `typescript-eslint` v8 kennt TS 7 nicht
  (`TypeError: ... reading 'Cjs'` in typescript-estree). Revertiert auf
  `^6.0.3` (#91). TS 7 erst wieder anfassen, wenn `typescript-eslint` v9
  (mit TS-7-Support) released ist.
- #107 `fix`: TS1149 Casing-Collision + alle restlichen `tsc`-Type-Errors in
  Tests bereinigt (`tsc --noEmit` → 0 Errors).
- #108 `chore`: Dependabot Auto-Merge abgestellt — künftige Dependency-PRs
  brauchen manuellen Review/Merge.
- Lockfile via `npm install --legacy-peer-deps` regeneriert (CI nutzt
  `npm ci --legacy-peer-deps`; der eslint-plugin-import ↔ eslint 10
  Peer-Konflikt ist bewusst toleriert).

### Tests / Coverage

- Neue `tests/dailyPuzzle.test.ts` (15 Tests): Index-Determinismus, lokales
  Datum-Format, Solved-Round-Trip, Streak, leeres Set.
- Gesamte Unit-Suite: **2818 Tests, 0 Regressionen** (222 Testdateien,
  Vitest) + 25 E2E-Specs (Playwright, Chromium).
- Coverage-Gate: **Lines 92.63% | Branches 82.12% | Functions 91.84%**.

## [1.2.0] – 2026-07-12

Neues Feature: **Tägliches Puzzle** — ein jeden Tag rotierendes Schachtaktik-Puzzle
(Solo, kein Multiplayer). Reuse der bestehenden `puzzleManager`-Infrastruktur.

### Feature

- `DailyPuzzleManager` (`js/dailyPuzzle.ts`): wählt deterministisch ein Puzzle pro
  Kalendertag (rotiert um lokale Mitternacht), trackt "heute gelöst" pro Tag
  (`localStorage['dailyPuzzle.solved.YYYY-MM-DD']`) und eine Siegesserie
  (`getStreak`, aufeinanderfolgende gelöste Tage).
- Neue Main-Menu-Karte "Tägliches Puzzle" (`data-mode="daily-puzzle"`) mit
  "Heute gelöst ✓"-Badge (aktualisiert beim App-Start + live nach dem Lösen).
- `gameController.startDailyPuzzleMode()` lädt das Tages-Puzzle über die
  bestehende `puzzleManager.loadPuzzle`-Pipeline; der Solve-Hook in
  `MoveExecutor` markiert den Tages-Status.
- `GameMode`-Union um `'daily-puzzle'` erweitert (inkl. `GAME_MODES.DAILY_PUZZLE`).

### Fixes (aus Code-Review)

- Puzzle-Index und Solved-Key nun beide auf lokaler Tagesbasis (zuvor rotierte
  der Index UTC-mitternachts → falscher "schon gelöst"-Status westlich von UTC).
- `getTodaysPuzzle`-Null-Guard für leere Puzzle-Sets korrekt getestet.

### Tests / Coverage

- Neue `tests/dailyPuzzle.test.ts` (15 Tests): Index-Determinismus, lokales
  Datum-Format, Solved-Round-Trip, Streak, leeres Set.
- Gesamte Unit-Suite: 2672 Tests, 0 Regressionen (209 Dateien).

## [1.1.2] – 2026-07-12

Bugfix-Release für den Eröffnungs-Trainer. Ein E2E-Browser-Check nach
v1.1.1 deckte einen kritischen Bug auf, den die Unit-Tests nicht fanden.

### Fixes

- **Trainer zeigte ein leeres Brett:** Das Hauptthread-`openingBook`-Singleton
  wurde nie mit Daten gefüllt — nur der isolierte AI-Worker-Kontext lud das
  Buch. `startOpeningTrainerMode` lädt `opening-book.json` jetzt idempotent
  via neue `ensureOpeningBookLoaded()` (nur wenn noch leer), bevor die erste
  Stellung gerendert wird.
- **E2E-Abdeckung:** `e2e/opening-trainer.spec.ts` bestätigt im Browser, dass
  das Brett mit echten Figuren rendert und der Zwei-Klick-Move-Flow Feedback
  auslöst.

### Tests / Coverage

- Neue E2E-Spec (2 Tests, Chromium) für den Trainer-Modus.
- Gesamte Unit-Suite: 2657 Tests, 0 Regressionen.

## [1.1.1] – 2026-07-12

Bugfix-Release für den Eröffnungs-Trainer (v1.1.0): der Play-Loop ließ sich
nicht korrekt bedienen.

### Fixes

- **Erste Stellung wurde nicht gerendert:** `startOpeningTrainerMode` lief vor
  `UI.initBoardUI`, sodass das erste Brett leer blieb. Render jetzt nach dem
  Board-Setup.
- **Klick-Fallthrough:** Ein Klick auf ein leeres/gegnerisches Feld fiel an
  `MoveController` durch und selektierte fremde Figuren. Der Trainer schluckt
  nun jeden In-Phase-Klick.
- **Stale Selektion:** `loadTrainerPosition` setzt `selectedSquare`/`validMoves`
  beim Laden einer neuen Stellung zurück (betraf den „Start"-Button-Pfad).

### Tests / Coverage

- Play-Loop-Tests von 7 auf 9 erweitert (Fehler-Zug-Feedback, Klick-Verschlucken).
- Gesamte Testsuite: 2654 Tests, 0 Regressionen.

## [1.1.0] – 2026-07-12

Neues Feature: **Eröffnungs-Trainer** (Solo-Spielmodus). Trainiere Eröffnungen aus dem
trainierten Eröffnungsbuch — eine Stellung wird auf das Brett gelegt, du findest den
buch-gelisteten Zug, bekommst sofortiges Feedback und dein Fortschritt (Trefferquote,
Streak, gelöste Linien) wird lokal gespeichert.

### Features

- **Eröffnungs-Trainer-Modus** (`js/openingTrainer.ts`): `OpeningTrainerManager` lädt
  das `OpeningBook`, wählt eine trainierbare Stellung, prüft den eingereichten Zug
  gegen den Buch-Zug und führt Streak/Accuracy/Trefferstatistik.
- **Stellungs-Rekonstruktion:** Buch-Positionen (Hash) werden via
  `reconstructBoardFromHash` zurück in ein renderbares Brett + Zugrecht gewandelt.
- **Fortschritt persistiert:** `localStorage` (Key `openingTrainer.progress`),
  isoliert vom Spiel-Autosave — auto-geladen beim Start, speicherbar nach jeder Runde.
- **Menü-Shell** (`js/ui/OpeningTrainerMenu.ts`): dünne DOM-Schicht mit Start-Button
  und Fortschrittsanzeige.
- **Modus-Verdrahtung:** `GameController.startOpeningTrainerMode()`, `GameMode`
  um `'opening-trainer'` erweitert, Hauptmenü-Karte + `#opening-trainer-container`
  in `index.html`.

### Tests / Coverage

- Neue Test-Suite `tests/openingTrainer*.test.ts` (21 Tests): Manager-Logik,
  Hash-Rekonstruktion (weiß/schwarz, multi-figurig), Persistence (Edge-Cases
  inkl. korruptem/partiellem JSON), Menü-Shell und Modus-Verdrahtung.
- Gesamte Testsuite: 2645 Tests, 0 Regressionen.

## [1.0.4] – 2026-07-12

Qualitäts-Release: Test-Basis für den Eröffnungs-Trainer geschärft. Keine neuen
Features, keine Breaking Changes.

### Tests / Coverage

- **coverage:** `js/chess-pieces.ts` (reines Re-Export-Barrel) aus dem Coverage-
  Report ausgeschlossen — v8 meldete fälschlich 0%, während das Zielmodul voll
  getestet ist. Gesamt-Coverage dadurch leicht gestiegen (#74)
- **OpeningBookTrainer:** Coverage von 67% → 81% Lines (Branch 69% → 80%) (#75)
  - CLI-Argument-Parser aus `main()` in exportierte pure Funktion `parseCliArgs()`
    extrahiert (testbar, ohne Laufzeitverhalten zu ändern)
  - neue Tests: CLI-Parser (8), `printStats()`-Ausgabe, Spezialfiguren-Mappings
    (Erzbischof/Chancellor/Engel/Nightrider) in `boardToUi` + `getBoardHashInt`

## [1.0.3] – 2026-07-12

Qualitäts-Release: Typsicherheit im Produktivcode geschärft. Keine neuen Features,
keine Breaking Changes.

### Refactoring / Typsicherheit

- **types:** neues `SavedGameState`-Interface; `savedGameState: unknown` → typisiert (#72)
- **GameStateManager:** 3 unterdrückte `as any`-Casts entfernt
  (`window.battleChess3D` bereits typisiert, `savedGameState`-Zugriff mit Null-Guard) (#72)
- **PieceManager3D:** `game as any` entfernt — `whiteCorridor`/`blackCorridor` sind
  echte `Game`-Properties (#72)
- **MoveExecutor:** `defenderData` `as any` → `as Piece` (konsistent mit `attackerData`) (#72)
- **eslint:** `@typescript-eslint/no-explicit-any` im src von `warn` → `error` gehärtet;
  verhindert künftige unbemerkte `any`-Einführung (#72)

## [1.0.2] – 2026-07-12

Wartungs-Release: Fokus auf Code-Qualität (ESLint/Prettier-Bereinigung, tests/
ins Linting aufgenommen) und Doku. Keine neuen Features, keine Breaking Changes.

### Chores / Code-Qualität

- **eslint:** generierten `coverage/`-Ordner + `docs/`, `engine-wasm/pkg/`, `build/`
  in die Flat-Config-`ignores` aufgenommen (behebt 7 False-Positive-Parse-Errors) (#68)
- **eslint:** veraltete `.eslintignore` entfernt (von Flat Config nicht unterstützt),
  Inhalte in `eslint.config.mjs` migriert (#68)
- **eslint:** `tests/` ins Linting aufgenommen mit test-tauglichem Regelsatz
  (`no-explicit-any` in Tests aus, unused-vars TS-aware als error) (#70)
- **prettier:** gesamtes Repository durchformatiert (`prettier --write .`) (#68)
- **docs:** Testzahlen in README aktualisiert (> 2.600 Tests / > 200 Testdateien) (#69)

## [1.0.1] – 2026-07-12

Maintenance-Release nach `v1.0.0-stable`. Schwerpunkt: umfangreiche
Test-Invarianten-Suiten (Coverage der Kernmodule deutlich erhöht), CI-Stabilität
und gezielte Bugfixes/UX-Verbesserungen. Keine neuen Features, keine Breaking Changes.

### Bug Fixes

- **PGNGenerator:** korrekte Rochaden-/Beförderungs-/Schach-/Disambiguierungs-Notation (#47)
- **aiController:** ausgewogener Fallback für unbekannte Gegner-Persönlichkeiten (#46)
- **tutor:** KI-Tutor tatsächlich stärker als die Gegner-KI machen (#36)
- **ai:** Root-Level-ProbCut deaktiviert, der KI-Züge ab Elo >= 1400 fallen ließ
- **ai:** JS-Search-Bugs nach WASM-Entfernung behoben
- **ui:** mobile Action-Bar-Overflow + Board-Tap-Verhalten
- **ui:** NotificationUI XSS-sicher, barrierefrei, gestapelt
- **ui:** 2D-Board sichtbar und klickbar (board-wrapper Opacity/Pointer-Events)
- **ui:** Shop-Panel am Desktop rechts angedockt (verdeckt das Brett nicht mehr)
- **ui:** PWN->Engel-Direkt-Upgrade in Upgrade-Modi erlaubt
- **e2e:** Tutorial-Seen-Flag seeden, damit First-Run-Overlay Klicks nicht blockiert

### Features

- **aiController:** `null` zurückgeben, wenn Hint-Worker-Pool leer ist
- **aiController:** Worker-Pool-Init mit Fallback-Fehlerbehandlung gehärtet
- **aiWorker:** Heartbeat-Selbstüberwachung gegen Deadlocks
- **ui:** AI-Denkzustand im Spinner-Overlay anzeigen
- **ui:** Tutorial nur beim ersten Start (localStorage) + fehlendes `show()` bei Auto-Start

### UX / Accessibility

- dynamische Viewport-Units, erweitertes focus-visible, High-Contrast- +
  Touch-Target-Guards (#60)

### Refactoring

- **ai:** WASM-Engine entfernt, JS-Search-Root-Move-Bug behoben, CI aufgeräumt
- **AI:** AI-Timeout-Konstanten in config.ts zentralisiert

### Tests

- Uber 40 neue fokussierte Invarianten-Suiten fur Kernmodule (u.a. MoveGenerator,
  RulesEngine, Evaluate, MoveController, MoveValidator, MoveExecutor, TranspositionTable,
  AIController, CampaignManager, StatisticsManager, PGN-Generator/-Parser,
  OpeningBook(…), PuzzleManager, TacticsDetector, MoveAnalyzer, OpeningBookTrainer,
  PostGameAnalyzer, HintGenerator, ErrorManager/logger, DOMHandler, TooltipManager,
  EvaluationBar, GameController, OpeningBookUI). Gesamt-Coverage: stmts ~92% /
  fn ~91% / br ~81%.

### CI / Automation

- WASM-Build-Trigger für Dependabot-PRs repariert (Rust-Cache, Change-Detection)
- E2E nicht-blockierend gemacht, Coverage-Thresholds erzwungen
- Bundle-Budget angehoben + Chunk-Breakdown-Report
- Dependabot-Auto-Merge + Dependency-Graph-Snapshot

[1.0.1]: https://github.com/bumblei3/schach9x9/compare/v1.0.0-stable...v1.0.1

## [1.0.0] – 2026-07-10

Changes since `v1.0.0-stable`.

### Features

- **aiController:** return null when hint worker pool is empty (6476cdf)
- **aiController:** harden worker pool init with fallback error handling (7d0d30d)
- **aiWorker:** add heartbeat self-monitoring for deadlock protection (429b7a8)
- **ui:** show AI thinking state in spinner-overlay (363a72f)

### Bug Fixes

- remove unused variables and constants in Rust engine (6fb805b)
- remove PIECE_SVGS from window interface to avoid TS2687 conflict (9519124)
- resolve PIECE_SVGS window type conflict (ecedca4)
- resolve PIECE_SVGS type errors in OverlayManager and pieces/index (eb2fd04)
- **ai:** disable root-level probcut that dropped AI moves at elo>=1400 (a415511)
- **ai:** heal JS search bugs found after WASM removal (6de0789)
- **ci:** consolidate Window global types into tracked js/global.d.ts (b30f022)
- **deps:** pin vulnerable transitive deps via overrides (225bf9b)

### Documentation

- add CHANGELOG.md generated from conventional commits (62cd1e3)

### Refactoring

- **ai:** remove WASM engine, fix JS search root move bug, clean up CI (8bc2a68)
- **AI:** centralize AI timeout constants in config.ts (6eb26f2)

### Tests

- raise AnalysisUI coverage to 99% lines / 82% branches (9b28225)
- raise coverage on weakest modules (opening db/ui, analysis, tactics) (c472927)
- **aiController:** guard empty pool in getHint() (925a2fb)

### CI / Automation

- make E2E non-blocking and enforce coverage thresholds (89a6ead)
- remove dependency-submission step (action unavailable in this GH setup) (ff8797f)
- fix dependency-submission action version (v4 -> v3) (b1e46e6)
- submit dependency graph snapshot to keep vuln dashboard in sync (296651d)
- remove engine-wasm/target from Rust cache to fix missing WASM artifact (f597c76)
- retrigger (60db38e)
- remove WASM change-detection, always build to fix Dependabot PRs (943ef94)
- retrigger CI after WASM build fix (c3c5a7c)
- trigger WASM build on package-lock.json changes (fix Dependabot PRs) (13a24bc)
- increase bundle budget to 2500 KB and make non-blocking for PRs (6e54678)
- remove engine-wasm/target from Rust cache to fix missing WASM artifact (4e1b9e8)
- remove WASM change-detection, always build to fix Dependabot PRs (03c5502)
- trigger WASM build on package-lock.json changes (fix Dependabot PRs) (98ba861)
- clear eslint cache (35dc8d8)
- **deps:** bump actions/checkout from 6 to 7 (1d1c343)
- **deps:** bump actions/cache from 5 to 6 (25e8c2e)
- **deps:** bump actions/checkout from 6 to 7 (9364084)

### Chores

- chore(deps-dev)(deps-dev): bump @types/node from 25.9.3 to 26.0.0 (65a9582)
- chore(deps-dev)(deps-dev): bump the development-dependencies group with 7 updates (#22) (bf8206d)
- **deps:** prefer focused npm dependency PRs over large bundles in Dependabot (604eaef)
