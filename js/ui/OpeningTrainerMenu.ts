/**
 * Opening Trainer Menu — thin DOM shell.
 *
 * This class owns NO game logic. It renders a heading, a "Start training"
 * button, and a small progress readout, delegating all state to the
 * provided `OpeningTrainerManager`. The actual training flow (board
 * reconstruction, move checking, scoring) is handled by the controller
 * in Task 6.
 */

import type { OpeningTrainerManager } from '../openingTrainer.js';

export class OpeningTrainerMenu {
  private container: HTMLElement;
  private manager: OpeningTrainerManager;
  private onStart: () => void;

  private root: HTMLElement | null;
  private startButton: HTMLButtonElement | null;
  private handleStart: () => void;

  constructor(container: HTMLElement, manager: OpeningTrainerManager, onStart: () => void) {
    this.container = container;
    this.manager = manager;
    this.onStart = onStart;

    this.root = null;
    this.startButton = null;
    this.handleStart = () => this.onStart();

    this.render();
  }

  render(): void {
    this.container.innerHTML = '';

    const root = document.createElement('div');
    root.className = 'opening-trainer-menu';

    const heading = document.createElement('h2');
    heading.textContent = 'Opening Trainer';
    root.appendChild(heading);

    root.appendChild(this.buildProgressReadout());

    const startButton = document.createElement('button');
    startButton.type = 'button';
    startButton.className = 'opening-trainer-start';
    startButton.textContent = 'Start training';
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
    streak.textContent = `Streak: ${progress.streak}`;
    readout.appendChild(streak);

    const solved = document.createElement('span');
    solved.className = 'opening-trainer-solved';
    solved.textContent = `Solved: ${progress.solvedHashes.length}`;
    readout.appendChild(solved);

    const acc = document.createElement('span');
    acc.className = 'opening-trainer-accuracy';
    acc.textContent = `Accuracy: ${Math.round(accuracy * 100)}%`;
    readout.appendChild(acc);

    return readout;
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
