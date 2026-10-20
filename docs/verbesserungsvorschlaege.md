# Verbesserungsvorschläge für Schach 9x9

> **Aktualisiert 2026-10.** Kanonische Planung: [`ROADMAP.md`](ROADMAP.md).
> TypeScript-Migration, PGN, Themes, Drag&Drop, Opening Book, Analyse, PWA,
> Service Worker, Auto-Save, Sound-Settings-Persistenz und CSP-Cleanups sind
> **erledigt**. Multiplayer ist bewusst abgelehnt (lokales Spiel).

## ✅ Erledigt (historische Liste, als Referenz)

- Drag & Drop, Mobile-Optimierung, Themes, PGN Export/Import, Service Worker
- TypeScript-Migration (komplett), Unit-Tests (3138 Tests), E2E-Suite (91 Specs)
- KI-Analyse-Modus (Live + Post-Game), Sound-Volume-Slider, Auto-Save
- CSP-Inline-Handler entfernt (index.html, ErrorManager, ShopManager, debug.ts)

## 🎯 Offene, konkrete Verbesserungen (priorisiert)

### A. Hoch — Sofort umsetzbar
1. **Docs aktualisieren** — `ROADMAP.md`, `STATUS.md` und diese Datei hinken `main` hinterher (letzter Stand ROADMAP `1a3947d`). Test-/Coverage-Zahlen aktualisieren (91 E2E, 3138 Unit, Statements 90 %).
2. **Draw-Offer vs. Mensch** — braucht ein 2-Player/Hotseat-E2E-Setup (aktuell keiner vorhanden). E2E-Spec + Hotseat-Modus.
3. **Coverage-Lücken schließen** — `js/ui/3d` (Statements 80 % / Branches 61 %) und `js/ui/eManager3D.ts` (69 % / 54 %).

### B. Mittel — Nächste Version
4. **Erweiterte Statistiken** — Zug-Zeit-Tracking, Material-Verlauf-Grafik, Heatmap genutzter Felder.
5. **Bessere visuelle Feedback-Mechanismen** — Hover-Effekte, Schach/Checkmate-Animationen, pulsierender König im Schach.
6. **Tastatursteuerung erweitern** — Feldauswahl per "e4", Escape zum Abwählen, Tastenkürzel (U/H/S).

### C. Niedrig — Zukünftig
7. **Puzzle-Modus erweitern** — taktische Aufgaben, Schwierigkeitsgrade, Fortschritt speichern.
8. **Eröffnungs-Trainer** — Eröffnungen aus dem Buch trainieren, richtigen Zug finden.
9. **Erweiterte Analyse** — Varianten-Baum ("was wäre wenn"), Zug-Kommentare.
10. **Barrierefreiheit** — Screen Reader, Hoher Kontrast, vollständige Tastatur-Navigation.
11. **Social Features** — Spiel teilen (Link mit Position), Leaderboard (lokal), Achievements.

## 📈 Priorisierung (aktualisiert)

### Phase 1 (Hoch — Sofort)
- Docs aktualisieren
- Coverage-Lücken schließen (3d, eManager3D)
- Draw-Offer vs. Mensch (Hotseat-E2E)

### Phase 2 (Mittel — Nächste Version)
- Erweiterte Statistiken
- Bessere visuelle Feedback-Mechanismen
- Tastatursteuerung erweitern

### Phase 3 (Niedrig — Zukünftig)
- Puzzle-Modus erweitern
- Eröffnungs-Trainer
- Erweiterte Analyse (Varianten-Baum)
- Barrierefreiheit
- Social Features
