# Playtest-Ergebnisse

Stand: 2026-11-16 · Arbeitsblatt: [`PLAYTEST_BOBLATT.md`](PLAYTEST_BOBLATT.md) ·
Protokoll und Nordstern-Metriken: [`PLAYTEST_PROTOCOL.md`](PLAYTEST_PROTOCOL.md)

**Status: noch keine Daten.** Die Datei existiert jetzt, damit das erste
ausgefüllte Blatt direkt hier landet, ohne dass man erst das Format daraus
entwickeln muss. Das Blatt und [`STATUS.md`](../STATUS.md) verweisen hierher.

Es wird **nicht** vorgegriffen: Solange keine Zeile ausgefüllt ist, gibt es
keine Aussage über Spielerwert, Schwierigkeit oder Haltbarkeit. Jede Produkt-
entscheidung vor dem ersten Blatt bleibt Spekulation.

## 1. Sitzungen

| Datum | Spieler | Reihenfolge der Modi | Blätter | Von |
| ----- | ------- | -------------------- | ------- | --- |
| —     | —       | —                    | 0       | —   |

## 2. Pro Spieler

Aus dem Übertragungsschema des Blatts, eine Zeile pro Spieler:

| Spieler | Dauer / Ende | Ø Züge bis Matt | Mal-Warnungen | Kapitel % | Hunger (15 min) | Wieder spielen? | Störung Nr. 1 |
| ------- | ------------ | --------------- | ------------- | --------- | --------------- | --------------- | ------------- |
|         |              |                 |               |           |                 |                 |               |

Erwartungen aus dem Protokoll (gleiche Maßstäbe für alle Sitzungen, sonst ist
der Vergleich wertlos):

| Metrik                                      | Erwartung |
| ------------------------------------------- | --------- |
| Züge bis zum ersten Matt                    | < 25      |
| Mal-Warnungen („Grober Fehler?") pro Partie | ≤ 2       |
| Kapitel-Abschluss (Akt IV) in 2× 30 min     | ≥ 50 %    |
| Hunger nach 15 min (1–5)                    | ≥ 3       |
| „Würdest du wieder spielen?" (1–5)          | ≥ 4       |

## 3. Vergleich Akt II gegen Akt IV

| Metrik                       | Akt II   | Akt IV | Signal                     |
| ---------------------------- | -------- | ------ | -------------------------- |
| Kapitel-Anteil ab Kapitel 20 | Baseline | Test   | Mehr haltbar?              |
| Mal-Warnungen pro Spiel      | Baseline | Test   | Fühlt sich schwieriger an? |
| Spieldauer                   | Baseline | Test   | Noch im Rahmen?            |

Akt II ist die Baseline, solange kein zweiter Lauf vorliegt. Werte erst
eintragen, wenn beide Spalten Daten haben.

## 4. Kommentare (Wortlaut)

Die offenen Antworten sind die eigentliche Datenquelle — die Zahlen sind nur
die Sortierung. Pro Sitzung die vier Fragen des Blatts:

- „Was hast du gespürt?"
- „Wann wolltest du aufgeben?"
- „Was hat dich am meisten gestört?"
- „Was fehlt dir?"

```
(Sitzung 1, Spieler —)
```

## 5. Konsolen-Auffälligkeiten

Nur aufgefallene Meldungen, mit Kontext. Entstanden im Browser, nicht im Test.

| Spieler | Meldung | Kontext |
| ------- | ------- | ------- |
|         |         |         |

## 6. Auswertung

Erst befüllen, wenn mindestens ein Blatt vorliegt:

1. Eindeutig häufige Störung benennen (bei 3–5 Spielern: mindestens 2 Nennungen).
2. Kapitel mit Abbruch benennen.
3. Danach gezielter Merge — bis dahin keine weiteren Content-Gerüste committen.

## Datenschutz

Keine Login-Daten, keine Autosaves, keine Stellungen von realen Konten. Nur
anonymisierte Metriken, Zahlen und Kommentare. Der Spieler entscheidet, was er
meldet; der Reporter im Spiel öffnet ein Issue, er schickt nichts automatisch ab.
