# schach9x9 — Roadmap

Stand: 2026-08-23 · Basis: `v1.8.0` + M1.1 gemergt (+230 Elo) + NNUE-Pipeline auf `main` · Live: https://bumblei3.github.io/schach9x9/

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

Das Produkt ist **feature-reich und engine-satt**. Die letzten Wochen waren ein Such-Parameter-Tunnel. Billige Eval-Terme und Knob-Tweaks sind aufgebraucht; der nächste Elo-Gewinn ist strukturell.

### Was bereits gut ist

- **Regeln:** 9×9 + Standard-8×8 (Rochade, EP, Unterpromotion) in derselben Integer-Engine.
- **Modi:** Classic 9×9, Standard 8×8, Setup/Shop, Upgrade, Cross, Kampagne, Puzzle, Daily Puzzle, Opening-Trainer, Analyse, 3D.
- **KI-Infrastruktur:** Alpha-Beta + LMR/NMP/ProbCut/QSearch/TT, 5 Persönlichkeiten, Worker, Track-A (`matchRefs`) und Track-B (`match:stockfish`).
- **Solo-UX:** Tutorial, Replay, Position-teilen, Variant-Tree, Heatmap, Post-Game-Analyse, PWA/Offline.
- **Qualität:** 2944 Tests, tsc/eslint grün, Coverage global >90 %.

### Wo es wirklich hakt

1. **Suche skaliert nicht.** Bei 8 s/Zug `avgMaxDepth ≈ 4.8`, `avgNps ≈ 10k`. Tiefe 5 ohne Such-Tuning war *schwächer* als Tiefe 4. Ursache: `computeZobristHash` läuft **pro Knoten über alle 81 Felder** (`js/search.ts` → `js/ai/transpositionTable.ts`). Make/Undo aktualisiert den Hash nicht inkrementell.
2. **Absolute Stärke.** Bestes gemessenes Ergebnis vs Stockfish Elo 1400 (d5 vs SF d8, n=40): **4–6–30, Score 0.175, ≈ −269 Elo**. Solide Richtung, aber kein gleichwertiger Gegner.
3. **Kampagne ist dünn.** 6 Story-Kapitel + 5 Endspiel-Drills. Featured im Menü, Inhalt reicht für einen Nachmittag.
4. **Lernen ist 8×8-lastig.** Procedural Puzzles sind zufällige Matt-in-1/2-Stellungen, nicht Feenfiguren-Taktik (Gabel mit Erzbischof, X-Ray mit Kanzler).
5. **Engine-Ast ist unaufgeräumt.** `main` ist 15 Commits voraus, `js/search.ts` hat Test-Kommentare und eine uncommittete `PROBCUT_REDUCTION`-Korrektur. Kein Release seit v1.7.0.

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
| D5 + LMR4 + `NULL_MOVE_R=1`                        | **0.175** | **≈ −269**  | **behalten**      |
| mob=1.2 / pawn=110 / tempo=20 / eg-passpawn 2.5    | 0.06–0.13 | schlechter  | **nie wieder**    |

`MAX_SEARCH_TIME` 8s→10s ist committed als Experiment, **nicht** gegen n=40 gemessen. UI-Trade-off, kein Merge ohne Messung.

---

## Prinzipien (nicht verhandelbar)

1. **Ein Hebel, eine Messung.** Isoliert, `n≥40`, gleiche Flags. n=20 trägt keine 200-cp-Claims.
2. **Negative Results nicht wiederholen.** Liste: `bench/NEGATIVE_RESULTS.md` + Tabelle oben.
3. **Keine Eval-Terme mehr**, bis die Suche Tiefe 5 *tatsächlich* erreicht (avgMaxDepth ≥ 5.0 bei gesetztem Depth-5).
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
| TypeScript 7 jetzt           | typescript-eslint v8 blockiert                           |

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

**Status:** M1.1 (inkrementeller Zobrist + Quiesce-Negamax-Fix) ist gemergt
(commit f91e116). n40 vs SF-1400: **0.575 / Elo +52 → ~+230 gesamt**.
MAX_SEARCH_TIME 10s gemessen: −44 → 8s bleibt.

| # | Arbeit | Warum | Akzeptanz |
| - | ------ | ----- | --------- |
| ~~1.1~~ | ✅ Inkrementeller Zobrist-Hash **gemergt (+ Quiesce-Fix, +230)** | — | — |
| 1.2 | Hash-Keys für Rochade/EP (8×8) | TT-Kollisionen bei RuleState | Kein illegal-ours-Anstieg auf Track B |
| 1.3 | 64-bit Zobrist (BigInt oder zwei Int32) | 32-bit Hash + 1M TT = Kollisionen bei d5+ | Track A 9×9 unverändert oder besser |
| 1.4 | Optional: Killer/History/Counter Move bleiben; **kein** neues Pruning | Pruning ist kalibriert | — |
| 1.5 | Track B nach 1.1: **n=40, d5, gleiche Knobs** | Messung, kein Glauben | Teilweise erfüllt (n40-Merge-Messung liegt vor); Ziel 0.30 nicht erreicht |

**Parken bis nach 1.1:** Bitboards, Magic Bitboards, SSE, WASM-Rewrite. Erst messen, ob inkrementeller Hash reicht.

**Reihenfolge intern:** 1.1 allein mergen und messen. 1.2/1.3 nur wenn 1.1 den NPS-Sprung bringt und Track B nicht regressiert.

---

### M2 — 9×9-Identität (Content)

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

### M3 — Coach, der 9×9 spricht

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

---

### M5 — Später / nur nach Gate

Erst anfassen, wenn M1 das Score-Ziel (0.30) **oder** klaren NPS-Beweis geliefert hat.

| Thema | Gate | Sonst |
| ----- | ---- | ----- |
| SF Elo 1600 / höhere SF-Tiefe | Track B Score ≥ 0.30 bei Elo 1400 | Parken |
| Syzygy/Endgame-TBs 8×8 | NPS-Sprung da, Endspiele verlieren Track-B-Partien | 9×9 hat keine TBs — nur 8×8-Kalibrierung |
| NNUE | Pipeline steht, Netze bei ~72% Agreement | GEMESSEN 2026-08-23: Gate −132 Elo → geparkt |
| TypeScript 7 | typescript-eslint ≥ v9 | Warten |
| Desktop-Hülle (Tauri) | M4 a11y + PWA stabil | Unnötig für Web-first |
| GIF/PGN-Replay-Export | M3 Coach steht | Nice-to-have |

---

## Empfohlene Reihenfolge

```
M0 Freeze v1.8 ──┬── M1 Suche (Zobrist) ── M5-Gates
                 ├── M2 Kampagne / Fairy-Puzzles
                 └── M4 Polish (A11y, Sound, Three.js)
                              │
                              └── M3 Coach (braucht 2.2)
```

**Nächster konkreter Schritt:** M0. Ohne Freeze bleiben 15 Experiment-Commits und Test-Konstanten die Baseline verwischen — jede spätere Messung ist dann wertlos.

---

## Offene Produktentscheidungen

Diese drei Punkte sind keine Technik, sondern Richtung. Default, falls niemand entscheidet:

1. **Zeitbudget KI:** **8 s gemessen bestätigt** (10s: −44) — abgehakt.
2. ~~**Nach v1.8 zuerst M1 oder M2?**~~ M1.1 ist gemergt (+230). Nächster Hebel: NNUE-Blend-Gate.
3. **Ist 8×8-Elo die Nordstern-Metrik?** Ja als *Regression-Gate*. Spielerwert kommt aus M2/M3.

---

## Release-Linie

| Version | Inhalt |
| ------- | ------ |
| **v1.7.0** | Eval-Patch, Replay, Share-Link, 8×8-Regeln — **released** |
| **v1.8.0** | M0: LMR4 + NMP R=1, aufgeräumte Knobs, dokumentierte Baseline — **released/getaggt** |
| **main (post-v1.8.0)** | M1.1 inkrementeller Hash + Quiesce-Fix (+230 Elo), NNUE-Pipeline — noch nicht als Release getaggt |
| **v1.9.0** | Kandidat: Tag des aktuellen main-Stands (M1.1 + ggf. NNUE-Gate-Ergebnis) |
| **v2.0.0** | M2+M3: Kampagne Akt II + Fairy-Coach — das eigentliche 9×9-Spiel |

v2.0 ist die erste Version, die man jemandem zeigen kann mit „das ist Feenschach, nicht Schach mit einem Extra-Feld“.
