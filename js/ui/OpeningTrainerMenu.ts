/**
 * Opening Trainer Menu — thin DOM shell.
 *
 * This class owns NO game logic. It renders a heading, a "Start training"
 * button, and a small progress readout, delegating all state to the
 * provided `OpeningTrainerManager`. The actual training flow (board
 * reconstruction, move checking, scoring) is handled by the controller.
 */

import type { OpeningTrainerManager } from '../openingTrainer.js';

export class OpeningTrainerMenu {
  private container: HTMLElement;
  private manager: OpeningTrainerManager;
  private onStart: () => void;

  private root: HTMLElement | null;
  private startButton: HTMLButtonElement | null;
  private handleStart: () => void;
  private lastFeedback: string;

  constructor(container: HTMLElement, manager: OpeningTrainerManager, onStart: () => void) {
    this.container = container;
    this.manager = manager;
    this.onStart = onStart;

    this.root = null;
    this.startButton = null;
    this.handleStart = () => this.onStart();
    this.lastFeedback = '';

    this.render();
  }

  render(): void {
    this.container.innerHTML = '';

    const root = document.createElement('div');
    root.className = 'opening-trainer-menu';

    const heading = document.createElement('h2');
    heading.textContent = 'Eröffnungs-Trainer';
    root.appendChild(heading);

    const hint = document.createElement('p');
    hint.className = 'opening-trainer-hint';
    hint.textContent =
      'Finde den Buch-Zug (höchste Engine-Gewichtung). Falsche Züge setzen die Serie zurück.';
    root.appendChild(hint);

    root.appendChild(this.buildProgressReadout());

    const feedback = document.createElement('div');
    feedback.className = 'opening-trainer-feedback';
    feedback.setAttribute('aria-live', 'polite');
    feedback.textContent = this.lastFeedback;
    root.appendChild(feedback);

    const startButton = document.createElement('button');
    startButton.type = 'button';
    startButton.className = 'opening-trainer-start';
    startButton.textContent = 'Nächste Stellung';
    startButton.addEventListener('click', this.handleStart);
    root.appendChild(startButton);

    this.container.appendChild(root);

    this.root = root;
    this.startButton = startButton;
  }

  private buildProgressReadout(): HTMLElement {
    const { progress, accuracy } = this.manager;
    const readout = document.createElement('div');
    readout.className = 'opening-trainer-progress';

    const streak = document.createElement('span');
    streak.className = 'opening-trainer-streak';
    streak.textContent = `Serie: ${progress.streak}`;
    readout.appendChild(streak);

    const solved = document.createElement('span');
    solved.className = 'opening-trainer-solved';
    solved.textContent = `Gelöst: ${progress.solvedHashes.length}`;
    readout.appendChild(solved);

    const acc = document.createElement('span');
    acc.className = 'opening-trainer-accuracy';
    acc.textContent = `Treffer: ${Math.round(accuracy * 100)}%`;
    readout.appendChild(acc);

    const attempts = document.createElement('span');
    attempts.className = 'opening-trainer-attempts';
    attempts.textContent = `Versuche: ${progress.attempts}`;
    readout.appendChild(attempts);

    return readout;
  }

  /**
   * Re-render only the progress readout from the current manager state.
   * Called by the controller after a submitted move updates progress.
   */
  updateProgress(feedback?: string): void {
    if (feedback !== undefined) {
      this.lastFeedback = feedback;
    }
    if (!this.root) {
      this.render();
      return;
    }
    const old = this.root.querySelector('.opening-trainer-progress');
    const next = this.buildProgressReadout();
    if (old && old.parentNode) {
      old.parentNode.replaceChild(next, old);
    } else {
      this.root.appendChild(next);
    }
    const fb = this.root.querySelector('.opening-trainer-feedback');
    if (fb) {
      fb.textContent = this.lastFeedback;
      fb.classList.toggle('is-error', /Falsch|zurückgesetzt/i.test(this.lastFeedback));
      fb.classList.toggle('is-ok', /Richtig/i.test(this.lastFeedback));
    }
  }

  destroy(): void {
    if (this.startButton && this.handleStart) {
      this.startButton.removeEventListener('click', this.handleStart);
    }
    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
    this.root = null;
    this.startButton = null;
  }
}
