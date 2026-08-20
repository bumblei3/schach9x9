---
title: Release v1.7.0 — Engine-Evaluation-Verbesserungen & LMR-Rückkehr
tags: [release, engine, lmr, evaluation, benchmark]
---

# Release v1.7.0

Datum: 20. August 2026

## Was ist drin

### Engine-Evaluation-Verbesserungen

- Bishop-Paar-Bonus (zentrale, unbelädete Paare)
- Passed-Pawn-Endspiel-Bewertung (schachkompatibel 2.0×)
- Turm 7. Reihe mit File-Scaling (offene Datei → Bonus)
- Commit: 59164cf

### LMR-Rückkehr

- LMR_MAX_REDUCTION von 2 auf 3 zurückgesetzt
- Motivation: gemessene Regression auf d4 (−53 cp) bei REDUCTION=2; +9 cp bei REDUCTION=3
- Commit: 8b84535 / 5cd2324

## Benchmark-Ergebnisse (wie gemessen)

### LMR-Vergleich auf d3 (n=40 je)

| Konfiguration           | W   | B   | D   | EloDiff |
| ----------------------- | --- | --- | --- | ------- |
| LMR=2 (nach Eval-Patch) | 2   | 0   | 38  | +9 cp   |
| LMR=3 (nach Eval-Patch) | 1   | 3   | 36  | −17 cp  |

→ Auf d3 unsignifikant; LMR=2 leicht besser, aber innerhalb des Rauschens.

### LMR-Vergleich auf d4 (n=40 je)

| Konfiguration           | W   | B   | D   | EloDiff |
| ----------------------- | --- | --- | --- | ------- |
| LMR=2 (nach Eval-Patch) | 7   | 13  | 20  | −53 cp  |
| LMR=3 (nach Eval-Patch) | 1   | 0   | 39  | +9 cp   |

→ Regression mit REDUCTION=2 auf d4 klar messbar → Revert-Entscheidung.

### Tiefe-5-Benchmark (n=40, LMR=2, nach Eval-Patch)

- W=7 B=23 D=10, EloDiff −147 cp
- avgMaxDepth=4.8, avgNps=9993, avgMoves=32.7
- Signal: Zeitmangel bei 8s/Zug auf d5 — Engine sucht im Schnitt nur bis Tiefe 4.8

### SF-Match-Validierung (v1.7.0, Release-Check)

- 20 Spiele, volle Regeln (Rochade, En-passant, auto-Queen-Promotion)
- Engine-Tiefe 4 vs SF-Tiefe 8, SF-Elo 1400
- Ergebnis: W=0 D=1 L=19
- Score 0.025, Elo vs SF≈1400: −636 cp (95% CI: −1200 .. −395)
- 19 Checkmates, 1 max-plies-Draw

## Kontext & Einordnung

- Historische Baseline (2026-08-02): 0–3–17, Score 0.075, −436 cp
- v1.7.0 Release-Check: 0–1–19, 0.025, −636 cp
- Same-harness A/B (2026-08-20, gleiche Flags):
  - pre-eval `fbba0c8`: 1–2–17, 0.100, −382
  - `v1.7.0` rerun: 0–5–15, **0.125**, **−338**
- Die −200 cp sind **n=20-Rauschen**. Eval-Patch nicht zurückdrehen.

## Treiber für 1.8.0 (geparkt)

- SF-Match künftig n≥40 (n=20 trägt keine 200-cp-Claims)
- Tiefe-5-Diagnose (Zeitsteuerung, NPS) — Suche erreicht Tiefe 5 nicht
- Keine weiteren Eval-Terme, OpeningBookTrainer oder NNUE

## Dateien

- `js/search.ts` — LMR_MAX_REDUCTION = 3
- `js/evaluate.ts` — Eval-Patch (Bishop-Paar, Passed-Pawn, Turm 7. Reihe)
- `package.json` — Version 1.7.0
- `RELEASE-v1.7.0.md` — Release-Notizen
- `bench/sf_match_v170.log` — SF-Match-Rohdaten
