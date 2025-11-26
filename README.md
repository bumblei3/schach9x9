# ♟️ Schach 9x9

Ein innovatives Schachspiel auf einem 9x9 Brett mit neuen Figuren, strategischer Tiefe und modernen Features.

## 🌟 Features

*   **9x9 Spielbrett**: Ein größeres Schlachtfeld für mehr strategische Möglichkeiten.
*   **Neue Figuren**:
    *   **Erzbischof**: Kombiniert die Zugmöglichkeiten von Läufer und Springer.
    *   **Kanzler**: Kombiniert die Zugmöglichkeiten von Turm und Springer.
*   **Setup-Phase**: Platziere deinen König und kaufe deine Armee mit einem Punktesystem.
*   **KI-Gegner**: Spiele gegen einen Computergegner mit verschiedenen Schwierigkeitsstufen (Anfänger bis Experte).
*   **Tutor-Modus**: Erhalte Tipps und Analysen während des Spiels.
*   **PWA-Support**: Installiere das Spiel als App auf deinem Gerät und spiele offline.
*   **Modernes UI**: Anpassbare Themes, Soundeffekte und flüssige Animationen.

## 🚀 Installation & Start

### Voraussetzungen

*   Node.js (für Entwicklung und Tests)

### Schritte

1.  **Repository klonen:**
    ```bash
    git clone https://github.com/bumblei3/schach9x9.git
    cd schach9x9
    ```

2.  **Abhängigkeiten installieren:**
    ```bash
    npm install
    ```

3.  **Spiel starten:**
    ```bash
    npm start
    ```
    Das Spiel wird in deinem Standardbrowser geöffnet (standardmäßig unter `http://localhost:3000`).

## 🛠️ Entwicklung

*   **Tests ausführen:**
    ```bash
    npm test
    ```

*   **Linting:**
    ```bash
    npm run lint
    ```

*   **Formatierung:**
    ```bash
    npm run format
    ```

*   **KI-Training:**
    ```bash
    npm run train
    ```

## 🎮 Spielregeln (Kurzfassung)

1.  **Setup**: Wähle eine Startposition für deinen König in deinem Korridor.
2.  **Kaufphase**: Nutze 15 Punkte, um Figuren zu kaufen (Bauer=1, Springer/Läufer=3, Turm=5, Erzbischof=7, Kanzler/Dame=9).
3.  **Spiel**: Es gelten die üblichen Schachregeln (Schach, Matt, Rochade, En Passant). Ziel ist es, den gegnerischen König mattzusetzen.

## 💻 Tech Stack

*   **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
*   **Testing**: Jest
*   **Tools**: ESLint, Prettier, Husky

## 📄 Lizenz

Dieses Projekt ist unter der MIT Lizenz veröffentlicht.
