# Mitmachen an schach9x9

Danke für das Interesse. Das ist die kurze Anleitung: was du brauchst, welche
Befehle laufen, und wie aus einer Änderung ein Merge wird.

Kurz das Wichtigste:

1. **Eine Änderung = ein Branch = ein PR gegen `main`.** Nicht direkt auf `main`
   pushen.
2. **Conventional Commits**, Header ≤ 100 Zeichen — die Nachricht wird im
   `commit-msg`-Hook geprüft.
3. **Vor dem Push die ganze Kette lokal grün haben.** Ein grüner Build allein
   reicht nicht: `vitest` erkennt Fehler in Modulen, die nichts importiert, und
   `tsc` mit warmem Increment-Cache kann durchlaufen, wo der Baum nicht
   typprüft.
4. **`STATUS.md` und `docs/ROADMAP.md` im selben Push mitführen**, wenn sich der
   Ist-Stand ändert. Beide hinken sonst hinterher und sagen dann etwas
   Falsches.
5. **Alles, was das Brett, die Aktionsleiste oder das Layout verändert, bewegt
   die visuellen E2E-Baselines.** Neu aufnehmen ist dabei der Normalfall, kein
   Misserfolg — aber die Differenz lesen, nicht blind `--update-snapshots`.

## Voraussetzungen

- **Node.js 18+** (die CI pinnt `24.0.0`, siehe `.github/workflows/ci.yml`).
  Lokal darf eine andere Version läuft; wenn ein Test nur in der CI rot ist,
  ist die Version der erste Verdacht, nicht der Code.
- **npm**

## Setup

```bash
git clone https://github.com/bumblei3/schach9x9.git
cd schach9x9
npm ci --legacy-peer-deps
```

`--legacy-peer-deps` ist Pflicht: `eslint@10` und `eslint-plugin-import@2.32`
vertragen sich nicht, ohne das Flag scheitert `npm ci` an `ERESOLVE`.

## Befehle

| Zweck                             | Befehl                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| Dev-Server                        | `npm run dev`                                                                         |
| Produktions-Build                 | `npm run build`                                                                       |
| Unit-Tests (komplett)             | `npm test`                                                                            |
| Eine Testdatei                    | `npx vitest run tests/<datei>.test.ts`                                                |
| Fuzz-Tests                        | `npm test tests/fuzz/fuzz.test.ts`                                                    |
| Typecheck                         | `npm run typecheck`                                                                   |
| Lint                              | `npm run lint`                                                                        |
| Formatierung (nur eigene Dateien) | `npx prettier --write <datei>`                                                        |
| Abdeckung                         | `npm run test:coverage`                                                               |
| E2E (komplett, CI-nah)            | `CI=1 npx playwright test --project=chromium --reporter=line --workers=1 --retries=0` |
| Ein E2E-Spec                      | `npx playwright test e2e/<spec>.ts --project=chromium --workers=1 --retries=0`        |
| E2E-Baselines neu aufnehmen       | `npm run test:visual:update`                                                          |
| Engine gegen Stockfish            | `npm run match:stockfish`                                                             |
| Changelog aus den Commits         | `npm run changelog`                                                                   |

Nur **Chromium** ist als Playwright-Projekt aktiv (Firefox/WebKit stehen in
`playwright.config.ts` auskommentiert). E2E läuft gegen ein statisch
ausgeliefertes `dist/` auf `http://localhost:3000` — **vor** einer E2E-Runde
also `rm -rf dist && npm run build`. `dist/` wird nicht gesäubert, ein alter
Build tarnt eine kaputte Änderung als grün.

## Vor dem Push

```bash
rm -rf dist && npm run build
npx vitest run
npx tsc --noEmit --incremental false
npx eslint . --ext .ts
```

Dazu:

- `npx prettier --check <datei>` für alles unter `e2e/` (das ist
  Prettier-geprüft, aber nicht lintd).
- `npx vitest run tests/snapshots.test.ts -u`, wenn du `title`, `aria-label`
  oder `data-*` in `index.html` angefasst hast — der Snapshot prüft
  `document.body.innerHTML` der Setup-Phase. Danach den Diff lesen: es dürfen
  nur die erwarteten Zeilen wandern.
- E2E-Suite, wenn du an der UI, am Brett oder an Heuristiken mit
  Schwellwerten gespielt hast (Tutor-Warnungen sind Schwellwerte, keine
  Einheiten — sie können ein Zug an der UI blockieren).

**`npm run format:check` ist kein Gate.** Auf `main` sind 129 Dateien nicht
prettier-sauber (49 unter `tests/`, 33 unter `js/`, 12 unter `e2e/`, 12 unter
`tools/`, dazu `README.md`, `STATUS.md`, `docs/`, `css/`), und `index.html`
lässt der Prettier-HTML-Parser mit einem Syntaxfehler an `</div>` (Zeile 1662)
abbrechen — obwohl der Browser die Datei fehlerfrei baut und alle
E2E-Visual-Baselines unverändert sind. Es ist also kein Beleg für einen
Kaputtbaum, sondern eine Parser-Differenz. Formatiere daher gezielt die
Dateien, die du anfasst, und lasse `npm run format` nicht über den ganzen Baum
laufen: der Diff würde hundert fremde Dateien mitnehmen und jedes offene PR
breitmachen.

Zwei Haken laufen automatisch beim Commit:

- `pre-commit`: `npm run lint` und `npm test`
- `commit-msg`: commitlint

## Commit-Nachrichten

Conventional Commits, Typ klein, Subjekt in Satzschreibung (groß am Anfang),
kein Punkt am Ende, Header höchstens 100 Zeichen:

```
feat(ui): Sprachschalter für Englisch
fix(tutor): Drohungen auf 8x8 nicht mehr erfinden
perf: Outfit selbst hosten statt von Google Fonts
docs: STATUS auf main <sha>
test(e2e): Promotions-Baseline wird wirklich geprüft
```

Erlaubte Typen: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
`chore`, `ci`, `build`, `revert`. Der Scope ist klein (`ui`, `tutor`, `ci`,
`tests`, `deps`, `assets`, …). Im Körper lieber GFM-Dateien nennen als nur
„oben“ zu verweisen.

## Pull Request

- **Ziel:** `main`. Überschrift und Beschreibung in demselben Stil wie die
  Commits.
- **Beschreibung:** was sich ändert, wie es gemessen/verifiziert wurde, was
  absichtlich nicht geht. Eine Zahl aus einem einzelnen Lauf ist keine
  Aussage — die Performance korrumpiert zwischen Läufen, siehe
  `STATUS.md`.
- **Merge:** Squash, danach Branch löschen.
- **Abhängigkeiten:** Dependabot-PRs einzeln mergen. Einer gemergten PR
  verschiebt `main` und hinterlässt die anderen Branches mit alten, grün
  wirkenden Checks, die den neuen Stand nie geprüft haben. Vor dem Merge eines
  zweiten also rebase und CI neu laufen lassen. Konflikte in `package.json`
  und `package-lock.json`: die neuere Version der geteilten Abhängigkeit aus
  `main` behalten, den Bump des Branches behalten, danach
  `npm install --legacy-peer-deps` und prüfen, dass `vitest` und
  `@vitest/coverage-v8` aus derselben Version kommen.

## CI

`ci.yml` hat sieben Jobs: `lint`, `test`, `build`, `e2e-test`, `security-audit`,
`lighthouse` und `deploy`, plus den `ci-gate`. Der Gate schlägt fehl, wenn
`lint`, `test` oder `build` rot sind; `e2e-test` steht in `needs` und muss
damit _fertig_ sein, schließt den Gate aber nicht von allein. Eine rote E2E
darf trotzdem nicht mergen — sie ist ein eigener, erforderlicher Status-Check.
`lighthouse` läuft mit `continue-on-error`, weil die Performance ein bekannter,
offener Hebel ist; die Zahlen stehen im Artifact und in `STATUS.md`, nicht im
Job-Status.

## Konventionen, die nicht offensichtlich sind

- **Tests assertieren den Effekt, nicht die Serialisierung.** jsdom 31
  serialisiert `el.style.boxShadow` als `rgb(...)` und hängt `px` an
  werbenlose Transforms; eine Assertion darauf ist versionsabhängig.
- **Kein Test endet in einem `catch` mit `return`.** Damit ist er grün, ohne
  etwas zu prüfen. Entweder die Erwartung scheitern lassen oder mit
  `test.skip(...)` explizit überspringen.
- **Dynamische Inhalte gehören zu den Tests.** Das Schließen eines Moduls
  zusammen mit seinen Importern _und_ seinen Testdateien; ein commitlint- oder
  tsc-Fehler durch ein halb gelöschtes Modul schließt mehrere Jobs auf einmal.
- **Kampagnenkapitel** müssen in `CAMPAIGN_LEVELS` eingesprengt sein und
  `unlocks` auf existierende Kapitel zeigen. **Texbuch-Zeilen** müssen die
  Lösbarkeitsprüfung gegen die echte Engine bestehen. Beides fängt die
  Invarianten-Suiten ab.
- **Toasts statt `alert`/`confirm`.** Die App zeigt Rückmeldungen über
  `#toast-container`; ein Test, der auf `window.alert` lauscht, schlägt
  garantiert fehl.
- **Dokumentation:** lokale Markdown-Links müssen aufgelöst werden, und
  Dateien, die andere Docs referenzieren, müssen existieren. `STATUS.md`
  führt die Gesundheitstabelle (Testzahlen, CI-Läufe) und die Abschnitte
  „Erledigt“/„Nächster sinnvoller Schritt“; `docs/ROADMAP.md` führt die
  Releasezeile und den nächsten konkreten Schritt.

## Was nicht rein muss

`docs/ROADMAP.md` und `bench/NEGATIVE_RESULTS.md` listen ausdrücklich aus, was
bewusst nicht gebaut wird: Multiplayer, Cloud-Sync, NNUE (geparkt, gemessen
schwächer) und eine Stärkung über das Eröffnungsbuch. Bevor du einen Vorschlag
in eine dieser Richtungen umsetzt, kurz in beide Dateien schauen — und die
Stärkezahl nicht aus einem einzelnen Match zitieren.

## Inhaltliche Arbeit

Kampagnen, Texbuch, Rätsel und Tutortexte sind Prosa, keine Labels. Wer hier
nicht gut genug Schach kann, um gültige Stellungen zu bauen: **nicht** im
Block neue Inhalte einführen. Lieber zuerst eine Design-Notiz in `docs/`, dann
ein einziges Pilotkapitel/eine einzige Pilotzeile, die Strukturgate laufen
lassen, und die Restmenge erst danach.

## Fragen

Issue-Templates liegen in `.github/ISSUE_TEMPLATE/`, unter anderem für
Playtest-Rückmeldungen. Die qualitative Kanal ist `docs/PLAYTEST_PROTOCOL.md`
mit dem zugehörigen `docs/PLAYTEST_BOBLATT.md`.
