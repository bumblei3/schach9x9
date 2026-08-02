# schach9x9 — Status (Stand: 2026-08-02)

Laufender Zustand des Repos `bumblei3/schach9x9` (branch `main`).
Gehalten von Hermes; bei jeder "wie weiter verbessern"-Run neu verifiziert.

## Gesundheit

| Gate      | Befehl             | Ergebnis                                           |
| --------- | ------------------ | -------------------------------------------------- |
| Tests     | `npx vitest run`   | 2936/2936 passed (vor SF-Harness-Commit; Spot-Check 21/21 8x8-related grün) |
| Typecheck | `npx tsc --noEmit` | grün (historisch)                                  |
| Lint      | `npx eslint .`     | grün (historisch)                                  |
| Build     | `npx vite build`   | `dist/` vorhanden/ok                               |
| Security  | CodeQL             | keine offenen Alerts (letzte Fixes #169/#170/#171) |

## Absolute Strength — Track B (NEU)

Headless Match vs Stockfish WASM auf **8×8**:

```bash
npm run match:stockfish -- --games=8 --depth=4 --sf-depth=8 --sf-elo=1400
```

- Tool: `tools/stockfish-match.ts` (Child-Process UCI, `stockfish@18` devDep)
- Doku + Zahlen: `bench/ABSOLUTE_STRENGTH_BASELINE.md`
- Regeln: **volle Standard-8×8** (Rochade + EP + Auto-Dame) via `RuleState`
- Erste Messung: vs SF full d4 → 0–0–6; vs SF Elo1400 d4 → grob ~−140 Elo (kleine n)
- Smoke mit Castle/EP: 2 Partien d2, 0× `illegal-sf`

## Engine-Stärkung 9×9 — feature-complete / geparkt

Alle Such-Hebel gemergt, bei fester Zeit/Depth **nicht messbar stärker**:

- H3, H-Q1, LMR 2.0, IIR-Skip, H4, H-P1 — kein messbarer Elo-Gewinn
- Mobility abgelehnt (#151), NNUE geparkt, Buch = Vielfalt (#146)

Relative 9×9-Messung weiter über `js/matchRefs.ts` (Track A).

## Lizenz

WTFPL (Commit 8ec8ceb) — einheitlich mit trischach.

## Offene Punkte

- **8x8-Regeln:** Doppelzug, Auto-Queen, **Rochade, En passant** im Integer-
  Board (`setRules` / `RuleState`). 9×9 default bleibt rights=0 (kein Verhalten
  ohne Opt-in).
- **Absolute Stärke:** Messlatte steht; Engine klar unter SF-1400 bei d4.
  Nächster Engine-Schritt: n≥20 neu baselinen, dann gezielte Hebel — nicht blind
  9×9-Tuning.
- **TypeScript 7:** blockiert durch typescript-eslint v8 → bleibt TS 6.0.3.
- **Multiplayer:** bewusst nicht geplant.

## Nächster sinnvoller Schritt

1. Baseline n≥20 vs SF Elo 1400/1600 (volle Regeln)
2. Solo-UX (Puzzle/Trainer/Post-Game) parallel möglich
3. Engine-Hebel nur mit Gate gegen diese Baseline
4. TS 7 warten auf eslint-Support

Im Unterschied zu trischach (aktive 3P-Hebel) ist 9×9-Engine feature-complete;
der aktive Strang ist **8×8 absolute Messung** (Regeln jetzt vollständig).
