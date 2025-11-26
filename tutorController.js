import { PHASES, BOARD_SIZE } from './gameEngine.js';
import * as UI from './ui.js';
import { logger } from './logger.js';

export class TutorController {
    constructor(game) {
        this.game = game;
    }

    updateBestMoves() {
        if (this.game.phase === PHASES.PLAY && (!this.game.isAI || this.game.turn === 'white')) {
            const originalWarn = console.warn;
            console.warn = () => { };

            try {
                this.game.bestMoves = this.getTutorHints();
            } finally {
                console.warn = originalWarn;
            }
        } else {
            this.game.bestMoves = [];
        }
    }

    isTutorMove(from, to) {
        if (!this.game.bestMoves || this.game.bestMoves.length === 0) return false;
        return this.game.bestMoves.some(
            hint =>
                hint.move.from.r === from.r &&
                hint.move.from.c === from.c &&
                hint.move.to.r === to.r &&
                hint.move.to.c === to.c
        );
    }

    getTutorHints() {
        if (this.game.phase !== PHASES.PLAY) {
            logger.debug('Tutor: Not in PLAY phase');
            return [];
        }

        // Only show hints when it's the human player's turn
        if (this.game.isAI && this.game.turn === 'black') {
            logger.debug('Tutor: AI turn, no hints');
            return []; // Don't give hints for AI
        }

        logger.debug(`Tutor: Getting hints for ${this.game.turn}`);
        const moves = this.game.getAllLegalMoves(this.game.turn);
        logger.debug(`Tutor: Found ${moves.length} legal moves`);

        if (moves.length === 0) return [];

        // Evaluate all moves with simpler method to avoid board corruption
        const evaluatedMoves = [];
        for (const move of moves) {
            // Verify the move is still valid
            const fromPiece = this.game.board[move.from.r][move.from.c];
            if (!fromPiece) {
                console.warn(`Tutor: No piece at from position ${move.from.r},${move.from.c}`);
                continue;
            }
            if (fromPiece.color !== this.game.turn) {
                console.warn(`Tutor: Wrong color piece at ${move.from.r},${move.from.c}`);
                continue;
            }
            // Ensure target square is not occupied by own piece
            const targetPiece = this.game.board[move.to.r][move.to.c];
            if (targetPiece && targetPiece.color === this.game.turn) {
                console.warn(`Tutor: Target square ${move.to.r},${move.to.c} occupied by own piece`);
                continue;
            }
            // Double-check this move is in the original valid moves for this piece
            const validForPiece = this.game.getValidMoves(move.from.r, move.from.c, fromPiece);
            const isReallyValid = validForPiece.some(v => v.r === move.to.r && v.c === move.to.c);

            if (!isReallyValid) {
                console.warn(
                    `Tutor: Move from ${move.from.r},${move.from.c} to ${move.to.r},${move.to.c} not in valid moves`
                );
                continue;
            }

            // Use shallow Minimax for Tutor
            // minimax returns score from Black's perspective.
            // We pass isMaximizing=true because after White moves, it's Black's turn (Maximizer).
            const score = this.game.minimax(move, 1, true, -Infinity, Infinity);

            // Invert score for display (so + is good for White)
            const displayScore = -score;
            const notation = this.getMoveNotation(move);

            logger.debug(`Tutor: Valid move: ${notation} (score: ${displayScore})`);

            evaluatedMoves.push({
                move,
                score: displayScore,
                notation,
            });
        }

        logger.debug(`Tutor: ${evaluatedMoves.length} valid evaluated moves`);

        // Sort by score (best first)
        evaluatedMoves.sort((a, b) => b.score - a.score);

        // Get best score for relative comparison
        const bestScore = evaluatedMoves.length > 0 ? evaluatedMoves[0].score : 0;

        // Return top 3 with analysis
        return evaluatedMoves.slice(0, 3).map(hint => {
            const analysis = this.analyzeMoveWithExplanation(hint.move, hint.score, bestScore);
            return {
                ...hint,
                analysis,
            };
        });
    }

    getMoveNotation(move) {
        const piece = this.game.board[move.from.r][move.from.c];
        const targetPiece = this.game.board[move.to.r][move.to.c];
        const pieceSymbol = UI.getPieceText(piece);
        const fromNotation = String.fromCharCode(97 + move.from.c) + (BOARD_SIZE - move.from.r);
        const toNotation = String.fromCharCode(97 + move.to.c) + (BOARD_SIZE - move.to.r);

        // Get piece names in German
        const pieceNames = {
            p: 'Bauer',
            n: 'Springer',
            b: 'Läufer',
            r: 'Turm',
            q: 'Dame',
            k: 'König',
            a: 'Erzbischof',
            c: 'Kanzler',
        };
        const pieceName = pieceNames[piece.type];

        if (targetPiece) {
            const targetName = pieceNames[targetPiece.type];
            return `${pieceSymbol} ${pieceName} schlägt ${targetName} (${fromNotation}→${toNotation})`;
        } else {
            return `${pieceSymbol} ${pieceName} nach ${toNotation}`;
        }
    }

    showTutorSuggestions() {
        UI.showTutorSuggestions(this.game);
    }

    getPieceName(type) {
        const names = {
            p: 'Bauer',
            n: 'Springer',
            b: 'Läufer',
            r: 'Turm',
            q: 'Dame',
            k: 'König',
            a: 'Erzbischof',
            c: 'Kanzler',
        };
        return names[type] || type;
    }

    getThreatenedPieces(pos, attackerColor) {
        const threatened = [];
        const piece = this.game.board[pos.r][pos.c];
        if (!piece) return threatened;

        const moves = this.game.getValidMoves(pos.r, pos.c, piece);

        moves.forEach(move => {
            const targetPiece = this.game.board[move.r][move.c];
            if (targetPiece && targetPiece.color !== attackerColor) {
                threatened.push({
                    piece: targetPiece,
                    pos: { r: move.r, c: move.c },
                    type: targetPiece.type,
                    name: this.getPieceName(targetPiece.type),
                });
            }
        });

        return threatened;
    }

    detectTacticalPatterns(move) {
        const patterns = [];
        const from = move.from;
        const to = move.to;
        const piece = this.game.board[from.r][from.c];

        if (!piece) return patterns;

        // Simulate the move temporarily
        const capturedPiece = this.game.board[to.r][to.c];
        this.game.board[to.r][to.c] = piece;
        this.game.board[from.r][from.c] = null;

        try {
            // 1. FORK - Attacks 2+ valuable pieces
            const threatened = this.getThreatenedPieces(to, piece.color);
            const valuableThreatened = threatened.filter(t => t.type !== 'p');

            if (valuableThreatened.length >= 2) {
                const pieces = valuableThreatened.map(t => t.name).join(' und ');
                patterns.push({
                    type: 'fork',
                    severity: 'high',
                    explanation: `🍴 Gabelangriff! Bedroht: ${pieces}`,
                });
            }

            // 2. CAPTURE - Taking material
            if (capturedPiece) {
                const pieceName = this.getPieceName(capturedPiece.type);
                patterns.push({
                    type: 'capture',
                    severity: 'medium',
                    explanation: `⚔️ Schlägt ${pieceName}`,
                });
            }

            // 3. CHECK - Threatening opponent's king
            const opponentColor = piece.color === 'white' ? 'black' : 'white';
            if (this.game.isInCheck(opponentColor)) {
                patterns.push({
                    type: 'check',
                    severity: 'high',
                    explanation: '♔ Schach! Bedroht gegnerischen König',
                });
            }

            // 4. DEFENSE - Defending a threatened piece
            const defendedPieces = this.getDefendedPieces(to, piece.color);
            if (defendedPieces.length > 0 && defendedPieces.some(d => d.wasThreatened)) {
                const defended = defendedPieces.find(d => d.wasThreatened);
                patterns.push({
                    type: 'defense',
                    severity: 'medium',
                    explanation: `🛡️ Verteidigt bedrohten ${defended.name}`,
                });
            }
        } finally {
            // Restore board
            this.game.board[from.r][from.c] = piece;
            this.game.board[to.r][to.c] = capturedPiece;
        }

        return patterns;
    }

    getDefendedPieces(pos, defenderColor) {
        const defended = [];
        const piece = this.game.board[pos.r][pos.c];
        if (!piece) return defended;

        const moves = this.game.getValidMoves(pos.r, pos.c, piece);

        moves.forEach(move => {
            const targetPiece = this.game.board[move.r][move.c];
            if (targetPiece && targetPiece.color === defenderColor) {
                // Check if this piece is threatened by opponent
                const opponentColor = defenderColor === 'white' ? 'black' : 'white';
                const wasThreatened = this.game.isSquareUnderAttack(move.r, move.c, opponentColor);

                defended.push({
                    piece: targetPiece,
                    pos: { r: move.r, c: move.c },
                    type: targetPiece.type,
                    name: this.getPieceName(targetPiece.type),
                    wasThreatened,
                });
            }
        });

        return defended;
    }

    analyzeStrategicValue(move) {
        const strategic = [];
        const to = move.to;
        const from = move.from;
        const piece = this.game.board[from.r][from.c];

        if (!piece) return strategic;

        // Center control (middle 3x3 area)
        const centerSquares = [
            [3, 3],
            [3, 4],
            [3, 5],
            [4, 3],
            [4, 4],
            [4, 5],
            [5, 3],
            [5, 4],
            [5, 5],
        ];
        const isCenter = centerSquares.some(c => c[0] === to.r && c[1] === to.c);

        if (isCenter) {
            strategic.push({
                type: 'center_control',
                explanation: '🎯 Kontrolliert das Zentrum',
            });
        }

        // Development - moving a piece for the first time (except pawns)
        if (!piece.hasMoved && piece.type !== 'p' && piece.type !== 'k') {
            strategic.push({
                type: 'development',
                explanation: '♟️ Entwickelt neue Figur',
            });
        }

        // Castling
        if (move.specialMove && move.specialMove.type === 'castling') {
            strategic.push({
                type: 'castling',
                explanation: '🏰 Rochade - Sichert König',
            });
        }

        return strategic;
    }

    getScoreDescription(score) {
        // Score is in centipawns (100 = 1 pawn advantage)
        const pawns = score / 100;

        if (score >= 900) {
            return { label: '🏆 Gewinnstellung', color: '#10b981', emoji: '🏆' };
        } else if (score >= 500) {
            return { label: '⭐ Großer Vorteil', color: '#22c55e', emoji: '⭐' };
        } else if (score >= 200) {
            return { label: '✨ Klarer Vorteil', color: '#4ade80', emoji: '✨' };
        } else if (score >= 50) {
            return { label: '➕ Leichter Vorteil', color: '#86efac', emoji: '➕' };
        } else if (score >= -50) {
            return { label: '⚖️ Ausgeglichen', color: '#94a3b8', emoji: '⚖️' };
        } else if (score >= -200) {
            return { label: '➖ Leichter Nachteil', color: '#fca5a5', emoji: '➖' };
        } else if (score >= -500) {
            return { label: '⚠️ Schwieriger', color: '#f87171', emoji: '⚠️' };
        } else if (score >= -900) {
            return { label: '🔴 Großer Nachteil', color: '#ef4444', emoji: '🔴' };
        } else {
            return { label: '💀 Verloren', color: '#dc2626', emoji: '💀' };
        }
    }

    analyzeMoveWithExplanation(move, score, bestScore) {
        const explanations = [];
        const warnings = [];
        let category = 'normal';

        // Calculate difference from best move (relative quality)
        // score and bestScore are from perspective of player (higher is better)
        const diff = score - bestScore;

        // Categorize based on relative score
        if (diff >= -0.5) {
            // Top tier move
            if (score >= 300) {
                category = 'excellent';
                explanations.push('⭐⭐⭐ Gewinnzug!');
            } else if (diff >= -0.1) {
                category = 'excellent';
                explanations.push('⭐⭐⭐ Bester Zug');
            } else {
                category = 'good';
                explanations.push('⭐⭐ Guter Zug');
            }
        } else if (diff >= -1.5) {
            category = 'normal';
            explanations.push('⭐ Solider Zug');
        } else if (diff >= -3.0) {
            category = 'questionable';
            warnings.push('Fragwürdiger Zug');
        } else {
            category = 'mistake';
            warnings.push('Fehler - Bessere Züge verfügbar');
        }

        // Detect tactical patterns
        const patterns = this.detectTacticalPatterns(move);
        patterns.forEach(pattern => {
            explanations.push(pattern.explanation);
        });

        // Analyze strategic value
        const strategic = this.analyzeStrategicValue(move);
        strategic.forEach(s => {
            explanations.push(s.explanation);
        });

        return {
            move,
            score,
            category,
            explanations,
            warnings,
            tacticalPatterns: patterns,
            strategicValue: strategic,
        };
    }
}
