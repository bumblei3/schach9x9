# schach9x9 — Status (Stand: 2026-08-21)

Laufender Zustand des Repos `bumblei3/schach9x9` (branch `main`, tag `v1.8.0`).
Gehalten von Hermes; bei jeder "wie weiter verbessern"-Run neu verifiziert.

**Roadmap / Milestones:** [`docs/ROADMAP.md`](docs/ROADMAP.md) — nächster Schritt ist **M1 inkrementeller Zobrist** (v1.8.0 eingefroren).

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

## Nächster Schritt — M1: Inkrementeller Zobrist

Heutige Suche macht `computeZobristHash` pro Knoten über alle 81 Felder.
Make/Undo aktualisiert den Hash nicht inkrementell. Das ist der Hebel für mehr effektive Tiefe.
Nicht neue Eval-Terme, nicht mehr Pruning — M1 ist reiner Such-Kosmetik-Aufwand.

Details: `bench/ABSOLUTE_STRENGTH_BASELINE.md`, `tools/stockfish-match.ts`.
Logs: `bench/sf_match_v170*.log`, `bench/sf_match_v170_d5_*.log`.

## Offene Punkte

- **MAX_SEARCH_TIME 10s:** unmeasured, auf 8s im Freeze. Eigenes n=40-Gate nötig vor Merge.
- **TypeScript 7:** blockiert durch typescript-eslint v8 → TS 6.0.3.
- **Geparkt:** NNUE, OpeningBookTrainer harder, SF-1600 Match — kein nächster Schritt bekannt.

## Lizenz

WTFPL (Commit 8ec8ceb).

## Solo-UX

- Standard 8×8 spielbar (Worker + Opening Book + volle Regeln).
- Post-Game-Replay-Overlay ab v1.7.0.
- Position teilen per Link.

**Nächster sinnvoller Schritt:** M1 Zobrist as a measurable Elo step — kein neuer Code für Feature, nur Suche sparen.

Und wenn das Wort von dir kommt, sagen wir, ob wir 10 s messen oder erst merken. Danach M1.
