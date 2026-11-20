# Playtest & Messung — Protokoll für schach9x9

Stand: 2026-11-20 · Für: 3–5 Testspieler · Ziel: Daten statt Spekulation

## Warum

Die Roadmap nennt Messung als den einzigen Weg, um zu entscheiden, ob Akt I–IV
den Spielerwert erhöhen. Ohne Daten ist jede weitere Verbesserung Spekulation
(Roadmap: „Spielerwert kommt aus M2/M3 und der Playtest").

## Was die Spieler tun (ca. 2× 30 Min pro Spieler)

Solo gegen die KI auf einem Gerät (Hotseat nur, wenn zwei dasselbe Gerät teilen
wollen — es gibt bewusst keinen Multiplayer/Login).

| # | Aufgabe | Ziel | Erfassung |
|---|---------|------|-----------|
| 1 | Classic 9×9 (3 Runden) | Regelmäßigkeit spüren | Kommentar-Journal |
| 2 | Standard 8×8 (3 Runden) | Baseline; 9×9 vergleichen | Kommentar-Journal |
| 3 | Kampagne Akt IV, Kapitel 19–25 | Content-Tiefe testen | Anzahl gespielte Kapitel, Hunger |
| 4 | Daily Puzzle oder Setup-Modus | Feeleinzelung testen | Lösungszahl, Zeit |
| 5 | Replay-GIF-Export nutzen | UI-Flow testen | Kommentar zu Export |
| 6 | (optional) 3D-Modus anschauen | 3D-Bootszeit + Stabilität | Kommentar |

## Nordstern-Metriken (je Spieler)

| Metrik | Wie erfassen | Erwartung |
|--------|--------------|-----------|
| Spieldauer (Gesamt) | Aufzeichnung | < 3 Min pro Runde |
| Züge bis erster Mal | Kommentar | < 25 |
| Mal-Warnungen (Visual) | Kommentar zu „Grober Fehler?" | ≤ 2 |
| Kapitel-Abschluss-Rate (Akt IV) | Vorher/Nachher | ≥ 50% in 2× 30 Min |
| Hunger nach 15 Min | Selbst-Bewertung 1–5 | ≥ 3 |
| „Würde ich wieder spielen?" | 1–5 | ≥ 4 |

## Vergleichs-Metrik (Akt IV vs Akt II)

| Metrik | Akt II | Akt IV | Signal |
|--------|--------|--------|--------|
| Kapitel-Anteil ab Kap. 20 | Baseline | Test | Mehr haltbar? |
| Mal-Warnungen/Spiel | Baseline | Test | Mehr fühlt sich schwieriger an? |
| Dauer | Baseline | Test | Noch im Rahmen? |

## Protokoll-Ablauf (Remote)

1. Aktuellen Stand ausliefern: `npx vite build`, dann `npx http-server dist -p 3000 -s -c-1`,
   die URL an die Spieler geben (oder `dist/` hosten). Nicht den Dev-Server testen.
2. 2× 30 Min gleichzeitig spielen: Solo gegen die KI, bei Bedarf zwei Geräte/KI-Seiten.
3. Nach jeder Runde kurz kommentieren:
   `„Was hast du gespürt?", „Wann warst du am stärksten?", „Wann wolltest du aufgeben?"`.
4. Nach 30 Min: Metriken loggen (aufgezeichnete Runden, Kommentare, Hunger).
5. Ergebnisse zusammenfassen und der Dev-Listen.

## Automatische Baseline (2026-11-20, vor dem Playtest)

Damit die Spieler nicht erst die Grundlagen prüfen: Live-Sweep über 9 Modi
(Initial-Load, Classic 9×9, Standard 8×8, Opening-Trainer, Puzzle, Cross,
Daily-Puzzle, Kampagne, Setup/Shop) mit Konsolen-Sammler → **0 `error`/`pageerror`**;
E2E-Suite `--workers=8` → **159 passed**; `vitest` → **3311 passed**. Ein Konsolenfehler
im Playtest ist also ein neuer Befund, kein bekanntes Rauschen.

## KI-Regeln gezielt prüfen (neu seit 2026-11-20)

Die KI sucht jetzt mit den Rochaden-/en-passant-Regeln der Stellung. Zwei
beobachtbare Kriterien, falls ein Spieler auf die Idee kommt:

- **8×8:** König einmal hin- und zurückziehen, dann die KI Züge machen lassen —
  sie darf **nicht** mehr rochieren (vorher möglich, jetzt nicht mehr).
- **9×9:** Ein Bauer zweiziehen, wenn ein gegnerischer Bauer neben dem
  Landungsfeld steht — die KI darf **en passant** schlagen.

## Speicherung & Datenschutz

- Keine Login-Daten im Protokoll.
- Nur anonymisierte Metriken (Runden, Kommentare, Hunger) werden gemeldet.
- Lokale Autosaves sind kein Tracking; der Spieler entscheidet.

## Checkliste

[ ] 3 Spieler eingeladen
[ ] 2× 30 Min gespielt
[ ] Kommentare gesammelt
[ ] Metriken protokolliert
[ ] Ergebnisse in diesem Dokument erfasst
[ ] Nächster konkreter Schritt gewählt (Content / SF-Kalibrierung / Merge)

## Nächster konkreter Schritt

Sobald 1+ Spieldaten vorliegen: Metriken miterfassen, Pattern identifizieren,
dann targeted Merge. Bis dahin keine weiteren Content-Gerüste committen.
