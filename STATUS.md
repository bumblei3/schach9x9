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
| **n** | 20 (volle Regeln: Rochade + EP + Auto-Dame) |
| **W–D–L (wir)** | **0–4–16** |
| **Score** | **0.100** |
| **Elo vs SF≈1400** | **≈ −382** |
| Term | matt 16 · max-plies 2 · illegal-sf 2 (als Remis) |

Details: `bench/ABSOLUTE_STRENGTH_BASELINE.md` · Tool: `tools/stockfish-match.ts`

## Engine-Stärkung 9×9 — feature-complete / geparkt

Alle Such-Hebel gemergt, bei fester Zeit/Depth **nicht messbar stärker**.
Relative 9×9-Messung: `js/matchRefs.ts` (Track A).

## Lizenz

WTFPL (Commit 8ec8ceb).

## Offene Punkte

- **2/20 illegal-sf** unter vollen Regeln — Rest-Mismatch (loggen/fixen wenn Rate steigt).
- **Absolute Stärke:** Gate steht; Engine klar unter SF-1400 bei d4.
- **TypeScript 7:** blockiert durch typescript-eslint v8 → TS 6.0.3.
- **Multiplayer:** bewusst nicht geplant.

## Nächster sinnvoller Schritt

1. Solo-UX (Puzzle/Trainer/Post-Game) — Produkt-Wert ohne Elo-Blindflug
2. Engine-Hebel **nur** wenn Score vs kanonischer Baseline steigt (n≥20, gleiche Flags)
3. optional: illegal-sf-Ursachen debuggen; SF Elo 1600-Leiter
4. TS 7 warten auf eslint-Support
5. 3+ lokale Commits pushen wenn Remote gewünscht

9×9-Engine feature-complete; aktiver Strang war **8×8 absolute Messung** — Baseline
jetzt gesetzt. Nächster Produkt-Hebel eher Solo-UX als weiteres Tuning.
