# schach9x9 — Status (Stand: 2026-08-02)

Laufender Zustand des Repos `bumblei3/schach9x9` (branch `main`).
Gehalten von Hermes; bei jeder "wie weiter verbessern"-Run neu verifiziert.

## Gesundheit

| Gate      | Befehl             | Ergebnis                                           |
| --------- | ------------------ | -------------------------------------------------- |
| Tests     | `npx vitest run`   | historisch 2936; Spot-Checks 8x8/engine grün nach SF-Arbeit |
| Typecheck | `npx tsc --noEmit` | grün (historisch)                                  |
| Lint      | `npx eslint .`     | grün (historisch)                                  |
| Build     | `npx vite build`   | `dist/` vorhanden/ok                               |
| Security  | CodeQL             | keine offenen Alerts (letzte Fixes #169/#170/#171) |

## Absolute Strength — Track B (kanonische Baseline)

```bash
npm run match:stockfish -- --games=20 --depth=4 --sf-depth=8 --sf-elo=1400 --quiet
```

| | |
|--|--|
| **n** | 20 (volle Regeln: Rochade + EP + q/r/b/n-Promo) |
| **W–D–L (wir)** | **0–3–17** |
| **Score** | **0.075** |
| **Elo vs SF≈1400** | **≈ −436** |
| Term | matt 17 · max-plies 3 · **illegal-sf 0** |

Details: `bench/ABSOLUTE_STRENGTH_BASELINE.md` · Tool: `tools/stockfish-match.ts`

## Engine-Stärkung 9×9 — feature-complete / geparkt

Alle Such-Hebel gemergt, bei fester Zeit/Depth **nicht messbar stärker**.
Relative 9×9-Messung: `js/matchRefs.ts` (Track A).

## Lizenz

WTFPL (Commit 8ec8ceb).

## Offene Punkte

- **illegal-sf behoben:** Ursache war **Unterpromotion** (SF `c7c8b`, wir nur `…q`).
  Move-Gen erzeugt jetzt q/r/b/n; n=20 Re-Run → 0 illegal-sf.
- **Absolute Stärke:** Gate steht; Engine klar unter SF-1400 bei d4 (Score 0.075).
- **TypeScript 7:** blockiert durch typescript-eslint v8 → TS 6.0.3.
- **Multiplayer:** bewusst nicht geplant.

## Solo-UX (2026-08-02)

- **Standard 8×8 spielbar:** Menü-Text korrigiert; `opening-book-8x8.json` in `public/`;
  AI-Worker bekommen `setBoardVariant` (8×8-Geometrie + Castling/EP) — vorher
  suchten Worker weiter auf 9×9.
- Kanonische Engine-Baseline unverändert (siehe Track B).

## Nächster sinnvoller Schritt

1. Post-Game / Puzzle / Trainer weiter polieren
2. Engine-Hebel **nur** wenn Score vs kanonischer Baseline (0.075 / n=20) steigt
3. optional: SF Elo 1600-Leiter
4. TS 7 warten auf eslint-Support
