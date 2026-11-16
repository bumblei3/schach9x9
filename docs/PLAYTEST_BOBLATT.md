# Playtest-Blatt — Feedback in Daten, nicht in Gefühle

Stand: 2026-11-16 · Ergänzt [`PLAYTEST_PROTOCOL.md`](PLAYTEST_PROTOCOL.md). Das
Protokoll beschreibt *warum* und *was*; dieses Blatt ist das Arbeitsblatt, das
ein Spieler ausfüllt und das die Zahlen in genau das Format bringt, das das
Protokoll verlangt.

Zweck: 3–5 Testspieler à 2× 30 Min liefern something, was man vergleichen kann.
Ohne Zahlen ist jede weitere Produktentscheidung Spekulation.

## Kanäle (alle schon vorhanden)

| Kanal | Wofür | Wie |
|-------|-------|-----|
| **Problem melden** (im Menü, „Rückmeldung") | Einzelfehler, Unklarheiten, Vorschläge | Öffnet ein vorbefülltes GitHub-Issue mit Modus, Stellung, letzten Client-Fehlern und Umgebung. Kein Backend, kein Token — der Tester schickt selbst ab. |
| **GitHub Issues** | Alles, was länger ist als ein Issue-Kommentar | <https://github.com/bumblei3/schach9x9/issues> |
| **Dieses Blatt** | Die 30-Minuten-Sitzung als Zahlen | Ausdrucken oder in `docs/PLAYTEST_ERGEBNISSE.md` übertragen |

## Pro Spieler (Kopierblock)

```
Spieler: ____   Datum: ____   Modus-Reihenfolge: Classic 9x9 / 8x8 / Akt IV / Daily / Setup

## 1. Spieldauer
Runden: ____  davon beendet: ____  Ø Züge bis zum ersten Matt: ____

## 2. Mal-Warnungen (Visuell, „Grober Fehler?"-Dialoge)
Anzahl pro Partie: ____ / ____ / ____   (Erwartung: ≤ 2)
Welche waren berechtigt? ______________________________________________

## 3. Kapitel-Abschluss (Akt IV, Kapitel 19–25)
Gespielt: ____  Geschafft: ____   (Erwartung: ≥ 50 %)
An Kapitel: ____ war ich am stärksten, an Kapitel: ____ wollte ich aufgeben.
Warum: ____________________________________________________________

## 4. Hunger nach 15 Minuten
1–5: ____   (Erwartung: ≥ 3)

## 5. „Würdest du wieder spielen?"
1–5: ____   (Erwartung: ≥ 4)

## 6. Züge bis zum ersten Matt
____   (Erwartung: < 25)

## 7. Offene Antworten (die wichtigste Zeile)
„Was hast du gespürt?" ______________________________________________
„Wann wolltest du aufgeben?" _______________________________________
„Was hat dich am meisten gestört?" __________________________________
„Was fehlt dir?" ___________________________________________________

## 8. Konsolen-Auffälligkeiten (nur falls aufgefallen)
____________________________________________________________
```

## Übertragen nach `docs/PLAYTEST_ERGEBNISSE.md`

Pro Spieler eine Zeile, damit man Akt II gegen Akt IV vergleichen kann:

| Spieler | Dauer/Ende | Ø Züge bis Matt | Mal-Warnungen | Kapitel % | Hunger | Wiederholen | Störung Nr. 1 |
|---------|-----------|-----------------|---------------|----------|--------|-------------|---------------|
|         |           |                 |               |          |        |             |               |

## Nächster konkreter Schritt

Sobald 1+ Blätter vorliegen: Zahlen in `PLAYTEST_ERGEBNISSE.md` übertragen,
Pattern identifizieren (eindeutig häufige Störung, Kapitel mit Abbruch), dann
gezielten Merge. Bis dahin keine weiteren Content-Gerüste committen.
