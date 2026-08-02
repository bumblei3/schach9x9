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
- Regeln (symmetrisch): **keine Rochade, kein EP**, Auto-Dame-Promotion
- Erste Messung: vs SF full d4 → 0–0–6; vs SF Elo1400 d4 → grob ~−140 Elo (kleine n)

## Engine-Stärkung 9×9 — feature-complete / geparkt

Alle Such-Hebel gemergt, bei fester Zeit/Depth **nicht messbar stärker**:

- H3, H-Q1, LMR 2.0, IIR-Skip, H4, H-P1 — kein messbarer Elo-Gewinn
- Mobility abgelehnt (#151), NNUE geparkt, Buch = Vielfalt (#146)

Relative 9×9-Messung weiter über `js/matchRefs.ts` (Track A).

## Lizenz

WTFPL (Commit 8ec8ceb) — einheitlich mit trischach.

## Offene Punkte

- **8x8-Regeln unvollständig für Standard-Chess:** Doppelzug size-aware +
  Auto-Queen erledigt; **Rochade + En passant fehlen** im Integer-Board →
  gelegentlich `illegal-sf` (wird als Remis/void gewertet, nicht als Win).
- **Absolute Stärke:** Messlatte steht; Engine klar unter SF-1400 bei d4.
  Nächster Engine-Schritt: Regeln vervollständigen, dann neu baselinen — nicht
  blind weitere 9×9-Hebel.
- **TypeScript 7:** blockiert durch typescript-eslint v8 → bleibt TS 6.0.3.
- **Multiplayer:** bewusst nicht geplant.

## Nächster sinnvoller Schritt

1. **Rochade (+ EP)** im 8×8 Integer-Move-Gen → faire SF-Partien
2. Baseline n≥20 vs SF Elo 1400/1600 wiederholen
3. Solo-UX (Puzzle/Trainer/Post-Game) parallel möglich
4. TS 7 warten auf eslint-Support

Im Unterschied zu trischach (aktive 3P-Hebel) ist 9×9-Engine feature-complete;
der neue aktive Strang ist **8×8 absolute Messung + Regelvollständigkeit**.
