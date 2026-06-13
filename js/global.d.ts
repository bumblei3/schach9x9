// TypeScript global type declarations for Schach 9x9
// This file extends the global Window interface with application-specific properties

import type { Game } from './gameEngine.js';
import type { GameController } from './gameController.js';
import type * as UIImport from './ui.js';

interface KeyboardManager {
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
  }

  // Module augmentation for HTML elements
  interface HTMLElementTagNameMap {
    'game-board': HTMLElement;
    'move-history': HTMLElement;
  }
}

// Export as module
export {};