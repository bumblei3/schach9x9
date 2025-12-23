import { PHASES, BOARD_SIZE, PIECE_VALUES } from './gameEngine.js';
import { SHOP_PIECES } from './config.js';
import * as UI from './ui.js';
import { soundManager } from './sounds.js';
import { PIECE_SVGS } from './chess-pieces.js';
import { logger } from './logger.js';

// Piece values for shop (needed for some logic?)
const PIECES = SHOP_PIECES;

export class MoveController {
    constructor(game) {
        this.game = game;
        this.redoStack = [];
    }

    handlePlayClick(r, c) {
        const clickedPiece = this.game.board[r][c];
        const isCurrentPlayersPiece = clickedPiece && clickedPiece.color === this.game.turn;

        // 1. If clicking own piece, always select it (change selection)
        if (isCurrentPlayersPiece) {
            this.game.selectedSquare = { r, c };
            this.game.validMoves = this.game.getValidMoves(r, c, clickedPiece);
            UI.renderBoard(this.game);
            return;
        }

        // 2. If we have a selected piece AND it belongs to us, check if we want to move/capture
        const selectedPiece = this.game.selectedSquare
            ? this.game.board[this.game.selectedSquare.r][this.game.selectedSquare.c]
            : null;
        const isSelectedMine = selectedPiece && selectedPiece.color === this.game.turn;

        if (isSelectedMine && this.game.validMoves) {
            const move = this.game.validMoves.find(m => m.r === r && m.c === c);
            if (move) {
                // Track accuracy for human player
                const isHumanMove = this.game.isAI ? this.game.turn === 'white' : true;
                if (isHumanMove) {
                    this.game.stats.playerMoves++;
                    if (this.game.isTutorMove && this.game.isTutorMove(this.game.selectedSquare, move)) {
                        this.game.stats.playerBestMoves++;
                    }
                }
                this.executeMove(this.game.selectedSquare, move);
                return;
            }
        }

        // 3. If clicking an enemy piece (and not capturing it), select it to show threats
        if (clickedPiece) {
            this.game.selectedSquare = { r, c };
            this.game.validMoves = this.game.getValidMoves(r, c, clickedPiece);
            UI.renderBoard(this.game);
            return;
        }

        // 4. Otherwise (clicking empty square that is not a move), deselect
        this.game.selectedSquare = null;
        this.game.validMoves = null;
        UI.renderBoard(this.game);
    }

    async executeMove(from, to) {
        // Clear tutor arrows when making a move
        if (this.game.arrowRenderer) {
            this.game.arrowRenderer.clearArrows();
        }

        const piece = this.game.board[from.r][from.c];
        if (!piece) return;

        const targetPiece = this.game.board[to.r][to.c];

        // Record move in history (snapshot current state)
        const moveRecord = {
            from: { r: from.r, c: from.c },
            to: { r: to.r, c: to.c },
            piece: { type: piece.type, color: piece.color, hasMoved: piece.hasMoved },
            capturedPiece: targetPiece ? { type: targetPiece.type, color: targetPiece.color } : null,
            specialMove: null,
            halfMoveClock: this.game.halfMoveClock,
            positionHistoryLength: this.game.positionHistory.length,
        };

        // Handle Castling
        if (piece.type === 'k' && Math.abs(to.c - from.c) === 2) {
            const isKingside = to.c > from.c;
            const rookCol = isKingside ? BOARD_SIZE - 1 : 0;
            const rookTargetCol = isKingside ? to.c - 1 : to.c + 1;
            const rook = this.game.board[from.r][rookCol];

            moveRecord.specialMove = {
                type: 'castling',
                isKingside,
                rookFrom: { r: from.r, c: rookCol },
                rookTo: { r: from.r, c: rookTargetCol },
                rookHadMoved: rook.hasMoved,
                rookType: rook.type, // FIX: Store rook type to prevent corruption
            };

            // Move Rook
            this.game.board[from.r][rookTargetCol] = rook;
            this.game.board[from.r][rookCol] = null;
            rook.hasMoved = true;
            this.game.log(`${piece.color === 'white' ? 'Weiß' : 'Schwarz'} rochiert!`);
        }

        // Handle En Passant
        if (piece.type === 'p' && to.c !== from.c && !targetPiece) {
            const capturedPawnRow = from.r;
            const capturedPawn = this.game.board[capturedPawnRow][to.c];

            moveRecord.specialMove = {
                type: 'enPassant',
                capturedPawnPos: { r: capturedPawnRow, c: to.c },
                capturedPawn: { type: capturedPawn.type, color: capturedPawn.color },
            };

            this.game.board[capturedPawnRow][to.c] = null;
            this.game.log('En Passant geschlagen!');
        }
        // Update 50-move rule clock
        if (piece.type === 'p' || targetPiece) {
            this.game.halfMoveClock = 0;
        } else {
            this.game.halfMoveClock++;
        }

        // Animate move BEFORE updating board state
        if (this.game.phase === PHASES.PLAY) {
            await this.animateMove(from, to, piece);
        }

        // NOW execute move
        this.game.board[to.r][to.c] = piece;
        this.game.board[from.r][from.c] = null;
        piece.hasMoved = true;

        UI.renderBoard(this.game);

        // Play sound
        if (targetPiece || (moveRecord.specialMove && moveRecord.specialMove.type === 'enPassant')) {
            soundManager.playCapture();
        } else {
            soundManager.playMove();
        }

        // Update captured pieces
        if (targetPiece) {
            const capturerColor = piece.color;
            this.game.capturedPieces[capturerColor].push(targetPiece);
            UI.updateCapturedUI(this.game);
        } else if (moveRecord.specialMove && moveRecord.specialMove.type === 'enPassant') {
            const capturerColor = piece.color;
            this.game.capturedPieces[capturerColor].push(moveRecord.specialMove.capturedPawn);
            UI.updateCapturedUI(this.game);
        }

        // Update last move highlight
        this.game.lastMoveHighlight = {
            from: { r: from.r, c: from.c },
            to: { r: to.r, c: to.c },
        };

        // Track last move for En Passant
        this.game.lastMove = {
            from: { r: from.r, c: from.c },
            to: { r: to.r, c: to.c },
            piece: piece,
            isDoublePawnPush: piece.type === 'p' && Math.abs(to.r - from.r) === 2,
        };

        // Promotion check
        if (piece.type === 'p') {
            const promotionRow = piece.color === 'white' ? 0 : BOARD_SIZE - 1;
            if (to.r === promotionRow) {
                // Automatic promotion to Angel (Engel)
                piece.type = 'e';
                moveRecord.specialMove = { type: 'promotion', promotedTo: 'e' };
                this.game.log(`${piece.color === 'white' ? 'Weißer' : 'Schwarzer'} Bauer zum Engel befördert!`);

                // Play promotion sound if available, otherwise move sound
                soundManager.playMove();
            }
        }

        // Add move to history
        this.game.moveHistory.push(moveRecord);
        UI.updateMoveHistoryUI(this.game);

        // Check for insufficient material
        if (this.isInsufficientMaterial()) {
            this.game.phase = PHASES.GAME_OVER;
            UI.renderBoard(this.game);
            UI.updateStatus(this.game);
            this.game.log('Unentschieden (Ungenügendes Material)');
            const overlay = document.getElementById('game-over-overlay');
            const winnerText = document.getElementById('winner-text');
            winnerText.textContent = 'Unentschieden (Ungenügendes Material)';
            overlay.classList.remove('hidden');

            // Save to statistics
            if (this.game.gameController) {
                this.game.gameController.saveGameToStatistics('draw', null);
            }
            return;
        }

        this.finishMove();
    }

    showPromotionUI(r, c, color, moveRecord) {
        UI.showPromotionUI(this.game, r, c, color, moveRecord, () => this.finishMove());
    }

    async animateMove(from, to, piece) {
        await UI.animateMove(this.game, from, to, piece);
    }

    finishMove() {
        this.game.selectedSquare = null;
        this.game.validMoves = null;

        this.game.stats.totalMoves++;
        if (this.game.turn === 'white') this.game.stats.playerMoves++;

        // Check if a king was captured
        let whiteKingExists = false;
        let blackKingExists = false;
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const piece = this.game.board[r][c];
                if (piece && piece.type === 'k') {
                    if (piece.color === 'white') whiteKingExists = true;
                    if (piece.color === 'black') blackKingExists = true;
                }
            }
        }

        if (!whiteKingExists || !blackKingExists) {
            this.game.phase = PHASES.GAME_OVER;
            const winner = !whiteKingExists ? 'Schwarz' : 'Weiß';
            this.game.log(`KÖNIG GESCHLAGEN! ${winner} gewinnt!`);

            const overlay = document.getElementById('game-over-overlay');
            const winnerText = document.getElementById('winner-text');
            winnerText.textContent = `${winner} gewinnt!\n(König geschlagen)`;
            overlay.classList.remove('hidden');

            const isPlayerWin = (this.game.isAI && this.game.turn === 'black') || !this.game.isAI;
            soundManager.playGameOver(isPlayerWin);

            UI.renderBoard(this.game);
            UI.updateStatus(this.game);

            // Save to statistics
            if (this.game.gameController) {
                const losingColor = !whiteKingExists ? 'white' : 'black';
                this.game.gameController.saveGameToStatistics('win', losingColor);
            }
            return;
        }

        // Switch turns
        this.game.turn = this.game.turn === 'white' ? 'black' : 'white';

        UI.updateStatistics(this.game);

        if (this.game.clockEnabled) {
            const previousPlayer = this.game.turn === 'white' ? 'black' : 'white';
            if (previousPlayer === 'white') {
                this.game.whiteTime += this.game.timeControl.increment;
            } else {
                this.game.blackTime += this.game.timeControl.increment;
            }
            UI.updateClockDisplay(this.game);
            UI.updateClockUI(this.game);
        }

        // Add position to repetition history
        const currentHash = this.getBoardHash();
        this.game.positionHistory.push(currentHash);

        // Update 3D board if active
        if (window.battleChess3D && window.battleChess3D.enabled && this.game.moveHistory.length > 0) {
            const lastMove = this.game.moveHistory[this.game.moveHistory.length - 1];
            const piece = lastMove.piece;
            const from = lastMove.from;
            const to = lastMove.to;
            const targetPiece = lastMove.capturedPiece;
            const moveRecord = lastMove;

            const captured = targetPiece || (moveRecord.specialMove && moveRecord.specialMove.type === 'enPassant');
            if (captured) {
                // Play battle animation on capture
                const attackerData = { type: piece.type, color: piece.color };
                const defenderData = targetPiece || moveRecord.specialMove.capturedPawn;
                window.battleChess3D.playBattleSequence(
                    attackerData,
                    defenderData,
                    from,
                    to
                ).then(() => {
                    // After battle, update the board state
                    window.battleChess3D.removePiece(to.r, to.c);
                    window.battleChess3D.animateMove(from.r, from.c, to.r, to.c);
                });
            } else {
                // Normal move animation
                window.battleChess3D.animateMove(from.r, from.c, to.r, to.c);
            }
        }

        const opponentColor = this.game.turn;
        if (this.game.isCheckmate(opponentColor)) {
            this.game.phase = PHASES.GAME_OVER;
            UI.renderBoard(this.game);
            UI.updateStatus(this.game);
            const winner = opponentColor === 'white' ? 'Schwarz' : 'Weiß';
            this.game.log(`SCHACHMATT! ${winner} gewinnt!`);

            UI.animateCheckmate(this.game, opponentColor);

            const overlay = document.getElementById('game-over-overlay');
            const winnerText = document.getElementById('winner-text');
            winnerText.textContent = `${winner} gewinnt!`;
            overlay.classList.remove('hidden');

            const isPlayerWin = (this.game.isAI && opponentColor === 'black') || !this.game.isAI;
            soundManager.playGameOver(isPlayerWin);

            // Save to statistics
            if (this.game.gameController) {
                this.game.gameController.saveGameToStatistics('win', opponentColor);
            }
            return;
        } else if (this.game.isStalemate(opponentColor)) {
            this.game.phase = PHASES.GAME_OVER;
            UI.renderBoard(this.game);
            UI.updateStatus(this.game);
            this.game.log('PATT! Unentschieden.');
            const overlay = document.getElementById('game-over-overlay');
            const winnerText = document.getElementById('winner-text');
            winnerText.textContent = 'Unentschieden (Patt)';
            overlay.classList.remove('hidden');

            // Save to statistics
            if (this.game.gameController) {
                this.game.gameController.saveGameToStatistics('draw', null);
            }
            return;
        } else if (this.checkDraw()) {
            return;
        } else if (this.game.isInCheck(opponentColor)) {
            this.game.log(`SCHACH! ${opponentColor === 'white' ? 'Weiß' : 'Schwarz'} steht im Schach.`);
            soundManager.playCheck();
            UI.animateCheck(this.game, opponentColor);
        }

        UI.updateStatus(this.game);
        this.game.log(`${this.game.turn === 'white' ? 'Weiß' : 'Schwarz'} ist am Zug.`);

        if (this.game.isAI && this.game.turn === 'black' && this.game.phase === PHASES.PLAY) {
            setTimeout(() => {
                if (this.game.aiMove) this.game.aiMove();
            }, 1000);
        } else {
            setTimeout(() => {
                if (this.game.updateBestMoves) this.game.updateBestMoves();
            }, 10);
        }
    }

    undoMove() {
        if (this.game.moveHistory.length === 0 || this.game.phase !== PHASES.PLAY) {
            return;
        }

        const move = this.game.moveHistory.pop();
        this.redoStack.push(move);

        const piece = this.game.board[move.to.r][move.to.c];
        if (!piece) return;

        // Restore the piece to its original position
        this.game.board[move.from.r][move.from.c] = piece;
        this.game.board[move.to.r][move.to.c] = move.capturedPiece
            ? { type: move.capturedPiece.type, color: move.capturedPiece.color, hasMoved: true }
            : null;

        // Restore piece properties (hasMoved and type)
        piece.hasMoved = move.piece.hasMoved;
        piece.type = move.piece.type;

        if (move.specialMove) {
            if (move.specialMove.type === 'castling') {
                // Undo rook movement
                const rook = this.game.board[move.specialMove.rookTo.r][move.specialMove.rookTo.c];
                if (rook) {
                    this.game.board[move.specialMove.rookFrom.r][move.specialMove.rookFrom.c] = rook;
                    this.game.board[move.specialMove.rookTo.r][move.specialMove.rookTo.c] = null;
                    rook.hasMoved = move.specialMove.rookHadMoved;
                    // FIX: Restore rook type to prevent it from being corrupted
                    if (move.specialMove.rookType) {
                        rook.type = move.specialMove.rookType;
                    }
                }
            } else if (move.specialMove.type === 'enPassant') {
                this.game.board[move.specialMove.capturedPawnPos.r][move.specialMove.capturedPawnPos.c] = {
                    type: 'p',
                    color: move.specialMove.capturedPawn.color,
                    hasMoved: true,
                };
            }
        }

        // Handle captured pieces restoration
        if (move.capturedPiece) {
            const capturerColor = move.piece.color;
            this.game.capturedPieces[capturerColor].pop();
            UI.updateCapturedUI(this.game);
        } else if (move.specialMove && move.specialMove.type === 'enPassant') {
            const capturerColor = move.piece.color;
            this.game.capturedPieces[capturerColor].pop();
            UI.updateCapturedUI(this.game);
        }

        this.game.halfMoveClock = move.halfMoveClock;
        while (this.game.positionHistory.length > move.positionHistoryLength) {
            this.game.positionHistory.pop();
        }

        this.game.turn = this.game.turn === 'white' ? 'black' : 'white';
        this.game.stats.totalMoves--;
        UI.updateStatus(this.game);
        UI.updateMoveHistoryUI(this.game);
        UI.updateStatistics(this.game);

        if (this.game.moveHistory.length > 0) {
            const lastMove = this.game.moveHistory[this.game.moveHistory.length - 1];
            this.game.lastMoveHighlight = { from: lastMove.from, to: lastMove.to };
        } else {
            this.game.lastMoveHighlight = null;
        }

        this.game.selectedSquare = null;
        this.game.validMoves = null;

        UI.renderBoard(this.game);
        UI.updateMoveHistoryUI(this.game);
        UI.updateStatus(this.game);
        this.game.log(`Zug ${move.piece.color === 'white' ? 'Weiß' : 'Schwarz'} zurückgenommen`);

        // Update 3D board if active
        if (window.battleChess3D && window.battleChess3D.enabled) {
            window.battleChess3D.updateFromGameState(this.game);
        }

        if (this.game.updateBestMoves) this.game.updateBestMoves();
        this.updateUndoRedoButtons();
    }

    async redoMove() {
        if (this.redoStack.length === 0 || this.game.phase !== PHASES.PLAY) {
            return;
        }

        const move = this.redoStack.pop();

        this.game.selectedSquare = move.from;
        this.game.validMoves = this.game.getValidMoves(
            move.from.r,
            move.from.c,
            this.game.board[move.from.r][move.from.c]
        );

        await this.executeMove(move.from, move.to);
        this.updateUndoRedoButtons();
    }

    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');

        if (undoBtn) {
            undoBtn.disabled = this.game.moveHistory.length === 0 || this.game.phase !== PHASES.PLAY;
            undoBtn.textContent = `⏮ Rückgängig${this.game.moveHistory.length > 0 ? ` (${this.game.moveHistory.length})` : ''}`;
        }

        if (redoBtn) {
            redoBtn.disabled = this.redoStack.length === 0 || this.game.phase !== PHASES.PLAY;
            redoBtn.textContent = `⏭ Wiederholen${this.redoStack.length > 0 ? ` (${this.redoStack.length})` : ''}`;
        }
    }

    checkDraw() {
        if (this.game.halfMoveClock >= 100) {
            this.game.phase = PHASES.GAME_OVER;
            UI.renderBoard(this.game);
            UI.updateStatus(this.game);
            this.game.log('Unentschieden (50-Züge-Regel)');
            const overlay = document.getElementById('game-over-overlay');
            const winnerText = document.getElementById('winner-text');
            winnerText.textContent = 'Unentschieden (50-Züge-Regel)';
            overlay.classList.remove('hidden');

            // Save to statistics
            if (this.game.gameController) {
                this.game.gameController.saveGameToStatistics('draw', null);
            }
            return true;
        }

        const currentHash = this.getBoardHash();
        const occurrences = this.game.positionHistory.filter(h => h === currentHash).length;
        if (occurrences >= 3) {
            this.game.phase = PHASES.GAME_OVER;
            UI.renderBoard(this.game);
            UI.updateStatus(this.game);
            this.game.log('Unentschieden (Stellungswiederholung)');
            const overlay = document.getElementById('game-over-overlay');
            const winnerText = document.getElementById('winner-text');
            winnerText.textContent = 'Unentschieden (Stellungswiederholung)';
            overlay.classList.remove('hidden');

            // Save to statistics
            if (this.game.gameController) {
                this.game.gameController.saveGameToStatistics('draw', null);
            }
            return true;
        }

        if (this.isInsufficientMaterial()) {
            this.game.phase = PHASES.GAME_OVER;
            UI.renderBoard(this.game);
            UI.updateStatus(this.game);
            this.game.log('Unentschieden (Ungenügendes Material)');
            const overlay = document.getElementById('game-over-overlay');
            const winnerText = document.getElementById('winner-text');
            winnerText.textContent = 'Unentschieden (Ungenügendes Material)';
            overlay.classList.remove('hidden');

            // Save to statistics
            if (this.game.gameController) {
                this.game.gameController.saveGameToStatistics('draw', null);
            }
            return true;
        }

        return false;
    }

    isInsufficientMaterial() {
        const pieces = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (this.game.board[r][c]) {
                    pieces.push(this.game.board[r][c]);
                }
            }
        }

        const whitePieces = pieces.filter(p => p.color === 'white');
        const blackPieces = pieces.filter(p => p.color === 'black');
        const whiteNonKings = whitePieces.filter(p => p.type !== 'k');
        const blackNonKings = blackPieces.filter(p => p.type !== 'k');

        if (pieces.length === 2) return true;

        if (pieces.length === 3) {
            const nonKings = pieces.filter(p => p.type !== 'k');
            if (nonKings.length === 1 && (nonKings[0].type === 'n' || nonKings[0].type === 'b')) {
                return true;
            }
        }

        if (pieces.length === 4) {
            if (whiteNonKings.length === 2 && blackNonKings.length === 0) {
                if (whiteNonKings.every(p => p.type === 'n')) return true;
            }
            if (blackNonKings.length === 2 && whiteNonKings.length === 0) {
                if (blackNonKings.every(p => p.type === 'n')) return true;
            }
        }

        if (
            pieces.length === 4 &&
            whiteNonKings.length === 1 &&
            blackNonKings.length === 1 &&
            whiteNonKings[0].type === 'b' &&
            blackNonKings[0].type === 'b'
        ) {
            let whiteBishopSquare = null;
            let blackBishopSquare = null;

            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    const piece = this.game.board[r][c];
                    if (piece && piece.type === 'b') {
                        if (piece.color === 'white') whiteBishopSquare = { r, c };
                        else blackBishopSquare = { r, c };
                    }
                }
            }

            if (whiteBishopSquare && blackBishopSquare) {
                const whiteSquareColor = (whiteBishopSquare.r + whiteBishopSquare.c) % 2;
                const blackSquareColor = (blackBishopSquare.r + blackBishopSquare.c) % 2;
                if (whiteSquareColor === blackSquareColor) return true;
            }
        }

        const allNonKings = pieces.filter(p => p.type !== 'k');
        if (allNonKings.length > 0 && allNonKings.every(p => p.type === 'b')) {
            const bishopSquareColors = new Set();
            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    const piece = this.game.board[r][c];
                    if (piece && piece.type === 'b') {
                        bishopSquareColors.add((r + c) % 2);
                    }
                }
            }
            if (bishopSquareColors.size === 1) return true;
        }

        return false;
    }

    getBoardHash() {
        let hash = '';
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const piece = this.game.board[r][c];
                if (piece) {
                    hash += `${piece.color[0]}${piece.type}${r}${c};`;
                }
            }
        }
        return hash;
    }

    saveGame() {
        const gameState = {
            board: this.game.board,
            phase: this.game.phase,
            turn: this.game.turn,
            points: this.game.points,
            selectedShopPiece: this.game.selectedShopPiece,
            whiteCorridor: this.game.whiteCorridor,
            blackCorridor: this.game.blackCorridor,
            isAI: this.game.isAI,
            difficulty: this.game.difficulty,
            moveHistory: this.game.moveHistory,
            halfMoveClock: this.game.halfMoveClock,
            positionHistory: this.game.positionHistory,
            capturedPieces: this.game.capturedPieces,
            drawOffered: this.game.drawOffered,
            drawOfferedBy: this.game.drawOfferedBy,
        };
        localStorage.setItem('schach9x9_save', JSON.stringify(gameState));
        this.game.log('Spiel gespeichert! 💾');
        alert('Spiel wurde gespeichert!');
    }

    loadGame() {
        const savedData = localStorage.getItem('schach9x9_save');
        if (!savedData) {
            this.game.log('Kein gespeichertes Spiel gefunden.');
            alert('Kein gespeichertes Spiel gefunden.');
            return false;
        }

        try {
            const state = JSON.parse(savedData);

            this.game.board = state.board;
            this.game.phase = state.phase;
            this.game.turn = state.turn;
            this.game.points = state.points;
            this.game.selectedShopPiece = state.selectedShopPiece;
            this.game.whiteCorridor = state.whiteCorridor;
            this.game.blackCorridor = state.blackCorridor;
            this.game.isAI = state.isAI;
            this.game.difficulty = state.difficulty;
            this.game.moveHistory = state.moveHistory;
            this.game.halfMoveClock = state.halfMoveClock;
            this.game.positionHistory = state.positionHistory;
            this.game.capturedPieces = state.capturedPieces || { white: [], black: [] };

            document.getElementById('ai-toggle').checked = this.game.isAI;
            document.getElementById('difficulty-select').value = this.game.difficulty;

            UI.renderBoard(this.game);
            UI.updateStatus(this.game);
            UI.updateShopUI(this.game);
            UI.updateMoveHistoryUI(this.game);
            UI.updateCapturedUI(this.game);

            this.game.drawOffered = state.drawOffered || false;
            this.game.drawOfferedBy = state.drawOfferedBy || null;
            const drawOverlay = document.getElementById('draw-offer-overlay');
            if (drawOverlay) {
                if (this.game.drawOffered) {
                    const message = document.getElementById('draw-offer-message');
                    const offeringColor = this.game.drawOfferedBy === 'white' ? 'Weiß' : 'Schwarz';
                    if (message)
                        message.textContent = `${offeringColor} bietet Remis an. Möchtest du annehmen?`;
                    drawOverlay.classList.remove('hidden');
                } else {
                    drawOverlay.classList.add('hidden');
                }
            }

            if (this.game.phase === PHASES.SETUP_WHITE_PIECES || this.game.phase === PHASES.SETUP_BLACK_PIECES) {
                UI.showShop(this.game, true);
            } else {
                UI.showShop(this.game, false);
            }

            if (this.game.phase === PHASES.PLAY) {
                document.getElementById('move-history-panel').classList.remove('hidden');
                document.getElementById('captured-pieces-panel').classList.remove('hidden');
                if (this.game.updateBestMoves) this.game.updateBestMoves();
            }

            this.game.log('Spiel geladen! 📂');
            return true;
        } catch (e) {
            console.error('Fehler beim Laden:', e);
            this.game.log('Fehler beim Laden des Spielstands.');
            return false;
        }
    }

    calculateMaterialAdvantage() {
        let whiteMaterial = 0;
        let blackMaterial = 0;

        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const piece = this.game.board[r][c];
                if (piece) {
                    const value = this.getMaterialValue(piece);
                    if (piece.color === 'white') {
                        whiteMaterial += value;
                    } else {
                        blackMaterial += value;
                    }
                }
            }
        }

        return whiteMaterial - blackMaterial;
    }

    getMaterialValue(piece) {
        return PIECE_VALUES[piece.type] || 0;
    }

    enterReplayMode() {
        if (this.game.replayMode || this.game.moveHistory.length === 0) return;

        this.game.savedGameState = {
            board: JSON.parse(JSON.stringify(this.game.board)),
            turn: this.game.turn,
            selectedSquare: this.game.selectedSquare,
            validMoves: this.game.validMoves,
            lastMoveHighlight: this.game.lastMoveHighlight,
        };

        this.game.replayMode = true;
        this.game.replayPosition = this.game.moveHistory.length - 1;
        this.game.stopClock();

        document.getElementById('replay-status').classList.remove('hidden');
        document.getElementById('replay-exit').classList.remove('hidden');
        document.getElementById('undo-btn').disabled = true;

        this.updateReplayUI();
    }

    exitReplayMode() {
        if (!this.game.replayMode) return;

        this.game.board = this.game.savedGameState.board;
        this.game.turn = this.game.savedGameState.turn;
        this.game.selectedSquare = this.game.savedGameState.selectedSquare;
        this.game.validMoves = this.game.savedGameState.validMoves;
        this.game.lastMoveHighlight = this.game.savedGameState.lastMoveHighlight;

        this.game.replayMode = false;
        this.game.replayPosition = -1;
        this.game.savedGameState = null;

        document.getElementById('replay-status').classList.add('hidden');
        document.getElementById('replay-exit').classList.add('hidden');
        document.getElementById('undo-btn').disabled =
            this.game.moveHistory.length === 0 || this.game.phase !== PHASES.PLAY;

        UI.renderBoard(this.game);

        if (this.game.clockEnabled && this.game.phase === PHASES.PLAY) {
            this.game.startClock();
        }
    }

    replayFirst() {
        if (!this.game.replayMode) this.enterReplayMode();
        this.game.replayPosition = -1;
        this.updateReplayUI();
    }

    replayPrevious() {
        if (!this.game.replayMode) this.enterReplayMode();
        if (this.game.replayPosition > -1) {
            this.game.replayPosition--;
            this.updateReplayUI();
        }
    }

    replayNext() {
        if (!this.game.replayMode) this.enterReplayMode();
        if (this.game.replayPosition < this.game.moveHistory.length - 1) {
            this.game.replayPosition++;
            this.updateReplayUI();
        }
    }

    replayLast() {
        if (!this.game.replayMode) this.enterReplayMode();
        this.game.replayPosition = this.game.moveHistory.length - 1;
        this.updateReplayUI();
    }

    updateReplayUI() {
        this.reconstructBoardAtMove(this.game.replayPosition);
        document.getElementById('replay-move-num').textContent = this.game.replayPosition + 1;

        document.getElementById('replay-first').disabled = this.game.replayPosition === -1;
        document.getElementById('replay-prev').disabled = this.game.replayPosition === -1;
        document.getElementById('replay-next').disabled =
            this.game.replayPosition === this.game.moveHistory.length - 1;
        document.getElementById('replay-last').disabled =
            this.game.replayPosition === this.game.moveHistory.length - 1;

        UI.renderBoard(this.game);
    }

    reconstructBoardAtMove(moveIndex) {
        if (this.game.savedGameState) {
            this.game.board = JSON.parse(JSON.stringify(this.game.savedGameState.board));
            for (let i = this.game.moveHistory.length - 1; i > moveIndex; i--) {
                const move = this.game.moveHistory[i];
                this.undoMoveForReplay(move);
            }
        }

        if (moveIndex >= 0) {
            const move = this.game.moveHistory[moveIndex];
            this.game.lastMoveHighlight = {
                from: move.from,
                to: move.to,
            };
        } else {
            this.game.lastMoveHighlight = null;
        }
    }

    undoMoveForReplay(move) {
        const piece = this.game.board[move.to.r][move.to.c];
        if (!piece) return;

        this.game.board[move.from.r][move.from.c] = piece;
        this.game.board[move.to.r][move.to.c] = move.capturedPiece
            ? { type: move.capturedPiece.type, color: move.capturedPiece.color, hasMoved: true }
            : null;

        piece.hasMoved = move.piece.hasMoved;

        if (move.specialMove) {
            if (move.specialMove.type === 'castling') {
                const rookFrom = move.specialMove.rookFrom;
                const rookTo = move.specialMove.rookTo;
                const rook = this.game.board[rookTo.r][rookTo.c];
                if (rook) {
                    this.game.board[rookFrom.r][rookFrom.c] = rook;
                    this.game.board[rookTo.r][rookTo.c] = null;
                    rook.hasMoved = false;
                }
            } else if (move.specialMove.type === 'enPassant') {
                const capturedPos = move.specialMove.capturedPawnPos;
                this.game.board[capturedPos.r][capturedPos.c] = {
                    type: 'p',
                    color: move.specialMove.capturedPawn.color,
                    hasMoved: true,
                };
            } else if (move.specialMove.type === 'promotion') {
                piece.type = 'p';
            }
        }
    }

    setTheme(themeName) {
        this.game.currentTheme = themeName;
        this.applyTheme(themeName);
        localStorage.setItem('chess_theme', themeName);
    }

    applyTheme(themeName) {
        document.body.setAttribute('data-theme', themeName);
    }
}
