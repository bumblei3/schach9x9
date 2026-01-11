/**
 * Component for the vertical evaluation bar
 */
export class EvaluationBar {
    private container: HTMLElement | null;
    private bar: HTMLElement | null = null;
    private fill: HTMLElement | null = null;
    private scoreLabel: HTMLElement | null = null;
    private currentScore: number = 0;

    constructor(containerId: string = 'board-container') {
        this.container = document.getElementById(containerId);
        this.init();
    }

    private init(): void {
        if (!this.container) return;

        const wrapper = document.createElement('div');
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

        this.bar = wrapper.querySelector('.evaluation-bar') as HTMLElement;
        this.fill = document.getElementById('eval-bar-fill');
        this.scoreLabel = document.getElementById('eval-bar-score');

        this.update(0); // Initial state (balanced)
    }

    /**
     * Updates the bar with a new score
     * @param score - Centipawns (positive for white, negative for black)
     */
    public update(score: number): void {
        this.currentScore = score;

        if (!this.scoreLabel || !this.fill) return;

        // Convert centipawns to display score (e.g., 100 -> 1.0)
        const displayScore = (score / 100).toFixed(1);
        this.scoreLabel.textContent = score > 0 ? `+${displayScore}` : displayScore;

        // Calculate fill percentage
        // 0 = Black winning (-1000cp or more), 100 = White winning (+1000cp or more), 50 = Balanced
        const percentage = this.scoreToPercentage(score);

        // Update fill height (White is top, Black is bottom)
        this.fill.style.height = `${percentage}%`;

        // Update color/labels if needed
        this.updateStyle(score);
    }

    private scoreToPercentage(score: number): number {
        const max = 1000; // 10 pawns is "full"
        const clamped = Math.max(-max, Math.min(max, score));
        return ((clamped + max) / (max * 2)) * 100;
    }

    private updateStyle(score: number): void {
        if (!this.scoreLabel) return;

        if (score > 300) {
            this.scoreLabel.className = 'eval-bar-score win-white';
        } else if (score < -300) {
            this.scoreLabel.className = 'eval-bar-score win-black';
        } else {
            this.scoreLabel.className = 'eval-bar-score neutral';
        }
    }

    public show(visible: boolean = true): void {
        const wrapper = document.getElementById('evaluation-bar-wrapper');
        if (wrapper) {
            wrapper.style.display = visible ? 'flex' : 'none';
        }
    }

    public getCurrentScore(): number {
        return this.currentScore;
    }
}
