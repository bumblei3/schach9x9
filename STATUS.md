# schach9x9 — Status (Stand: 2026-08-02)

Laufender Zustand des Repos `bumblei3/schach9x9` (branch `main`, synced mit origin).
Gehalten von Hermes; bei jeder "wie weiter verbessern"-Run neu verifiziert.

## Gesundheit (frisch verifiziert 2026-08-02)

| Gate      | Befehl             | Ergebnis                                           |
| --------- | ------------------ | -------------------------------------------------- |
| Tests     | `npx vitest run`   | 2936/2936 passed (235 files)                       |
| Typecheck | `npx tsc --noEmit` | grün (exit 0)                                      |
| Lint      | `npx eslint .`     | grün (exit 0)                                      |
| Build     | `npx vite build`   | `dist/` vorhanden/ok                               |
| Security  | CodeQL             | keine offenen Alerts (letzte Fixes #169/#170/#171) |

Working Tree: sauber, synced mit origin. Keine ungepushten Commits.

## Engine-Stärkung — feature-complete / geparkt

Alle Such-Hebel sind gemergt, aber bei fester Zeit/Depth **nicht messbar
stärker** (40 Partien 15:15 equal). Dokumentiert in CHANGELOG "verified reality":

- H3 (MAX_SEARCH_TIME 5s→8s), H-Q1 Delta-Pruning, LMR 2.0, IIR-Skip,
  H4 time-probe, H-P1 PSQT — alle gemergt, kein messbarer Elo-Gewinn.
- **Mobility-Lever abgelehnt** (#151, negative Tuning-Messung).
- **NNUE geparkt** (2026-07-17) — train-Skripte (`train`, `train:fast`,
  `train:thorough`) existieren, sind inaktiv.
- **Opening-Buch bewusst Vielfalt** (kein Engine-Optimum): `tools/book-eval.ts`
  maß Top-1 16% / Top-3 42.5% / Top-5 62% / Eval-Loss 16.1cp. Stärkungs-
  Nachbesserung würde den Vielfalt-Zweck (#146) torpedieren → geparkt.

Es gibt **keine** absolute Engine-Stärke-Bench-Infra wie in trischach
(`engine-strength.ts`) — `scripts/parallel-benchmark.ts` misst nur
Parallel-Suche, nicht Stärke vs Baseline.

## Lizenz

WTFPL (Do What The F*** You Want To Public License) — hinzugefügt 2026-08-02
(Commit 8ec8ceb). Zuvor keine LICENSE-Datei, README behauptete fälschlich MIT,
package.json hatte kein license-Feld. Jetzt einheitlich WTFPL (wie trischach).

## Offene Punkte (aus CHANGELOG)

- **Absolute Engine-Stärke vs Stockfish: NICHT MESSBAR — 8x8-Modus broken.**
  Versuch 2026-08-02: Stockfish-WASM (npm `stockfish@18`) gegen die Engine im
  `standard8x8`-Modus matchen. Scheiterte, weil der 8x8-Modus **fundamental
  broken** ist: `genLegalInt` (Move-Generierung in aiEngine/MoveGenerator) ist
  hart auf 9x9 codiert und kennt das 8x8-Board nicht — `getAllLegalMoves` auf
  einem 8x8-Brett liefert 19/38 Züge mit out-of-range Koordinaten (r/c > 7).
  Ein `size=9`-Fix in `convertMoveToResult` heilt das nicht (der Index selbst
  ist 9x9-basiert). Der `standard8x8`-Modus kann also gar nicht legal ziehen;
  ein absoluter Stärke-Match ist ohne 8x8-Reparatur der Move-Generierung
  (variabler Board-Größe) unmöglich. Das ist die echte Lücke, die README
  "absolute Stärke vs Stockfish" meint — sie ist eine Engine-Reparatur, kein
  Benchmark-Problem. Versuchs-Artefakte (stockfish-match.ts, stockfish-dep)
  wieder radikal entfernt.
- **TypeScript 7: VERSUCHT 2026-08-02, blockiert.** TS 7.0.2 ist auf npm,
  aber typescript-eslint v8.65.0 hat peerDep `typescript >=4.8.4 <6.1.0` und
  **crasht hart** mit TS 7.0 ("typescript-eslint does not support TS 7.0").
  Gemessen im abgeschirmten Branch `try/ts7`: `tsc --noEmit` läuft mit TS 7
  **grün** (keine neuen Errors), aber `eslint .` bricht mit obigem Error.
  Side-by-side mit TS-6-API (TS-7-Announcement) ist fragil und riskiert die
  4 CI-checks → nicht weiterverfolgt. Branch sauber revertiert (Lock-Hash
  wieder 3d46a0e, TS 6.0.3, eslint grün). **Weiterhin auf TS 6.0.3 fixiert,**
  bis typescript-eslint **v9** (oder TS 7.1+ Support per Issue #10940) da ist.
- **Multiplayer:** bewusst nicht geplant (Solo-Fokus).
- Keine offenen Engine-Hebel — bewusst alles geparkt.

## Nächster sinnvoller Schritt

Kein aktiver Stärkungs-Hebel mehr — die Engine-Arbeit ist an dem Punkt ehrlich
abgeschlossen ("feature-complete"). Sinnvolle nächste Schritte wären eher:

- Eine absolute Engine-Stärke-Bench-Infra (Analog zu trischach) einziehen, um
  künftige Änderungen ehrlich messbar zu machen.
- TS 7 Upgrade, sobald typescript-eslint v9 da ist.
- Solo-UX/Features (nicht Engine-Stärkung) — der erklärte Fokus.

Im Unterschied zu trischach (dort ist Opp-Awareness ein aktiver, messbarer
3P-Hebel, Root-Maxⁿ geparkt, d4-Bench offen) ist schach9x9 in einem ruhigen
Endzustand: Engine als feature-complete dokumentiert, keine aktiven Hebel.
