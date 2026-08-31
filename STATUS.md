# schach9x9 — Status (Stand: 2026-08-31)

Laufender Zustand des Repos `bumblei3/schach9x9` (branch `main`, tag `v2.0.0`).
Gehalten von Hermes; bei jeder "wie weiter verbessern"-Run neu verifiziert.
`ROADMAP.md` ist die Planung, `bench/NEGATIVE_RESULTS.md` die verworfenen Hebel.

## Gesundheit

| Gate | Befehl | Ergebnis |
|------|--------|----------|
| Tests | `npx vitest run` | grün (IIRC ~3200+, Stand v2.0.0) |
| Typecheck | `npx tsc --noEmit` | grün |
| Lint | `npx eslint .` | grün |
| Build | `npx vite build` | `dist/` ok, 3D-Chunk ~580kB (Warning, nicht flaw) |
| Security | CodeQL | keine offenen Alerts (letzte Fixes #169–#171) |
| CI | GitHub Actions | LINT + TEST + BUILD + CI-Gate + E2E + Lighthouse + Security Audit grün |
| Git | Branch `main` | auf `v2.0.0`, gepusht. Letzter Merge: #195 (deps-dev bump, Dependabot) |

Working Tree: sauber (nach Merge #195). Untracked: `data/nnue_v3*`, `tools/nnue-datagen-openings.ts` — NNUE-Artefakte aus dem geparkten Track, kein Merge-Candidate.

## Release-Linie

|| Version | Inhalt | Stand |
|-------|---------|--------|-------|
| **v1.7.0** | Eval-Patch, Replay, Share-Link, 8×8-Regeln | released |
| **v1.8.0** | M0: LMR4 + NMP R=1, aufgeräumte Knobs, dokumentierte Baseline | released/getaggt |
| **v1.9.0** | Kandidat: main nach M1.1 (+230 Elo) | tag existiert (Commit 554daf1 etc.) |
| **v2.0.0** | M2+M3: Kampagne Akt II + Fairy-Tactics + M3 Coach (Feenmuster, Figurennamen-Microcopy) + Daily Puzzle (deterministisch) | released/gemerged (PR #188, 2026-08-23) |

`main` (post-v2.0.0) = v2.0.0 + Dependabot-Bumps (#195, 2026-08-31).

## Engine — feature-complete / geparkt

Alle Such-Hebel seit v1.7.0 gemessen. Engine-Arbeit an diesem Punkt ehrlich abgeschlossen.

### Was gemerged (M1.1 — der Hebel, der funktionierte)

- Inkrementeller Zobrist-Hash + Quiesce-Negamax-Fix (commit f91e116, 2026-08-22).
- n=40 vs SF-1400 (d5, Merge-Lauf): **0.575 / +52 Elo** im Merge-Lauf → ~+230 Elo über alle Hebel gesamt (von −319 auf ~−267).
- M1.1 löste das strukturelle Problem: `computeZobristHash` lief pro Knoten über 81 Felder → durch inkrementellen Hash + Quiesce-Fix wurde Tiefe 5 tatsächlich spielfähig.
- MAX_SEARCH_TIME 10s gemessen 2026-08-22: −44 → **8s bleibt im Freeze** (Commit b5b6ca7).

### Was nicht funktioniert hat (verworfen, dokumentiert)

- Alle Eval-Hypothesen (mob=1.2, pawn=110, tempo=20, eg-passpawn 2.5): n=40-Regressionen → nie wieder.
- PROBCUT_RED=2: neutral/schlechter als 3 (0.150 vs 0.1625) → auf 3 bleiben.
- LMR_MAX_REDUCTION=2: −53 cp auf d4 → verworfen.
- QSearch-Check-Extension: schwächer bei fester Zeit.
- Opening-Book auf Engine-PV: zerstört das Vielfalt-Buch (#146) → bewusst Vielfalt.

Siehe: `bench/ABSOLUTE_STRENGTH_BASELINE.md`, `bench/NEGATIVE_RESULTS.md`, `tools/stockfish-match.ts`, `tools/selfmatch.ts`.

### Native Selfmatch-Messung (Track A — echtes 9×9-Elo)

SF kann kein 9×9 → echte 9×9-Stärke via `tools/selfmatch.ts` (zwei Configs, Farbwechsel, Elo + 95%-CI; kalibriert: d4-vs-d3 = +280). Alle Knob-Experimente 2026-08-22 nativ n=30:
E1 bp50 −47, E2 passedPawnEgMult2.5 −58, S1 lmrBase3 **−280**, S2 lmr5 −12, S3 nmr2 −12 → **v1.8.0-Freeze nativ bestätigt**, alle verworfen.

### NNUE-Track — GEPARKT 2026-08-23 (Gate negativ)

Pipeline komplett committed: Datengen (`tools/nnue-datagen.ts`), Trainer (`tools/nnue-train.py`, venv `.venv-nnue/`), Export, JS-Inference (`js/ai/nnue.ts`), Blend-Hook in evaluate.ts (default off), selfmatch-Wiring.

**Gate-Ergebnis (selfmatch baseline vs nnue30, n=80, d3):**
W-D-L 32–45–3, Score 0.681 → **nnue30 = −132 Elo [−223..−55] vs PST**.
72.8% Agreement reicht nicht; PST-Eval schlägt das Netz klar. Blend bleibt default-off.

|| Netz | Daten | Val decisive-agreement | corr |
| ---- | ----- | ---------------------- | ---- |
| e200 (256→32) | big-gen0 35k d3 | 71.9% | 0.324 |
| v2 (256×256→32) | + gen2 d4 (39.5k) | 72.8% | 0.346 |

Lehren: Mehr Daten gleicher Art bringt ~nichts (+1pp); Epochen helfen monoton (65→72 über 40→200); d4-Selfplay ohne Opening-Vielfalt bricht bei Ø 11 plies ab (370/400 Remis kurz); Netz schlägt Suchscore (d3 sign-agreement nur 60.6%), verliert aber gegen den fertigen PST-Eval.

**Falls wiederbelebt:** Opening-Randomisierung im Datengen (diverse, entschieden Partien), tiefere Labels (d5+), größerer Netzentwurf — erst dann neues Gate. Bis dahin: geparkt.

## v2.0.0 — was das Release brachte (M2+M3)

v2.0.0 ist das erste Release, das die 9×9-Identität ernst nimmt — nicht nur als Dekor.

### Kampagne Akt II (M2.1, PR #185)
- +6 Kapitel, die *eine* Feenfigur ins Zentrum stellen (Erzbischof-Gabeln, Kanzler-X-Ray, Engel vs Dame, Nachtreiter-Linien).
- Jedes Kapitel: einzigartige FEN, Persönlichkeit, 2★/3★-Ziele, E2E-Smoke.

### Fairy-Tactics-Set (M2.2, PR #186)
- Handgemachte Fairy-Puzzles statt nur procedural Matt-in-1.
- Puzzle-Menü: Filter "Feenfiguren"; Daily Puzzle darf daraus ziehen.
- 155 validierte Self-play-Puzzles in `puzzles.json`.

### Daily Puzzle (neu in v2.0.0, PR #188 / docs/puzzle.ts)
- Deterministisches Tagespuzzle: FNV-1a über Datum → gleiches Puzzle für alle an einem Tag.
- Sa/So = easy-Tier, Mo–Fr = medium.
- Damit hat das Spiel ein tägliches "Wiederkommen"-Anker-Event (Solo-Fokus).

### Tutor / Coach (M3.1–M3.4, PRs #187, #189)
- `TacticsDetector` um Feenmuster: Erzbischof-Gabel (Läufer+Springer), Kanzler-Spieß (Turm+Springer), Engel-Batterie.
- Tutor-Erklärung nutzt Figurennamen (Erzbischof, nicht "Läufer/Springer").
- M3.3: optionaler auto-Hint nach Blunder (Setting, default aus).
- M3.4: handkuratierte 20–30 Linien als "Lehrbuch"-Modus im Opening-Trainer (getrennt vom Vielfalt-Buch, 0 unlösbar).

### Sonstiges aus M4 / vorherigen Merges
- Sound-Settings persistieren (PR #184).
- Deutsche Microcopy weitgehend geschlossen (Puzzle-Generator war der letzte große englische Rest — nach M3.4 lokalisiert).
- CSP self-host für Three.js (jsDelivr aus Import-Map entfernt, eigenes `script-src`).
- A11y-Regeln im Playwright-Smoke angeschaltet (#184) — **Verifikation steht aus** (siehe unten).
- Post-Game-Replay-Overlay ab v1.7.0.
- Position teilen per Link.
- PWA/Offline-fähig.

## Verifizierte vs. behauptete Lücken

**Verifiziert (gemessen oder grün):**
- Engine-Stärke bis v1.8.0/M1.1: n=40-vs-SF-1400-Messungen, native Selfmatch-Messungen, alle verworfenen Hebel in `bench/NEGATIVE_RESULTS.md`.
- NNUE-Gate: n=80 selbstmatch, Ergebnis negativ.
- CI-Pipeline: alle Checks grün (nach Merge #195).

**Behauptet, aber nicht heute verifiziert:**
- Exakte Testanzahl (~3200+) — basiert auf Session-Memory/CI, nicht auf heute-gelaufenem `npx vitest run`.
- M4.1 A11y: PR #184 sagt "A11y-Rules an", aber ob 0 Violations auf Settings + Board existieren, ist nicht heute verifiziert. Playwright-Smoke muss gegen den Build laufen.

## Offene Punkte

- **M4.1 A11y-Verifikation:** Playwright-Smoke gegen Build laufen lassen. Wenn grün → Claim aus ROADMAP bestätigt. Wenn nicht → Bug, vor neuen Features aufräumen.
- **M1.2 (Hash-Keys für Rochade/EP 8×8) + M1.3 (64-bit Zobrist):** In ROADMAP als offen gelistet, nach M1.1 nicht gemessen. Kein offener Hebel, aber auch nicht "bewiesen unnötig". Entscheidung offen — nur sinnvoll mit klarer Mess-Spezifikation + Bereitschaft, 0-cp-Ergebnis zu akzeptieren.
- **TypeScript 7:** blockiert durch typescript-eslint v8 → TS 6.0.3 fixiert. Upgrade erst wenn typescript-eslint v9 erscheint.
- **MAX_SEARCH_TIME 10s:** gemessen 2026-08-22 (−44) → 8s eingefroren. Punkt abgehakt.
- **SF Elo 1600 / höhere SF-Tiefe (M5):** Track B Score ≥ 0.30 bei Elo 1400 als Gate. Nach M1.1 liegt man im Merge-Lauf bei ~0.575, aber die Zahlen sind nicht direkt komparabel (Farbwechsel). Referenz vor neuem Lauf festlegen.
- **Geparkt (bewusst):** OpeningBookTrainer harder, SF-1600 Match, NNUE, Multiplayer, Desktop-Hülle (Tauri), Coverage-Ziel 85%-Branches, TS7.

## Nächste Schritte (geplant)

1. **STATUS.md + ROADMAP.md aufräumen** (dieses Dokument hier + ROADMAP-Widerspruch NNUE).
2. **M4.1 verifizieren:** Playwright-A11y-Smoke gegen `npx vite build` + lokalen Server.
3. **Domain-Entscheidung danach:**
   - **A) Engine (M1.2/M1.3 messen):** Nur mit klarer Mess-Spezifikation (welcher Track? welches n? welche Referenz?).
   - **B) Produkt/UX:** Onboarding-Flow oder Feedback-Kanal — mit klarer Metrik/Budget-Entscheidung vorher.
   - **C) Pause:** v2.0.0 frisch, Engine geparkt, Doku stimmig. Warten bis konkrete Unzufriedenheit auftaucht.

## Lizenz

WTFPL (Commit 8ec8ceb, 2026-08-02). Einheitlich mit trischach.

## Solo-UX

- Standard 8×8 spielbar (Worker + Opening Book + volle Regeln: Rochade, EP, Unterpromotion).
- 9×9 Classic, Standard 8×8, Setup/Shop, Upgrade, Cross, Kampagne, Puzzle, Daily Puzzle, Opening-Trainer, Analyse, 3D.
- Post-Game-Replay-Overlay ab v1.7.0.
- Position teilen per Link.
- PWA/Offline-fähig.

**Nächster sinnvoller Schritt:** STATUS.md hier → M4.1 verifizieren → Domain-Entscheidung.
Engine-Hebel gibt es keine — NNUE ist geparkt, M1-Rest (M1.2/M1.3) ist die einzige verbleibende engine-seitige Option (nur sinnvoll mit klarer Mess-Spez + 0-cp-Akzeptanz).
