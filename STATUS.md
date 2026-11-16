# schach9x9 — Status (Stand: 2026-11-16)

Laufender Zustand des Repos `bumblei3/schach9x9`.
Release-Tag ist `v2.1.0`. `main` ist `3d85186`. Akt IV (Kapitel 19–25) liegt auf `main`: stille Mattaufgaben, kein Stellungstext. Kapitel 26 gibt es nicht. Die Testzahlen in der Tabelle sind die Zählung von `3d85186`.
`ROADMAP.md` ist die Planung, `bench/NEGATIVE_RESULTS.md` die verworfenen Hebel.

## Gesundheit

| Gate | Befehl | Ergebnis |
|------|--------|----------|
| Tests | `npx vitest run`, Node 26, `898a750` | 271 Dateien, 3294/3294 (10,0 s) |
| Tests (CI) | Run 43908688755, `898a750` | grün, inklusive E2E |
| Typecheck + Lint | `898a750` | grün (`tsc --noEmit`, `eslint . --ext .ts`) |
| Build | `898a750` | grün |
| E2E + Lighthouse | Run 43914533913, `3d85186` | E2E grün. Lighthouse-Abfrage lief bis zum Fix nie (Budget-Fehler), jetzt echt: Performance 0,68 < 0,90 → rot; Job bleibt `continue-on-error`, siehe Eintrag unten |
| Security | CodeQL, Run 43908688741 | grün |
| CI | GitHub Actions | `898a750` grün (Run 43908688755) |
| Git | `main` `898a750` (2026-11-16) | Tag `v2.1.0`. Brett-Quadrat, Kreuz-Korridore, KI-Aufstellung (weiß wie schwarz) und Statuspille sind auf `main`. |

**Abhängigkeiten 2026-11-16:** jsdom 30.1.3 → 31.0.1 (#238), vite 8.3.6 → 8.3.8 und prettier 3.9.10 → 3.10.1 (#239) sind gemergt. jsdom 31 serialisiert `#abc` als `rgb(170, 187, 204)` und `translateY(0)` als `translateY(0px)`; drei Assertions prüften auf die Serialisierung statt auf die Wirkung und blockierten den Bump — Fix #240. #239 lag vor `8c1664a` (Header-Fix) und hatte deshalb falsche visuelle Baselines plus zehn Click-Timeouts in der CI; nach dem Rebase auf `main` war die E2E-Suite lokal grün (106 passed, 1 skipped, 3,4 min). `main` `a4eaad4` ist grün inklusive E2E und Pages-Deploy.

**Lighthouse-Gate lief nie (2026-11-16):** `.github/lighthouse-ci.json` ist eine LHCI-Config (`ci.assert.assertions`), wurde aber als `budgetPath` an `treosh/lighthouse-ci-action` übergeben — `budgetPath` erwartet eine `budgets.json`. `lhci assert` crashte seit dem ersten Lauf mit `Budget file is not defined as an array of budgets`, die Assertions liefen nie, und `continue-on-error: true` (auf Job und Step) zeichnete den Job grün. Die eigentlichen Zahlen standen nur im Artifact. Mit `configPath` statt `budgetPath` läuft die Abfrage jetzt — gegen den Lauf vom 16.11.2026 (Artifact `lhr-1794848942658`, gebautes `dist/`) und den PR-Lauf danach: **Performance 0,68 bzw. 0,75** (Budget ≥ 0,90, error — die Schwankung zwischen den Läufen ist die Runner-CPU, nicht die App), Accessibility 1,00 (≥ 0,95), Best-Practices 0,96 (≥ 0,90), SEO 1,00 (≥ 0,90); FCP 3,8 s (≤ 1,8 s), LCP 5,1 s bzw. 4,7 s (≤ 2,5 s), TTI 5,4 s bzw. 5,0 s (≤ 3,5 s), Byte-Gewicht 576 KiB (≤ 500 kB), CLS 0,008. Der Job bleibt `continue-on-error`, weil Performance ein bekannter, offener Hebel ist: 3D ist bereits lazy geladen, aber ungenutztes JS (175 KiB) und ungenutztes CSS (65 KiB) liegen im initialen Bundle, und das render-blockende Google-Fonts-Stylesheet kostet 0,8 s. Die Abfrage ist jetzt ein Maßstab statt eine Dekoration.

**PWA-Precache war leer (2026-11-16):** `public/service-worker.js` präcachete `['/', '/index.html', '/style.css']`. `style.css` wird nicht mehr ausgeliefert — Vite bündelt das CSS in `assets/main-*.css` — also scheiterte `cache.addAll` von Anfang an, und `.catch(() => {})` verschlang den Fehler. Im Browser gemessen: Cache `schach9x9-v8` mit **0 Einträgen**, ein frischer Install hatte also keinen Offline-Shell. Die Pfade außerdem absolut und deshalb auf GitHub Pages (`/schach9x9/`) falsch. Neu: `SHELL_PRECACHE` mit relativen Pfaden, `BUILD_PRECACHE` wird von einem kleinen Vite-Plugin aus `dist/` gefüllt (gehashte Assets; alles über 256 KiB bleibt außen vor, damit der 595-KiB-3D-Chunk nicht beim Install mitgeladen wird), Cache `schach9x9-v9`, und jede URL wird einzeln `cache.add`ed, damit ein einzelner Fehlschlag den Rest nicht kippt. Verifiziert: nach `register()` stehen 32 Einträge im Cache, und mit `Network.emulateNetworkConditions {offline:true}` lädt die Seite und erreicht `app-ready` — vorher war der Cache leer. `tests/serviceWorker.test.ts` prüft das Install-Verhalten, inklusive toleriertem Fehlschlag. Damit ist „PWA/Offline-fähig" erstmals echt wahr.

**3D-Visual-Test war tot (2026-11-16):** `e2e/visual.spec.ts` trug `test.skip(true, 'Skipping 3D visual test due to headless WebGL inconsistencies')` — danach 25 unerreichbare Zeilen, dazu ein verwaister Webkit-Baseline. Im Headless-Chromium läuft WebGL2 einwandfrei: der 3D-Container bekommt `active`, ein Canvas, `window.app.battleChess3D` existiert, und die Screenshot der Szene ist 277.791 Bytes (eine leere Fläche wäre im unteren Kilobyte-Bereich). Die eigentliche Ursache des alten Skip ist die bekannte Actionability-Falle an der Aktionsleiste, die `domClick` löst. Der Test läuft jetzt mit Baseline und ist dreimal stabil (5 passed, ~12,5 s). Damit ist die größte gelieferte Funktion — der 595-KiB-3D-Chunk — erstmals visuell gedeckt. Nebeneinander entfernt: neun verwaiste Baselines (`main-board-initial-*`, `menu-overlay-*`, `shop-panel-15-points-*`; kein `toHaveScreenshot` referenziert sie).

**Icons waren JPEG mit PNG-Endung (2026-11-16):** `public/icon-192.png` und `public/icon-512.png` waren **byte-identisch**, 321.204 Bytes, und in Wahrheit ein **1024×1024-JPEG** mit `.png`-Endung. `index.html` und `manifest.json` (root und `public/`) referenzierten zusätzlich `/schach9x9/icon-*.png` — auf GitHub Pages korrekt, in CI und lokal 404, im Lighthouse-Report der einzige Fehler. Beides behoben: die Icons sind jetzt echte PNGs in der deklarierten Größe (192×192 → 2.600 Bytes, 512×512 → 8.027 Bytes; das Bild hat nur 29 Farben, Quantisierung auf 64 Farben ist maximal 14/255 Abweichung), und die Pfade sind relativ — `../icon-192.png` im Manifest, weil das Manifest in `dist/assets/` liegt und `icon-192.png` dort nach `/assets/icon-192.png` (404) gelandet wäre. `../` landet in beiden Lagen richtig: `/icon-192.png` an Root, `/schach9x9/icon-192.png` auf Pages. Lighthouse gegen `dist/`: **0 Fehler**. `curl` gegen `dist/`: `/icon-192.png` → 200 `image/png` 2.600 B. Depotgröße der vier Icon-Dateien: 1.284.816 → 21.254 Bytes.

**Lokales Mess-Setup und die Skin-Frage (2026-11-16):** Der Performance-Score ist auf dieser Maschine bimodal — fünf Läufe auf einem identischen Build streuen zwischen 0,82 und 0,98, die LCP zwischen 1,95 s und 4,71 s, während der FCP konstant 1,95 s bleibt. Ein Einzellauf ist damit keine Aussage, und das galt auch für den CI-Budget-Wert. `tools/lighthouse-local.mjs` misst N Läufe und gibt Median plus Streuung aus (`node tools/lighthouse-local.mjs http://localhost:5050/ 5`). Damit nachgerechnet: alle acht Figuren-Skins liegen im Initial-Bundle (75,4 KiB), aktiv ist genau eine. Lazy-Skins (nur `classic` statisch, die anderen per Dynamic Import) senken die Übertragung deterministisch 566 → 504 KiB (−62 KiB), aber Median von Performance, LCP, TTI und Bootup-Zeit bleibt identisch (0,97 / 1,95 s / 3,3–3,5 s / 0,04 s). Die Skins sind also **nicht** umgebaut: Der Hebel ist die Übertragung, nicht die Zeit — und für 62 KiB wäre die Async-Umstellung von `setPieceSkin` plus drei Testdateien nicht gerechtfertigt.

Regressionsnotiz 2026-10-20: `bf89c14` („toter Settings-Store entfernt“) löschte `js/settings.ts`, ließ aber `tests/settings.test.ts` stehen → `TS2307` im Lint-Job, `Failed to resolve import` im Unit-Test-Job, CI-Gate zu. Fix `1a3947d` (Test entfernt). Lokal grün (255/3124, `tsc`, `eslint`, `build`), CI nach dem Fix grün inkl. E2E (84 passed) und Pages-Deploy. Lehre: ein gelöschtes Modul muss zusammen mit seinen Importern *und* seinen Tests im selben Commit gehen.

Tutor-Warndialog 2026-10-20 (#220, `182c923`): Der Vorab-Dialog („Grober Fehler?") nannte denselben Grund einmal pro bedrohter Figur und behauptete danach „Kein konkretes taktisches Motiv erkannt". Fix: `uniqueReasons()` in `js/tutor/MoveAnalyzer.ts` entdoppelt `warnings`/`tacticalExplanations`/`strategicExplanations`; der „kein Motiv"-Satz greift nur noch, wenn wirklich nichts gefunden wurde; die Zusammenfassung fällt im Dialog weg. Gefunden nur durch Dogfooding der Live-Seite, kein Test deckte es ab.

Bestätigungslauf: `bench/sf_match_m13_n40.log`, gleiches Protokoll wie `bench/sf_match_m1_symfix_n40.log`. Dependabot #198 und #199 sind geschlossen (Vitest 5 kam über #212).

## Release-Linie

| Version | Inhalt | Stand |
|-------|---------|--------|-------|
| **v1.7.0** | Eval-Patch, Replay, Share-Link, 8×8-Regeln | released |
| **v1.8.0** | M0: LMR4 + NMP R=1, aufgeräumte Knobs, dokumentierte Baseline | released/getaggt |
| **v1.9.0** | M1.1 (inkrementeller Hash + Quiesce-Fix) | released. Kanonische Stärke ist der Symfix-Log (+52), nicht die alte „+230“-Notiz |
| **v2.0.0** | M2+M3: Kampagne Akt II + Fairy-Tactics + M3 Coach (Feenmuster, Figurennamen-Microcopy) + Daily Puzzle (deterministisch) | released/gemerged (PR #188, 2026-08-23) |
| **main nach v2.0.0** | A11y-Labels, Vitest 5 (#212), TypeScript 7 Side-by-Side (#214), M1.3 64-bit-Zobrist (#215), Tagespuzzle als Sitzungseinstieg (#217/#219), Neues Spiel startet denselben Modus (#218), Akt IV, Partieende über `handleGameEnd`, 3D-Brett folgt 8×8/9×9 und der Kreuz-Form | auf `main`, kein neuer Tag |
| **v2.1.0** | „Kreuz & Aufstellung": quadratisches Brett, Kreuz-Korridore, KI-Aufstellung (weiß + schwarz) ohne Bauern auf der Grundreihe, Statuspille mit Sieger, 8×8-Korridorrekatur; `Problem melden` já vorbefüllt | released/getaggt (2026-11-16, `7c68a72`) |

`main` ist v2.1.0 plus die Doku-Commit danach. Der M1.3-Lauf ist neutral zur v1.9-Messung — die Engine bleibt eingefroren.

## Engine — feature-complete / geparkt

Alle Eval- und Pruning-Knöpfe seit v1.7.0 sind gemessen und entweder eingefroren oder verworfen. Der 64-bit-Hash ist gemessen und neutral.

### Was gemerged (M1.1 — der Hebel, der funktionierte)

- Inkrementeller Zobrist-Hash + Quiesce-Negamax-Fix (commit f91e116, 2026-08-22).
- Kanonische Zahl: `bench/sf_match_m1_symfix_n40.log`. n=40, Tiefe 5, Stockfish Tiefe 8, Elo 1400, `lite-single`, Farbwechsel an, Buch aus. **17–12–11, Score 0.575, +52 Elo, 95%-Intervall etwa −55..+171.** Abschlussgründe: Matt 28, Max-Plies 12, **0 illegal-ours**.
- Die ältere Zeile „−269 Elo“ ist v1.8.0 (`NULL_MOVE_R=1`, Score 0.175), nicht der Ist-Stand. „+230 gesamt“ steht so in älteren Notizen und lässt sich aus diesen beiden Scores nicht ableiten (−269 → +52 ist rund +321). Weiter zitieren wir den Log.
- M1.1 hat den vollen 81-Felder-Hash pro Knoten abgelöst. Tiefe 5 ist seitdem das Messprotokoll.
- MAX_SEARCH_TIME 10s gemessen 2026-08-22: −44 → **8s bleibt im Freeze** (Commit b5b6ca7).

### M1.3 — gemergt und gemessen, neutral

- 64-bit-Zobrist (`Hash64` aus zwei Int32) in TT und Suche. PR #215, `main` `fb20831`. CI grün.
- `bench/sf_match_m13_n40.log`, gleiches Protokoll: **19–6–15, Score 0.550, +35 Elo, 95%-Intervall etwa −73..+151.** Matt 34, Max-Plies 6, **0 illegal-ours**.
- Gegen den Symfix-Lauf (0.575 / +52, Intervall −55..+171) liegt das im Rauschen. Der 64-bit-Hash ändert die Stärke nicht. Erwartung war etwa 0 cp.

### Was nicht funktioniert hat (verworfen, dokumentiert)

- Alle Eval-Hypothesen (mob=1.2, pawn=110, tempo=20, eg-passpawn 2.5): n=40-Regressionen → nie wieder.
- PROBCUT_RED=2: neutral/schlechter als 3 (0.150 vs 0.1625) → auf 3 bleiben.
- LMR_MAX_REDUCTION=2: −53 cp auf d4 → verworfen.
- QSearch-Check-Extension: schwächer bei fester Zeit.
- Opening-Book auf Engine-PV: zerstört das Vielfalt-Buch (#146) → bewusst Vielfalt.

Siehe: `bench/ABSOLUTE_STRENGTH_BASELINE.md`, `bench/NEGATIVE_RESULTS.md`, `tools/stockfish-match.ts`, `tools/selfmatch.ts`.

### Native Selfmatch-Messung (Track A — echtes 9×9-Elo)

SF kann kein 9×9 → echte 9×9-Stärke via `tools/selfmatch.ts` (zwei Configs, Farbwechsel, Elo + 95%-CI; kalibriert: d4-vs-d3 = +280). Alle Knob-Experimente 2026-08-22 nativ n=30:
E1 bp50 −47, E2 passedPawnEgMult2.5 −58, S1 lmrBase3 **−280**, S2 lmr5 −12, S3 nmr2 −12 → **v1.8.0-Freeze nativ bestätigt**, alle verworfen.

### NNUE-Track — GEPARKT 2026-08-23 (Gate negativ)

Pipeline komplett committed: Datengen (`tools/nnue-datagen.ts`), Trainer (`tools/nnue-train.py`, venv `.venv-nnue/`), Export, JS-Inference (`js/ai/nnue.ts`), Blend-Hook in evaluate.ts (default off), selfmatch-Wiring.

**Gate-Ergebnis (selfmatch baseline vs nnue30, n=80, d3):**
W-D-L 32–45–3, Score 0.681 → **nnue30 = −132 Elo [−223..−55] vs PST**.
72.8% Agreement reicht nicht; PST-Eval schlägt das Netz klar. Blend bleibt default-off.

|| Netz | Daten | Val decisive-agreement | corr |
| ---- | ----- | ---------------------- | ---- |
| e200 (256→32) | big-gen0 35k d3 | 71.9% | 0.324 |
| v2 (256×256→32) | + gen2 d4 (39.5k) | 72.8% | 0.346 |

Lehren: Mehr Daten gleicher Art bringt ~nichts (+1pp); Epochen helfen monoton (65→72 über 40→200); d4-Selfplay ohne Opening-Vielfalt bricht bei Ø 11 plies ab (370/400 Remis kurz); Netz schlägt Suchscore (d3 sign-agreement nur 60.6%), verliert aber gegen den fertigen PST-Eval.

**Falls wiederbelebt:** Opening-Randomisierung im Datengen (diverse, entschieden Partien), tiefere Labels (d5+), größerer Netzentwurf — erst dann neues Gate. Bis dahin: geparkt.

## v2.0.0 — was das Release brachte (M2+M3)

v2.0.0 ist das erste Release, das die 9×9-Identität ernst nimmt — nicht nur als Dekor.

### Kampagne Akt II (M2.1, PR #185)
- +6 Kapitel, die *eine* Feenfigur ins Zentrum stellen (Erzbischof-Gabeln, Kanzler-X-Ray, Engel vs Dame, Nachtreiter-Linien).
- Jedes Kapitel: einzigartige FEN, Persönlichkeit, 2★/3★-Ziele, E2E-Smoke.

### Fairy-Tactics-Set (M2.2, PR #186)
- Handgemachte Fairy-Puzzles statt nur procedural Matt-in-1.
- Puzzle-Menü: Filter "Feenfiguren"; Daily Puzzle darf daraus ziehen.
- 8 handgemachte Feen-Puzzles in `js/puzzleManager.ts` (`fairy-archbishop-*`, `fairy-angel-*`, `fairy-chancellor-*`) plus 5 klassische; danach procedural via `js/puzzleGenerator.ts` / `js/puzzle/ProceduralGenerator.ts`. Kein `puzzles.json` — die frühere Notiz „155 Self-play-Puzzles in puzzles.json“ bezieht sich auf eine Datei, die es im Repo nie gab.

### Daily Puzzle (neu in v2.0.0, PR #188; `js/dailyPuzzle.ts`)
- Deterministisches Tagespuzzle: FNV-1a über Datum → gleiches Puzzle für alle an einem Tag.
- Sa/So = easy-Tier, Mo–Fr = medium.
- Damit hat das Spiel ein tägliches "Wiederkommen"-Anker-Event (Solo-Fokus).

### Tagespuzzle als Sitzungseinstieg (PR #217/#219, `main` `a9b1e0e`)
- `js/ui/dailyPuzzleMenu.ts` verschiebt die Karte: **ungelöst** → direkt hinter „Fortsetzen“ (bzw. an Position 1), **gelöst** → hinter „Klassisch 9×9“.
- Badge „Heute gelöst ✓“ und Serien-Anzeige (`daily-puzzle-streak`) auf der Karte.
- E2E-Assert in `e2e/daily-puzzle.spec.ts`: Reihenfolge in beiden Zuständen.
- Der Wiederkommen-Anker ist damit nicht mehr nur ein Modus unter mehreren, sondern der Einstieg der Sitzung.

### Tutor / Coach (M3.1–M3.4, PRs #187, #189)
- `TacticsDetector` um Feenmuster: Erzbischof-Gabel (Läufer+Springer), Kanzler-Spieß (Turm+Springer), Engel-Batterie.
- Tutor-Erklärung nutzt Figurennamen (Erzbischof, nicht "Läufer/Springer").
- M3.3: optionaler auto-Hint nach Blunder (Setting, default aus).
- M3.4: handkuratierte 20–30 Linien als "Lehrbuch"-Modus im Opening-Trainer (getrennt vom Vielfalt-Buch, 0 unlösbar).

### Sonstiges aus M4 / vorherigen Merges
- Sound-Settings persistieren (PR #184).
- Deutsche Microcopy weitgehend geschlossen (Puzzle-Generator war der letzte große englische Rest — nach M3.4 lokalisiert).
- CSP self-host für Three.js (jsDelivr aus Import-Map entfernt, eigenes `script-src`).
- A11y-Regeln im Playwright-Smoke angeschaltet (#184), erweitert #216. Verifiziert — siehe unten.
- Post-Game-Replay-Overlay ab v1.7.0.
- Position teilen per Link.
- PGN-Export der gespielten Partie (`#export-pgn-btn` in `DOMHandler.ts`, `js/utils/PGNGenerator.ts`, Copy + Download).
- PWA/Offline-fähig.

## Verifizierte vs. behauptete Lücken

**Verifiziert (gemessen oder grün):**
- Engine bis M1.1: der Symfix-Log oben. Verworfene Hebel in `bench/NEGATIVE_RESULTS.md`.
- NNUE-Gate: n=80 Selbstmatch, −132 Elo gegen PST.
- CI auf #214 und #215: Lint, Tests, Build, E2E, Lighthouse, CodeQL, CI-Gate grün.
- M4.1: `e2e/accessibility.spec.ts` lässt `color-contrast`, `label`, `select-name` und `nested-interactive` an. Aus sind nur `landmark-unique`, `page-has-heading-one`, `scrollable-region-focusable`, `landmark-no-duplicate-main`. E2E auf #215 grün, inklusive der A11y-Label-Fixes vom 2026-10-19.
- PWA/Offline: behauptet seit v2.0.0, war aber nie aktiv — der Registrierungsaufruf in `main.ts` steckte kommentiert, `public/service-worker.js` wurde lediglich nach `dist/` kopiert. Behoben und gemergt (PR #219, `f491a2b`, `js/serviceWorkerRegistration.ts`): Guard auf Produktions-Build + `navigator.webdriver` (Playwright/Lighthouse) + `?disable-sw`. Der tote Doppelgänger `service-worker.ts` im Repo-Root ist gelöscht; `tests/serviceWorker.test.ts` testet das ausgelieferte Worker-File.

**Zwei Läufe, dieselbe Aussage:**
- 32-bit (Symfix) 0.575 / +52 und 64-bit (M1.3) 0.550 / +35. Beide Intervalle enthalten die 0 und schließen einen Einbruch auf 0,2 aus. „Ebenbürtig mit Stockfish 1400“ schreiben wir nicht fest. „Wieder bei −269“ ist widerlegt.

## Offene Punkte

- **M1.2 (Hash-Keys für Rochade/EP auf 8×8):** zu. Der M1.3-Lauf hatte 0 `illegal-ours`, der Symfix-Lauf ebenfalls.
- **TypeScript 7:** erledigt in #214 (tsc 7, Linter bleibt auf der TS-6-API). Nicht wieder als Blocker führen.
- **MAX_SEARCH_TIME 10s:** gemessen 2026-08-22 (−44) → 8s eingefroren.
- **SF Elo 1600:** Gate Score ≥ 0.30 bei Elo 1400 ist in beiden Läufen erfüllt (0.575 und 0.550). Ein 1600er-Lauf misst die Decke, er macht den Gegner nicht stärker. Zurückgestellt, bis ein Produkt-Schnitt fertig ist.
- **Geparkt:** NNUE, Multiplayer, Tauri, Coverage-Ziel 85 % Branches, Eval-Knöpfe aus `NEGATIVE_RESULTS.md`, Opening-Book auf Engine-PV.

## Nächste Schritte

Erledigt und nicht wieder öffnen: Tagespuzzle-Einstieg (#217/#219, `a9b1e0e`), PGN-Export, `js/types/` in `core.ts`, `matchRefs.ts`-Coverage 71,7 %. Der offene Schritt steht am Ende dieser Datei.

## Lizenz

WTFPL (Commit 8ec8ceb, 2026-08-02). Einheitlich mit trischach.

## Solo-UX

- Standard 8×8 spielbar (Worker + Opening Book + volle Regeln: Rochade, EP, Unterpromotion).
- 9×9 Classic, Standard 8×8, Setup/Shop, Upgrade, Cross, Kampagne, Puzzle, Daily Puzzle, Opening-Trainer, Analyse, 3D.
- Post-Game-Replay-Overlay ab v1.7.0.
- Position teilen per Link.
- PGN-Export (Copy + Download).
- PWA/Offline-fähig.

**Erledigt 2026-10-20 (#221, `162df4b`):** Vorab-Warnung kalibriert. `analyzePlayerMovePreExecution` zählt nicht mehr den vollen Materialwert jeder bedrohten Figur, sondern eine statische Tauscheinschätzung (`staticExchangePenalty` über `aiEngine.getAllThreats` + `aiEngine.see`) auf der simulierten Stellung. Gedeckte Figur = 0, hängende = echter Wert. Vorher schlug der Dialog schon auf `e2-e4` an („2.9 Bauern“, Schwelle 200 cp) und blockierte den Zug. Zwei Fehler maskierten sich dabei gegenseitig: die Summenregel und der Verteidiger-Zähler, der am leeren `from`-Feld lief.

Belegt durch `tests/tutor/premoveWarning.penalty.test.ts` (5) und `e2e/tutor-premove-warning.spec.ts` (neu: ein normaler Eröffnungszug wird nicht abgefangen). Lokal `vitest` 257/3134, `tsc`/`eslint`/`prettier` sauber, `ai-move.spec.ts` + neuer Spec 3 passed; CI grün inkl. E2E.

**Erledigt 2026-10-20 (#222, `1d6eebc`):** `detectThreatsAfterMove` korrigiert. `pos` ist jetzt das Feld der bedrohten Figur (vorher das Startfeld — nach der Simulation leer), und die Deckung kommt aus `aiEngine.isSquareAttacked` + `aiEngine.see` statt aus `countDefenders`. `countDefenders` prüft `getValidMoves` und kann eine belegte Figur grundsätzlich nicht als gedeckt melden — deshalb meldete der Detektor gedeckte Figuren als „wird ungeschützt angegriffen!", eine falsche Coach-Aussage an den Spieler. Beide Fehler waren auf `main` reproduzierbar (2 rote Tests), jetzt grün. Der Detektor teilt sich das Kriterium mit dem Drohungen-Overlay (`js/AnalysisManager.ts`).

**Erledigt 2026-10-20 (#223, `eab8ad0`):** 3D-Schatten-Typ korrigiert. `SceneManager3D` wies `THREE.PCFSoftShadowMap` zu — in three.js r186 entfernt. Der Renderer wird beim Laden des 3D-Moduls aufgebaut, deshalb meldete three.js die Warnung bei *jedem* Seitenaufruf, auch ohne geöffnete 3D-Ansicht:

```
THREE.WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.
```

Fix: benannte Konstante `SHADOW_MAP_TYPE = THREE.PCFShadowMap` mit Begründung; `tests/ui/3d/shadowMapType.test.ts` hält das fest; die unvollständigen `three`-Mocks in `tests/battleChess3D.{boost,coords,dynamic}.test.ts` kannten nur den alten Namen. Gefunden durch Mitschreiben der Browser-Konsole auf der Live-Seite — kein Test und kein Coverage-Werkzeug zeigte es. Browser-Gegenprobe: Live-Build warnt, lokaler Build nicht.

**Seit 2026-10-21 auf `main`:** Akt IV ist committed, nicht mehr nur im Arbeitsbaum. Puzzle 12 und 13 hatten eine leere Reihe zu viel; der Zugmarker wird am String-Ende gelesen (`bbebe3c`), sonst wurde Weiß am Zug als Schwarz gelesen und der Tagespuzzle-Tipp öffnete kein Overlay. Zeitüberschreitung und die Remisregeln (50 Züge, Stellungswiederholung, zu wenig Material) laufen über `handleGameEnd` (`2f38b73`), wie Matt und Patt. Dependabot-Bumps bis three 0.187, Playwright 1.65, Actions 7 und tokio 1.54.1 sind gemergt. `minimatch` 10 unter ESLint und `typescript-estree` ist auf 11.0.5 gepinnt (`d1b1e41`); die 3er-Linie für `eslint-plugin-import` bleibt. Keine offene Dependabot-Meldung.

**Seit 2026-11-16 auf `main`:** `d925254` (3D-Brett folgt 8×8/9×9), `b8d75d1` (Fix: `syncToGame` nur mit Partie, Drehung nur bei Feen-Figuren — der Rotlauf d925254 war `TS2345` in `App.ts` plus `rotation` ohne Deckung im Test) und `98d6f6b` (3D-Kreuzform: `ensureBoard`/`createBoard` bekommen `boardShape`, `isBlockedCell` überspringt die vier Ecken, `battleChess3D.fitBoard` leitet Size und Shape weiter). Live gegengeprüft: der Kreuz-Modus erzeugt genau 45 3D-Felder. Konsolen-Abnahme der Live-Seite (Klassisch 9×9, Kreuz, 3D, Eröffnungs-Trainer, Puzzle, Setup, Analyse, Drohungen/Chancen, Eröffnungsbuch, Save/Load, Share, GIF-/PGN-Export): 0 Fehler, 0 Warnungen.

**Brett und Aufstellung 2026-11-16 (`d6e49bf`):** Die Eval-Bar ist ein Flex-Kind von `#board-container` und brachte den Brett-Wrapper auf 279×335 — die Zellen wurden 31×37 Rechtecke, in jedem Modus. `#board` trägt jetzt `aspect-ratio: 1` (verifiziert: 279×279, Zellen 31×31). Der Kreuz-Modus bot 27 „wählbare" Korridorfelder an, 18 davon blockierte Ecken, auf die nicht einmal geklickt werden konnte; Korridor-Highlight, `placeKing` und `handleBuyPiece` prüfen jetzt blockierte Felder (verifiziert: genau 9 wählbare Felder, d1–f3). Die KI-Aufstellung legte Bauern auf die Grundreihe (`gambit_15` → Bauer auf r8c5); `getOptimalSquare` meidet die Grundreihe, solange ein anderes Feld frei ist (verifiziert: Bauer auf r7c5). Weiße Korridor-Reihen sind `boardSize`-basiert — 8×8 nutzte vorher nur 6 der 9 Felder und die Grundreihen-Boni wirkten nie.

**Schwarze KI-Aufstellung 2026-11-16 (`27021a6`):** `aiSetupPieces` fiel bei voller vorderer Reihe auf einen zufälligen freien Platz zurück — inklusive der Grundreihe. Live reproduziert: zwei Schwarze Bauern auf r0/r1, während (1,3) noch frei war. Jetzt greift zuerst ein Nicht-Grundreihen-Fallback; der Zufallsfallback bleibt nur, wenn wirklich nichts mehr frei ist. Verifiziert: 6 Live-Läufe, 0 Bauern auf r0; der neue Test ist ohne den Fix rot.

**Statuspille 2026-11-16 (`24eb9b0`):** `GameStatusUI` leitete den Sieger bei `GAME_OVER` aus `game.turn` ab — das ist am Ende die *bedrängte* Seite. Weiß setzt matt, `turn` ist schwarz, die Pille sagte „Schwarz hat gewonnen!", während das Overlay korrekt „Weiß gewinnt!" zeigte. Neu ist `Game.winner` (`'white' | 'black' | 'draw' | null`), gesetzt an allen neun `GAME_OVER`-Stellen (Matt, Patt, ungenügendes Material, 50-Züge, Stellungswiederholung, Zeitüberschreitung, Aufgabe, Remis) und im Save/Load mitgeführt. Verifiziert am Puzzle `mate-in-1-001`: Pille, Overlay und `winner`-Feld nennen jetzt gleich Weiß. Test gegen die Verwechslung angebunden.

**Feedback-Kanäle (alle vorhanden, geprüft 2026-11-16):** Der Einstieg lag in „Menü → Einstellungen → ganz unten" — niemand fand ihn. Neu ist `#feedback-btn` im Aktionsmenü („Mehr"), das mit **einem Klick** im laufenden Spiel denselben Reporter öffnet (`9ace284`). Der Reporter baut ein vorbefülltes GitHub-Issue (`labels=playtest`, Titel `[Fehler|Unklar|Vorschlag] …`, Body mit Version, Modus/Phase, Stellung, letzten Client-Fehlern und Umgebung) — live verifiziert. Dazu GitHub Issues und das Playtest-Blatt [`docs/PLAYTEST_BOBLATT.md`](docs/PLAYTEST_BOBLATT.md), das die 30-Minuten-Sitzung in die Nordstern-Metriken von [`docs/PLAYTEST_PROTOCOL.md`](docs/PLAYTEST_PROTOCOL.md) überträgt und nach `docs/PLAYTEST_ERGEBNISSE.md` aggregiert wird.

**Erledigt 2026-11-16 (#242, `898a750`):** Der Visual-Test „Pawn Promotion Modal" lief stillschweigend durch. `e2e/visual.spec.ts` hatte im vierten Schritt ein `try { … } catch { return; }` um das Promotion-Overlay — wenn es nicht erschien, endete der Test ohne Fehlermeldung, grün und ohne den Baseline-Vergleich zu erreichen (lokal: „Promotion modal not visible, skipping screenshot", `1 passed`). Ursache für das fehlende Overlay war der KI-Mentor: `showBlunderWarning` fängt den Zug mit einem Bestätigungsdialog ab, bevor die Promotions-UI auftauchen kann. Das Szenario baut jetzt die Stellung sauber auf (klassisch 9×9, Könige e1/i9, weißer Bauer e8, `phase='PLAY'`, `isAI=false`, `kiMentorEnabled=false`, `ki_mentor_level='OFF'` im `addInitScript`) und prüft das Overlay sichtbar. Damit ist `promotion-modal.png` wirklich gedeckt; der Test braucht 3,9 s statt 18 s. E2E: 4 passed, 1 skipped.

**Nächster sinnvoller Schritt:** Die Engine bleibt eingefroren. `v2.1.0` ist draußen. Die Live-Seite ist durchgespielt (s. o.) — der Playtest mit 3–5 Spielern aus `docs/PLAYTEST_PROTOCOL.md` ist der nächste Datenpunkt, nicht weiterer Code. Das Ziel für das erste Blatt existiert jetzt: [`docs/PLAYTEST_ERGEBNISSE.md`](docs/PLAYTEST_ERGEBNISSE.md) (Sitzungen, Pro-Spieler-Tabelle, Akt-II-gegen-Akt-IV-Vergleich, Kommentare, Konsolen-Auffälligkeiten) — bisher bewusst leer. NNUE bleibt geparkt, M1.2 bleibt zu. Die Abhängigkeiten sind auf dem Stand von `main` (`898a750`): jsdom 31.0.1, vite 8.3.8, prettier 3.10.1.
