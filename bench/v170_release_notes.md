# Release v1.7.0 — Engine-Messergebnisse

## SF-Match vs Stockfish (absolute Stärke)
- Spiele: 20 (vollständige Regeln: Rochade + EP + automatische Queen-Promotion)
- Tiefe: 4 vs SF-Tiefe 8, SF-Elo 1400
- Ergebnis: 0 Siege, 1 Remis, 19 Niederlagen
- Score: 0,025
- Elo vs SF≈1400: −636 cp (95%-Konfidenzintervall: −1200 bis −395)
- Terminierungsbreakdown: 19 Schachmatt, 1 Max-Ply

## Benchmark-Stack (relativ, Self-Play)
Alle Messungen: balanced@e2500 vs aggressive@e2500, 8s/Zug, n=40

| Konfiguration | W–D–L | EloDiff | Status |
|---|---|---|---|
| LMR=3, eval-Patch, d4 | 1–39–0 | +9 cp | Nach Revert (Release) |
| LMR=2, eval-Patch, d4 | 7–20–13 | −53 cp | Vorher (revertiert) |
| LMR=2, eval-Patch, d5 | 7–10–23 | −147 cp | Diagnose (nicht im Release) |

## Vergleich zur kanonischen Baseline
- Kanonische Baseline (Track B, 2026-08-02): 0–3–17, Score 0,075, Elo −436
- V1.7.0 (aktuell): 0–1–19, Score 0,025, Elo −636
- Delta: −200 cp (Regression)

## Bewertung
Die SF-Messung zeigt eine signifikante Schwächung gegenüber der kanonischen Baseline. Die 95%-CI (−1200..−395) überlappt teilweise mit der Baseline (−436), aber der Punktschätzer −636 ist deutlich schlechter. Ursache unklar — Eval-Patch + LMR=3 könnten zusammenwirken oder Einzelkomponenten (z.B. Turm-7.-Reihe-Bonus) könnten in bestimmten Positionen kontraproduktiv sein.

Nächste Schritte:
1. SF-Match wiederholen (n=40 für schmalere CI) — klärt, ob Regression echt oder Noise
2. Eval-Komponenten einzeln disabling/enabling testen — isoliert den Schuldigen
3. LMR=3 ohne Eval-Patch messen — klärt, ob LMR-Revert allein ausreicht
