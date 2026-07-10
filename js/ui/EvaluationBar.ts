import { EVAL_MAX_SCORE, EVAL_WINNING_THRESHOLD } from '../constants.js';

/**
 * Component for the vertical evaluation bar
 */
export class EvaluationBar {
  private container: HTMLElement | null;
  // private bar: HTMLElement | null = null; // Unused
  private fill: HTMLElement | null = null;
  private scoreLabel: HTMLElement | null = null;
  private currentScore: number = 0;

  constructor(containerId: string = 'board-container') {
    this.container = document.getElementById(containerId);
    this.init();
  }

  private init(): void {
    if (!this.container) return;

    // Check if bar already exists
    let wrapper = document.getElementById('evaluation-bar-wrapper');

    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = 'evaluation-bar-wrapper';
      wrapper.className = 'evaluation-bar-wrapper';
      wrapper.innerHTML = `
        <div class="evaluation-bar">
          <div id="eval-bar-fill" class="eval-bar-fill"></div>
          <div class="eval-bar-labels">
            <span class="eval-label pos">+5</span>
            <span class="eval-label zero">0</span>
            <span class="eval-label neg">-5</span>
          </div>
        </div>
        <div id="eval-bar-score" class="eval-bar-score">0.0</div>
      `;

      // Insert as first child of board-container or next to board-wrapper
      const boardWrapper = document.getElementById('board-wrapper');
      if (boardWrapper) {
        this.container.insertBefore(wrapper, boardWrapper);
      } else {
        this.container.appendChild(wrapper);
      }
    }

    this.fill = document.getElementById('eval-bar-fill');
    this.scoreLabel = document.getElementById('eval-bar-score');

    // Initialize at 50% (balanced) with transition
    this.update(0);
  }

  /**
   * Updates the bar with a new score
   * @param score - Centipawns (positive for white, negative for black)
   */
  public update(score: number): void {
    const prevScore = this.currentScore;
    this.currentScore = score;

    if (!this.scoreLabel || !this.fill) return;

    // Convert centipawns to display score (e.g., 100 -> 1.0)
    const displayScore = (score / 100).toFixed(1);
    this.scoreLabel.textContent = score > 0 ? `+${displayScore}` : displayScore;

    // Calculate fill percentage
    // 0 = Black winning (-1000cp or more), 100 = White winning (+1000cp or more), 50 = Balanced
    const percentage = this.scoreToPercentage(score);

    // Update fill height (White is top, Black is bottom) with smooth transition
    this.fill.style.height = `${percentage}%`;

    // Update fill color based on who's winning - smooth transition
    this.updateFillColor(score);

    // Update score label style/color
    this.updateStyle(score);

    // Subtle pulse on significant score changes (> 1.5 pawns)
    this.maybePulse(score, prevScore);
  }

  private scoreToPercentage(score: number): number {
    const max = EVAL_MAX_SCORE;
    const clamped = Math.max(-max, Math.min(max, score));
    return ((clamped + max) / (max * 2)) * 100;
  }

  private updateStyle(score: number): void {
    if (!this.scoreLabel) return;

    if (score > EVAL_WINNING_THRESHOLD) {
      this.scoreLabel.className = 'eval-bar-score win-white';
    } else if (score < -EVAL_WINNING_THRESHOLD) {
      this.scoreLabel.className = 'eval-bar-score win-black';
    } else {
      this.scoreLabel.className = 'eval-bar-score neutral';
    }
  }

  /**
   * Updates the fill gradient color based on evaluation
   * White winning -> green gradient, Black winning -> red gradient, Balanced -> neutral
   */
  private updateFillColor(score: number): void {
    if (!this.fill) return;

    const normalized = Math.max(-1, Math.min(1, score / 1000)); // Clamp to [-1, 1]
    
    // Interpolate between red (black winning) -> neutral -> green (white winning)
    let gradient: string;
    if (normalized > 0) {
      // White advantage: neutral -> green
      const intensity = Math.min(1, normalized * 2); // 0 to 1
      const r = Math.round(30 * (1 - intensity) + 34 * intensity);
      const g = Math.round(41 * (1 - intensity) + 197 * intensity);
      const b = Math.round(59 * (1 - intensity) + 94 * intensity);
      gradient = `linear-gradient(to bottom, rgb(${r}, ${g}, ${b}), rgb(${Math.max(15, r - 20)}, ${Math.max(20, g - 30)}, ${Math.max(15, b - 20)}))`;
    } else if (normalized < 0) {
      // Black advantage: neutral -> red
      const intensity = Math.min(1, -normalized * 2);
      const r = Math.round(30 * (1 - intensity) + 239 * intensity);
      const g = Math.round(41 * (1 - intensity) + 68 * intensity);
      const b = Math.round(59 * (1 - intensity) + 68 * intensity);
      gradient = `linear-gradient(to bottom, rgb(${r}, ${g}, ${b}), rgb(${Math.max(15, r - 20)}, ${Math.max(20, g - 30)}, ${Math.max(15, b - 20)}))`;
    } else {
      // Neutral
      gradient = 'linear-gradient(to bottom, var(--bg-board-dark), var(--bg-app))';
    }

    this.fill.style.background = gradient;
    this.fill.style.transition = 'background 0.4s cubic-bezier(0.4, 0, 0.2, 1), height 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
  }

  /**
   * Adds a subtle pulse animation when score changes significantly
   * @param score - new score (centipawns)
   * @param prevScore - previous score, used to measure the magnitude of change
   */
  private maybePulse(score: number, prevScore: number): void {
    if (!this.fill) return;

    const diff = Math.abs(score - prevScore);

    // Only pulse on significant changes (> 150 centipawns = 1.5 pawns)
    if (diff > 150) {
      this.fill.style.animation = 'eval-pulse 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
      this.fill.addEventListener(
        'animationend',
        () => {
          this.fill!.style.animation = '';
        },
        { once: true }
      );
    }
  }

  public show(visible: boolean = true): void {
    const wrapper = document.getElementById('evaluation-bar-wrapper');
    if (wrapper) {
      wrapper.classList.toggle('hidden', !visible);
    }
  }

  public getCurrentScore(): number {
    return this.currentScore;
  }
}
