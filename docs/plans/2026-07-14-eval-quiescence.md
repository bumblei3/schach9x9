# Engine-Eval-Verbesserung (Schach9x9) — Implementation Plan

> **For Hermes:** Jeder Hebel isolierbar. Nach jedem Hebel: Regression-Gate.
> Basis ist die SYMMETRISCHE Asymmetrie-Probe (balanced vs balanced,
> fixe Tiefe, alternierende Farben) — VERDICT SYMMETRIC am 2026-07-14
> (16 Partien, 0 Crashes, 4:2:10 W/B/D). Color-Bug damit ausgeschlossen,
> PR #114 (H3, MAX_SEARCH_TIME 5s) gemergt. Jetzt Eval-Hebel erlaubt.

**Goal:** Den Solo-Gegner (JS-Suche) über bessere statische Bewertung /
stabilere Quiescence spürbar stärken — reine Eval-/Quiescence-Tuninge,
gemessen durch Engine-vs-Engine-Matches.

**Architecture:** `js/evaluate.ts` (PSTs, tapered eval, pawn structure,
mobility, king safety) + `js/search.ts` `quiesce()` (MVV-LVA Captures).
Public API `js/aiEngine.ts` (`getBestMoveDetailed` → `runJsSearch`).
Regression-Gate via `js/engineMatch.ts` bzw. `js/asymmetryProbe.ts`.

## Regression-Gate (nach jedem Hebel)
1. **Asymmetrie-Probe** (must stay SYMMETRIC, 0 crashes):
   `npx tsx js/asymmetryProbe.ts` mit `PROBE_GAMES=8 PROBE_DEPTH=4 PROBE_ELO=1600`
   (16 Partien). Ein Hebel, der die Symmetrie bricht, ist ein BUG → Revert.
2. **Unit/Eval Gates:** `npx vitest run` (keine Regression in search/eval),
   `npx tsc --noEmit`, `npx eslint js/search.ts js/evaluate.ts --max-warnings=0`.
3. **Stärke-Match (neu vs alt):** empfohlen als Follow-up mit zwei Refs
   (alter Stand vs neuer Hebel) — Determinismus der Engine macht
   balanced-vs-balanced Self-Play statistisch wertlos, daher echter
   neu-vs-alt Vergleich nötig. Delta-Pruning ist per Konstruktion SOUND
   (kein Stärkeverlust möglich), Gate #1+#2 genügen als Freigabe.

## Hebel H-Q1: Quiescence Delta-Pruning (sicher, SOUND)
**Problem:** `quiesce()` in `js/search.ts:48` generiert bei jedem Knoten
ALLE Capture-Moves und evaluiert sie — auch wenn `standPat` schon so tief
unter `alpha` liegt, dass selbst das wertvollste mögliche Capture den
Score nicht über `alpha` heben kann. Das ist verschwendete Tiefe.

**Fix (sound lower-bound delta prune):**
Nach `if (standPat > alpha) alpha = standPat;` einfügen:
```ts
// Delta pruning (sound): even capturing the most valuable piece (+ promotion)
// cannot raise standPat above alpha, so no capture helps -> stand pat.
const QSEARCH_DELTA = 2000; // angel (1220) + promotion gain (~800) upper bound
if (standPat + QSEARCH_DELTA < alpha) return alpha;
```
`QSEARCH_DELTA = 2000` ist eine sichere Obergrenze (max Nicht-Königs-Wert
1220 + Promotions-Bonus ~800). Kein Stärkeverlust möglich — nur
Pruning von aussichtslosen Zweigen. Erwartung: gleiche oder tiefere
Knotenzahl bei gleicher Stärke → Engine mindestens gleich, evtl. durch
gesparte Zeit an anderer Stelle tiefer.

**Files:** Modify `js/search.ts` (nur `quiesce()`).

## Hebel H-Q2: Quiescence Check-Extension (Präzision, etwas langsamer)
**Problem:** `quiesce()` betrachtet nur Captures. Steht die Seite am Zug
im Schach, werden Flucht-/Block-Züge nicht gesucht → Horizon-Effekt bei
Schachsequenzen. Erweiterung: wenn `isInCheck(b, c)` am qsearch-Einstieg,
alle (Pseudo-)Züge statt nur Captures durchsuchen (1 Ply).

**Risk:** kann bei tiefen Schachketten explodieren → nur mit
Delta-Pruning (H-Q1) kombiniert sinnvoll. Eigener Hebel + eigenes Gate.

## Hebel H-P1: PSQT für 9x9 schärfen (riskant, viel Tuning)
**Problem:** Die PSTs in `js/evaluate.ts` (Knight/Bishop/Archbishop/
Chancellor/Angel) sind generische 8x8-abgeleitete Muster auf 9x9
gestreckt. Center-Bias und Endgame-Werte sind nicht auf das 9x9-Brett
kalibriert.

**Risk:** PSQT-Tuning kann die Engine SCHWÄCHER machen, wenn die Werte
nicht durch Matches validiert werden. Erst NACH H-Q1/H-Q2, eigener
Branch pro Piece-Table, jeweils Match-Gate. Nicht blind anwenden.

## Reihenfolge & Risiko
1. H-Q1 (sicher, SOUND) → Gate (Asymmetrie + tsc/eslint/vitest)
2. H-Q2 (Präzision, braucht H-Q1) → Gate
3. H-P1 (PSQT, riskant) → nur einzeln + Match-Gate

Jeder Hebel ein eigener Feature-Branch + PR (main protected). Revert bei
Regression/Bug. Am Ende: CHANGELOG-Sektion + README (Engine) aktualisieren.
