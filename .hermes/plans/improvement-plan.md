# Schach9x9 Improvement Plan

**Stand:** 2026-06-10 | 1517 Unit-Tests + 55 E2E-Tests | 0 TS-Fehler | 22.458 LOC

---

## Phase 1: Any-Typ Reduktion (Woche 1)

Ziel: Von 151 auf <50 any-Types reduzieren. Fokus auf echte Type-Safety-Bugs, nicht nur Kosmetik.

### 1.1 AnalysisController (einfach, 3 any)
**Datei:** `js/AnalysisController.ts`
**Problem:** `gameController: any`, `game: any`, `constructor(gameController: any)`
**Lösung:** `GameController` und `Game` sind bereits importierbar — der Import existiert bereits in gameController.ts. Einfach die Typen importieren und verwenden.
**Risiko:** Gering — keine zirkulären Abhängigkeiten.

### 1.2 ArrowRenderer (einfach, 5 any)
**Datei:** `js/arrows.ts`
**Problem:** `lastArrows: any[]`, `highlightMoves(moves: any[])`, forEach-Callbacks
**Lösung:** Arrow-Typ definieren: `{ fromR: number; fromC: number; toR: number; toC: number; colorKey: string; quality?: string }` und verwenden.
**Risiko:** Gering — ArrowRenderer ist eine eigenständige Klasse.

### 1.3 aiController workerResults (mittel, 1 any)
**Datei:** `js/aiController.ts:543`
**Problem:** `const workerResults: any[] = []`
**Lösung:** Typ aus `SearchResult` (aus aiEngine.ts) oder `MoveResult` ableiten. Worker-Ergebnisse haben `move`, `score`, `depth` Felder.
**Risiko:** Gering — nur eine Stelle.

### 1.4 gameController.aiController (mittel, 1 any)
**Datei:** `js/gameController.ts:64`
**Problem:** `aiController?: any` mit Kommentar "using any to avoid import resolution issues"
**Lösung:** AIController wird bereits in gameController.ts importiert (Zeile 25 via AnalysisController). Prüfen ob direkter Import klappt, sonst `import type` verwenden.
**Risiko:** Mittel — könnte zirkuläre Imports auslösen.

### 1.5 App.ts window-Globals (mittel, ~8 any)
**Datei:** `js/App.ts`
**Problem:** `(window as any).UI`, `.game`, `.app`, `.gameController`, `.battleChess3D`, `.recoverGame`
**Lösung:** Window-Erweiterungstyp definieren in `types/window.d.ts`:
```typescript
interface Window {
  UI: typeof import('./ui.js');
  game: Game;
  app: App;
  gameController: GameController;
  battleChess3D: BattleChess3D;
  recoverGame: () => void;
}
```
**Risiko:** Gering — nur Typ-Definitionen, kein Laufzeitverhalten.

### 1.6 moveController (mittel, 2 any)
**Datei:** `js/moveController.ts`
**Problem:** `(UI as any).animateMove`, `(campaignManager as any).state`
**Lösung:** 
- `animateMove` in ui.ts als exportieren und typisieren
- `campaignManager.state` ist ein öffentliches Feld — Typ in CampaignManager definieren
**Risiko:** Mittel — ui.ts Export erfordert Refactoring.

### 1.7 gameController return types (einfach, 2 any)
**Datei:** `js/gameController.ts:649,653`
**Problem:** `enterAnalysisMode(): any`, `exitAnalysisMode(): any`
**Lösung:** Return-Typ `boolean` (AnalysisController gibt boolean zurück).

### 1.8 GameExtended.aiController (mittel, 1 any)
**Datei:** `js/gameController.ts:64`
**Problem:** `aiController?: any` auf GameExtended Interface
**Lösung:** Typ `AIController | null` verwenden.

---

## Phase 2: Code-Aufteilung (Woche 2)

Ziel: Große Dateien modularisieren für bessere Wartbarkeit.

### 2.1 aiController.ts (956 LOC) → aufteilen
**Vorschlag:** 
- `aiController.ts` — Kernlogik (AI-Performance, Worker-Pool)
- `ai/drawOffer.ts` — Remis-Analyse (Zeilen 720-770)
- `ai/hintGenerator.ts` — Tutor-Hint-Logik (getHint Methode)

### 2.2 gameController.ts (924 LOC) → aufteilen
**Vorschlag:**
- `gameController.ts` — Kern (Spielablauf, Modus-Wechsel)
- `game/modeTransitions.ts` — Setup → Play → Analysis Übergänge
- `game/saveLoad.ts` — Speichern/Laden Funktionen

### 2.3 BoardRenderer.ts (~600 LOC) → aufteilen
**Vorschlag:**
- `BoardRenderer.ts` — Rendering
- `ui/dragDrop.ts` — Drag & Drop Logik
- `ui/promotion.ts` — Bauernumwandlung UI

---

## Phase 3: Test-Verbesserungen (Woche 2-3)

### 3.1 Coverage Report
**Aktion:** `npx vitest --coverage` laufen lassen und Lücken identifizieren.
**Ziel:** >80% Abdeckung für Kernmodule.

### 3.2 Fehlende Tests
**Kandidaten:**
- `js/arrows.ts` — 0 Tests, eigenständige Klasse, leicht testbar
- `js/utils/ErrorManager.ts` — 116 LOC, wenig Tests
- `js/utils/PGNParser.ts` — 191 LOC, Parser sollte gut getestet sein
- `js/utils/PGNGenerator.ts` — 189 LOC
- `js/moveController.ts` — 359 LOC, komplexe Logik

### 3.3 E2E Tests ergänzen
**Ideen:**
- PGN Export/Import Roundtrip
- Kompletter Spielablauf: Setup → Play → Ende
- Remis-Angebot Flow (AI akzeptiert/lehnt ab)
- Tutorial durchspielen

---

## Phase 4: Code-Qualität (Woche 3)

### 4.1 Magic Numbers → Konstanten
- `aiController.ts:780` — `-300`, `-100` Schwellenwerte → `DRAW_OFFER_THRESHOLD_LOW/HIGH`
- `aiController.ts:755` — `50`, `40` → `DRAW_ACCEPT_SCORE_MAX`, `DRAW_ACCEPT_MOVES_MIN`
- `aiController.ts:749` — `80` → `HALF_MOVE_CLOCK_NEAR_50`
- `EvaluationBar.ts:67` — `-1000`, `1000` → `SCORE_MIN`, `SCORE_MAX`

### 4.2 Inline Styles → CSS-Klassen
- `BoardRenderer.ts:146` — `dragImage.style.top = '-1000px'` → `.drag-hidden` Klasse
- `ui_effects.ts:91` — `bottom: -100px` → CSS Animation

### 4.3 Sound-Validierung
- `sounds.ts:48` — "value should be 0-100" Kommentar → echte Validierung

---

## Phase 5: Features (Backlog)

### 5.1 Statistik-Dashboard
- Spielhistorie visualisieren (Gewinnrate, durchschnittliche Zuganzahl)
- Tutor-Fortschritt anzeigen

### 5.2 Mobile/Touch
- Touch-Events für Drag & Drop
- Responsive Board-Größe

### 5.3 Dark Mode Erweiterung
- Mehr als 2 Theme-Optionen
- System-Theme automatisch erkennen

### 5.4 PGN-Import
- PGN-String einfügen und Spiel daraus laden
- Partien aus Chess.com/Lichess importieren

### 5.5 Achievement System
- Spieler-Fortschritt mit Belohnungen und Errungenschaften
- Kategorien: Spielstil, Kampagne, Tutor, Sozial
- Persistenz über localStorage/StatistikManager
- UI: Achievement-Popup bei Freischaltung, Fortschrittsanzeige

#### Geplante Achievements
| ID | Name | Beschreibung | Kategorie |
|----|------|-------------|-----------|
| `first_win` | Erster Sieg | Gewinne dein erstes Spiel gegen die KI | Spielstil |
| `campaign_starter` | Abenteurer | Starte dein erstes Kampagnen-Level | Kampagne |
| `campaign_veteran` | Veteran | Schließe 10 Kampagnen-Levels ab | Kampagne |
| `perfectionist` | Perfektionist | Gewinne ein Spiel ohne Materialverlust | Spielstil |
| `speed_demon` | Blitzkrieg | Gewinne ein Spiel in unter 20 Zügen | Spielstil |
| `tutor_student` | Schüler | Nutze den Tutor 10 Mal | Tutor |
| `puzzle_solver` | Rätsellöser | Löse 5 Puzzles | Tutor |
| `comeback_king` | Comeback-König | Gewinne ein Spiel mit >500 Punkten Rückstand | Spielstil |
| `draw_master` | Remis-Meister | Erzwinge 5 Remisse | Spielstil |
| `explorer` | Entdecker | Spiele in 3 verschiedenen Modi | Sozial |

#### Technische Umsetzung
- Neues Modul: `js/achievements/AchievementManager.ts`
- Events: `gameWon`, `gameLost`, `gameDrawn`, `tutorUsed`, `puzzleSolved`, `campaignLevelCompleted`
- Achievement-Popup: `js/ui/AchievementPopup.ts` (Toast-ähnlich)
- Fortschrittsanzeige: Neuer Menü-Eintrag "Errungenschaften"
- Tests: `tests/achievements/AchievementManager.test.ts`

---

## Priorisierung

| Phase | Impact | Aufwand | Empfehlung |
|-------|--------|---------|------------|
| 1.1-1.3 Any-Reduktion (einfach) | Hoch | 2h | **Sofort** |
| 1.4-1.5 Any-Reduktion (mittel) | Hoch | 3h | **Sofort** |
| 1.6-1.8 Any-Reduktion (rest) | Mittel | 2h | **Sofort** |
| 3.1 Coverage Report | Mittel | 1h | **Diese Woche** |
| 3.2 Neue Tests | Hoch | 6h | **Diese Woche** |
| 4.1 Magic Numbers | Mittel | 1h | **Diese Woche** |
| 2.x Aufteilung | Hoch | 12h | **Nächste Woche** |
| 3.3 Neue E2E Tests | Mittel | 4h | **Nächste Woche** |
| 4.2-4.3 Sonstiges | Niedrig | 2h | **Wenn Zeit** |
| 5.5 Achievement System | Mittel | 8h | **Backlog** |
| 5.x Features | Variabel | Variabel | **Backlog** |

---

## Nächste Schritte

1. Phase 1.1-1.3 sofort umsetzen (AnalysisController, ArrowRenderer, workerResults)
2. Coverage Report laufen lassen
3. Dann Phase 1.4-1.8 je nach verbleibender Zeit
