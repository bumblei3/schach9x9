# schach9x9 — Status (Stand: 2026-10-19)

Laufender Zustand des Repos `bumblei3/schach9x9`.
Release-Tag bleibt `v2.0.0`. `main` ist `fb20831` (M1.3, PR #215, 2026-10-19).
`ROADMAP.md` ist die Planung, `bench/NEGATIVE_RESULTS.md` die verworfenen Hebel.

## Gesundheit

| Gate | Befehl | Ergebnis |
|------|--------|----------|
| Tests | CI „Unit Tests (24)“ auf #215 | grün. Commit `80171dd`: 250 Dateien, 3070/3070 (Node 24) |
| Typecheck + Lint | CI „Lint & Type Check“ auf #215 | grün |
| Build | CI „Production Build“ auf #215 | grün |
| E2E + Lighthouse | CI auf #215 | grün |
| Security | CodeQL auf #215 | grün |
| CI | GitHub Actions | #214 (TS 7, auf `main`) und #215 (M1.3) komplett SUCCESS. Pages-Deploy läuft nur auf `main` |
| Git | `main` `fb20831` | M1.3 gemergt. Tag bleibt `v2.0.0` |

Working Tree zur Doku: dieser Stand. Der Bestätigungslauf schreibt `bench/sf_match_m13_n40.log` (Protokoll wie `bench/sf_match_m1_symfix_n40.log`). Dependabot #198 und #199 sind geschlossen (Vitest 5 kam über #212).

## Release-Linie

| Version | Inhalt | Stand |
|-------|---------|--------|-------|
| **v1.7.0** | Eval-Patch, Replay, Share-Link, 8×8-Regeln | released |
| **v1.8.0** | M0: LMR4 + NMP R=1, aufgeräumte Knobs, dokumentierte Baseline | released/getaggt |
| **v1.9.0** | M1.1 (inkrementeller Hash + Quiesce-Fix) | released. Kanonische Stärke ist der Symfix-Log (+52), nicht die alte „+230“-Notiz |
| **v2.0.0** | M2+M3: Kampagne Akt II + Fairy-Tactics + M3 Coach (Feenmuster, Figurennamen-Microcopy) + Daily Puzzle (deterministisch) | released/gemerged (PR #188, 2026-08-23) |
| **main nach v2.0.0** | A11y-Labels, Vitest 5 (#212), TypeScript 7 Side-by-Side (#214), M1.3 64-bit-Zobrist (#215) | auf `main`, kein neuer Tag |

`main` ist v2.0.0 plus die Zeile oben. Kein v2.1, solange der M1.3-Lauf nicht da ist.

## Engine — feature-complete / geparkt

Alle Eval- und Pruning-Knöpfe seit v1.7.0 sind gemessen und entweder eingefroren oder verworfen. Offen ist nur noch die M1.3-Wiederholungsmessung.

### Was gemerged (M1.1 — der Hebel, der funktionierte)

- Inkrementeller Zobrist-Hash + Quiesce-Negamax-Fix (commit f91e116, 2026-08-22).
- Kanonische Zahl: `bench/sf_match_m1_symfix_n40.log`. n=40, Tiefe 5, Stockfish Tiefe 8, Elo 1400, `lite-single`, Farbwechsel an, Buch aus. **17–12–11, Score 0.575, +52 Elo, 95%-Intervall etwa −55..+171.** Abschlussgründe: Matt 28, Max-Plies 12, **0 illegal-ours**.
- Die ältere Zeile „−269 Elo“ ist v1.8.0 (`NULL_MOVE_R=1`, Score 0.175), nicht der Ist-Stand. „+230 gesamt“ steht so in älteren Notizen und lässt sich aus diesen beiden Scores nicht ableiten (−269 → +52 ist rund +321). Weiter zitieren wir den Log.
- M1.1 hat den vollen 81-Felder-Hash pro Knoten abgelöst. Tiefe 5 ist seitdem das Messprotokoll.
- MAX_SEARCH_TIME 10s gemessen 2026-08-22: −44 → **8s bleibt im Freeze** (Commit b5b6ca7).

### M1.3 — gemergt, Messung läuft

- 64-bit-Zobrist (`Hash64` aus zwei Int32) in TT und Suche. PR #215, `main` `fb20831`. CI grün.
- Gleicher Track-B-Lauf wie der Symfix-Log, auf diesem Commit. Log: `bench/sf_match_m13_n40.log`. Ergebnis wird hier eingetragen, sobald `RESULT` im Log steht. Erwartung aus der Roadmap: etwa 0 cp (Kollisionen, kein neuer Eval-Term).

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
- 155 validierte Self-play-Puzzles in `puzzles.json`.

### Daily Puzzle (neu in v2.0.0, PR #188 / docs/puzzle.ts)
- Deterministisches Tagespuzzle: FNV-1a über Datum → gleiches Puzzle für alle an einem Tag.
- Sa/So = easy-Tier, Mo–Fr = medium.
- Damit hat das Spiel ein tägliches "Wiederkommen"-Anker-Event (Solo-Fokus).

### Tutor / Coach (M3.1–M3.4, PRs #187, #189)
- `TacticsDetector` um Feenmuster: Erzbischof-Gabel (Läufer+Springer), Kanzler-Spieß (Turm+Springer), Engel-Batterie.
- Tutor-Erklärung nutzt Figurennamen (Erzbischof, nicht "Läufer/Springer").
- M3.3: optionaler auto-Hint nach Blunder (Setting, default aus).
- M3.4: handkuratierte 20–30 Linien als "Lehrbuch"-Modus im Opening-Trainer (getrennt vom Vielfalt-Buch, 0 unlösbar).

### Sonstiges aus M4 / vorherigen Merges
- Sound-Settings persistieren (PR #184).
- Deutsche Microcopy weitgehend geschlossen (Puzzle-Generator war der letzte große englische Rest — nach M3.4 lokalisiert).
- CSP self-host für Three.js (jsDelivr aus Import-Map entfernt, eigenes `script-src`).
- A11y-Regeln im Playwright-Smoke angeschaltet (#184) — **Verifikation steht aus** (siehe unten).
- Post-Game-Replay-Overlay ab v1.7.0.
- Position teilen per Link.
- PWA/Offline-fähig.

## Verifizierte vs. behauptete Lücken

**Verifiziert (gemessen oder grün):**
- Engine bis M1.1: der Symfix-Log oben. Verworfene Hebel in `bench/NEGATIVE_RESULTS.md`.
- NNUE-Gate: n=80 Selbstmatch, −132 Elo gegen PST.
- CI auf #214 und #215: Lint, Tests, Build, E2E, Lighthouse, CodeQL, CI-Gate grün.
- M4.1: `e2e/accessibility.spec.ts` lässt `color-contrast`, `label`, `select-name` und `nested-interactive` an. Aus sind nur `landmark-unique`, `page-has-heading-one`, `scrollable-region-focusable`, `landmark-no-duplicate-main`. E2E auf #215 grün, inklusive der A11y-Label-Fixes vom 2026-10-19.

**Offen, bis der Lauf fertig ist:**
- M1.3-Score. Der Symfix-Lauf ist 32-bit-Hash. Ob 64-bit die +52 bewegt, sagt nur `bench/sf_match_m13_n40.log`.

## Offene Punkte

- **M1.3-Bestätigungslauf:** läuft, Protokoll identisch zum Symfix-Log. Danach diese Datei um die `RESULT`-Zeile ergänzen.
- **M1.2 (Hash-Keys für Rochade/EP auf 8×8):** nur wenn der Lauf wieder `illegal-ours` zeigt oder ein Probe gleiche Hashes für verschiedene Rochade-Zustände findet. Der Symfix-Lauf hatte 0 `illegal-ours`.
- **TypeScript 7:** erledigt in #214 (tsc 7, Linter bleibt auf der TS-6-API). Nicht wieder als Blocker führen.
- **MAX_SEARCH_TIME 10s:** gemessen 2026-08-22 (−44) → 8s eingefroren.
- **SF Elo 1600:** Gate war Track-B-Score ≥ 0.30 bei Elo 1400. Der Symfix-Lauf liegt bei 0.575, Intervall schließt die 0 ein. Erst den M1.3-Lauf abwarten, dann entscheiden.
- **Geparkt:** NNUE, Multiplayer, Tauri, Coverage-Ziel 85 % Branches, Eval-Knöpfe aus `NEGATIVE_RESULTS.md`, Opening-Book auf Engine-PV.

## Nächste Schritte

1. M1.3-Lauf zu Ende laufen lassen und die `RESULT`-Zeile hier eintragen.
2. Liegt das Intervall klar über 0: Engine-Arbeit zu. Nächster Produkt-Schnitt ist das Tagespuzzle als Einstieg der Sitzung, danach PGN-Export der Partie.
3. Fällt der Score wieder Richtung 0,2: der +52-Lauf war ein Ausreißer. Nächster einzelner Hebel ist die Zuggenerierung (NPS), n≥40. Kein neuer Eval-Term.

## Lizenz

WTFPL (Commit 8ec8ceb, 2026-08-02). Einheitlich mit trischach.

## Solo-UX

- Standard 8×8 spielbar (Worker + Opening Book + volle Regeln: Rochade, EP, Unterpromotion).
- 9×9 Classic, Standard 8×8, Setup/Shop, Upgrade, Cross, Kampagne, Puzzle, Daily Puzzle, Opening-Trainer, Analyse, 3D.
- Post-Game-Replay-Overlay ab v1.7.0.
- Position teilen per Link.
- PWA/Offline-fähig.

**Nächster sinnvoller Schritt:** `RESULT` aus `bench/sf_match_m13_n40.log` hier eintragen. NNUE bleibt geparkt. M1.2 bleibt zu, solange `illegal-ours` ausbleibt.
