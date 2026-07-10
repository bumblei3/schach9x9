// Tutorial system for Schach 9x9
import { PIECE_SVGS } from './chess-pieces.js';

interface Step {
  title: string;
  content: string;
}

export class Tutorial {
  private static readonly SEEN_KEY = 'schach9x9_tutorial_seen';

  public currentStep!: number;
  public steps!: Step[];
  public overlay!: HTMLElement;
  public stepsContainer!: HTMLElement;
  public prevBtn!: HTMLButtonElement;
  public nextBtn!: HTMLButtonElement;
  public closeBtn!: HTMLButtonElement;
  public currentStepEl!: HTMLElement;
  public totalStepsEl!: HTMLElement;

  constructor() {
    this.currentStep = 0;
    this.steps = this.createSteps();
    this.initUI();
  }

  /** Returns true when the tutorial has NOT been seen yet (first run). */
  public static shouldAutoShow(): boolean {
    try {
      return localStorage.getItem(Tutorial.SEEN_KEY) !== '1';
    } catch {
      return true; // storage unavailable -> show anyway
    }
  }

  /** Persist that the tutorial has been seen/closed. */
  public static markSeen(): void {
    try {
      localStorage.setItem(Tutorial.SEEN_KEY, '1');
    } catch {
      /* ignore storage failures */
    }
  }

  public createSteps(): Step[] {
    return [
      {
        title: '🎮 Willkommen zu Schach 9x9!',
        content: `
          <p>Schach 9x9 ist eine erweiterte Variante des klassischen Schachs mit einzigartigen Regeln und besonderen Figuren.</p>
          <p>In diesem Tutorial lernst du:</p>
          <ul>
            <li>🏰 Das 9x9 Brett und Korridor-System</li>
            <li>⚔️ Die speziellen Figuren: Erzbischof, Kanzler, Nachtreiter und Engel</li>
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
        title: '🐎 Der Nachtreiter',
        content: this.createNightriderDemo(),
      },
      {
        title: '😇 Der Engel',
        content: this.createAngelDemo(),
      },
      {
        title: '🗺️ Das Korridor-System',
        content: this.createCorridorDemo(),
      },
      {
        title: '💰 Der Shop',
        content: this.createShopDemo(),
      },
      {
        title: '⭐ Truppen Upgrades',
        content: this.createUpgradeDemo(),
      },
    ];
  }

  public createNightriderDemo(): string {
    return `
      <p>Der <strong>Nachtreiter</strong> ist ein "gleitender" Springer. Er kann mehrere Springer-Sprünge in einer Linie ausführen.</p>
      <div class="piece-demo">
        <div class="piece-svg" style="width: 80px; height: 80px;">${PIECE_SVGS.white.j}</div>
        <p style="margin: 10px 0; font-size: 1.1em;"><strong>Nachtreiter (6 Punkte)</strong></p>
        ${this.createMoveGrid('nightrider', 7)}
        <p style="margin-top: 15px; font-size: 0.9em; color: #4ecca3;">
          🔵 = Mehrfache Springer-Sprünge in einer Linie
        </p>
      </div>
    `;
  }

  public createAngelDemo(): string {
    return `
      <p>Der <strong>Engel</strong> ist die mächtigste Figur. Er kombiniert die Bewegungen von <strong>Dame</strong> und <strong>Springer</strong>.</p>
      <div class="piece-demo">
        <div class="piece-svg" style="width: 80px; height: 80px;">${PIECE_SVGS.white.e}</div>
        <p style="margin: 10px 0; font-size: 1.1em;"><strong>Engel (12 Punkte)</strong></p>
        ${this.createMoveGrid('angel')}
        <p style="margin-top: 15px; font-size: 0.9em; color: #4ecca3;">
          🟢 = Dame (Gerade & Diagonal)<br>
          🔵 = Springer-Bewegung (L-förmig)
        </p>
      </div>
    `;
  }

  public createArchbishopDemo(): string {
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

  public createChancellorDemo(): string {
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

  public createUpgradeDemo(): string {
    return `
      <p>Im <strong>Upgrade-Modus</strong> kannst du deine Figuren verbessern, indem du Punkte investierst.</p>
      <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin: 15px 0;">
        <div style="display: flex; justify-content: center; align-items: center; gap: 15px; margin-bottom: 10px;">
          <div style="text-align: center;">
            <div style="width: 40px; height: 40px; margin: 0 auto;">${PIECE_SVGS.white.r}</div>
            <p style="font-size: 0.8em;">Turm (5)</p>
          </div>
          <div style="font-size: 16px; color: #4ecca3;">➔</div>
          <div style="text-align: center;">
            <div style="width: 40px; height: 40px; margin: 0 auto;">${PIECE_SVGS.white.c}</div>
            <p style="font-size: 0.8em; color: #4ecca3;">Kanzler (8)</p>
          </div>
          <div style="width: 20px;"></div>
          <div style="text-align: center;">
            <div style="width: 40px; height: 40px; margin: 0 auto;">${PIECE_SVGS.white.n}</div>
            <p style="font-size: 0.8em;">Springer (3)</p>
          </div>
          <div style="font-size: 16px; color: #4ecca3;">➔</div>
          <div style="text-align: center;">
            <div style="width: 40px; height: 40px; margin: 0 auto;">${PIECE_SVGS.white.j}</div>
            <p style="font-size: 0.8em; color: #4ecca3;">Nachtr. (6)</p>
          </div>
        </div>
        <p style="text-align: center; font-size: 0.9em;"><strong>Kosten = Differenz der Figurowerte</strong></p>
      </div>
      <p><strong>So funktioniert's:</strong></p>
      <ol style="text-align: left; margin-top: 5px; font-size: 0.95em;">
        <li>Starte ein Spiel im <strong>Upgrade-Modus</strong></li>
        <li>Klicke eine leuchtende Figur in der Setup-Phase an</li>
        <li>Wähle dein Upgrade (z.B. Springer zu Nachtreiter für 3 Pkt)</li>
      </ol>
      <p style="font-size: 0.9em; margin-top: 5px;"><em>Tipp: Der Engel ist das ultimative Upgrade für die Dame!</em></p>
    `;
  }

  public createMoveGrid(piece: string, size: number = 5): string {
    // Create size x size demo grid
    const moves = this.getPieceMoves(piece, size);
    const center = Math.floor(size / 2);
    let html = `<div class="piece-demo-grid" style="grid-template-columns: repeat(${size}, 1fr); width: ${
      size * 50
    }px; height: ${size * 50}px;">`;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const isCenter = r === center && c === center;
        const isHighlight = moves.some(m => m.r === r && m.c === c);
        const moveType = isHighlight ? this.getMoveType(piece, r, c, size) : null;
        const cellClass = `demo-cell ${(r + c) % 2 === 0 ? 'light' : 'dark'} ${
          isCenter ? 'piece-position' : isHighlight ? `highlight ${moveType}` : ''
        }`;
        html += `<div class="${cellClass}">`;
        if (isCenter) {
          const symbolMap: Record<string, string> = {
            archbishop: 'a',
            chancellor: 'c',
            nightrider: 'j',
            angel: 'e',
          };
          const pieceKey = symbolMap[piece] as keyof typeof PIECE_SVGS.white;
          html += `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">${
            PIECE_SVGS.white[pieceKey]
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

  public getMoveType(piece: string, r: number, c: number, size: number = 5): string {
    const center = Math.floor(size / 2);
    const dr = Math.abs(r - center);
    const dc = Math.abs(c - center);

    // Knight move (L-shape) or Nightrider move
    if ((dr === 2 && dc === 1) || (dr === 1 && dc === 2)) {
      return 'knight-move';
    }

    // Extended Nightrider moves
    if (piece === 'nightrider') {
      if (
        (dr === 4 && dc === 2) ||
        (dr === 2 && dc === 4) ||
        (dr === 6 && dc === 3) ||
        (dr === 3 && dc === 6)
      ) {
        return 'knight-move';
      }
    }

    if (piece === 'archbishop' || piece === 'angel') {
      if (dr === dc && dr > 0) return 'bishop-move';
    }

    if (piece === 'chancellor' || piece === 'angel') {
      if ((dr === 0 && dc > 0) || (dc === 0 && dr > 0)) return 'rook-move';
    }

    return '';
  }

  public getPieceMoves(piece: string, size: number = 5): { r: number; c: number }[] {
    const moves: { r: number; c: number }[] = [];
    const center = Math.floor(size / 2);

    const isKnight =
      piece === 'archbishop' ||
      piece === 'chancellor' ||
      piece === 'angel' ||
      piece === 'nightrider';
    const isBishop = piece === 'archbishop' || piece === 'angel';
    const isRook = piece === 'chancellor' || piece === 'angel';

    if (isKnight) {
      const knightOffsets = [
        { r: -2, c: -1 },
        { r: -2, c: 1 },
        { r: -1, c: -2 },
        { r: -1, c: 2 },
        { r: 1, c: -2 },
        { r: 1, c: 2 },
        { r: 2, c: -1 },
        { r: 2, c: 1 },
      ];
      knightOffsets.forEach(off => {
        const nr = center + off.r;
        const nc = center + off.c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          moves.push({ r: nr, c: nc });

          if (piece === 'nightrider') {
            // Continue in same direction
            for (
              let tr = nr + off.r, tc = nc + off.c;
              tr >= 0 && tr < size && tc >= 0 && tc < size;
              tr += off.r, tc += off.c
            ) {
              moves.push({ r: tr, c: tc });
            }
          }
        }
      });
    }

    if (isBishop) {
      for (let i = 1; i < size; i++) {
        if (center - i >= 0 && center - i < size && center - i >= 0 && center - i < size)
          moves.push({ r: center - i, c: center - i });
        if (center - i >= 0 && center - i < size && center + i >= 0 && center + i < size)
          moves.push({ r: center - i, c: center + i });
        if (center + i >= 0 && center + i < size && center - i >= 0 && center - i < size)
          moves.push({ r: center + i, c: center - i });
        if (center + i >= 0 && center + i < size && center + i >= 0 && center + i < size)
          moves.push({ r: center + i, c: center + i });
      }
    }

    if (isRook) {
      for (let i = 0; i < size; i++) {
        if (i !== center) {
          moves.push({ r: center, c: i });
          moves.push({ r: i, c: center });
        }
      }
    }

    return moves;
  }

  public createCorridorDemo(): string {
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

  public createShopDemo(): string {
    return `
      <p>Du hast <strong>15 Punkte</strong> zum Kaufen von Figuren:</p>
      <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin: 15px 0;">
        <table style="width: 100%; color: #e0e0e0; border-collapse: collapse; font-size: 0.9em;">
          <tr style="border-bottom: 1px solid #333;">
            <th style="text-align: left; padding: 5px; color: #4ecca3;">Figur</th>
            <th style="text-align: right; padding: 5px; color: #4ecca3;">Kosten</th>
          </tr>
          <tr>
            <td style="padding: 4px;">♟ Bauer</td>
            <td style="text-align: right; padding: 4px; color: #4ecca3;"><strong>1</strong></td>
          </tr>
          <tr style="background: rgba(255,255,255,0.03);">
            <td style="padding: 4px;">♞ Springer / ♝ Läufer</td>
            <td style="text-align: right; padding: 4px; color: #4ecca3;"><strong>3</strong></td>
          </tr>
          <tr>
            <td style="padding: 4px;">♜ Turm</td>
            <td style="text-align: right; padding: 4px; color: #4ecca3;"><strong>5</strong></td>
          </tr>
          <tr style="background: rgba(255,255,255,0.03);">
            <td style="padding: 4px;">🐎 Nachtreiter</td>
            <td style="text-align: right; padding: 4px; color: #4ecca3;"><strong>6</strong></td>
          </tr>
          <tr>
            <td style="padding: 4px;">🏰 Erzbischof</td>
            <td style="text-align: right; padding: 4px; color: #4ecca3;"><strong>7</strong></td>
          </tr>
          <tr style="background: rgba(255,255,255,0.03);">
            <td style="padding: 4px;">⚖️ Kanzler</td>
            <td style="text-align: right; padding: 4px; color: #4ecca3;"><strong>8</strong></td>
          </tr>
          <tr>
            <td style="padding: 4px;">♛ Dame</td>
            <td style="text-align: right; padding: 4px; color: #4ecca3;"><strong>9</strong></td>
          </tr>
          <tr style="background: rgba(255,255,255,0.03);">
            <td style="padding: 4px;">🕊️ Engel</td>
            <td style="text-align: right; padding: 4px; color: #4ecca3;"><strong>12</strong></td>
          </tr>
        </table>
      </div>
      <p style="font-size: 0.9em;"><strong>Beispiel-Setups (15 Pkt):</strong></p>
      <ul style="margin-top: 5px; font-size: 0.85em;">
        <li>1 Erzbischof (7) + 1 Nachtreiter (6) + 2 Bauern (2)</li>
        <li>1 Kanzler (8) + 1 Turm (5) + 1 Läufer (3) ... warte, das sind 16!</li>
        <li>1 Engel (12) + 1 Springer (3) = Maximale Power</li>
      </ul>
      <p style="text-align: center; margin-top: 15px; font-size: 1.1em; color: #4ecca3;">
        <strong>Viel Erfolg! ♟️</strong>
      </p>
    `;
  }

  public initUI(): void {
    this.overlay = document.getElementById('tutorial-overlay') as HTMLElement;
    this.stepsContainer = document.getElementById('tutorial-steps') as HTMLElement;
    this.prevBtn = document.getElementById('tutorial-prev') as HTMLButtonElement;
    this.nextBtn = document.getElementById('tutorial-next') as HTMLButtonElement;
    this.closeBtn = document.getElementById('tutorial-close') as HTMLButtonElement;
    this.currentStepEl = document.getElementById('tutorial-current-step') as HTMLElement;
    this.totalStepsEl = document.getElementById('tutorial-total-steps') as HTMLElement;

    // Clear existing steps to prevent duplication
    this.stepsContainer.innerHTML = '';

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

    this.totalStepsEl.textContent = this.steps.length.toString();
  }

  public show(): void {
    this.currentStep = 0;
    this.overlay.classList.remove('hidden');
    this.updateStep();
  }

  public close(): void {
    this.overlay.classList.add('hidden');
    Tutorial.markSeen();
  }

  public nextStep(): void {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this.updateStep();
    } else {
      this.close();
    }
  }

  public prevStep(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.updateStep();
    }
  }

  public updateStep(): void {
    // Hide all steps
    const stepEls = this.stepsContainer.querySelectorAll('.tutorial-step');
    stepEls.forEach(el => el.classList.remove('active'));

    // Show current step
    stepEls[this.currentStep].classList.add('active');

    // Update navigation
    this.prevBtn.disabled = this.currentStep === 0;
    this.nextBtn.textContent =
      this.currentStep === this.steps.length - 1 ? 'Fertig ✓' : 'Weiter ▶';
    this.currentStepEl.textContent = (this.currentStep + 1).toString();
  }
}
