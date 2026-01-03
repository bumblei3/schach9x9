/**
 * Component for the vertical evaluation bar
 */
export class EvaluationBar {
  constructor(containerId = 'board-container') {
    this.container = document.getElementById(containerId);
    this.bar = null;
    this.fill = null;
    this.scoreLabel = null;
    this.currentScore = 0;
    this.init();
  }

  init() {
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

    this.bar = wrapper.querySelector('.evaluation-bar');
    this.fill = document.getElementById('eval-bar-fill');
    this.scoreLabel = document.getElementById('eval-bar-score');

    this.update(0); // Initial state (balanced)
  }

  /**
   * Updates the bar with a new score
   * @param {number} score - Centipawns (positive for white, negative for black)
   */
  update(score) {
    this.currentScore = score;

    // Convert centipawns to display score (e.g., 100 -> 1.0)
    const displayScore = (score / 100).toFixed(1);
    this.scoreLabel.textContent = score > 0 ? `+${displayScore}` : displayScore;

    // Calculate fill percentage
    // 0 = Black winning (-1000cp or more), 100 = White winning (+1000cp or more), 50 = Balanced
    // We use a sigmoid-like scaling to make the bar more sensitive near 0
    const percentage = this.scoreToPercentage(score);

    // Update fill height (White is top, Black is bottom)
    // The fill represents White's advantage from the bottom up
    this.fill.style.height = `${percentage}%`;

    // Update color/labels if needed
    this.updateStyle(score);
  }

  scoreToPercentage(score) {
    // Linear clamping for now, can be improved with a non-linear scale
    const max = 1000; // 10 pawns is "full"
    const clamped = Math.max(-max, Math.min(max, score));
    return ((clamped + max) / (max * 2)) * 100;
  }

  updateStyle(score) {
    if (score > 300) {
      this.scoreLabel.className = 'eval-bar-score win-white';
    } else if (score < -300) {
      this.scoreLabel.className = 'eval-bar-score win-black';
    } else {
      this.scoreLabel.className = 'eval-bar-score neutral';
    }
  }

  show(visible = true) {
    const wrapper = document.getElementById('evaluation-bar-wrapper');
    if (wrapper) {
      wrapper.style.display = visible ? 'flex' : 'none';
    }
  }
}
