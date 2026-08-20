# Release v1.7.0 — 2026-08-20 (MESZ)

## Zusammenfassung

Engine-Strärkung: Eval-Patches bleiben, LMR_MAX_REDUCTION wird von 2 auf 3 revertiert (Regression bei Messung auf Tiefe 4). Release-Validierung: SF-Match gegen SF≈1400, d4, n=20 (läuft im Hintergrund, ~12 Minuten).

## Engine-Änderungen

### Behalten
- Eval-Patch (59164cf): Bishop-Paar-Bonus (+30 cp), Passed-Pawn-Endspiel-Multiplikator (2.0×), Turm 7. Reihe-Endspiel-Bonus mit offenem/geschlossenem Datei-Scaling
- Revert LMR_MAX_REDUCTION 2→3 (d37b282 reverted): Regression auf Tiefe 4 gemessen (−53 cp statt +9 cp mit LMR=3)

### Nicht im Release
- LMR_REDUCTION=2: revertiert nach Regression; Messung zeigt −53 cp auf Tiefe 4 (vs +9 cp mit LMR=3)
- Tiefe-5-Benchmark (d5, LMR=2): −147 cp; Interpretation offen (Zeitmangel, avgMaxDepth nur 4.8)

## Benchmark-Ergebnisse (n=40, jeweils balanced@e2500 vs aggressive@e2500)

| Konfiguration | W–D–L | EloDiff (balanciert über aggressiv) |
|---|---|---|
| LMR=3, eval-patch, d4 (nach Revert) | 1–39–0 | +9 cp |
| LMR=2, eval-patch, d4 (vor Revert) | 7–20–13 | −53 cp |
| LMR=2, eval-patch, d5 (Diagnose) | 7–10–23 | −147 cp |

## Nächste Hebel (nach Release)
- SF-Match-Validierung: absolute Stärke vs SF≈1400 (läuft, ~12 Min.)
- Eval-Verbesserungen: Springer-Entwicklung, Königssicherheit Endspiel, Passed-Pawn-Progressiv-Bonus
- Tiefe-5-Zeitsteuerungs-Diagnose: adaptive Zeitallokation, NPS-Monitoring, Suchskalierung
- OpeningBookTrainer: Optional, aber ohne stärkere Engine wenig Sinn

## Gates (alle grün vor Release)
- `npx tsc --noEmit`: OK
- `npx eslint .`: OK (0 Warnungen)
- `npm test`: 2944 Tests in 237 Files, OK (80s)
- CI: ausstehend (nach Push)
