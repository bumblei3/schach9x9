/**
 * TimeManager.ts
 * Handles game clock, time controls, and time expiration.
 */
import { PHASES } from './gameEngine.js';
import * as UI from './ui.js';
import { soundManager } from './sounds.js';
import type { Player } from './types/game.js';
import type { Phase, TimeControl } from './config.js';

export interface TimeControlMode {
    base: number;
    increment: number;
}

export interface GameWithTime {
    clockEnabled: boolean;
    phase: Phase;
    lastMoveTime: number;
    turn: Player;
    whiteTime: number;
    blackTime: number;
    timeControl: TimeControl;
    log: (message: string) => void;
}

export interface GameControllerInterface {
    saveGameToStatistics?: (result: string, color: Player) => void;
}

const TIME_CONTROLS: Record<string, TimeControlMode> = {
    blitz3: { base: 180, increment: 2 },
    blitz5: { base: 300, increment: 3 },
    rapid10: { base: 600, increment: 0 },
    rapid15: { base: 900, increment: 10 },
    classical30: { base: 1800, increment: 0 },
};

export class TimeManager {
    private game: GameWithTime;
    private gameController: GameControllerInterface | null;
    private clockInterval: ReturnType<typeof setInterval> | null = null;

    constructor(game: GameWithTime, gameController: GameControllerInterface | null = null) {
        this.game = game;
        this.gameController = gameController;
        this.clockInterval = null;
    }

    setTimeControl(mode: string): void {
        this.game.timeControl = TIME_CONTROLS[mode] || TIME_CONTROLS['blitz5'];
        this.game.whiteTime = this.game.timeControl.base;
        this.game.blackTime = this.game.timeControl.base;
        this.updateClockDisplay();
    }

    updateClockVisibility(): void {
        const clockEl = document.getElementById('chess-clock');
        if (clockEl) {
            if (this.game.clockEnabled) {
                clockEl.classList.remove('hidden');
            } else {
                clockEl.classList.add('hidden');
            }
        }
    }

    startClock(): void {
        if (!this.game.clockEnabled || this.game.phase !== PHASES.PLAY) return;

        this.stopClock();
        this.game.lastMoveTime = Date.now();
        this.clockInterval = setInterval(() => this.tickClock(), 100);
        this.updateClockUI();
    }

    stopClock(): void {
        if (this.clockInterval) {
            clearInterval(this.clockInterval);
            this.clockInterval = null;
        }
    }

    private tickClock(): void {
        if (this.game.phase !== PHASES.PLAY) {
            this.stopClock();
            return;
        }

        const now = Date.now();
        const elapsed = (now - this.game.lastMoveTime) / 1000;
        this.game.lastMoveTime = now;

        if (this.game.turn === 'white') {
            this.game.whiteTime = Math.max(0, this.game.whiteTime - elapsed);
        } else {
            this.game.blackTime = Math.max(0, this.game.blackTime - elapsed);
        }

        this.updateClockDisplay();

        if (this.game.whiteTime <= 0) {
            this.handleTimeout('white');
        } else if (this.game.blackTime <= 0) {
            this.handleTimeout('black');
        }
    }

    private handleTimeout(loserColor: Player): void {
        this.stopClock();
        (this.game as unknown as { phase: string }).phase = PHASES.GAME_OVER;
        const winnerColor = loserColor === 'white' ? 'Schwarz' : 'Weiß';
        const loserName = loserColor === 'white' ? 'Weiß' : 'Schwarz';

        this.game.log(
            `${loserName} hat keine Zeit mehr! ${winnerColor} gewinnt durch Zeitüberschreitung.`
        );

        if (typeof document !== 'undefined') {
            const overlay = document.getElementById('game-over-overlay');
            const winnerText = document.getElementById('winner-text');
            if (overlay && winnerText) {
                winnerText.textContent = `${winnerColor} gewinnt durch Zeitüberschreitung!`;
                overlay.classList.remove('hidden');
            }
        }
        soundManager.playGameOver(false);

        // Save to statistics via gameController
        if (this.gameController && this.gameController.saveGameToStatistics) {
            this.gameController.saveGameToStatistics('loss', loserColor);
        }
    }

    updateClockDisplay(): void {
        UI.updateClockDisplay(this.game);
    }

    updateClockUI(): void {
        UI.updateClockUI(this.game);
    }
}
