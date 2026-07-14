# Engine-Stärkung (Schach9x9) — Implementation Plan

> **For Hermes:** Jeder Hebel ist isolierbar. Nach jedem Hebel: Engine-Match als
> Regression-Gate (Win-Rate muss steigen, keine Elo-Regression). Nicht alle
> Hebel blind anwenden — der Zeit-Hebel (H3) braucht vorher Freigabe (UI-Trade-off).

**Goal:** Den Solo-Gegner (JS-Suche) spürbar stärken, ohne neue Features —
reine Such-/Pruning-Tuninge, gemessen durch Engine-vs-Engine-Matches.

**Architecture:** Die Suche liegt in `js/search.ts` (`createJsSearch`), die
Zeitverwaltung in `js/ai/timeManagement.ts`, der Public API in `js/aiEngine.ts`
(`getBestMoveDetailed`). Die bestehende Headless-Match-Infra `js/engineMatch.ts`
(`npx tsx js/engineMatch.ts`) dient als Regression-Gate.

**Tech Stack:** TypeScript, Vitest (Unit), tsx (engineMatch headless), Node.

---

## Regression-Gate (vor jedem Hebel ausführen)

Baseline-Match bauen (einmal), dann nach jedem Hebel Vergleichs-Match.

```bash
# Baseline (aktueller Stand, vor Änderungen) — Ergebnis notieren!
npx tsx js/engineMatch.ts \
  --white '{"personality":"balanced","depth":8}' \
  --black '{"personality":"balanced","depth":8}' \
  --games 20 --tc fixed-time --baseTimeMs 3000 --openings
# Ausgabe: Win/Draw/Loss + avgDepth + nodes + blunders
```

Akzeptanzkriterium pro Hebel: neue Engine (mit Hebel) muss gegen unveränderte
Baseline **deutlich besser oder gleich** sein (Win-Rate ≥ 50% bei gleicher Zeit,
keine Zunahme der Blunder-Quote). Ein Hebel, der die Engine schwächer macht,
wird verworfen (Revert), nicht gemerged.

---

## Hebel H1: IIR-Skip toter Code aktivieren (sicher, gratis)

**Problem:** `js/search.ts` Zeile 701–726 berechnet `shouldSkipDepth`, wendet
es aber nie an (nur ein Kommentar). Das ist verschenkte Effizienz: bei extrem
stabilen Scores (3 Iterationen < 10cp Delta) könnte eine Tiefe übersprungen
werden, um Zeit für tiefere/wichtigere Stellungen zu sparen.

**Files:**
- Modify: `js/search.ts:701-727` (der `shouldSkipDepth`-Block im Iterative-Deepening-Loop)

**Step 1: Verstehen (kein Test nötig, Verhaltensänderung ist die Messung)**
Die Variable `shouldSkipDepth` ist bereits korrekt berechnet:
```ts
const shouldSkipDepth =
  d >= 4 &&
  lastScores.length >= 3 &&
  Math.abs(lastScores[lastScores.length - 1] - lastScores[lastScores.length - 2]) < 10 &&
  Math.abs(lastScores[lastScores.length - 2] - lastScores[lastScores.length - 3]) < 10 &&
  performance.now() - start < MAX_SEARCH_TIME * 0.5;
```

**Step 2: Aktivieren — die Tiefe wirklich überspringen**
Ersetze den toten Block (Zeile 723-726):
```ts
// Optional: Early exit if IIR suggests depth increase won't help
if (shouldSkipDepth && d + 1 <= maxDepth) {
  // Still do one more iteration for safety, but could break here
}
```
durch:
```ts
// IIR: Skip one stable depth to spend the budget on deeper/worthwhile plies.
// We never skip the final iteration, so the reported result is complete.
if (shouldSkipDepth && d + 1 < maxDepth) {
  // advance loop counter without a full search at this depth
  d++;
  continue;
}
```
ACHTUNG: `continue` im `for`-Loop überspringt den Rest des Iterationskörpers
(Progress-Callback, Mate-Break) — das ist OK, weil die nächste Iteration diese
ohnehin ausführt. `d` wird vor `continue` erhöht, damit die Schleife nicht
endet.

**Step 3: Regression-Gate (siehe oben)**
Erwartung: gleiche oder leicht tiefere avgDepth, aber geringere Zeit pro Zug
bei gleichem Ergebnis → Engine mindestens gleich stark, evtl. durch gesparte
Zeit bei stabilen Stellungen an anderer Stelle tiefer. Win-Rate ≥ 50%.

**Step 4: Commit**
```bash
git add js/search.ts
git commit -m "perf(search): activate IIR depth-skip for stable evals (was dead code)"
```

---

## Hebel H2: LMR-Skala korrigieren (Präzision ↑, etwas langsamer)

**Problem:** `js/search.ts:477` nutzt `Math.floor((depthLog * moveLog) / 1.75)`.
Standard-Engines nutzen ~2.0–2.5. 1.75 reduziert späte Züge zu aggressiv →
taktische Ungenauigkeiten. Anheben auf 2.0 = präziser, leicht langsamer.

**Files:**
- Modify: `js/search.ts:477` UND `js/search.ts:569` (beide LMR-Stellen — maximizing UND minimizing Branch)

**Step 1: Ändern (beide Stellen identisch)**
```ts
reduction = Math.min(LMR_MAX_REDUCTION, Math.floor((depthLog * moveLog) / 1.75));
```
→
```ts
reduction = Math.min(LMR_MAX_REDUCTION, Math.floor((depthLog * moveLog) / 2.0));
```

**Step 2: Regression-Gate**
Erwartung: leicht höhere Knoten bei gleicher Zeit, aber bessere Züge in
taktischen Stellungen → Win-Rate gegen Baseline steigt oder bleibt (±).
Wenn Win-Rate signifikant sinkt (Engine zu langsam → weniger Tiefe pro Zeit),
wieder verwerfen (Revert auf 1.75).

**Step 3: Commit**
```bash
git add js/search.ts
git commit -m "perf(search): LMR scale 1.75 -> 2.0 for more precise late-move reductions"
```

---

## Hebel H3: MAX_SEARCH_TIME anheben (STÄRKSTER Hebel — BRAUCHT FREIGABE)

**Problem:** `js/search.ts:42` `const MAX_SEARCH_TIME = 3000;` (von 8s auf 3s
halbiert). Mehr Zeit = tiefere Suche = stärker. ABER: die JS-Suche läuft im
Browser-Hauptthread (kein Worker beim `getBestMoveDetailed`-Fallback), d.h.
höhere Zeit = längere UI-Blockade pro KI-Zug.

**Trade-off (Freizugeben via clarify):**
- **3s (aktuell):** UI bleibt flüssig, Engine begrenzt auf ~depth 6–7.
- **5s:** spürbar stärker (~depth 7–8), KI-Zug dauert bis 5s sichtbar.
- **8s (ursprünglich):** stärkstes, aber bis 8s UI-Freeze pro Zug.

**Files:**
- Modify: `js/search.ts:42`

**Step 1 (nur nach Freigabe):**
```ts
const MAX_SEARCH_TIME = 3000;
```
→ (gewählter Wert, z.B.) `5000`

**Step 2: Regression-Gate**
Erwartung: deutlich höhere avgDepth + Win-Rate steigt klar gegen 3s-Baseline.
Das ist der Hebel mit dem größten Stärkungs-Gewinn.

**Step 3: Commit (nur nach Freigabe)**
```bash
git add js/search.ts
git commit -m "perf(search): raise MAX_SEARCH_TIME 3s -> 5s for deeper search"
```

---

## Hebel H4: Zeit-Probe verfeinern (Nebenwirkung von H3)

**Problem:** `js/search.ts:59` und `:360` prüfen Zeit nur alle `nodes % 1000`.
Bei tiefen Stellungen (wenige erzeugte Knoten pro Sekunde) kann die Suche
1000 Knoten über `MAX_SEARCH_TIME` laufen → UI länger blockiert als gedacht.
Verfeinern auf 256 reduziert den Overshoot.

**Files:**
- Modify: `js/search.ts:59` und `js/search.ts:360` (`nodes.count % 1000` → `nodes.count % 256`)

**Step 1: Ändern (beide Stellen)**
```ts
if (nodes.count % 1000 === 0 && performance.now() - start > MAX_SEARCH_TIME) {
```
→
```ts
if (nodes.count % 256 === 0 && performance.now() - start > MAX_SEARCH_TIME) {
```

**Step 2: Regression-Gate**
Erwartung: identische Stärke, aber zuverlässigere Zeit-Einhaltung (weniger
Overshoot bei tiefen Stellungen). Win-Rate ≈ Baseline.

**Step 3: Commit**
```bash
git add js/search.ts
git commit -m "perf(search): finer time-probe (1000->256 nodes) for reliable time limit"
```

---

## Reihenfolge & Risiko

1. H1 (sicher, gratis) → Gate
2. H2 (Präzision) → Gate
3. H3 (ZEIT — nur nach Freigabe) → Gate
4. H4 (nur wenn H3 gemacht wurde, sonst nutzlos) → Gate

Jeder Hebel ein eigener Feature-Branch + PR (main ist protected). Revert bei
Regression. Am Ende: CHANGELOG + README (Engine-Sektion) aktualisieren,
Version auf v1.4.0 (Feature-Release, da spürbare Stärkung).

## Verifikation (abschließend)

- `npx vitest run` → alle grün (keine Regression in search.ts-Tests)
- `npx tsc --noEmit` → 0 Errors
- `npx eslint js/search.ts --max-warnings=0` → 0
- Engine-Match (20 Games, depth 8): neue Version ≥ Baseline (Win-Rate ≥ 50%,
  Blunder-Quote nicht gestiegen)
- `npx playwright test e2e/ai-move.spec.ts` → KI zieht noch korrekt im Browser
