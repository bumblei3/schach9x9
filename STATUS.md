# schach9x9 — Status (Stand: 2026-08-23)

Laufender Zustand des Repos `bumblei3/schach9x9` (branch `main`, tag `v1.8.0`).
Gehalten von Hermes; bei jeder "wie weiter verbessern"-Run neu verifiziert.

**Roadmap / Milestones:** [`docs/ROADMAP.md`](docs/ROADMAP.md) — **M1.1 (inkrementeller Zobrist + Quiesce-Fix) ist gemergt** (+230 Elo); nächster Schritt ist das NNUE-Blend-Gate.

## Gesundheit

| Gate      | Befehl             | Ergebnis                                                                 |
| --------- | ------------------ | ------------------------------------------------------------------------ |
| Tests     | `npx vitest run`   | 2944 Tests in 237 Files — grün                                          |
| Typecheck | `npx tsc --noEmit` | grün                                                                     |
| Lint      | `npx eslint .`     | grün                                                                     |
| Build     | `npx vite build`   | `dist/` ok                                                               |
| Security  | CodeQL             | keine offenen Alerts                                                     |
| CI        | GitHub Actions     | LINT + TEST + BUILD + CI-Gate grün                                      |
| Git       | Branch `main`      | auf `v1.8.0` — Engine-Freeze committed; kein dirty Tree                |

## Engine-Freeze v1.8.0

| Konstante              | Wert | Bemerkung                                                      |
| ---------------------- | ---- | -------------------------------------------------------------- |
| LMR_BASE_DEPTH         | 4    | Winner d5 (Score 0.1625 vs Baseline 0.138)                    |
| NULL_MOVE_R            | 1    | Winner d5 (Score 0.175 — bestes Ergebnis)                     |
| PROBCUT_REDUCTION     | 3    | Winner d5 (Score 0.1625 vs PROBCUT_RED=2 0.150)              |
| MAX_SEARCH_TIME        | 8000 | Gemessener Default (8 s) — 10 s noch unmeasured, geparkt     |

Committed in `b5b6ca7` — freeze: v1.8.0 Knobs + revert MAX_SEARCH_TIME 10s→8s until measured.
Tag `v1.8.0` erstellt und gepusht.

## Absolute Strength — Track B

| Messung                                     | W–D–L   | Score   | Elo vs SF≈1400 |
| ------------------------------------------- | ------- | ------- | -------------- |
| v1.7.0 Tages-Run n=40                       | 4–3–33  | 0.138   | −319           |
| D5 + LMR_BASE_DEPTH=4 n=40                  | 1–11–28 | 0.1625  | −285           |
| D5 + LMR_BASE_DEPTH=4 + NULL_MOVE_R=1 n=40  | 4–6–30  | 0.175   | −269 (bestes)  |

Alle früheren Eval-Hypothesen (mob=1.2, pawn=110, tempo=20) verworfen — keine brachte n=40-Gewinn.
PROBCUT_RED=2 neutral/negativ (0.150 vs 0.1625) — verwerfen, auf 3 bleiben.

## M1.1 — Inkrementeller Zobrist (gemergt 2026-08-22, commit f91e116)

Inkrementeller Hash + Quiesce-Negamax-Fix (`-quiesce(-beta,-alpha)` an
minimierenden Knoten, Fenster + Perspektive gekoppelt).
n40 vs SF-1400: **0.575 / Elo +52** (Baseline −179) → **~+230 Elo gesamt**.
MAX_SEARCH_TIME 10s gemessen: 0.4375 / −44 → **8s bleibt im Freeze.**

Details: `bench/ABSOLUTE_STRENGTH_BASELINE.md`, `tools/stockfish-match.ts`,
`references/m1-incremental-hash-quiesce-fix-2026-08-22.md` (Skill).

## Native Selfmatch-Messung (tools/selfmatch.ts)

SF kann kein 9×9 — echte 9×9-Stärke wird nativ via `tools/selfmatch.ts`
gemessen (zwei benannte Configs, Farbwechsel, Elo + binomiales 95%-CI;
kalibriert: d4-vs-d3 = +280). Alle Knob-Experimente 2026-08-22 nativ n=30:
E1 bp50 −47, E2 passedPawnEgMult2.5 −58, S1 lmrBase3 **−280**, S2 lmr5 −12,
S3 nmr2 −12 → **v1.8.0-Freeze nativ bestätigt**, alle verworfen.

## NNUE-Track (GEPARKT 2026-08-23 — Gate negativ)

Pipeline komplett committed: Datengen (`tools/nnue-datagen.ts`), Trainer
(`tools/nnue-train.py`, venv `.venv-nnue/`), Export, JS-Inference
(`js/ai/nnue.ts`), Blend-Hook in evaluate.ts (default off), selfmatch-Wiring.

**Gate-Ergebnis (selfmatch baseline vs nnue30, n=80, d3):**
W-D-L 32–45–3, Score 0.681 → **nnue30 = −132 Elo [−223..−55] vs PST**.
72.8% Agreement reicht nicht; PST-Eval schlägt das Netz klar. Blend bleibt
default-off, Gewichte liegen in `data/`, Track ist gemessen beendet.

| Netz | Daten | Val decisive-agreement | corr |
| ---- | ----- | ---------------------- | ---- |
| e200 (256→32) | big-gen0 35k d3 | 71.9% | 0.324 |
| v2 (256×256→32) | + gen2 d4 (39.5k) | 72.8% | 0.346 |

Lehren: mehr Daten gleicher Art bringt ~nichts (+1pp); Epochen helfen monoton
(65→72 über 40→200); d4-Selfplay ohne Opening-Vielfalt bricht bei Ø 11 plies
ab (370/400 Remis kurz) — Gen-2 lieferte nur 4.4k Samples.
Netz schlägt den Suchscore (d3 sign-agreement nur 60.6%), verliert aber gegen
den fertigen PST-Eval.

**Falls der Track je wiederbelebt wird:** Opening-Randomisierung im Datengen
(diverse, entschieden Partien), tiefere Labels (d5+), größerer Netzentwurf —
erst dann neues Gate. Bis dahin: geparkt.

## Nächster Schritt

Kein offener Engine-Hebel bekannt (alle Knobs + NNUE gemessen tot).
Verbleibende Richtlinien laut ROADMAP: M2 Kampagne / M3 Coach / M4 Polish,
oder TS7-Re-check (`npm view typescript-eslint version`).

## Offene Punkte

- **MAX_SEARCH_TIME 10s:** gemessen 2026-08-22 (−44) → 8s bleibt, Punkt abgehakt.
- **TypeScript 7:** blockiert durch typescript-eslint v8 → TS 6.0.3.
- **NNUE:** GEPARKT 2026-08-23 — Gate negativ (−132 Elo vs PST, n=80).
- **Geparkt:** OpeningBookTrainer harder, SF-1600 Match.

## Lizenz

WTFPL (Commit 8ec8ceb).

## Solo-UX

- Standard 8×8 spielbar (Worker + Opening Book + volle Regeln).
- Post-Game-Replay-Overlay ab v1.7.0.
- Position teilen per Link.

**Nächster sinnvoller Schritt:** NNUE-Track ist gemessen geparkt (Gate −132 Elo). Kein offener Engine-Hebel — Richtung laut ROADMAP: M2 Kampagne / M3 Coach / M4 Polish.
