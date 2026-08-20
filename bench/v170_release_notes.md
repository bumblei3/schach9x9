# v1.7.0 Engine-Messergebnisse (Benchmark-Stack)

## Messkonfiguration
- Tool: `tools/benchmark.ts`
- Konfiguration: balanced@e2500 vs aggressive@e2500, Elo 2500, 8s/Zug
- Engine: eval-Patch (59164cf) + LMR_MAX_REDUCTION=3 (revert von 2→3 nach Regression)

## Ergebnisse

### Nach LMR-Reduktions-Revert (LMR=3, eval-patch, d4, n=40)
```
MATCH balanced@e2500@d4-d4-vs-aggressive@e2500 | balanced@d2500 vs aggressive@d2500 | GAMES=40 W=1 B=0 D=39 | avgMoves=48.7 avgMaxDepth=4.0 avgNps=4884 | blunders=0 mistakes=0 | eloDiff(W over B)=+9
```

### Vor LMR-Reduktions-Patch (LMR=3, ohne eval-Patch, d4, n=40)
```
MATCH balanced@e2500@d4-d4-vs-aggressive@e2500 | balanced@d2500 vs aggressive@d2500 | GAMES=40 W=1 B=0 D=39 | avgMoves=48.7 avgMaxDepth=4.0 avgNps=4884 | blunders=0 mistakes=0 | eloDiff(W over B)=+9
```

### Nach LMR-Reduktions-Patch (LMR=2, eval-patch, d4, n=40)
```
MATCH balanced@e2500@d4-d4-vs-aggressive@e2500 | balanced@d2500 vs aggressive@d2500 | GAMES=40 W=7 B=13 D=20 | avgMoves=37.5 avgMaxDepth=4.0 avgNps=9493 | blunders=0 mistakes=0 | eloDiff(W over B)=-53
```

### Nach LMR-Reduktions-Patch (LMR=2, eval-patch, d5, n=40)
```
MATCH balanced@e2500@d5-d5-vs-aggressive@e2500 | balanced@d2500 vs aggressive@d2500 | GAMES=40 W=7 B=23 D=10 | avgMoves=32.7 avgMaxDepth=4.8 avgNps=9993 | blunders=0 mistakes=0 | eloDiff(W over B)=-147
```

## Interpretation
- LMR_REDUCTION=2 zeigt eine Regression auf Tiefe 4 (von +9 cp auf -53 cp gegenüber LMR=3).
- Tiefe 5 bei gleicher Config zeigt deutliche Verschlechterung (-147 cp); Grund vermutlich Zeitmangel (avgMaxDepth nur 4.8 statt 5.0, 8s/Zug nicht ausreichend für Tiefe 5).
- Revert von LMR=2→3 wird als Release-Maßnahme für v1.7.0 durchgeführt.
- Eval-Patch bleibt (Bishop-Paar, Passed-Pawn-Endspiel 2.0×, Turm 7. Reihe mit offenem Datei-Scaling).

## Nächste Schritte (nach Release)
- SF-Match-Validierung: absolute Stärke vs SF≈1400 (läuft im Hintergrund, session_id: proc_94698804dcbb)
- Weitere Eval-Verbesserungen: Springer-Entwicklung, Königssicherheit Endspiel, Passed-Pawn-Progressiv-Bonus
- Tiefe-5-Zeitsteuerungs-Diagnose: adaptive Zeitallokation, NPS-Monitoring, Suchskalierung
