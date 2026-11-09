# schach9x9 — Status (Stand: 2026-11-10)

Laufender Zustand des Repos `bumblei3/schach9x9`.
Release-Tag bleibt `v2.0.0`. `main` ist `d1b1e41`. Akt IV (Kapitel 19–25) liegt auf `main`: stille Mattaufgaben, kein Stellungstext. Kapitel 26 gibt es nicht. Die Testzahlen in der Tabelle sind der letzte gezählte Stand, nicht eine neue Zählung von `d1b1e41`.
`ROADMAP.md` ist die Planung, `bench/NEGATIVE_RESULTS.md` die verworfenen Hebel.

## Gesundheit

| Gate | Befehl | Ergebnis |
|------|--------|----------|
| Tests | letzter gezählter Lauf, Node 26, `c53213d` | 262 Dateien, 3173/3173. Für `d1b1e41` nicht neu gezählt |
| Tests (CI) | Referenz #215, nicht der Zähler von `d1b1e41` | 250 Dateien, 3070/3070 (Node 24) |
| Typecheck + Lint | zuletzt abgelesen vor `d1b1e41` | nicht neu gezählt |
| Build | zuletzt abgelesen vor `d1b1e41` | nicht neu gezählt |
| E2E + Lighthouse | zuletzt abgelesen vor `d1b1e41` | nicht neu gezählt |
| Security | CodeQL, zuletzt abgelesen vor `d1b1e41` | nicht neu gezählt |
| CI | GitHub Actions | #214–#219 sind die Läufe vom Oktober 2026, nicht der Stand `d1b1e41`. Pages-Deploy läuft nur auf `main` |
| Git | `main` `d1b1e41` (2026-11-10) | Tag bleibt `v2.0.0`. Arbeitsbaum sauber, kein offener PR. Akt IV, Partieende und der minimatch-Pin sind auf `main`. |

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
| **main nach v2.0.0** | A11y-Labels, Vitest 5 (#212), TypeScript 7 Side-by-Side (#214), M1.3 64-bit-Zobrist (#215), Tagespuzzle als Sitzungseinstieg (#217/#219), Neues Spiel startet denselben Modus (#218), Akt IV, Partieende über `handleGameEnd` | auf `main`, kein neuer Tag |

`main` ist v2.0.0 plus die Zeile oben. Kein v2.1: der M1.3-Lauf ist neutral zur v1.9-Messung.

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

**Nächster sinnvoller Schritt:** Die Engine bleibt eingefroren. Als Nächstes die Live-Seite durchspielen: Setup/Shop, Kapitel 19, Opening-Trainer. Der Partieende-Fix soll dabei dieselbe Nachspiel-Ansicht zeigen wie ein Matt. Jede Konsolen-Abweichung am selben Tag als Regressionstest. Kein Tag v2.1. NNUE bleibt geparkt, M1.2 bleibt zu.
