import type { GameExtended, GameController } from '../gameController.js';

export interface GameModeStrategy {
  /**
   * Initialize the game state for this mode.
   * Called when starting a new game in this mode.
   */
  init(_game: GameExtended, _controller: GameController, _initialPoints: number): void;

  /**
   * Handle user interaction (clicking a cell).
   * @returns true if the interaction was handled, false otherwise.
   */
  handleInteraction(
    _game: GameExtended,
    _controller: GameController,
    _r: number,
    _c: number
  ): Promise<boolean>;

  /**
   * Called when a setup phase ends (e.g., clicking "Fertig").
   * Handles transitions between setup phases or directly to play.
   */
  onPhaseEnd(_game: GameExtended, _controller: GameController): void;
}
