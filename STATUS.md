# schach9x9 — Status (Stand: 2026-08-21)

Laufender Zustand des Repos `bumblei3/schach9x9` (branch `main`, tag `v1.7.0`).
Gehalten von Hermes; bei jeder "wie weiter verbessern"-Run neu verifiziert.

## Gesundheit

| Gate      | Befehl             | Ergebnis                                                                 |
| --------- | ------------------ | ------------------------------------------------------------------------ |
| Tests     | `npx vitest run`   | 2944 Tests in 237 Files — grün (Release-Zeitpunkt v1.7.0)                |
| Typecheck | `npx tsc --noEmit` | grün (nach v1.7.0, Commit `fbba0c8`)                                     |
| Lint      | `npx eslint .`     | grün (0 Warnungen nach v1.7.0)                                           |
| Build     | `npx vite build`   | `dist/` vorhanden/ok                                                     |
| Security  | CodeQL             | keine offenen Alerts (letzte Fixes #169/#170/#171)                       |
| CI        | GitHub Actions     | LINT + TEST + BUILD + CI-Gate grün; E2E/Lighthouse/Security non-blocking |

## Absolute Strength — Track B

```bash
npm run match:stockfish -- --games=20 --depth=4 --sf-depth=8 --sf-elo=1400 --quiet
```

| Messung                                     | W–D–L (wir) | Score     | Elo vs SF≈1400 |
| ------------------------------------------- | ----------- | --------- | -------------- |
| 2026-08-02 (post-underpromo)                | 0–3–17      | 0.075     | ≈ −436         |
| v1.7.0 Release-Check                        | 0–1–19      | 0.025     | ≈ −636         |
| A/B pre-eval `fbba0c8` (heute)              | 1–2–17      | 0.100     | ≈ −382         |
| A/B `v1.7.0` rerun (heute, gleiche Harness) | 0–5–15      | **0.125** | **≈ −338**     |
| `v1.7.0` **Tages-Run n=40** (2026-08-21)    | 4–3–33      | **0.138** | **≈ −319**    |
| mob=1.2 Exp (2026-08-21, verworfen)         | 1–3–36      | 0.063     | ≈ −470        |

**Die −200 cp (0.075 → 0.025) sind Rauschen bei n=20, kein Eval-Rückschritt.**
Gleicher Harness, gleicher Tag: v1.7.0 **0.125** vs pre-eval **0.100**. 95%-CIs
überlappen alle (−1200 .. ca. −170). illegal-sf = 0.

N=40-Lauf (2026-08-21): Score **0.138** (≈ −319 cp), CI −599..−196. Bestätigt:
der Release-Check von −636 cp war ein n=20-Ausreißer; mit n=40 liegt die
realistische Schätzung bei ≈ −319 cp, konsistent mit dem Rerun (0.125). CI
schmaler als alle n=20-Läufe.

Eval-Hypothese mob=1.2 (2026-08-21, n=40): Score **0.063** (≈ −470 cp),
Regression ~75 cp vs Baseline. Hypothese **verworfen** — Mobilitätserhöhung
auf 9x9 schwächer. Revert auf mob=1.0.

Eval-Hypothese pawn=110 (2026-08-21, n=40): Score **0.100** (≈ −382 cp),
Regression ~63 cp vs Baseline. Hypothese **verworfen** — Pawn-Bonuserhöhung
auf 9x9 schwäcker. Revert auf pawn=100.

Eval-Hypothese tempo=20 (2026-08-21, n=40): Score **0.125** (≈ −338 cp),
Δ ~19 cp vs Baseline, 95%-CIs weit überlappend. **Nicht signifikant** —
weder Gewinn noch klarer Verlust. Revert auf tempo=10, nicht gemergt.

n=20 kann 200-cp-Claims nicht tragen. Merge-Gate: gleiche Flags, Score im
Rauschband (~0.00–0.15), kein Win gegen eine Einzelzahl (weder 0.025 noch
0.075). Für echte Hebel: **n≥40**.

Details: `bench/ABSOLUTE_STRENGTH_BASELINE.md` · Tool: `tools/stockfish-match.ts`
· Logs: `bench/sf_match_v170.log`, `bench/sf_match_v170_rerun.log`,
`bench/sf_match_preeval_fbba0c8.log`, `bench/sf_match_v170_n40.log`

## Engine-Stärkung 9×9 — feature-complete / geparkt

Alle Such-Hebel gemergt, bei fester Zeit/Depth **nicht messbar stärker**.
Relative 9×9-Messung: `js/matchRefs.ts` (Track A).

v1.7.0 (8×8/9×9-Eval): Läuferpaar, Freibauer-Endspiel, Turm 7. Reihe;
LMR_MAX_REDUCTION zurück auf 3 nach d4-Regression bei 2 (−53 cp).
d5-Diagnose intern: avgMaxDepth 4.8 bei 8 s/Zug — Suche skaliert nicht.

## Lizenz

WTFPL (Commit 8ec8ceb).

## Offene Punkte

- **illegal-sf behoben:** Ursache war Unterpromotion (SF `c7c8b`, wir nur `…q`).
- **Absolute Stärke:** klar unter SF-1400 bei d4. Eval-Patch von v1.7.0 ist
  **kein** gemessener Rückschritt. Keine neuen Eval-Terme — n=20 sieht sie nicht.
- **TypeScript 7:** blockiert durch typescript-eslint v8 → TS 6.0.3.
- **Multiplayer:** bewusst nicht geplant.

## Solo-UX

- Standard 8×8 spielbar (Worker + Opening Book + volle Regeln).
- Post-Game-Replay-Overlay in v1.7.0.
- Position teilen per Link.

## Nächster sinnvoller Schritt

1. Engine-Hebel nur mit **n≥40** derselben Flags; Ziel ist nicht 0.075
   „zurückzuholen“. Nächster technischer Hebel: Zeitsteuerung (d5 kommt nicht
   über Tiefe 4.8), nicht neue Eval-Terme.
2. TS 7 warten auf eslint-Support.
3. NNUE / OpeningBookTrainer / SF-1600 parken.
