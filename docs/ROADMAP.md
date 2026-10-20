# schach9x9 — Roadmap

Stand: 2026-10-20 · `main` `a9b1e0e` (v2.0.0 + TS 7 #214 + M1.3 #215 + Tagespuzzle-Einstieg #217/#219 + Rematch #218) · Live: https://bumblei3.github.io/schach9x9/

Dieses Dokument ist die kanonische Planung. `STATUS.md` hält den Mess-Ist-Stand, `bench/NEGATIVE_RESULTS.md` die verworfenen Hebel. Ältere Vorschläge in `docs/verbesserungsvorschlaege.md` sind historisch (TS-Migration, Multiplayer, Opening Book, PGN … sind erledigt oder bewusst abgelehnt).

---

## Vision

**Poliertes Solo-Feenschach auf 9×9**, mit einem Gegner der sich stark anfühlt — nicht ein Stockfish-Klon und nicht ein Feature-Friedhof.

Vier Qualitätsmaßstäbe:

| Dimension        | Ziel                                                                 |
| ---------------- | -------------------------------------------------------------------- |
| **Gegner**       | Spürbar stark, ohne die UI 10 s zu blockieren                        |
| **9×9-Identität**| Erzbischof, Kanzler, Engel, Nachtreiter sind das Spiel, nicht Dekor |
| **Lernen**       | Tutor/Puzzle/Kampagne erklären *dieses* Spiel, nicht nur 8×8-Matt   |
| **Solo-UX**      | Ein Sitzung: starten, spielen, verstehen, wiederkommen               |

**Bewusst nicht:** Multiplayer, Cloud-Sync, NNUE (geparkt), Opening-Book-„Stärkung“ (Vielfalt-Buch).

---

## Ist-Stand (ehrlich)

Das Produkt ist **feature-reich**. Billige Eval-Terme sind aufgebraucht (`bench/NEGATIVE_RESULTS.md`). M1.1 und M1.3 sind gemessen und liegen im selben Rauschen.

### Was bereits gut ist

- **Regeln:** 9×9 + Standard-8×8 (Rochade, EP, Unterpromotion) in derselben Integer-Engine.
- **Modi:** Classic 9×9, Standard 8×8, Setup/Shop, Upgrade, Cross, Kampagne Akt II, Fairy-Tactics, Daily Puzzle, Opening-Trainer, Analyse, 3D, Tutor mit Figurennamen.
- **KI-Infrastruktur:** Alpha-Beta + LMR/NMP/ProbCut/QSearch/TT, inkrementeller Zobrist, 64-bit-Hash auf `main`, 5 Persönlichkeiten, Worker, Track-A (`matchRefs`) und Track-B (`match:stockfish`).
- **Solo-UX:** Tutorial (inkl. Nachtreiter und Upgrade-Pfad), Replay, Position-teilen, Variant-Tree, Heatmap, Post-Game-Analyse, PWA/Offline, Sound-Settings persistent, Three.js self-hosted.
- **Qualität:** CI auf #215 grün (3070 Tests im Commit `80171dd`). A11y-Regeln `color-contrast`, `label`, `select-name`, `nested-interactive` sind an. TypeScript 7 läuft über den Side-by-Side-Alias (#214).

### Wo es wirklich hakt

1. **Die Stärkezahl ist ein Lauf mit breitem Intervall.** Kanonisch: `bench/sf_match_m1_symfix_n40.log`, 17–12–11, Score 0.575, +52 Elo gegen Stockfish 1400, Intervall etwa −55..+171, 0 `illegal-ours`. Die Zeile „−269 Elo“ weiter unten ist v1.8.0, nicht der Ist-Stand.
2. **M1.3 ist neutral.** `bench/sf_match_m13_n40.log`: 19–6–15, Score 0.550, +35 Elo, Intervall etwa −73..+151, 0 `illegal-ours`. Gegen +52 aus dem Symfix-Lauf ist das Rauschen.
3. **Der Wiederkommen-Anker ist jetzt der Einstieg.** War bis `fb20831` offen; in #217/#219 (`a9b1e0e`) verschiebt `syncDailyPuzzleMenu()` die Tagespuzzle-Karte je nach gelöst/ungelöst an die Sitzungsposition. E2E-Assert in `e2e/daily-puzzle.spec.ts`. Damit ist dieser Schnitt erledigt — der nächste ist strukturell (siehe Milestones).

### Track B — gemessene Hebel (n=40, gleiche Flags)

```
npm run match:stockfish -- --games=40 --depth=5 --sf-depth=8 --sf-elo=1400 --quiet
```

| Konfiguration                                      | Score  | Elo vs SF≈1400 | Entscheidung      |
| -------------------------------------------------- | ------ | -------------- | ----------------- |
| D4 Baseline (`v1.7.0`)                             | 0.138  | ≈ −319         | Referenz          |
| D5 ohne Tuning                                     | 0.125  | ≈ −338         | Tiefe allein ≠ +Elo |
| D5 + `LMR_BASE_DEPTH=4`                            | 0.163  | ≈ −285         | **behalten**      |
| D5 + LMR4 + `PROBCUT_REDUCTION=2`                  | 0.150  | ≈ −301         | verwerfen, bleibt 3 |
| D5 + LMR4 + `NULL_MOVE_R=1`                        | **0.175** | **≈ −269**  | **behalten** (v1.8-Freeze) |
| mob=1.2 / pawn=110 / tempo=20 / eg-passpawn 2.5    | 0.06–0.13 | schlechter  | **nie wieder**    |
| M1.1 inkrementeller Hash + Quiesce-Fix             | **0.575** | **≈ +52**   | Log `sf_match_m1_symfix_n40` |
| M1.3 64-bit-Zobrist (`fb20831`)                    | **0.550** | **≈ +35**   | neutral, Log `sf_match_m13_n40` |

`MAX_SEARCH_TIME` 10s ist gemessen (−44, 2026-08-22). Default bleibt 8s.

Beide Intervalle (−55..+171 und −73..+151) enthalten die 0 und schließen einen Rückfall auf den v1.8-Score 0.175 aus. Zwei Läufe tragen die Behauptung „etwa auf Höhe von Stockfish 1400, nicht fest darüber“.

---

## Prinzipien (nicht verhandelbar)

1. **Ein Hebel, eine Messung.** Isoliert, `n≥40`, gleiche Flags. n=20 trägt keine 200-cp-Claims.
2. **Negative Results nicht wiederholen.** Liste: `bench/NEGATIVE_RESULTS.md` + Tabelle oben.
3. **Keine Eval-Terme mehr.** Tiefe 5 ist seit M1.1 das Messprotokoll.
4. **Kein Double-DSP der Engine:** nicht LMR + NMP + ProbCut + Zeit gleichzeitig drehen.
5. **9×9 zuerst, 8×8 ist Kalibrierung.** Track B (SF) misst absolute Stärke; Track A (9×9 `matchRefs`) muss nach jedem Engine-Merge grün bleiben.
6. **Multiplayer bleibt draußen.**

---

## Nicht tun

| Idee                         | Warum nicht                                              |
| ---------------------------- | -------------------------------------------------------- |
| Mobility/Pawn/Tempo hoch     | n=40-Regressionen                                        |
| Zentrierte PSQT (H-P1)       | schwächer als handgetunte Tabellen                       |
| QSearch-Check-Extension      | schwächer bei fester Zeit                                |
| `LMR_MAX_REDUCTION=2`        | −53 cp auf d4                                            |
| `PROBCUT_REDUCTION=2`        | neutral/schlechter als 3                                 |
| Opening-Book auf Engine-PV   | zerstört das Vielfalt-Buch (#146)                        |
| NNUE                         | geparkt 2026-08-23; Gate negativ (−132 Elo vs PST)       |
| Coverage-Ziel 85 % Branches  | diminishing returns bei 7000+ Branches                   |
| TypeScript 7 nochmal aufrollen | erledigt in #214 (tsc 7, Linter auf TS-6-API)          |

---

## Milestones

Aufwand ist Kalenderzeit bei fokussierter Arbeit, nicht Story-Points. Akzeptanz ist messbar.

### M0 — Engine Freeze → v1.8.0

**Ziel:** Den Experiment-Ast schließen, einen spielbaren Release schiffen, Baseline festnageln.

**Dauer:** 1–2 Tage.

| # | Arbeit | Akzeptanz |
| - | ------ | --------- |
| 0.1 | Produktions-Knobs festlegen: `LMR_BASE_DEPTH=4`, `NULL_MOVE_R=1`, `PROBCUT_REDUCTION=3`, `LMR_MAX_REDUCTION=3` | Konstanten ohne „test hypothesis“-Kommentare |
| 0.2 | `MAX_SEARCH_TIME`: 8 s halten **oder** 10 s nur nach n=40 vs 8 s | Messung in `STATUS.md`; Default bleibt 8 s bis Gewinn ≥ ~30 cp *und* UI-Freigabe |
| 0.3 | Uncommitted `PROBCUT=3`-Revert committen; Bench-Logs unter `bench/` ablegen | Working tree sauber außer neuen Logs |
| 0.4 | `illegal-ours` in Track-B-Läufen (1/40 im NMP-R=1-Lauf) reproduzieren oder als Rauschen dokumentieren | 0 illegal-ours auf n=40 **oder** bekannte FEN + Ticket |
| 0.5 | `STATUS.md` + `CHANGELOG` + Tag `v1.8.0`, `main` pushen | Tag auf GitHub, 15-Commit-Vorsprung weg |

**Nicht in v1.8:** neue Eval-Terme, mehr Tiefe, NNUE.

**Definition of Done:** `vitest` + `tsc` + `eslint` grün; Track B n=40 Score ≥ 0.16 (≈ −285 oder besser); README zeigt v1.8.

---

### M1 — Suche skaliert (der echte Elo-Hebel) — ✅ 1.1 ERLEDIGT 2026-08-22

**Status:** M1.1 ist gemergt (`f91e116`). Kanonisch `sf_match_m1_symfix_n40.log`:
**0.575 / +52 Elo**, Intervall etwa −55..+171, 0 `illegal-ours`.
Die ältere „+230 gesamt“-Notiz lässt sich aus −269 und +52 nicht ableiten.
MAX_SEARCH_TIME 10s gemessen: −44 → 8s bleibt. M1.3 gemessen: 0.550 / +35, neutral zum Symfix-Lauf.

| # | Arbeit | Warum | Akzeptanz |
| - | ------ | ----- | --------- |
| ~~1.1~~ | ✅ Inkrementeller Zobrist-Hash gemergt (Quiesce-Fix, Log +52 Elo) | — | — |
| 1.2 | Hash-Keys für Rochade/EP (8×8) | TT-Kollisionen bei RuleState | Zu. Symfix und M1.3: je 0 `illegal-ours` |
| ~~1.3~~ | ✅ 64-bit Zobrist gemergt und gemessen: 0.550 / +35, neutral | — | — |
| 1.4 | Optional: Killer/History/Counter Move bleiben; **kein** neues Pruning | Pruning ist kalibriert | — |
| 1.5 | Track B nach 1.1: **n=40, d5, gleiche Knobs** | Messung, kein Glauben | Zwei Läufe: 0.575 und 0.550. Gate 0.30 erreicht. Intervalle enthalten die 0 |

**Weiter geparkt:** Bitboards, Magic Bitboards, SSE, WASM, Zuggenerierung. Der M1.3-Lauf liegt nicht unter dem Symfix-Lauf. Kein neuer Engine-Hebel.

---

### M2 — 9×9-Identität (Content) — ✅ ERLEDIGT in v2.0.0 (PR #185/#186/#188)

**Ziel:** Das Featured-Menü hält, was es verspricht. Feenfiguren sind lern- und spielbar.

**Dauer:** 2–4 Wochen. Parallel zu M1 möglich.

| # | Arbeit | Akzeptanz |
| - | ------ | --------- |
| 2.1 | **Kampagne Akt II** — mindestens +6 Kapitel, die *eine* Feenfigur ins Zentrum stellen (Erzbischof-Gabeln, Kanzler-X-Ray, Engel vs Dame, Nachtreiter-Linien) | Jedes Kapitel: einzigartige FEN, Persönlichkeit, 2★/3★-Ziele, E2E-Smoke |
| 2.2 | **Fairy-Tactics-Set** (20–40 handgemachte Puzzles) statt nur procedural Mate-in-1 | Puzzle-Menü: Filter „Feenfiguren“; Daily Puzzle darf daraus ziehen |
| 2.3 | Tutorial-Screen 4: Nachtreiter + Upgrade-Pfad (Shop 6 Punkte) | Quick-Start erwähnt alle vier Extra-Figuren |
| 2.4 | Kampagnen-Perks anbinden (`CAMPAIGN_PERKS` existiert, Wirkung prüfen) | 3 Perks kaufbar und in einer Mission nachweisbar |
| 2.5 | Talentbaum: ein Talent pro Feenfigur mit spürbarem Effekt | Kein reiner Flavor-Text; Test auf `effectType` |

**Nicht:** neue Brettform, neue Figur Nr. 5, Multiplayer-Kampagne.

---

### M3 — Coach, der 9×9 spricht — ✅ ERLEDIGT in v2.0.0 (PR #187/#189)

**Ziel:** Nach einem Zug versteht der Spieler *warum*, in der Sprache dieses Spiels.

**Dauer:** 1–2 Wochen. Sinnvoll nach 2.2 (Taktik-Set als Trainingsdaten).

| # | Arbeit | Akzeptanz |
| - | ------ | --------- |
| 3.1 | `TacticsDetector` um Feenmuster: Erzbischof-Gabel (Läufer+Springer), Kanzler-Spieß (Turm+Springer), Engel-Batterie | ≥ 8 Unit-Tests mit bekannten FENs |
| 3.2 | Tutor-Erklärung nutzt Figurennamen (Erzbischof, nicht „Läufer/Springer“) | Snapshot-Tests der Microcopy |
| 3.3 | Optional: nach Blunder auto-Hint (Setting, default aus) | Ein Toggle in Einstellungen, E2E |
| 3.4 | Opening-Trainer: 9×9-Buch nicht anfassen (Vielfalt). Stattdessen **handkuratierte** 20–30 Linien als „Lehrbuch“-Modus | Getrennt vom Vielfalt-Buch, 0 unlösbar (`check-book-solvability`) |

---

### M4 — Polish & Plattform

**Ziel:** Das Spiel fühlt sich fertig an, nicht wie ein Labor.

**Dauer:** 1–2 Wochen, nach M0. Kann mit M2/M3 verschränkt werden.

| # | Arbeit | Akzeptanz |
| - | ------ | --------- |
| 4.1 | **A11y Settings:** `e2e/accessibility.spec.ts` schaltet `color-contrast`, `label`, `select-name`, `nested-interactive` ab — das ist die Lücke | Diese Rules wieder an, 0 Violations auf Settings + Board |
| 4.2 | Three.js self-hosten (Paket 0.185 vs CDN 0.160 im Import-Map) | Import-Map ohne jsDelivr; CSP ohne fremdes `script-src` für Three |
| 4.3 | Sound-Settings persistieren (`sounds.ts` löscht den Key im Konstruktor und lädt danach) | Volume/Mute überlebt Reload |
| 4.4 | 3D: Capture-Juice + letzter Zug sichtbar ohne Overlay-Raten | Visueller Playwright-Snapshot |
| 4.5 | Deutsche Microcopy-Lücken (Puzzle-Generator ist noch englisch: „White to move. Find the checkmate…“) | Kein User-facing English außer Eigennamen |
| 4.6 | **PWA/Offline tatsächlich aktiv schalten** | Registrierung läuft (Produktions-Build, nicht im Dev-Server, nicht unter Automation); SW-Test gegen das ausgelieferte File |

**Stand M4 (2026-10-20):** 4.1–4.5 erledigt und verifiziert. 4.6 war als „PWA/Offline-fähig“ behauptet, aber der Registrierungsaufruf steckte kommentiert in `main.ts` — `public/service-worker.js` wurde nur nach `dist/` kopiert und nie aktiviert. In `fix/pwa-offline-aktiv` behoben: `js/serviceWorkerRegistration.ts` mit Guard auf Produktions-Build + `navigator.webdriver` (Playwright/Lighthouse) + `?disable-sw`, `tests/serviceWorker.test.ts` gegen das ausgelieferte Worker-File, toter Doppelgänger `service-worker.ts` gelöscht.

---

### M5 — Später / nur nach Gate

Erst anfassen, wenn M1 das Score-Ziel (0.30) **oder** klaren NPS-Beweis geliefert hat.

| Thema | Gate | Sonst |
| ----- | ---- | ----- |
| SF Elo 1600 / höhere SF-Tiefe | Track B Score ≥ 0.30 bei Elo 1400 | Parken |
| Syzygy/Endgame-TBs 8×8 | NPS-Sprung da, Endspiele verlieren Track-B-Partien | 9×9 hat keine TBs — nur 8×8-Kalibrierung |
| NNUE | Pipeline steht, Netze bei ~72% Agreement | GEMESSEN 2026-08-23: Gate −132 Elo → geparkt |
| TypeScript 7 | — | erledigt #214 |
| Desktop-Hülle (Tauri) | M4 a11y + PWA stabil | Unnötig für Web-first |
| GIF/PGN-Replay-Export | M3 Coach steht | Nice-to-have |

---

### M6 — Struktur (nach M4, vor neuen Features)

**Ziel:** Das Repo darf nicht weiter wachsen, ohne dass die Grundform mitkommt. Kein Feature, nur Wartbarkeit — deshalb ohne Elo-Gate.

**Dauer:** 1–2 Tage.

| # | Arbeit | Akzeptanz |
| - | ------ | --------- |
| 6.1 | ~~`js/types/` konsolidieren: `core.ts`, `game.ts`, `ui.ts` tragen ~40 doppelte Typen. `game.ts` hat 29 Importer, `core.ts` 8~~ **Erledigt** | Ein Definitions-Ort pro Domäne, 0 doppelte Typnamen — `game.ts`/`ui.ts`/`ai.ts`/`campaign.ts` sind in `core.ts` aufgegangen (402 Zeilen weg), `index.ts` auf den einen Export reduziert |
| 6.2 | Coverage von `js/matchRefs.ts` anheben (28 % Statements — niedrigste Datei im Repo) | Track-A-Harness, der jede Stärke-Aussage trägt, ist gegen Regressionen getestet |
| 6.3 | `tools/` und `js/` auf totem Export prüfen (`npx knip`) | Keine ungenutzten Dev-Dependencies (`jest`, `ts-jest`, `husky`, `jsdoc`) |

**Stand M6 (2026-10-20):** 6.1 erledigt — `js/types/` ist jetzt ein Definitions-Ort: `core.ts` (53 Export-Sätze) plus das Blatt `gameMode.ts`. Die vier parallelen Dateien `game.ts`, `ui.ts`, `ai.ts`, `campaign.ts` (402 Zeilen) sind aufgegangen, 26 Importer umgestellt, `tsc`/`eslint`/`vitest`/`build` grün. 6.2 erledigt — `js/matchRefs.ts` 28,2 % → 71,7 % Statements, `tests/matchRefs.protocol.test.ts` (26 Tests) gegen das Line-Protokoll, `applyMove`/Promotion, `playGame`-Urteile und das moveNumber-100-Limit. Nebenbei: die Figurencode-Mapping existierte doppelt (`engineNode.ts` privat + „mirror" in `matchRefs.ts`) und ist jetzt `js/pieceCodes.ts`; die Promotionstabelle kannte `e`/`j` nicht und ließe ein Feen-Promotion im Harness als Bauer durchgehen. 6.3 erledigt — Jest-Überreste und `jsdoc` entfernt, `npm ci --legacy-peer-deps` sauber.

**Nicht:** Umschreiben der Engine, neue Eval-Terme, NNUE.

---

## Empfohlene Reihenfolge

```
M0 Freeze v1.8 ──┬── M1 Suche (Zobrist) ── M5-Gates
                 ├── M2 Kampagne / Fairy-Puzzles
                 └── M4 Polish (A11y, Sound, Three.js)
                              │
                              └── M3 Coach (braucht 2.2)
```

**Nächster konkreter Schritt:** M6 Struktur ist vollständig (6.1 `js/types/`, 6.2 `matchRefs.ts`, 6.3 tote Dependencies). Tagespuzzle-Einstieg und PGN-Export sind erledigt. Die Engine bleibt eingefroren.

---

## Offene Produktentscheidungen

Diese drei Punkte sind keine Technik, sondern Richtung. Default, falls niemand entscheidet:

1. **Zeitbudget KI:** **8 s gemessen bestätigt** (10s: −44) — abgehakt.
2. **Nach v2.0.0:** M2/M3/M4 sind im Release bzw. auf `main` (A11y-Regeln an, TS 7, M1.3). **NNUE bleibt geparkt** (−132 Elo vs PST, n=80). Offener Engine-Rest ist nur noch M1.2, und nur bei `illegal-ours`. Die Richtung nach dem M1.3-Lauf steht in `STATUS.md`.
3. **Ist 8×8-Elo die Nordstern-Metrik?** Ja als *Regression-Gate*. Spielerwert kommt aus M2/M3.

---

## Release-Linie

| Version | Inhalt |
| ------- | ------ |
| **v1.7.0** | Eval-Patch, Replay, Share-Link, 8×8-Regeln — **released** |
| **v1.8.0** | M0: LMR4 + NMP R=1, aufgeräumte Knobs, dokumentierte Baseline — **released/getaggt** |
| **v1.9.0** | M1.1 + NNUE-Pipeline (Gate negativ, geparkt) — **released** |
| **v2.0.0** | M2+M3: Kampagne Akt II + Fairy-Coach — **released** |
| **main (2026-10-20)** | v2.0.0 + Vitest 5 + TS 7 (#214) + M1.3 (#215, gemessen neutral) + Tagespuzzle-Einstieg (#217/#219) + Rematch (#218). Kein neuer Tag |

v2.0 ist die erste Version, die man jemandem zeigen kann mit „das ist Feenschach, nicht Schach mit einem Extra-Feld“.
