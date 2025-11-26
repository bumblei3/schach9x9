import { PHASES, BOARD_SIZE } from './gameEngine.js';
import { SHOP_PIECES } from './config.js';
import * as UI from './ui.js';
import { soundManager } from './sounds.js';
import { PIECE_SVGS } from './chess-pieces.js';
import { logger } from './logger.js';
import { Tutorial } from './tutorial.js';
import { ArrowRenderer } from './arrows.js';

// Piece values for shop
const PIECES = SHOP_PIECES;

export class GameController {
    constructor(game) {
        this.game = game;
        this.clockInterval = null;
    }

    initGame(initialPoints) {
        // Initialize UI
        UI.initBoardUI(this.game);
        UI.updateStatus(this.game);
        UI.updateShopUI(this.game);
        UI.updateStatistics(this.game);
        UI.updateClockUI(this.game);
        UI.updateClockDisplay(this.game);

        // Render board to show corridor highlighting
        UI.renderBoard(this.game);

        // Initialize Sound Manager
        soundManager.init();

        // Initialize Tutorial
        const tutorial = new Tutorial();

        // Initialize Arrow Renderer
        const boardContainer = document.querySelector('#board').parentElement;
        if (boardContainer) {
            this.game.arrowRenderer = new ArrowRenderer(boardContainer);
        }

        // Start clock update loop
        if (this.game.clockInterval) clearInterval(this.game.clockInterval);
        this.game.clockInterval = setInterval(() => {
            if (this.game.phase === PHASES.PLAY && !this.game.replayMode && this.game.clockEnabled) {
                const now = Date.now();
                const delta = (now - this.game.lastMoveTime) / 1000;
                this.game.lastMoveTime = now;

                if (this.game.turn === 'white') {
                    this.game.whiteTime = Math.max(0, this.game.whiteTime - delta);
                    if (this.game.whiteTime <= 0) {
                        this.game.phase = PHASES.GAME_OVER;
                        this.game.log('Zeit abgelaufen! Schwarz gewinnt.');
                        UI.updateStatus(this.game);
                        soundManager.playSound('game-end');
                    }
                } else {
                    this.game.blackTime = Math.max(0, this.game.blackTime - delta);
                    if (this.game.blackTime <= 0) {
                        this.game.phase = PHASES.GAME_OVER;
                        this.game.log('Zeit abgelaufen! Weiß gewinnt.');
                        UI.updateStatus(this.game);
                        soundManager.playSound('game-end');
                    }
                }
                UI.updateClockDisplay(this.game);
                UI.updateClockUI(this.game);
            }
        }, 100);

        logger.info('Game initialized with', initialPoints, 'points');
    }

    handleCellClick(r, c) {
        // Prevent interaction in replay mode
        if (this.game.replayMode) {
            return;
        }
        // Disable clicks if it's AI's turn
        if (
            this.game.isAI &&
            (this.game.phase === PHASES.SETUP_BLACK_KING ||
                this.game.phase === PHASES.SETUP_BLACK_PIECES ||
                (this.game.phase === PHASES.PLAY && this.game.turn === 'black'))
        ) {
            return;
        }

        if (this.game.isAnimating) return; // Block input during animation

        if (this.game.phase === PHASES.SETUP_WHITE_KING) {
            this.placeKing(r, c, 'white');
        } else if (this.game.phase === PHASES.SETUP_BLACK_KING) {
            this.placeKing(r, c, 'black');
        } else if (
            this.game.phase === PHASES.SETUP_WHITE_PIECES ||
            this.game.phase === PHASES.SETUP_BLACK_PIECES
        ) {
            this.placeShopPiece(r, c);
        } else if (this.game.phase === PHASES.PLAY) {
            if (this.game.handlePlayClick) {
                this.game.handlePlayClick(r, c);
            }
        }

        console.time('Rendering');
        UI.renderBoard(this.game);
        console.timeEnd('Rendering');
    }

    placeKing(r, c, color) {
        // White at bottom (6), Black at top (0)
        const validRowStart = color === 'white' ? 6 : 0;

        if (r < validRowStart || r >= validRowStart + 3) {
            this.game.log('Ungültiger Bereich für König!');
            return;
        }

        const colBlock = Math.floor(c / 3);
        const colStart = colBlock * 3;

        const kingR = validRowStart + 1;
        const kingC = colStart + 1;

        this.game.board[kingR][kingC] = { type: 'k', color: color, hasMoved: false };

        if (color === 'white') {
            this.game.whiteCorridor = { rowStart: validRowStart, colStart: colStart };
            this.game.phase = PHASES.SETUP_BLACK_KING;
            this.game.log('Weißer König platziert. Schwarz ist dran.');
            UI.updateStatus(this.game);

            if (this.game.isAI) {
                setTimeout(() => {
                    if (this.game.aiSetupKing) this.game.aiSetupKing();
                }, 1000);
            }
        } else {
            this.game.blackCorridor = { rowStart: validRowStart, colStart: colStart };
            this.game.phase = PHASES.SETUP_WHITE_PIECES;
            this.game.points = this.game.initialPoints;
            UI.updateStatus(this.game);
            this.showShop(true);
            this.game.log('Weiß kauft ein.');
        }
        UI.updateStatus(this.game);
    }

    selectShopPiece(pieceType) {
        if (!pieceType) return;
        const typeUpper = pieceType.toUpperCase();
        const cost = PIECES[typeUpper].points;
        if (cost > this.game.points) {
            this.game.log('Nicht genug Punkte!');
            return;
        }

        this.game.selectedShopPiece = typeUpper;

        // Update UI
        document.querySelectorAll('.shop-btn').forEach(btn => btn.classList.remove('selected'));
        const btn = document.querySelector(`.shop-btn[data-piece="${pieceType}"]`);
        if (btn) btn.classList.add('selected');

        const displayEl = document.getElementById('selected-piece-display');
        const svg = PIECE_SVGS['white'][PIECES[typeUpper].symbol];
        displayEl.innerHTML = `Ausgewählt: <div style="display:inline-block;width:30px;height:30px;vertical-align:middle;">${svg}</div> ${PIECES[typeUpper].name} (${cost})`;
    }

    placeShopPiece(r, c) {
        if (!this.game.selectedShopPiece) {
            const piece = this.game.board[r][c];
            const isWhiteTurn = this.game.phase === PHASES.SETUP_WHITE_PIECES;
            const color = isWhiteTurn ? 'white' : 'black';

            if (piece && piece.color === color && piece.type !== 'k') {
                const cost =
                    PIECES[Object.keys(PIECES).find(k => PIECES[k].symbol === piece.type.toUpperCase())].points;
                this.game.points += cost;
                this.game.board[r][c] = null;
                this.updateShopUI();
                this.game.log('Figur entfernt, Punkte erstattet.');
            } else {
                this.game.log('Bitte zuerst eine Figur im Shop auswählen!');
            }
            return;
        }

        const isWhiteTurn = this.game.phase === PHASES.SETUP_WHITE_PIECES;
        const color = isWhiteTurn ? 'white' : 'black';
        const corridor = isWhiteTurn ? this.game.whiteCorridor : this.game.blackCorridor;

        if (
            r < corridor.rowStart ||
            r >= corridor.rowStart + 3 ||
            c < corridor.colStart ||
            c >= corridor.colStart + 3
        ) {
            this.game.log('Muss im eigenen Korridor platziert werden!');
            return;
        }

        if (this.game.board[r][c]) {
            this.game.log('Feld besetzt!');
            return;
        }

        const cost = PIECES[this.game.selectedShopPiece.toUpperCase()].points;
        if (this.game.points >= cost) {
            this.game.board[r][c] = {
                type: PIECES[this.game.selectedShopPiece.toUpperCase()].symbol,
                color: color,
                hasMoved: false,
            };
            this.game.points -= cost;
            this.updateShopUI();
        }
    }

    finishSetupPhase() {
        if (this.game.phase === PHASES.SETUP_WHITE_PIECES) {
            if (this.game.points > 0) {
                alert(
                    `Du hast noch ${this.game.points} Punkte übrig! Kaufe weitere Figuren oder klicke erneut auf "Fertig" um fortzufahren.`
                );
                this.game.log(`⚠️ Warnung: ${this.game.points} Punkte nicht ausgegeben!`);
                if (!confirm(`Möchtest du wirklich mit ${this.game.points} ungenutzten Punkten fortfahren?`)) {
                    return;
                }
            }

            this.game.phase = PHASES.SETUP_BLACK_PIECES;
            this.game.points = this.game.initialPoints;
            this.game.selectedShopPiece = null;
            this.updateShopUI();
            this.game.log('Weiß fertig. Schwarz kauft ein.');

            if (this.game.isAI) {
                setTimeout(() => {
                    if (this.game.aiSetupPieces) this.game.aiSetupPieces();
                }, 1000);
            }
        } else if (this.game.phase === PHASES.SETUP_BLACK_PIECES) {
            if (this.game.points > 0 && !this.game.isAI) {
                alert(
                    `Du hast noch ${this.game.points} Punkte übrig! Kaufe weitere Figuren oder klicke erneut auf "Fertig" um fortzufahren.`
                );
                this.game.log(`⚠️ Warnung: ${this.game.points} Punkte nicht ausgegeben!`);
                if (!confirm(`Möchtest du wirklich mit ${this.game.points} ungenutzten Punkten fortfahren?`)) {
                    return;
                }
            }

            this.game.phase = PHASES.PLAY;
            this.showShop(false);

            document.querySelectorAll('.cell.selectable-corridor').forEach(cell => {
                cell.classList.remove('selectable-corridor');
            });
            logger.debug('Removed all corridor highlighting for PLAY phase');

            const moveHistoryPanel = document.getElementById('move-history-panel');
            if (moveHistoryPanel) {
                moveHistoryPanel.classList.remove('hidden');
            }
            const capturedPanel = document.getElementById('captured-pieces-panel');
            if (capturedPanel) {
                capturedPanel.classList.remove('hidden');
            }
            const statsPanel = document.getElementById('stats-panel');
            if (statsPanel) {
                statsPanel.classList.remove('hidden');
            }

            this.game.log('Spiel beginnt! Weiß ist am Zug.');
            if (this.game.updateBestMoves) this.game.updateBestMoves();
            this.startClock();
            UI.updateStatistics(this.game);
            soundManager.playGameStart();
        }
        UI.updateStatus(this.game);
        UI.renderBoard(this.game);
    }

    setTimeControl(mode) {
        const controls = {
            blitz3: { base: 180, increment: 2 },
            blitz5: { base: 300, increment: 3 },
            rapid10: { base: 600, increment: 0 },
            rapid15: { base: 900, increment: 10 },
            classical30: { base: 1800, increment: 0 },
        };
        this.game.timeControl = controls[mode] || controls['blitz5'];
        this.game.whiteTime = this.game.timeControl.base;
        this.game.blackTime = this.game.timeControl.base;
        this.updateClockDisplay();
    }

    updateClockVisibility() {
        const clockEl = document.getElementById('chess-clock');
        if (clockEl) {
            if (this.game.clockEnabled) {
                clockEl.classList.remove('hidden');
            } else {
                clockEl.classList.add('hidden');
            }
        }
    }

    startClock() {
        if (!this.game.clockEnabled || this.game.phase !== PHASES.PLAY) return;

        this.stopClock();
        this.game.lastMoveTime = Date.now();
        this.clockInterval = setInterval(() => this.tickClock(), 100);
        this.updateClockUI();
    }

    stopClock() {
        if (this.clockInterval) {
            clearInterval(this.clockInterval);
            this.clockInterval = null;
        }
    }

    tickClock() {
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
            this.stopClock();
            this.game.phase = PHASES.GAME_OVER;
            this.game.log('Weiß hat keine Zeit mehr! Schwarz gewinnt durch Zeitüberschreitung.');
            const overlay = document.getElementById('game-over-overlay');
            const winnerText = document.getElementById('winner-text');
            winnerText.textContent = 'Schwarz gewinnt durch Zeitüberschreitung!';
            overlay.classList.remove('hidden');
        } else if (this.game.blackTime <= 0) {
            this.stopClock();
            this.game.phase = PHASES.GAME_OVER;
            this.game.log('Schwarz hat keine Zeit mehr! Weiß gewinnt durch Zeitüberschreitung.');
            const overlay = document.getElementById('game-over-overlay');
            const winnerText = document.getElementById('winner-text');
            winnerText.textContent = 'Weiß gewinnt durch Zeitüberschreitung!';
            overlay.classList.remove('hidden');
        }
    }

    updateClockDisplay() {
        UI.updateClockDisplay(this.game);
    }

    updateClockUI() {
        UI.updateClockUI(this.game);
    }

    showShop(show) {
        UI.showShop(this.game, show);
    }

    updateShopUI() {
        UI.updateShopUI(this.game);
    }

    resign(color) {
        if (this.game.phase !== PHASES.PLAY) {
            return;
        }

        const resigningColor = color || this.game.turn;
        const winningColor = resigningColor === 'white' ? 'black' : 'white';

        this.game.phase = PHASES.GAME_OVER;
        UI.renderBoard(this.game);
        UI.updateStatus(this.game);

        const message =
            resigningColor === 'white'
                ? 'Weiß gibt auf! Schwarz gewinnt.'
                : 'Schwarz gibt auf! Weiß gewinnt.';
        this.game.log(message);

        const overlay = document.getElementById('game-over-overlay');
        const winnerText = document.getElementById('winner-text');
        winnerText.textContent = message;
        overlay.classList.remove('hidden');

        soundManager.playGameOver();
        this.stopClock();
    }

    offerDraw(color) {
        if (this.game.phase !== PHASES.PLAY) {
            return;
        }

        // Don't allow multiple pending offers
        if (this.game.drawOffered) {
            this.game.log('Es gibt bereits ein offenes Remis-Angebot.');
            return;
        }

        this.game.drawOffered = true;
        this.game.drawOfferedBy = color || this.game.turn;

        const offeringColor = this.game.drawOfferedBy === 'white' ? 'Weiß' : 'Schwarz';
        this.game.log(`${offeringColor} bietet Remis an.`);

        // If AI is the opponent, let AI evaluate and respond
        if (this.game.isAI) {
            const aiColor = this.game.turn === 'white' ? 'black' : 'white';
            if (this.game.turn !== aiColor) {
                // Player offered draw to AI
                setTimeout(() => {
                    if (this.game.aiEvaluateDrawOffer) this.game.aiEvaluateDrawOffer();
                }, 1000);
            }
        } else {
            // Show draw offer dialog to human opponent
            this.showDrawOfferDialog();
        }
    }

    showDrawOfferDialog() {
        const overlay = document.getElementById('draw-offer-overlay');
        const message = document.getElementById('draw-offer-message');

        const offeringColor = this.game.drawOfferedBy === 'white' ? 'Weiß' : 'Schwarz';
        message.textContent = `${offeringColor} bietet Remis an. Möchtest du annehmen?`;

        overlay.classList.remove('hidden');
    }

    acceptDraw() {
        if (!this.game.drawOffered) {
            return;
        }

        this.game.phase = PHASES.GAME_OVER;
        this.game.drawOffered = false;
        this.game.drawOfferedBy = null;

        // Hide draw offer dialog
        const overlay = document.getElementById('draw-offer-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }

        UI.renderBoard(this.game);
        UI.updateStatus(this.game);
        this.game.log('Remis vereinbart!');

        const gameOverOverlay = document.getElementById('game-over-overlay');
        const winnerText = document.getElementById('winner-text');
        winnerText.textContent = 'Remis vereinbart';
        gameOverOverlay.classList.remove('hidden');
    }

    declineDraw() {
        if (!this.game.drawOffered) {
            return;
        }

        const decliningColor =
            this.game.turn === this.game.drawOfferedBy ? (this.game.turn === 'white' ? 'black' : 'white') : this.game.turn;
        this.game.log(`${decliningColor === 'white' ? 'Weiß' : 'Schwarz'} lehnt das Remis-Angebot ab.`);

        this.game.drawOffered = false;
        this.game.drawOfferedBy = null;

        // Hide draw offer dialog
        const overlay = document.getElementById('draw-offer-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }
}
