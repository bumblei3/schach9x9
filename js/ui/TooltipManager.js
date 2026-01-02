/**
 * Manage global tooltips for UI elements
 * Looks for elements with 'data-tooltip' attribute
 */
export class TooltipManager {
  constructor() {
    this.tooltipEl = null;
    this.activeElement = null;
    this.init();
  }

  init() {
    // Create tooltip element
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'global-tooltip hidden';
    document.body.appendChild(this.tooltipEl);

    // Global delegation for tooltips
    document.addEventListener('mouseover', e => this.handleMouseOver(e));
    document.addEventListener('mouseout', e => this.handleMouseOut(e));
  }

  handleMouseOver(e) {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;

    this.activeElement = target;
    const text = target.getAttribute('data-tooltip');
    if (!text) return;

    this.show(text, target);
  }

  handleMouseOut(e) {
    const target = e.target.closest('[data-tooltip]');
    if (target && target === this.activeElement) {
      this.hide();
      this.activeElement = null;
    }
  }

  show(text, target) {
    this.tooltipEl.textContent = text;
    this.tooltipEl.classList.remove('hidden');

    const rect = target.getBoundingClientRect();
    const tooltipRect = this.tooltipEl.getBoundingClientRect();

    // Position above the element by default
    let top = rect.top - tooltipRect.height - 8;
    let left = rect.left + (rect.width - tooltipRect.width) / 2;

    // Check bounds
    if (top < 0) {
      // Show below if not enough space above
      top = rect.bottom + 8;
    }

    // Keep within horizontal bounds
    if (left < 8) left = 8;
    if (left + tooltipRect.width > window.innerWidth - 8) {
      left = window.innerWidth - tooltipRect.width - 8;
    }

    this.tooltipEl.style.top = `${top}px`;
    this.tooltipEl.style.left = `${left}px`;
    this.tooltipEl.style.opacity = '1';
    this.tooltipEl.style.transform = 'translateY(0)';
  }

  hide() {
    this.tooltipEl.classList.add('hidden');
    this.tooltipEl.style.opacity = '0';
    this.tooltipEl.style.transform = 'translateY(4px)';
  }
}

export const tooltipManager = new TooltipManager();
