# schach9x9 — Status (Stand: 2026-08-31)

Laufender Zustand des Repos `bumblei3/schach9x9` (branch `main`, tag `v2.0.0`).
Gehalten von Hermes; bei jeder "wie weiter verbessern"-Run neu verifiziert. Dieses
Dokument ist das eine Quelle für den echten Ist-Stand; `ROADMAP.md` ist die
Planung, `bench/NEGATIVE_RESULTS.md` die verworfenen Hebel.

## Gesundheit

| Gate      | Befehl             | Ergebnis                                                                 |
| --------- | ------------------ | ------------------------------------------------------------------------ |
| Tests     | `npx vitest run`   | 3070+ Tests grün (Stand v2.0.0-Merge; Anzahl aus CI/logs, nicht heute re-messen) |
| Typecheck | `npx tsc --noEmit` | grün                                                                     |
| Lint      | `npx eslint .`     | grün                                                                     |
| Build     | `npx vite build`   | `dist/` ok                                                               |
| Security  | CodeQL             | keine offenen Alerts                                                     |
| CI        | GitHub Actions     | LINT + TEST + BUILD + CI-Gate + E2E + Lighthouse + Security Audit grün |
| Git       | Branch `main`      | auf `v2.0.0` — Release v2.0.0 gemerged; kein dirty Tree                 |

Working Tree: sauber, synced mit origin. Keine ungepushten Commits (nach Merge #195, 2026-08-31).

## Release-Linie

|| Version | Inhalt | Stand |
| ------- | ------ | ----- | ----- |
| **v1.7.0** | Eval-Patch, Replay, Share-Link, 8×8-Regeln | released |
| **v1.8.0** | M0: LMR4 + NMP R=1, aufgeräumte Knobs, dokumentierte Baseline | released/getaggt |
| **v1.9.0** | Kandidat: aktueller main-Stand (M1.1 + NNUE-Pipeline, keine neue Engine-Messung) | tag `v1.9.0` existiert |
| **v2.0.0** | **M2+M3: Kampagne Akt II + Fairy-Tactics-Puzzles + M3 Coach (Feenmuster, Figurennamen-Microcopy) + Tagespuzzle deterministic** — das erste Mal, das man das Spiel als "Feenschach, nicht Schach mit einem Extra-Feld" zeigen kann | released/gemerged (PR #188, 2026-08-23) |

`main` (post-v2.0.0) ist auf demselben Stand wie `v2.0.0` + Dependabot-Bumps (#195, 2026-08-31).

## Engine — feature-complete / geparkt

Alle Such-Hebel seit v1.7.0 gemessen. Die Engine-Arbeit ist an diesem Punkt ehrlich
abgeschlossen (feature-complete). Es gibt **keinen offenen Engine-Hebel**, der nicht
schon gemessen negativ/neutral ist.

### Was gemerged ist (M1.1 — der Hebel, der funktionierte)

- Inkrementeller Zobrist-Hash + Quiesce-Negamax-Fix (commit f91e116, 2026-08-22).
- n=40 vs SF-1400 (d5): **0.575 / +52 Elo** im Merge-Lauf (Baseline früher: −319 → jetzt ~−267 gesamt, ~+230 Elo über alle Hebel).
- M1.1 war der strukturelle Hebel, der die Tiefe 5 tatsächlich spielfähig machte (NPS/Hash-Kollisions-Problem gelöst).
- MAX_SEARCH_TIME 10s gemessen 2026-08-22: −44 → **8s bleibt im Freeze** (Commit b5b6ca7).

### Was nicht funktioniert hat (verworfen, dokumentiert)

- Alle früheren Eval-Hypothesen (mob=1.2, pawn=110, tempo=20, eg-passpawn 2.5): n=40-Regressionen → nie wieder.
- PROBCUT_RED=2: neutral/schlechter als 3 (0.150 vs 0.1625) → auf 3 bleiben.
- LMR_MAX_REDUCTION=2: −53 cp auf d4 → verworfen.
- QSearch-Check-Extension: schwächer bei fester Zeit.
- Opening-Book auf Engine-PV: zerstört das Vielfalt-Buch (#146) → bewusst Vielfalt.

Details: `bench/ABSOLUTE_STRENGTH_BASELINE.md`, `bench/NEGATIVE_RESULTS.md`,
`tools/stockfish-match.ts`, `tools/selfmatch.ts`.

### Native Selfmatch-Messung (Track A — 9×9-echtes Elo)

SF kann kein 9×9 — echte 9×9-Stärke wird nativ via `tools/selfmatch.ts` gemessen
(zwei benannte Configs, Farbwechsel, Elo + binomiales 95%-CI; kalibriert:
d4-vs-d3 = +280). Alle Knob-Experimente 2026-08-22 nativ n=30:
E1 bp50 −47, E2 passedPawnEgMult2.5 −58, S1 lmrBase3 **−280**, S2 lmr5 −12,
S3 nmr2 −12 → **v1.8.0-Freeze nativ bestätigt**, alle verworfen.

### NNUE-Track — GEPARKT 2026-08-23 (Gate negativ)

Pipeline komplett committed: Datengen (`tools/nnue-datagen.ts`), Trainer
(`tools/nnue-train.py`, venv `.venv-nnue/`), Export, JS-Inference
(`js/ai/nnue.ts`), Blend-Hook in evaluate.ts (default off), selfmatch-Wiring.

**Gate-Ergebnis (selfmatch baseline vs nnue30, n=80, d3):**
W-D-L 32–45–3, Score 0.681 → **nnue30 = −132 Elo [−223..−55] vs PST**.
72.8% Agreement reicht nicht; PST-Eval schlägt das Netz klar. Blend bleibt
default-off, Gewichte liegen in `data/`, Track ist gemessen beendet.

|| Netz | Daten | Val decisive-agreement | corr |
| ---- | ----- | ---------------------- | ---- |
| e200 (256→32) | big-gen0 35k d3 | 71.9% | 0.324 |
| v2 (256×256→32) | + gen2 d4 (39.5k) | 72.8% | 0.346 |

Lehren: mehr Daten gleicher Art bringt ~nichts (+1pp); Epochen helfen monoton
(65→72 über 40→200); d4-Selfplay ohne Opening-Vielfalt bricht bei Ø 11 plies
ab (370/400 Remis kurz) — Gen-2 lieferte nur 4.4k Samples.
Netz schlägt den Suchscore (d3 sign-agreement nur 60.6%), verliert aber gegen
den fertigen PST-Eval.

**Falls der Track je wiederbelebt wird:** Opening-Randomisierung im Datengen
(diverse, entschieden Partien), tiefere Labels (d5+), größerer Netzentwurf —
erst dann neues Gate. Bis dahin: geparkt.

## v2.0.0 — was das Release brachte (M2+M3)

v2.0.0 ist das erste Release, das die 9×9-Identität ernst nimmt — nicht nur
als Dekor, sondern als durchgehend lern- und spielbar.

### Kampagne Akt II (M2.1)
- Mindestens +6 Kapitel, die *eine* Feenfigur ins Zentrum stellen
  (Erzbischof-Gabeln, Kanzler-X-Ray, Engel vs Dame, Nachtreiter-Linien).
- Jedes Kapitel: einzigartige FEN, Persönlichkeit, 2★/3★-Ziele.

### Fairy-Tactics-Set (M2.2)
- Handgemachte Fairy-Puzzles statt nur procedural Mate-in-1.
- Puzzle-Menü mit Filter "Feenfiguren"; Daily Puzzle darf daraus ziehen.
- 155 validierte Self-play-Puzzles in `puzzles.json` (deterministisch via FNV-1a).

### Daily Puzzle (Tagespuzzle, neu in v2.0.0)
- `js/puzzle.ts`: deterministisches Tagespuzzle — FNV-1a über Datum → gleiches
  Puzzle für alle Spieler an einem Tag.
- Sa/So = easy-Tier, Mo–Fr = medium.
- Damit hat das Spiel ein tägliches "Wiederkommen"-Anker-Event (Solo-Fokus).

### Tutor / Coach (M3.1–M3.4)
- `TacticsDetector` um Feenmuster: Erzbischof-Gabel (Läufer+Springer),
  Kanzler-Spieß (Turm+Springer), Engel-Batterie.
- Tutor-Erklärung nutzt Figurennamen (Erzbischof, nicht "Läufer/Springer").
- M3.3: optionaler auto-Hint nach Blunder (Setting, default aus).
- M3.4: handkuratierte 20–30 Linien als "Lehrbuch"-Modus im Opening-Trainer
  (getrennt vom Vielfalt-Buch, 0 unlösbar — `check-book-solvability`).

### Sonstiges aus M4 / vorherigen Merges
- Sound-Settings persistieren (`sounds.ts` löscht den Key im Konstruktor und
  lädt danach → Volume/Mute überlebt Reload).
- Deutsche Microcopy-Lücken weitgehend geschlossen (Puzzle-Generator war der letzte
  große englische Rest — jetzt auf Deutsch).
- CSP self-host für Three.js (jsDelivr im Import-Map entfernt, eigenes
  `script-src`).
- A11y-Regeln im Playwright-Smoke angeschaltet (#184) — **Verifikation steht
  aus** (siehe "Verifizierte vs. behauptete Lücken" unten).

## Offene Punkte

- **NNUE:** GEPARKT 2026-08-23 — Gate negativ (−132 Elo vs PST, n=80).
  Wiederbelebung nur mit Opening-Randomisierung + tieferen Labels + größerem
  Netzentwurf sinnvoll. Bis dahin: "kein offener Engine-Hebel".
- **M1.2 (Hash-Keys für Rochade/EP 8×8) + M1.3 (64-bit Zobrist):**
  in ROADMAP als offen gelistet, nach M1.1 nicht gemessen. Kein offener Hebel,
  aber auch kein "bewiesen unnötig". Entscheidung offen (siehe nächster Abschnitt).
- **TypeScript 7:** blockiert durch typescript-eslint v8 → TS 6.0.3 fixiert.
  Upgrade erst wenn typescript-eslint v9 erscheint.
- **MAX_SEARCH_TIME 10s:** gemessen 2026-08-22 (−44) → 8s eingefroren. Punkt abgehakt.
- **SF Elo 1600 / höhere SF-Tiefe (M5):** Track B Score ≥ 0.30 bei Elo 1400
  als Gate. Nach M1.1 liegt man bei ~0.575 im Merge-Lauf (Farbwechsel, nicht
  direkt komparabel zur früheren 0.175-Zahl). Klärungsbedarf vor einem neuen
  Track-B-Lauf: welche Messung ist die kanonische Referenz?
- **Geparkt (bewusst):** OpeningBookTrainer harder, SF-1600 Match, NNUE,
  Multiplayer, Desktop-Hülle (Tauri), Coverage-Ziel 85%-Branches.

## Verifizierte vs. behauptete Lücken

Das ist der Teil, der im nächsten "wie weiter"-Gespräch Kopfzerbrechen vermeidet.

**Verifiziert (gemessen oder laufend grün):**
- Engine-Stärke bis v1.8.0/M1.1: n=40-vs-SF-1400-Messungen, native Selfmatch-
  Messungen, alle verworfenen Hebel in `bench/NEGATIVE_RESULTS.md`.
- NNUE-Gate: n=80 selbstmatch, Ergebnis negativ.
- CI-Pipeline: LINT + TEST + BUILD + CI-Gate + E2E + Lighthouse + Security Audit
  grün (nach Merge #195).

**Behauptet, aber nicht independently verifiziert in dieser Sitzung:**
- M4.1 A11y: PR #184 sagt "A11y-Rules an", aber ob wirklich 0 Violations auf
  Settings + Board existieren, ist nicht neu verifiziert. Playwright-Smoke muss
  gegen den Build laufen (Task unter "Nächste Schritte").
- Exakte Testanzahl: STATUS.md nennt 3070+, basiert auf CI/session-memory, nicht
  auf einem heute-gelaufenen `npx vitest run`. Wenn jemand die Zahl zitieren will,
  sollte sie vorher laufen.

## Nächste Schritte (empfohlen)

1. **Doku-DNA aufräumen (dieses Dokument + ROADMAP):**STATUS.md hier aktualisieren
   (v2.0.0-Stand) + ROADMAP.md NNUE-Widerspruch klären (Punkt 2 unter
   "Offene Produktentscheidungen" sagt "nächster Hebel: NNUE-Blend-Gate", aber
   der Track ist geparkt mit negativem Gate → Satz muss lauten "kein offener
   Engine-Hebel — NNUE geparkt, nächster Raum: M2/M3/M4 oder M1-Rest messen").
   Das ist der billigste Schritt und macht alles danach transparenter.

2. **M4.1 verifizieren:** Playwright-A11y-Smoke gegen `npx vite build` + lokal
   serve laufen lassen. Wenn 0 Violations auf Settings + Board → der Claim in
   ROADMAP ist wahr. Wenn nicht → Bug, der vor neuen Features aufgeräumt wird.

3. **Danach die Domain-Entscheidung:**Nach Schritt 1+2 ist klar, was verifiziert ist.
   Dann eine Entscheidung:

   - **Option A — Engine (M1.2/M1.3 messen):** Nur wenn man bereit ist, das
     Resultat zu akzeptieren, auch wenn es 0 cp bringt ("messbar oder weg").
     Vorher: welche Messung ist die kanonische Referenz (Track A oder B, welches
     n, welche Flags)? Das Ziel aus ROADMAP M1 war Score ≥ 0.30 — nach M1.1 liegt
     man im Merge-Lauf bei ~0.575, aber die Zahlen sind nicht direkt vergleichbar.
     Diese Referenz vorher festlegen, sonst ist die nächste Messung wertlos.
   - **Option B — Produkt/UX:** Onboarding-Flow (Fortsetzen/Wiedererkennen nach
     Pause) oder minimaler Feedback-Kanal (nach Lektionen oder versteckter Button).
     Erfordert eine Metrik/Budget-Entscheidung vorher ("was ist die eine Sache,
     die wir messen wollen?").

4. **Option C — Pause:** Wenn Engine geparkt ist, v2.0.0 frisch ist, und weder
   M1.2/M1.3 noch ein neues Produkt-Feature aktuell drängen, ist das ein
   legitimer Zustand. Dann warten, bis eine konkrete Unzufriedenheit auftaucht
   (z.B. "Tagespuzzle macht Spaß, aber Montag-Medium ist zu schwer" oder
   "Coverage ai-core.ts ist 70% und ich trau dem LMR-Refactoring nicht").

## Lizenz

WTFPL (Commit 8ec8ceb, 2026-08-02). Einheitlich mit trischach.

## Solo-UX

- Standard 8×8 spielbar (Worker + Opening Book + volle Regeln: Rochade, EP,
  Unterpromotion).
- 9×9 Classic, Standard 8×8, Setup/Shop, Upgrade, Cross, Kampagne, Puzzle,
  Daily Puzzle, Opening-Trainer, Analyse, 3D.
- Post-Game-Replay-Overlay ab v1.7.0.
- Position teilen per Link.
- PWA/Offline-fähig.

**Nächster sinnvoller Schritt:** Doku-DNA aufräumen (STATUS.md wie hier +
ROADMAP-Widerspruch klären), dann M4.1 verifizieren, dann Domain-Entscheidung.
Engine-Hebel gibt es keine — NNUE ist geparkt, M1-Rest (M1.2/M1.3) ist die
einzige verbleibende engine-seitige Option, und die nur sinnvoll mit klarer
Mess-Spezifikation + Bereitschaft, 0-cp-Ergebnis zu akzeptieren.
