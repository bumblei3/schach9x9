import { t } from './i18n.js';
// Tutorial system for Schach 9x9
import { PIECE_SVGS } from './chess-pieces.js';

interface Step {
  title: string;
  content: string;
}

export type TutorialMode = 'quick' | 'full';

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

  constructor(options: { mode?: TutorialMode } = {}) {
    this.currentStep = 0;
    this.steps = options.mode === 'quick' ? this.createQuickStartSteps() : this.createSteps();
    this.initUI();
  }

  /**
   * Suppress first-run overlay under Playwright/CI (navigator.webdriver) or
   * explicit ?e2e / ?notutorial — otherwise the modal intercepts all clicks.
   */
  public static isAutomatedBrowser(): boolean {
    try {
      if (typeof navigator !== 'undefined' && navigator.webdriver) return true;
    } catch {
      /* ignore */
    }
    try {
      if (typeof location !== 'undefined') {
        const q = new URLSearchParams(location.search);
        if (q.has('e2e') || q.has('notutorial')) return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  /** Returns true when the tutorial has NOT been seen yet (first run). */
  public static shouldAutoShow(): boolean {
    if (Tutorial.isAutomatedBrowser()) return false;
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

  /**
   * First-run onboarding (Phase A): three screens covering fairy pieces,
   * setup/king placement, and shop/upgrades — short enough to not block play.
   */
  public createQuickStartSteps(): Step[] {
    return [
      {
        title: t('tutorial.quick1.title'),
        content: `
          <p>${t('tutorial.quick1.intro')}</p>
          <ul style="text-align:left; line-height:1.6;">
            <li><strong>${t('piece.a')}</strong> — ${t('tutorial.quick1.pieceA')}</li>
            <li><strong>${t('piece.c')}</strong> — ${t('tutorial.quick1.pieceC')}</li>
            <li><strong>${t('piece.j')}</strong> — ${t('tutorial.quick1.pieceJ')}</li>
            <li><strong>${t('piece.e')}</strong> — ${t('tutorial.quick1.pieceE')}</li>
          </ul>
          <p style="margin-top:0.75rem;color:#4ecca3;">${t('tutorial.quick1.tip')} <em>Learn → Interactive Tutorial</em>.</p>
        `,
      },
      {
        title: t('tutorial.fullSetup.title'),
        content: this.createSetupDemo(),
      },
      {
        title: t('tutorial.quick3.title'),
        content: `
          <p>${t('tutorial.quick3.intro')} <strong>Punkte</strong> ${t('tutorial.quick3.intro2')}</p>
          <ul style="text-align:left; line-height:1.6;">
            <li>${t('tutorial.quick3.buyPieces')}</li>
            <li>Im <strong>Upgrade-Modus</strong> verbesserst du Figuren (z. B. Springer → Nachtreiter)</li>
            <li>${t('tutorial.quick3.costRule')}</li>
          </ul>
        `,
      },
      {
        title: t('tutorial.quick4.title'),
        content: `
          <p>${t('tutorial.quick4.intro')}</p>
          <ul style="text-align:left; line-height:1.6;">
            <li><strong>Move:</strong> ${t('tutorial.quick4.move')}</li>
            <li><strong>Keyboard:</strong> <code>B</code> ${t('tutorial.quick4.keyboard')} <code>H</code> ${t('tutorial.quick4.keyboardH')} <code>U</code> ${t('tutorial.quick4.keyboardU')} <code>A</code> ${t('tutorial.quick4.keyboardA')}</li>
            <li><strong>3D-Ansicht:</strong> ${t('tutorial.quick4.view3d')}</li>
            <li><strong>Timers:</strong> ${t('tutorial.quick4.timers')}</li>
          </ul>
          <p style="margin-top:1rem;text-align:center;font-size:1.1em;color:#4ecca3;"><strong>${t('tutorial.quick4.goodLuck')}</strong></p>
        `,
      },
    ];
  }

  public createSteps(): Step[] {
    return [
      {
        title: t('tutorial.full1.title'),
        content: `
          <p>${t('tutorial.full1.p1')}</p>
          <p>${t('tutorial.full1.p2')}</p>
          <ul>
            <li>${t('tutorial.full1.li1')}</li>
            <li>${t('tutorial.full1.li2')}</li>
            <li>${t('tutorial.full1.li3')}</li>
            <li>${t('tutorial.full1.li4')}</li>
            <li>${t('tutorial.full1.li5')}</li>
          </ul>
        `,
      },
      {
        title: t('tutorial.fullArchbishop.title'),
        content: this.createArchbishopDemo(),
      },
      {
        title: t('tutorial.fullChancellor.title'),
        content: this.createChancellorDemo(),
      },
      {
        title: t('tutorial.fullNightrider.title'),
        content: this.createNightriderDemo(),
      },
      {
        title: t('tutorial.fullAngel.title'),
        content: this.createAngelDemo(),
      },
      {
        title: t('tutorial.fullCorridor.title'),
        content: this.createCorridorDemo(),
      },
      {
        title: t('tutorial.fullSetup.title'),
        content: this.createSetupDemo(),
      },
      {
        title: t('tutorial.fullShop.title'),
        content: this.createShopDemo(),
      },
      {
        title: t('tutorial.fullUpgrade.title'),
        content: this.createUpgradeDemo(),
      },
    ];
  }

  public createSetupDemo(): string {
    return `
      <p>${t('tutorial.setupDemo.intro')} <strong>${t('tutorial.setupDemo.whereKing')}</strong>${t('tutorial.setupDemo.intro2')}</p>
      <ul style="text-align:left; line-height:1.55; margin: 0.75rem 0;">
        <li>${t('tutorial.setupDemo.click')} <strong>Korridor</strong></li>
        <li>${t('tutorial.setupDemo.then')}</li>
        <li>${t('tutorial.setupDemo.ai')}</li>
      </ul>
      <p style="font-size:0.95em;color:#4ecca3;">${t('tutorial.setupDemo.tip')}</p>
    `;
  }

  public createNightriderDemo(): string {
    return `
      <p>${t('tutorial.nightriderDemo.intro', { piece: t('piece.j') })}</p>
      <div class="piece-demo">
        <div class="piece-svg" style="width: 80px; height: 80px;">${PIECE_SVGS.white.j}</div>
        <p style="margin: 10px 0; font-size: 1.1em;"><strong>${t('tutorial.nightriderDemo.label')}</strong></p>
        ${this.createMoveGrid('nightrider', 7)}
        <p style="margin-top: 15px; font-size: 0.9em; color: #4ecca3;">
          ${t('tutorial.nightriderDemo.legend')}
        </p>
      </div>
    `;
  }

  public createAngelDemo(): string {
    return `
      <p>${t('tutorial.angelDemo.intro', { piece: t('piece.e'), queen: t('piece.q'), knight: t('piece.n') })}</p>
      <div class="piece-demo">
        <div class="piece-svg" style="width: 80px; height: 80px;">${PIECE_SVGS.white.e}</div>
        <p style="margin: 10px 0; font-size: 1.1em;"><strong>${t('tutorial.angelDemo.label')}</strong></p>
        ${this.createMoveGrid('angel')}
        <p style="margin-top: 15px; font-size: 0.9em; color: #4ecca3;">
          ${t('tutorial.angelDemo.legendQ')}<br>
          ${t('tutorial.legendKnight')}
        </p>
      </div>
    `;
  }

  public createArchbishopDemo(): string {
    return `
      <p>${t('tutorial.archbishopDemo.intro', { piece: t('piece.a'), bishop: t('piece.b'), knight: t('piece.n') })}</p>
      <div class="piece-demo">
        <div class="piece-svg" style="width: 80px; height: 80px;">${PIECE_SVGS.white.a}</div>
        <p style="margin: 10px 0; font-size: 1.1em;"><strong>${t('tutorial.archbishopDemo.label')}</strong></p>
        ${this.createMoveGrid('archbishop')}
        <p style="margin-top: 15px; font-size: 0.9em; color: #4ecca3;">
          ${t('tutorial.archbishopDemo.legendB')}<br>
          ${t('tutorial.legendKnight')}
        </p>
      </div>
    `;
  }

  public createChancellorDemo(): string {
    return `
      <p>${t('tutorial.chancellorDemo.intro', { piece: t('piece.c'), rook: t('piece.r'), knight: t('piece.n') })}</p>
      <div class="piece-demo">
        <div class="piece-svg" style="width: 80px; height: 80px;">${PIECE_SVGS.white.c}</div>
        <p style="margin: 10px 0; font-size: 1.1em;"><strong>${t('tutorial.chancellorDemo.label')}</strong></p>
        ${this.createMoveGrid('chancellor')}
        <p style="margin-top: 15px; font-size: 0.9em; color: #4ecca3;">
          ${t('tutorial.chancellorDemo.legendR')}<br>
          ${t('tutorial.legendKnight')}
        </p>
      </div>
    `;
  }

  public createUpgradeDemo(): string {
    return `
      <p>${t('tutorial.upgradeDemo.intro')} <strong>Upgrade-Modus</strong> ${t('tutorial.upgradeDemo.intro2')}</p>
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
        <li>${t('tutorial.upgradeDemo.chooseUpgrade')}</li>
      </ol>
      <p style="font-size: 0.9em; margin-top: 5px;"><em>${t('tutorial.upgradeDemo.tip')}</em></p>
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
      <p>${t('tutorial.corridorDemo.p1')} <strong>${t('piece.k')}</strong> ${t('tutorial.corridorDemo.p2')} <strong>${t('tutorial.corridorDemo.corridors')}</strong>${t('tutorial.corridorDemo.p3')}</p>
      <p>${t('tutorial.corridorDemo.allSame')}</p>
      <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; margin: 20px 0;">
        <p style="text-align: center; color: #4ecca3; margin-bottom: 10px; font-weight: bold;">${t('tutorial.corridorDemo.caption')}</p>
        <div style="font-family: monospace; font-size: 0.75em; line-height: 1.8; color: #e0e0e0;">
          <div style="text-align: center; margin-bottom: 10px;">
            <span style="color: #888;">${t('tutorial.corridorDemo.blackTop')}</span>
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
            <span style="color: #888;">${t('tutorial.corridorDemo.whiteBottom')}</span>
          </div>
        </div>
      </div>
      <p><strong>${t('tutorial.corridorDemo.important')}</strong> ${t('tutorial.corridorDemo.tip')}</p>
    `;
  }

  public createShopDemo(): string {
    return `
      <p>Du hast <strong>15 Punkte</strong> zum Kaufen von Figuren:</p>
      <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin: 15px 0;">
        <table style="width: 100%; color: #e0e0e0; border-collapse: collapse; font-size: 0.9em;">
          <tr style="border-bottom: 1px solid #333;">
            <th style="text-align: left; padding: 5px; color: #4ecca3;">${t('tutorial.shopDemo.piece')}</th>
            <th style="text-align: right; padding: 5px; color: #4ecca3;">${t('tutorial.shopDemo.cost')}</th>
          </tr>
          <tr>
            <td style="padding: 4px;">♟ ${t('piece.p')}</td>
            <td style="text-align: right; padding: 4px; color: #4ecca3;"><strong>1</strong></td>
          </tr>
          <tr style="background: rgba(255,255,255,0.03);">
            <td style="padding: 4px;">♞ ${t('piece.n')} / ♝ ${t('piece.b')}</td>
            <td style="text-align: right; padding: 4px; color: #4ecca3;"><strong>3</strong></td>
          </tr>
          <tr>
            <td style="padding: 4px;">♜ ${t('piece.r')}</td>
            <td style="text-align: right; padding: 4px; color: #4ecca3;"><strong>5</strong></td>
          </tr>
          <tr style="background: rgba(255,255,255,0.03);">
            <td style="padding: 4px;">🐎 ${t('piece.j')}</td>
            <td style="text-align: right; padding: 4px; color: #4ecca3;"><strong>6</strong></td>
          </tr>
          <tr>
            <td style="padding: 4px;">🏰 ${t('piece.a')}</td>
            <td style="text-align: right; padding: 4px; color: #4ecca3;"><strong>7</strong></td>
          </tr>
          <tr style="background: rgba(255,255,255,0.03);">
            <td style="padding: 4px;">⚖️ ${t('piece.c')}</td>
            <td style="text-align: right; padding: 4px; color: #4ecca3;"><strong>8</strong></td>
          </tr>
          <tr>
            <td style="padding: 4px;">♛ ${t('piece.q')}</td>
            <td style="text-align: right; padding: 4px; color: #4ecca3;"><strong>9</strong></td>
          </tr>
          <tr style="background: rgba(255,255,255,0.03);">
            <td style="padding: 4px;">🕊️ ${t('piece.e')}</td>
            <td style="text-align: right; padding: 4px; color: #4ecca3;"><strong>12</strong></td>
          </tr>
        </table>
      </div>
      <p style="font-size: 0.9em;"><strong>${t('tutorial.shopDemo.examples')}</strong></p>
      <ul style="margin-top: 5px; font-size: 0.85em;">
        <li>${t('tutorial.shopDemo.ex1')}</li>
        <li>${t('tutorial.shopDemo.ex2')}</li>
        <li>${t('tutorial.shopDemo.ex3')}</li>
      </ul>
      <p style="text-align: center; margin-top: 15px; font-size: 1.1em; color: #4ecca3;">
        <strong>${t('tutorial.shopDemo.goodLuck')}</strong>
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
    this.nextBtn.textContent = this.currentStep === this.steps.length - 1 ? 'Fertig ✓' : 'Weiter ▶';
    this.currentStepEl.textContent = (this.currentStep + 1).toString();
  }
}
