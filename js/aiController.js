import { PHASES, BOARD_SIZE } from './gameEngine.js';
import { SHOP_PIECES } from './config.js';
import { logger } from './logger.js';
import * as UI from './ui.js';

// Piece values for shop
const PIECES = SHOP_PIECES;

export class AIController {
    constructor(game) {
        this.game = game;
        this.aiWorker = null;
    }

    aiSetupKing() {
        // Choose random corridor (0, 3, 6)
        const cols = [0, 3, 6];
        const randomCol = cols[Math.floor(Math.random() * cols.length)];
        // Black King goes to row 0-2 (top), specifically row 1, col randomCol+1
        this.game.placeKing(1, randomCol + 1, 'black');
        UI.renderBoard(this.game);
    }

    aiSetupPieces() {
        const corridor = this.game.blackCorridor;
        // Map piece names to their symbols
        const pieceSymbols = {
            'QUEEN': 'q',
            'CHANCELLOR': 'c',
            'ARCHBISHOP': 'a',
            'ROOK': 'r',
            'BISHOP': 'b',
            'KNIGHT': 'n',
            'PAWN': 'p'
        };

        // Simple greedy strategy: buy expensive stuff first
        while (this.game.points > 0) {
            // Filter affordable pieces
            const pieceNames = ['QUEEN', 'CHANCELLOR', 'ARCHBISHOP', 'ROOK', 'BISHOP', 'KNIGHT', 'PAWN'];
            const affordable = pieceNames.filter(name => PIECES[name].points <= this.game.points);
            if (affordable.length === 0) break;

            const choice = affordable[Math.floor(Math.random() * affordable.length)];
            const symbol = pieceSymbols[choice];
            this.game.selectedShopPiece = symbol;

            // Find empty spot
            const emptySpots = [];
            for (let r = corridor.rowStart; r < corridor.rowStart + 3; r++) {
                for (let c = corridor.colStart; c < corridor.colStart + 3; c++) {
                    if (!this.game.board[r][c]) emptySpots.push({ r, c });
                }
            }

            if (emptySpots.length === 0) break;

            const spot = emptySpots[Math.floor(Math.random() * emptySpots.length)];
            this.game.placeShopPiece(spot.r, spot.c);
        }

        this.game.finishSetupPhase();
    }

    aiMove() {
        // Check if AI should resign
        if (this.aiShouldResign()) {
            this.game.resign('black');
            return;
        }

        // Check if AI should offer draw
        if (this.aiShouldOfferDraw()) {
            this.game.offerDraw('black');
            // Continue with move if player hasn't responded yet
        }

        // Check if there's a pending draw offer from player
        if (this.game.drawOffered && this.game.drawOfferedBy === 'white') {
            this.aiEvaluateDrawOffer();
            // If draw was accepted, game is over, so return
            if (this.game.phase === PHASES.GAME_OVER) {
                return;
            }
        }

        const spinner = document.getElementById('spinner-overlay');
        if (spinner) spinner.style.display = 'flex';
        console.time('KI-Zug');

        // Use Web Worker for AI calculations to prevent UI freezing
        if (!this.aiWorker) {
            this.aiWorker = new Worker('js/ai-worker.js', { type: 'module' });

            // Load opening book if available
            fetch('opening-book.json')
                .then(r => r.json())
                .then(book => {
                    this.aiWorker.postMessage({ type: 'loadBook', book });
                })
                .catch(() => { });
        }

        // Prepare board state for worker (convert to serializable format)
        const boardCopy = JSON.parse(JSON.stringify(this.game.board));

        // Difficulty to depth mapping
        const depthMap = {
            beginner: 1,
            easy: 2,
            medium: 3,
            hard: 4,
            expert: 5,
        };

        // In classic mode (AI vs AI), use lower depth for faster, watchable gameplay
        let depth;
        if (this.game.mode === 'classic') {
            depth = 3; // Fixed at medium depth for classic mode
            logger.debug(`[AI] Classic mode: using depth ${depth} for faster play`);
        } else {
            depth = depthMap[this.game.difficulty] || 3;
            logger.debug(`[AI] Difficulty ${this.game.difficulty}: using depth ${depth}`);
        }

        this.aiWorker.onmessage = e => {
            const { type, data } = e.data;

            if (type === 'progress') {
                // Update progress UI
                this.updateAIProgress(data);
            } else if (type === 'bestMove') {
                console.timeEnd('KI-Zug');
                if (spinner) spinner.style.display = 'none';

                if (data) {
                    this.game.executeMove(data.from, data.to);
                    if (this.game.renderBoard) this.game.renderBoard();
                } else {
                    this.game.log('KI kann nicht ziehen (Patt oder Matt?)');
                }
            }
        };

        this.aiWorker.postMessage({
            type: 'getBestMove',
            data: {
                board: boardCopy,
                color: 'black',
                depth: depth,
                difficulty: this.game.difficulty,
                moveNumber: Math.floor(this.game.moveHistory.length / 2), // Black's move number
            },
        });
    }

    updateAIProgress(data) {
        const depthEl = document.getElementById('ai-depth');
        const nodesEl = document.getElementById('ai-nodes');
        const bestMoveEl = document.getElementById('ai-best-move');
        const progressFill = document.getElementById('progress-fill');

        if (depthEl) {
            depthEl.textContent = `Tiefe ${data.depth}/${data.maxDepth}`;
        }

        if (nodesEl) {
            const nodesFormatted = data.nodes.toLocaleString('de-DE');
            nodesEl.textContent = `${nodesFormatted} Positionen`;
        }

        if (bestMoveEl && data.bestMove) {
            const from =
                String.fromCharCode(97 + data.bestMove.from.c) + (BOARD_SIZE - data.bestMove.from.r);
            const to = String.fromCharCode(97 + data.bestMove.to.c) + (BOARD_SIZE - data.bestMove.to.r);
            bestMoveEl.textContent = `Bester Zug: ${from}-${to}`;
        }

        if (progressFill && data.maxDepth > 0) {
            const progress = (data.depth / data.maxDepth) * 100;
            progressFill.style.width = `${progress}%`;
        }
    }

    evaluateMove(move) {
        // Simulate the move
        const fromPiece = this.game.board[move.from.r][move.from.c];
        const toPiece = this.game.board[move.to.r][move.to.c];

        this.game.board[move.to.r][move.to.c] = fromPiece;
        this.game.board[move.from.r][move.from.c] = null;

        const score = this.evaluatePosition('black');

        // Undo the move
        this.game.board[move.from.r][move.from.c] = fromPiece;
        this.game.board[move.to.r][move.to.c] = toPiece;

        return score;
    }

    getBestMoveMinimax(moves, depth) {
        let bestScore = -Infinity;
        let bestMove = moves[0];

        for (const move of moves) {
            const score = this.minimax(move, depth - 1, false, -Infinity, Infinity);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return bestMove;
    }

    minimax(move, depth, isMaximizing, alpha, beta) {
        // Simulate move
        const fromPiece = this.game.board[move.from.r][move.from.c];
        const toPiece = this.game.board[move.to.r][move.to.c];

        this.game.board[move.to.r][move.to.c] = fromPiece;
        this.game.board[move.from.r][move.from.c] = null;

        let score;

        if (depth === 0) {
            // Use Quiescence Search at leaf nodes
            score = this.quiescenceSearch(alpha, beta, isMaximizing);
        } else {
            const color = isMaximizing ? 'black' : 'white';
            const moves = this.game.getAllLegalMoves(color);

            if (moves.length === 0) {
                // Game over
                score = isMaximizing ? -10000 : 10000;
            } else if (isMaximizing) {
                score = -Infinity;
                for (const nextMove of moves) {
                    score = Math.max(score, this.minimax(nextMove, depth - 1, false, alpha, beta));
                    alpha = Math.max(alpha, score);
                    if (beta <= alpha) break;
                }
            } else {
                score = Infinity;
                for (const nextMove of moves) {
                    score = Math.min(score, this.minimax(nextMove, depth - 1, true, alpha, beta));
                    beta = Math.min(beta, score);
                    if (beta <= alpha) break;
                }
            }
        }

        // Undo move
        this.game.board[move.from.r][move.from.c] = fromPiece;
        this.game.board[move.to.r][move.to.c] = toPiece;

        return score;
    }

    quiescenceSearch(alpha, beta, isMaximizing) {
        // Stand-pat score (evaluation of current position)
        const standPat = this.evaluatePosition('black');

        if (isMaximizing) {
            if (standPat >= beta) return beta;
            if (alpha < standPat) alpha = standPat;
        } else {
            // For minimizing player (White), we want low scores.
            // But evaluatePosition returns Black's perspective (positive = good for Black).
            // So minimizing player wants to MINIMIZE the score.
            // Stand-pat logic for minimizer:
            if (standPat <= alpha) return alpha;
            if (beta > standPat) beta = standPat;
        }

        // Find all CAPTURE moves
        const color = isMaximizing ? 'black' : 'white';
        const moves = this.game.getAllLegalMoves(color);
        const captureMoves = moves.filter(m => this.game.board[m.to.r][m.to.c] !== null);

        if (isMaximizing) {
            for (const move of captureMoves) {
                // Simulate
                const fromPiece = this.game.board[move.from.r][move.from.c];
                const toPiece = this.game.board[move.to.r][move.to.c];
                this.game.board[move.to.r][move.to.c] = fromPiece;
                this.game.board[move.from.r][move.from.c] = null;

                const score = this.quiescenceSearch(alpha, beta, false);

                // Undo
                this.game.board[move.from.r][move.from.c] = fromPiece;
                this.game.board[move.to.r][move.to.c] = toPiece;

                if (score >= beta) return beta;
                if (score > alpha) alpha = score;
            }
            return alpha;
        } else {
            for (const move of captureMoves) {
                // Simulate
                const fromPiece = this.game.board[move.from.r][move.from.c];
                const toPiece = this.game.board[move.to.r][move.to.c];
                this.game.board[move.to.r][move.to.c] = fromPiece;
                this.game.board[move.from.r][move.from.c] = null;

                const score = this.quiescenceSearch(alpha, beta, true);

                // Undo
                this.game.board[move.from.r][move.from.c] = fromPiece;
                this.game.board[move.to.r][move.to.c] = toPiece;

                if (score <= alpha) return alpha;
                if (score < beta) beta = score;
            }
            return beta;
        }
    }

    evaluatePosition(forColor) {
        const pieceValues = { p: 100, n: 320, b: 330, r: 500, a: 700, q: 900, c: 900, k: 20000 };

        // Piece-Square Tables (bonus for good positions)
        const pawnTable = [
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [50, 50, 50, 50, 50, 50, 50, 50, 50],
            [10, 10, 20, 30, 30, 20, 10, 10, 10],
            [5, 5, 10, 25, 25, 10, 5, 5, 5],
            [0, 0, 0, 20, 20, 0, 0, 0, 0],
            [5, -5, -10, 0, 0, -10, -5, 5, 5],
            [5, 10, 10, -20, -20, 10, 10, 5, 5],
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
        ];

        const knightTable = [
            [-50, -40, -30, -30, -30, -30, -40, -50, -50],
            [-40, -20, 0, 0, 0, 0, -20, -40, -40],
            [-30, 0, 10, 15, 15, 10, 0, -30, -30],
            [-30, 5, 15, 20, 20, 15, 5, -30, -30],
            [-30, 0, 15, 20, 20, 15, 0, -30, -30],
            [-30, 5, 10, 15, 15, 10, 5, -30, -30],
            [-40, -20, 0, 5, 5, 0, -20, -40, -40],
            [-50, -40, -30, -30, -30, -30, -40, -50, -50],
            [-50, -40, -30, -30, -30, -30, -40, -50, -50],
        ];

        const bishopTable = [
            [-20, -10, -10, -10, -10, -10, -10, -20, -20],
            [-10, 0, 0, 0, 0, 0, 0, -10, -10],
            [-10, 0, 5, 10, 10, 5, 0, -10, -10],
            [-10, 5, 5, 10, 10, 5, 5, -10, -10],
            [-10, 0, 10, 10, 10, 10, 0, -10, -10],
            [-10, 10, 10, 10, 10, 10, 10, -10, -10],
            [-10, 5, 0, 0, 0, 0, 5, -10, -10],
            [-20, -10, -10, -10, -10, -10, -10, -20, -20],
            [-20, -10, -10, -10, -10, -10, -10, -20, -20],
        ];

        const rookTable = [
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [5, 10, 10, 10, 10, 10, 10, 5, 5],
            [-5, 0, 0, 0, 0, 0, 0, -5, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5, -5],
            [0, 0, 0, 5, 5, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
        ];

        const queenTable = [
            [-20, -10, -10, -5, -5, -10, -10, -20, -20],
            [-10, 0, 0, 0, 0, 0, 0, -10, -10],
            [-10, 0, 5, 5, 5, 5, 0, -10, -10],
            [-5, 0, 5, 5, 5, 5, 0, -5, -5],
            [0, 0, 5, 5, 5, 5, 0, -5, 0],
            [-10, 5, 5, 5, 5, 5, 0, -10, -10],
            [-10, 0, 5, 0, 0, 0, 0, -10, -10],
            [-20, -10, -10, -5, -5, -10, -10, -20, -20],
            [-20, -10, -10, -5, -5, -10, -10, -20, -20],
        ];

        const kingTable = [
            [-30, -40, -40, -50, -50, -40, -40, -30, -30],
            [-30, -40, -40, -50, -50, -40, -40, -30, -30],
            [-30, -40, -40, -50, -50, -40, -40, -30, -30],
            [-30, -40, -40, -50, -50, -40, -40, -30, -30],
            [-20, -30, -30, -40, -40, -30, -30, -20, -20],
            [-10, -20, -20, -20, -20, -20, -20, -10, -10],
            [20, 20, 0, 0, 0, 0, 20, 20, 20],
            [20, 30, 10, 0, 0, 10, 30, 20, 20],
            [30, 40, 40, 0, 0, 20, 40, 30, 30],
        ];

        const tables = {
            p: pawnTable,
            n: knightTable,
            b: bishopTable,
            r: rookTable,
            q: queenTable,
            k: kingTable,
            a: queenTable, // Reuse Queen table for Archbishop
            c: queenTable, // Reuse Queen table for Chancellor
        };

        let score = 0;

        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const piece = this.game.board[r][c];
                if (piece) {
                    let value = pieceValues[piece.type];

                    // Add piece-square table bonus
                    const table = tables[piece.type];
                    if (table) {
                        const row = piece.color === 'white' ? BOARD_SIZE - 1 - r : r;
                        value += table[row][c];
                    }

                    // Center Control Bonus (Central 3x3)
                    if (r >= 3 && r <= 5 && c >= 3 && c <= 5) {
                        value += 15;
                    }

                    if (piece.color === forColor) {
                        score += value;
                    } else {
                        score -= value;
                    }
                }
            }
        }

        return score;
    }

    aiEvaluateDrawOffer() {
        if (!this.game.drawOffered) {
            return;
        }

        const aiColor = 'black'; // Assuming AI is always black
        let shouldAccept = false;

        // Evaluate position
        const score = this.evaluatePosition(aiColor);

        // Accept if position is bad for AI (score <= -200 means AI is losing)
        if (score <= -200) {
            shouldAccept = true;
            this.game.log('KI akzeptiert: Position ist schlecht.');
        }

        // Accept if insufficient material
        if (this.game.isInsufficientMaterial()) {
            shouldAccept = true;
            this.game.log('KI akzeptiert: Ungenügendes Material.');
        }

        // Accept if 50-move rule is close
        if (this.game.halfMoveClock >= 80) {
            shouldAccept = true;
            this.game.log('KI akzeptiert: 50-Züge-Regel nahe.');
        }

        // Accept if position is roughly equal and many moves have been played
        if (Math.abs(score) < 50 && this.game.moveHistory.length > 40) {
            shouldAccept = true;
            this.game.log('KI akzeptiert: Ausgeglichene Position nach vielen Zügen.');
        }

        if (shouldAccept) {
            this.game.acceptDraw();
        } else {
            this.game.log('KI lehnt das Remis-Angebot ab.');
            this.game.declineDraw();
        }
    }

    aiShouldOfferDraw() {
        if (this.game.drawOffered) {
            return false; // Already an offer pending
        }

        const aiColor = 'black';
        const score = this.evaluatePosition(aiColor);

        // Offer draw if position is bad but not hopeless (-300 to -100)
        if (score >= -300 && score <= -100 && this.game.moveHistory.length > 20) {
            this.game.log('KI bietet Remis an (schlechte Position).');
            return true;
        }

        // Offer draw if threefold repetition is imminent
        const currentHash = this.game.getBoardHash();
        const occurrences = this.game.positionHistory.filter(h => h === currentHash).length;
        if (occurrences >= 2) {
            this.game.log('KI bietet Remis an (drohende Stellungswiederholung).');
            return true;
        }

        // Offer draw if position is roughly equal and game is long
        if (Math.abs(score) < 30 && this.game.moveHistory.length > 50) {
            this.game.log('KI bietet Remis an (ausgeglichene Position, langes Spiel).');
            return true;
        }

        return false;
    }

    aiShouldResign() {
        const aiColor = 'black';
        const score = this.evaluatePosition(aiColor);

        // Resign if position is hopeless (score <= -1500 means AI is losing badly)
        if (score <= -1500) {
            this.game.log('KI gibt auf (aussichtslose Position).');
            return true;
        }

        // Resign if we're down massive material (more than 15 points)
        const materialAdvantage = this.game.calculateMaterialAdvantage();
        // materialAdvantage is white - black, so if it's > 15, white is way ahead
        if (materialAdvantage > 15) {
            this.game.log('KI gibt auf (massiver Materialverlust).');
            return true;
        }

        return false;
    }

    // ===== ANALYSIS MODE METHODS =====

    analyzePosition() {
        // Don't analyze if not in analysis mode
        if (!this.game.analysisMode) {
            return;
        }

        // Use Web Worker for analysis to prevent UI freezing
        if (!this.aiWorker) {
            this.aiWorker = new Worker('js/ai-worker.js', { type: 'module' });

            // Load opening book if available
            fetch('opening-book.json')
                .then(r => r.json())
                .then(book => {
                    this.aiWorker.postMessage({ type: 'loadBook', book });
                })
                .catch(() => { });
        }

        // Prepare board state for worker
        const boardCopy = JSON.parse(JSON.stringify(this.game.board));

        // Analysis depth (can be higher than normal play since no time pressure)
        const analysisDepth = 3; // Medium depth for responsive analysis

        this.aiWorker.onmessage = e => {
            const { type, data } = e.data;

            if (type === 'analysis') {
                // Update analysis UI with results
                this.updateAnalysisUI(data);
            } else if (type === 'progress') {
                // Optionally show progress in analysis panel
                // Could update a progress indicator
            }
        };

        this.aiWorker.postMessage({
            type: 'analyze',
            data: {
                board: boardCopy,
                color: this.game.turn,
                depth: analysisDepth,
                topMovesCount: 5, // Get top 5 moves
            },
        });
    }

    updateAnalysisUI(analysis) {
        if (!analysis) return;

        // Update evaluation bar
        const evalBar = document.getElementById('eval-bar');
        const evalScore = document.getElementById('eval-score');

        if (evalBar && evalScore) {
            // Convert score to percentage (centipawns to %)
            // Score ranges roughly from -1000 to +1000
            // 0 = 50% (even), +1000 = 100% (white winning), -1000 = 0% (black winning)
            const normalizedScore = Math.max(-1000, Math.min(1000, analysis.score));
            const percentage = 50 + (normalizedScore / 1000) * 50;

            evalBar.style.width = `${percentage}%`;

            // Update numeric display
            const scoreInPawns = (analysis.score / 100).toFixed(2);
            evalScore.textContent = scoreInPawns;
            evalScore.className = 'eval-score';
            if (analysis.score > 0) evalScore.classList.add('positive');
            if (analysis.score < 0) evalScore.classList.add('negative');
        }

        // Update top moves list
        const topMovesContent = document.getElementById('top-moves-content');
        if (topMovesContent && analysis.topMoves && analysis.topMoves.length > 0) {
            topMovesContent.innerHTML = '';

            analysis.topMoves.forEach((move, index) => {
                const item = document.createElement('div');
                item.className = 'top-move-item';
                if (index === 0) item.classList.add('best');

                // Convert move to algebraic notation
                const fromFile = String.fromCharCode(97 + move.from.c);
                const fromRank = BOARD_SIZE - move.from.r;
                const toFile = String.fromCharCode(97 + move.to.c);
                const toRank = BOARD_SIZE - move.to.r;
                const notation = `${fromFile}${fromRank}-${toFile}${toRank}`;

                const scoreInPawns = (move.score / 100).toFixed(2);

                item.innerHTML = `
                    <span class="top-move-notation">${notation}</span>
                    <span class="top-move-score">${scoreInPawns > 0 ? '+' : ''}${scoreInPawns}</span>
                `;

                // Click to preview/highlight the move
                item.onclick = () => this.highlightMove(move);

                topMovesContent.appendChild(item);
            });
        }
    }

    highlightMove(move) {
        // Clear previous highlights
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('analysis-from', 'analysis-to');
        });

        // Highlight the from and to squares
        const fromCell = document.querySelector(`.cell[data-r="${move.from.r}"][data-c="${move.from.c}"]`);
        const toCell = document.querySelector(`.cell[data-r="${move.to.r}"][data-c="${move.to.c}"]`);

        if (fromCell) fromCell.classList.add('analysis-from');
        if (toCell) toCell.classList.add('analysis-to');

        // Optionally draw an arrow
        if (this.game.arrowRenderer) {
            this.game.arrowRenderer.clearArrows();
            this.game.arrowRenderer.drawArrow(
                move.from.r,
                move.from.c,
                move.to.r,
                move.to.c,
                'rgba(79, 156, 249, 0.7)'
            );
        }
    }
}
