import type { GameExtended, GameController } from '../gameController.js';

export interface GameModeStrategy {
  /**
   * Initialize the game state for this mode.
   * Called when starting a new game in this mode.
   */
  init(game: GameExtended, controller: GameController, initialPoints: number): void;

  /**
   * Handle user interaction (clicking a cell).
   * @returns true if the interaction was handled, false otherwise.
   */
  handleInteraction(
    game: GameExtended,
    controller: GameController,
    r: number,
    c: number
  ): Promise<boolean>;

  /**
   * Called when a setup phase ends (e.g., clicking "Fertig").
   * Handles transitions between setup phases or directly to play.
   */
  onPhaseEnd(game: GameExtended, controller: GameController): void;
}
