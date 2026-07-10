// TypeScript global type declarations for Schach 9x9
// This file extends the global Window interface with application-specific properties

import type { Game } from './gameEngine.js';
import type { GameController } from './gameController.js';
import type * as UIImport from './ui.js';

interface _KeyboardManager {
  performEmergencyRecovery?: () => void;
}

declare global {
  interface Window {
    /** Main UI module for legacy/debug access */
    UI: typeof UIImport | null;

    /** Current game instance */
    game: Game | null;

    /** Main App instance */
    app: import('./App.js').App | null;

    /** Game controller for direct access */
    gameController: GameController | null;

    /** Game recovery function for console access */
    recoverGame: () => void;

    /** 3D battle chess renderer (optional, enabled at runtime) */
    battleChess3D?: import('./battleChess3D.js').BattleChess3D;

    /** Active piece SVG set, mirrored from the pieces module */
    PIECE_SVGS?: import('./assets/pieces/index.js').PieceSet;

    /** Tutor controller for direct access */
    tutorController?: import('./tutorController.js').TutorController;
  }

  // Module augmentation for HTML elements
  interface HTMLElementTagNameMap {
    'game-board': HTMLElement;
    'move-history': HTMLElement;
  }
}

// Export as module
export {};
