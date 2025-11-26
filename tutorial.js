// Tutorial system for Schach 9x9
import { PIECE_SVGS } from './chess-pieces.js';

export class Tutorial {
  constructor() {
    this.currentStep = 0;
    this.steps = this.createSteps();
    this.initUI();
  }

  createSteps() {
    return [
      {
        title: '🎮 Willkommen zu Schach 9x9!',
        content: `
          <p>Schach 9x9 ist eine erweiterte Variante des klassischen Schachs mit einzigartigen Regeln und besonderen Figuren.</p>
          <p>In diesem Tutorial lernst du:</p>
          <ul>
            <li>🏰 Das 9x9 Brett und Korridor-System</li>
            <li>⚔️ Die speziellen Figuren: Erzbischof und Kanzler</li>
            <li>💰 Das Punkte-Shop-System</li>
            <li>♟️ Grundlegende Spielregeln</li>
          </ul>
        `,
      },
      {
        title: '⚔️ Der Erzbischof',
        content: this.createArchbishopDemo(),
      },
      {
        title: '🏰 Der Kanzler',
        content: this.createChancellorDemo(),
      },
      {
        title: '🗺️ Das Korridor-System',
        content: this.createCorridorDemo(),
      },
      {
        title: '💰 Der Shop',
        content: this.createShopDemo(),
      },
    ];
  }

  createArchbishopDemo() {
    return `
      <p>Der <strong>Erzbischof</strong> kombiniert die Bewegungen von <strong>Läufer</strong> und <strong>Springer</strong>.</p>
      <div class="piece-demo">
        <div class="piece-svg" style="width: 80px; height: 80px;">${PIECE_SVGS.white.a}</div>
        <p style="margin: 10px 0; font-size: 1.1em;"><strong>Erzbischof (7 Punkte)</strong></p>
        ${this.createMoveGrid('archbishop')}
        <p style="margin-top: 15px; font-size: 0.9em; color: #4ecca3;">
          🟢 = Diagonale Bewegung (wie Läufer)<br>
          🔵 = Springer-Bewegung (L-förmig)
        </p>
      </div>
    `;
  }

  createChancellorDemo() {
    return `
      <p>Der <strong>Kanzler</strong> kombiniert die Bewegungen von <strong>Turm</strong> und <strong>Springer</strong>.</p>
      <div class="piece-demo">
        <div class="piece-svg" style="width: 80px; height: 80px;">${PIECE_SVGS.white.c}</div>
        <p style="margin: 10px 0; font-size: 1.1em;"><strong>Kanzler (9 Punkte)</strong></p>
        ${this.createMoveGrid('chancellor')}
        <p style="margin-top: 15px; font-size: 0.9em; color: #4ecca3;">
          🟢 = Gerade Bewegung (wie Turm)<br>
          🔵 = Springer-Bewegung (L-förmig)
        </p>
      </div>
    `;
  }

  createMoveGrid(piece) {
    // Create 5x5 demo grid
    const moves = this.getPieceMoves(piece);
    let html = '<div class="piece-demo-grid">';
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const isCenter = r === 2 && c === 2;
        const isHighlight = moves.some(m => m.r === r && m.c === c);
        const moveType = isHighlight ? this.getMoveType(piece, r, c) : null;
        const cellClass = `demo-cell ${(r + c) % 2 === 0 ? 'light' : 'dark'} ${
          isCenter ? 'piece-position' : isHighlight ? `highlight ${moveType}` : ''
        }`;
        html += `<div class="${cellClass}">`;
        if (isCenter) {
          html += `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">${
            PIECE_SVGS.white[piece === 'archbishop' ? 'a' : 'c']
          }</div>`;
        } else if (isHighlight) {
          html += `<div class="move-indicator ${moveType}"></div>`;
        }
        html += '</div>';
      }
    }
    html += '</div>';
    return html;
  }

  getMoveType(piece, r, c) {
    const center = 2;
    const dr = Math.abs(r - center);
    const dc = Math.abs(c - center);

    // Knight move (L-shape)
    if ((dr === 2 && dc === 1) || (dr === 1 && dc === 2)) {
      return 'knight-move';
    }

    if (piece === 'archbishop') {
      // Bishop move (diagonal)
      if (dr === dc && dr > 0) {
        return 'bishop-move';
      }
    } else {
      // Rook move (straight)
      if ((dr === 0 && dc > 0) || (dc === 0 && dr > 0)) {
        return 'rook-move';
      }
    }

    return '';
  }

  getPieceMoves(piece) {
    if (piece === 'archbishop') {
      // Bishop + Knight moves from center (2,2)
      return [
        // Bishop diagonals
        { r: 0, c: 0 },
        { r: 1, c: 1 },
        { r: 3, c: 3 },
        { r: 4, c: 4 },
        { r: 0, c: 4 },
        { r: 1, c: 3 },
        { r: 3, c: 1 },
        { r: 4, c: 0 },
        // Knight moves
        { r: 0, c: 1 },
        { r: 0, c: 3 },
        { r: 1, c: 0 },
        { r: 1, c: 4 },
        { r: 3, c: 0 },
        { r: 3, c: 4 },
        { r: 4, c: 1 },
        { r: 4, c: 3 },
      ];
    } else {
      // Rook + Knight moves from center (2,2)
      return [
        // Rook straight lines
        { r: 0, c: 2 },
        { r: 1, c: 2 },
        { r: 3, c: 2 },
        { r: 4, c: 2 },
        { r: 2, c: 0 },
        { r: 2, c: 1 },
        { r: 2, c: 3 },
        { r: 2, c: 4 },
        // Knight moves
        { r: 0, c: 1 },
        { r: 0, c: 3 },
        { r: 1, c: 0 },
        { r: 1, c: 4 },
        { r: 3, c: 0 },
        { r: 3, c: 4 },
        { r: 4, c: 1 },
        { r: 4, c: 3 },
      ];
    }
  }

  createCorridorDemo() {
    return `
      <p>Am Anfang des Spiels platzierst du deinen <strong>König</strong> in einem von drei <strong>3x3 Korridoren</strong>.</p>
      <p>Alle deine Figuren müssen im selben Korridor wie dein König platziert werden.</p>
      <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; margin: 20px 0;">
        <p style="text-align: center; color: #4ecca3; margin-bottom: 10px; font-weight: bold;">Die drei Korridore (Beispiel: Weiß unten):</p>
        <div style="font-family: monospace; font-size: 0.75em; line-height: 1.8; color: #e0e0e0;">
          <div style="text-align: center; margin-bottom: 10px;">
            <span style="color: #888;">Schwarz (oben)</span>
          </div>
          ┌───────┬───────┬───────┐<br>
          │ Kor 1 │ Kor 2 │ Kor 3 │<br>
          │ 3x3   │ 3x3   │ 3x3   │<br>
          └───────┴───────┴───────┘<br>
          <br>
          ·  ·  ·  ·  ·  ·  ·  ·  ·<br>
          ·  ·  ·  ·  ·  ·  ·  ·  ·<br>
          ·  ·  ·  ·  ·  ·  ·  ·  ·<br>
          <br>
          ┌───────┬───────┬───────┐<br>
          │ Kor 1 │ Kor 2 │ Kor 3 │<br>
          │ 3x3   │ 3x3   │ 3x3   │<br>
          └───────┴───────┴───────┘<br>
          <div style="text-align: center; margin-top: 10px;">
            <span style="color: #888;">Weiß (unten)</span>
          </div>
        </div>
      </div>
      <p><strong>Wichtig:</strong> Wähle deinen Korridor strategisch! Er bestimmt die Startposition deiner Armee.</p>
    `;
  }

  createShopDemo() {
    return `
      <p>Du hast <strong>15 Punkte</strong> zum Kaufen von Figuren:</p>
      <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; margin: 20px 0;">
        <table style="width: 100%; color: #e0e0e0; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #333;">
            <th style="text-align: left; padding: 10px; color: #4ecca3;">Figur</th>
            <th style="text-align: right; padding: 10px; color: #4ecca3;">Kosten</th>
          </tr>
          <tr>
            <td style="padding: 8px;">♟ Bauer</td>
            <td style="text-align: right; padding: 8px; color: #4ecca3;"><strong>1 Punkt</strong></td>
          </tr>
          <tr style="background: rgba(255,255,255,0.03);">
            <td style="padding: 8px;">♞ Springer / ♝ Läufer</td>
            <td style="text-align: right; padding: 8px; color: #4ecca3;"><strong>3 Punkte</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px;">♜ Turm</td>
            <td style="text-align: right; padding: 8px; color: #4ecca3;"><strong>5 Punkte</strong></td>
          </tr>
          <tr style="background: rgba(255,255,255,0.03);">
            <td style="padding: 8px;">🅰 Erzbischof</td>
            <td style="text-align: right; padding: 8px; color: #f39c12;"><strong>7 Punkte</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px;">♛ Dame / 🅲 Kanzler</td>
            <td style="text-align: right; padding: 8px; color: #e74c3c;"><strong>9 Punkte</strong></td>
          </tr>
        </table>
      </div>
      <p><strong>Strategie-Tipp:</strong> Der Erzbischof ist sehr mächtig und kostet nur 7 Punkte - eine ausgezeichnete Wahl!</p>
      <p><strong>Beispiel-Setups:</strong></p>
      <ul style="margin-top: 10px;">
        <li>1 Erzbischof (7) + 1 Turm (5) + 1 Springer (3) = 15 Punkte</li>
        <li>1 Dame (9) + 1 Turm (5) + 1 Bauer (1) = 15 Punkte</li>
        <li>3 Türme (15) für maximale Kontrolle</li>
      </ul>
      <p style="text-align: center; margin-top: 30px; font-size: 1.3em; color: #4ecca3;">
        <strong>Viel Erfolg! ♟️</strong>
      </p>
    `;
  }

  initUI() {
    this.overlay = document.getElementById('tutorial-overlay');
    this.stepsContainer = document.getElementById('tutorial-steps');
    this.prevBtn = document.getElementById('tutorial-prev');
    this.nextBtn = document.getElementById('tutorial-next');
    this.closeBtn = document.getElementById('tutorial-close');
    this.currentStepEl = document.getElementById('tutorial-current-step');
    this.totalStepsEl = document.getElementById('tutorial-total-steps');

    // Create step elements
    this.steps.forEach(step => {
      const stepEl = document.createElement('div');
      stepEl.className = 'tutorial-step';
      stepEl.innerHTML = `
        <h2>${step.title}</h2>
        ${step.content}
      `;
      this.stepsContainer.appendChild(stepEl);
    });

    // Event listeners
    this.prevBtn.addEventListener('click', () => this.prevStep());
    this.nextBtn.addEventListener('click', () => this.nextStep());
    this.closeBtn.addEventListener('click', () => this.close());

    // Keyboard navigation
    document.addEventListener('keydown', e => {
      if (!this.overlay.classList.contains('hidden')) {
        if (e.key === 'ArrowLeft') {
          this.prevStep();
        } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
          this.nextStep();
        } else if (e.key === 'Escape') {
          this.close();
        }
      }
    });

    this.totalStepsEl.textContent = this.steps.length;
  }

  show() {
    this.currentStep = 0;
    this.overlay.classList.remove('hidden');
    this.updateStep();
  }

  close() {
    this.overlay.classList.add('hidden');
  }

  nextStep() {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this.updateStep();
    } else {
      this.close();
    }
  }

  prevStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.updateStep();
    }
  }

  updateStep() {
    // Hide all steps
    const stepEls = this.stepsContainer.querySelectorAll('.tutorial-step');
    stepEls.forEach(el => el.classList.remove('active'));

    // Show current step
    stepEls[this.currentStep].classList.add('active');

    // Update navigation
    this.prevBtn.disabled = this.currentStep === 0;
    this.nextBtn.textContent =
      this.currentStep === this.steps.length - 1 ? 'Fertig ✓' : 'Weiter ▶';
    this.currentStepEl.textContent = this.currentStep + 1;
  }
}
