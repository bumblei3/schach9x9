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
            return [];
        }

        // Only show hints when it's the human player's turn
        if (this.game.isAI && this.game.turn === 'black') {
            return []; // Don't give hints for AI
        }

        const moves = this.game.getAllLegalMoves(this.game.turn);

        if (moves.length === 0) return [];

        // Quick heuristic scoring for initial filtering (fast, no deep search)
        const quickScored = [];
        for (const move of moves) {
            const fromPiece = this.game.board[move.from.r][move.from.c];
            if (!fromPiece || fromPiece.color !== this.game.turn) continue;

            const targetPiece = this.game.board[move.to.r][move.to.c];
            if (targetPiece && targetPiece.color === this.game.turn) continue;

            // Quick heuristic: captures > center control > other
            let heuristic = 0;
            if (targetPiece) {
                const values = { p: 1, n: 3, b: 3, r: 5, q: 9, e: 12, a: 7, c: 8, k: 100 };
                heuristic += values[targetPiece.type] * 100; // Prioritize captures
            }
            // Center control bonus
            if (move.to.r >= 3 && move.to.r <= 5 && move.to.c >= 3 && move.to.c <= 5) {
                heuristic += 20;
            }

            quickScored.push({ move, heuristic });
        }

        // Sort by heuristic and take top 8 candidates for deep evaluation (reduced from 15)
        quickScored.sort((a, b) => b.heuristic - a.heuristic);
        const topCandidates = quickScored.slice(0, Math.min(8, quickScored.length));

        // Evaluate top candidates with shallow Minimax (depth 1 only for speed)
        const evaluatedMoves = [];
        const depth = 1; // Always use depth 1 to prevent freezing

        for (const { move } of topCandidates) {
            const fromPiece = this.game.board[move.from.r][move.from.c];
            const validForPiece = this.game.getValidMoves(move.from.r, move.from.c, fromPiece);
            const isReallyValid = validForPiece.some(v => v.r === move.to.r && v.c === move.to.c);

            if (!isReallyValid) continue;

            const score = this.game.minimax(move, depth, true, -Infinity, Infinity);
            const displayScore = -score;
            const notation = this.getMoveNotation(move);

            evaluatedMoves.push({
                move,
                score: displayScore,
                notation,
            });
        }

        // Sort by score (best first)
        evaluatedMoves.sort((a, b) => b.score - a.score);

        // Log only summary
        if (evaluatedMoves.length > 0) {
            logger.debug(`Tutor: Evaluated ${evaluatedMoves.length}/${moves.length} moves, best: ${evaluatedMoves[0].notation} (${evaluatedMoves[0].score})`);
        }

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

        // Handle null piece gracefully
        if (!piece) {
            const fromNotation = String.fromCharCode(97 + move.from.c) + (BOARD_SIZE - move.from.r);
            const toNotation = String.fromCharCode(97 + move.to.c) + (BOARD_SIZE - move.to.r);
            return `Zug ${fromNotation}→${toNotation}`;
        }

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
            e: 'Engel', // Angel piece
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
            e: 'Engel', // Angel piece
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
            const opponentColor = piece.color === 'white' ? 'black' : 'white';

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
            if (this.game.isInCheck(opponentColor)) {
                patterns.push({
                    type: 'check',
                    severity: 'high',
                    explanation: '♔ Schach! Bedroht gegnerischen König',
                });
            }

            // 4. PIN - Piece is pinning an opponent piece
            const pinned = this.detectPins(to, piece.color);
            if (pinned.length > 0) {
                const pinnedPiece = pinned[0];
                patterns.push({
                    type: 'pin',
                    severity: 'high',
                    explanation: `📌 Fesselung! ${pinnedPiece.pinnedName} kann nicht ziehen`,
                });
            }

            // 5. DISCOVERED ATTACK - Moving reveals an attack
            const discoveredAttacks = this.detectDiscoveredAttacks(from, to, piece.color);
            if (discoveredAttacks.length > 0) {
                const target = discoveredAttacks[0];
                patterns.push({
                    type: 'discovered',
                    severity: 'high',
                    explanation: `🌟 Abzugsangriff auf ${target.name}!`,
                });
            }

            // 6. DEFENSE - Defending a threatened piece
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

    /**
     * Detect if a piece at the given position is pinning an opponent piece
     * Returns array of pinned pieces
     */
    detectPins(pos, attackerColor) {
        const pinned = [];
        const piece = this.game.board[pos.r][pos.c];

        if (!piece || !['r', 'b', 'q', 'a', 'c'].includes(piece.type)) {
            return pinned; // Only sliding pieces can pin
        }

        const opponentColor = attackerColor === 'white' ? 'black' : 'white';

        // Check all directions this piece can move
        const moves = this.game.getValidMoves(pos.r, pos.c, piece);

        for (const move of moves) {
            const targetPiece = this.game.board[move.r][move.c];
            if (!targetPiece || targetPiece.color !== opponentColor) continue;

            // Check if there's a more valuable piece behind this one in the same line
            const dr = Math.sign(move.r - pos.r);
            const dc = Math.sign(move.c - pos.c);

            let r = move.r + dr;
            let c = move.c + dc;

            while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
                const behindPiece = this.game.board[r][c];
                if (behindPiece) {
                    if (behindPiece.color === opponentColor && behindPiece.type === 'k') {
                        // Found a pin!
                        pinned.push({
                            pinnedPos: { r: move.r, c: move.c },
                            pinnedPiece: targetPiece,
                            pinnedName: this.getPieceName(targetPiece.type),
                            behindPiece: behindPiece,
                            behindName: this.getPieceName(behindPiece.type),
                        });
                    }
                    break; // Stop at first piece
                }
                r += dr;
                c += dc;
            }
        }

        return pinned;
    }

    /**
     * Detect discovered attacks - attacks revealed by moving a piece
     */
    detectDiscoveredAttacks(from, to, attackerColor) {
        const discovered = [];
        const opponentColor = attackerColor === 'white' ? 'black' : 'white';

        // Check all our sliding pieces to see if moving from->to reveals an attack
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const piece = this.game.board[r][c];
                if (!piece || piece.color !== attackerColor) continue;
                if (!['r', 'b', 'q', 'a', 'c'].includes(piece.type)) continue;
                if (r === from.r && c === from.c) continue; // Skip the moving piece

                // Check if 'from' is blocking this piece's attack
                const dr = Math.sign(from.r - r);
                const dc = Math.sign(from.c - c);

                // Must be on same line
                if (dr === 0 && dc === 0) continue;

                // Check if piece can move in this direction
                const canMoveInDirection = this.canPieceMove(piece.type, dr, dc);
                if (!canMoveInDirection) continue;

                // Trace the line and see if 'from' was blocking an attack
                let checkR = r + dr;
                let checkC = c + dc;
                let foundFrom = false;

                while (checkR >= 0 && checkR < BOARD_SIZE && checkC >= 0 && checkC < BOARD_SIZE) {
                    if (checkR === from.r && checkC === from.c) {
                        foundFrom = true;
                        checkR += dr;
                        checkC += dc;
                        continue;
                    }

                    const targetPiece = this.game.board[checkR][checkC];
                    if (targetPiece) {
                        if (foundFrom && targetPiece.color === opponentColor && targetPiece.type !== 'p') {
                            discovered.push({
                                attackingPiece: piece,
                                target: targetPiece,
                                name: this.getPieceName(targetPiece.type),
                            });
                        }
                        break;
                    }

                    checkR += dr;
                    checkC += dc;
                }
            }
        }

        return discovered;
    }

    /**
     * Helper to check if a piece type can move in a given direction
     */
    canPieceMove(type, dr, dc) {
        if (type === 'r' || type === 'c') {
            // Rook/Chancellor: orthogonal
            return (dr === 0) !== (dc === 0);
        }
        if (type === 'b' || type === 'a') {
            // Bishop/Archbishop: diagonal
            return Math.abs(dr) === Math.abs(dc) && dr !== 0;
        }
        if (type === 'q') {
            // Queen: both
            return true;
        }
        return false;
    }

    /**
     * Detect threats to own pieces after making a move
     */
    detectThreatsAfterMove(move) {
        const threats = [];
        const from = move.from;
        const to = move.to;
        const piece = this.game.board[from.r][from.c];

        if (!piece) return threats;

        // Simulate the move
        const capturedPiece = this.game.board[to.r][to.c];
        this.game.board[to.r][to.c] = piece;
        this.game.board[from.r][from.c] = null;

        try {
            const opponentColor = piece.color === 'white' ? 'black' : 'white';

            // Check if any of our pieces are now under attack and undefended
            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    const ownPiece = this.game.board[r][c];
                    if (!ownPiece || ownPiece.color !== piece.color) continue;
                    if (ownPiece.type === 'p') continue; // Don't warn about pawns

                    // Is this piece under attack?
                    const isUnderAttack = this.game.isSquareUnderAttack(r, c, opponentColor);
                    if (isUnderAttack) {
                        // Is it defended?
                        const defenders = this.countDefenders(r, c, piece.color);
                        const attackers = this.countAttackers(r, c, opponentColor);

                        if (attackers > defenders) {
                            threats.push({
                                piece: ownPiece,
                                pos: { r, c },
                                warning: `⚠️ ${this.getPieceName(ownPiece.type)} wird ungeschützt!`,
                            });
                        }
                    }
                }
            }
        } finally {
            // Restore board
            this.game.board[from.r][from.c] = piece;
            this.game.board[to.r][to.c] = capturedPiece;
        }

        return threats;
    }

    /**
     * Count how many pieces defend a square
     */
    countDefenders(r, c, defenderColor) {
        let count = 0;
        for (let pr = 0; pr < BOARD_SIZE; pr++) {
            for (let pc = 0; pc < BOARD_SIZE; pc++) {
                const piece = this.game.board[pr][pc];
                if (!piece || piece.color !== defenderColor) continue;

                const moves = this.game.getValidMoves(pr, pc, piece);
                if (moves.some(m => m.r === r && m.c === c)) {
                    count++;
                }
            }
        }
        return count;
    }

    /**
     * Count how many pieces attack a square
     */
    countAttackers(r, c, attackerColor) {
        let count = 0;
        for (let pr = 0; pr < BOARD_SIZE; pr++) {
            for (let pc = 0; pc < BOARD_SIZE; pc++) {
                const piece = this.game.board[pr][pc];
                if (!piece || piece.color !== attackerColor) continue;

                const moves = this.game.getValidMoves(pr, pc, piece);
                if (moves.some(m => m.r === r && m.c === c)) {
                    count++;
                }
            }
        }
        return count;
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
        const tacticalExplanations = [];
        const strategicExplanations = [];
        const warnings = [];
        let category = 'normal';

        // Calculate difference from best move (relative quality)
        // score and bestScore are from perspective of player (higher is better)
        const diff = score - bestScore;
        const diffPawns = (diff / 100).toFixed(1);

        // Categorize based on relative score
        let qualityLabel = '';
        if (diff >= -0.5) {
            // Top tier move
            if (score >= 300) {
                category = 'excellent';
                qualityLabel = '⭐⭐⭐ Gewinnzug!';
            } else if (diff >= -0.1) {
                category = 'excellent';
                qualityLabel = '⭐⭐⭐ Bester Zug';
            } else {
                category = 'good';
                qualityLabel = `⭐⭐ Guter Zug (${diffPawns} Bauern schwächer)`;
            }
        } else if (diff >= -1.5) {
            category = 'normal';
            qualityLabel = `⭐ Solider Zug (${diffPawns} Bauern schwächer)`;
        } else if (diff >= -3.0) {
            category = 'questionable';
            qualityLabel = `⚠️ Fragwürdig (${diffPawns} Bauern schwächer)`;
            warnings.push('Bessere Alternativen verfügbar');
        } else {
            category = 'mistake';
            qualityLabel = `❌ Fehler (${diffPawns} Bauern schwächer)`;
            warnings.push('Deutlich bessere Züge vorhanden!');
        }

        // Detect tactical patterns
        const patterns = this.detectTacticalPatterns(move);
        patterns.forEach(pattern => {
            tacticalExplanations.push(pattern.explanation);
        });

        // Analyze strategic value
        const strategic = this.analyzeStrategicValue(move);
        strategic.forEach(s => {
            strategicExplanations.push(s.explanation);
        });

        // Check for threats to own pieces after this move
        const threats = this.detectThreatsAfterMove(move);
        if (threats.length > 0) {
            threats.forEach(threat => {
                warnings.push(threat.warning);
            });
        }

        return {
            move,
            score,
            category,
            qualityLabel,
            tacticalExplanations,
            strategicExplanations,
            warnings,
            tacticalPatterns: patterns,
            strategicValue: strategic,
            scoreDiff: diff,
        };
    }
    getSetupTemplates() {
        const points = this.game.initialPoints;

        // Templates for 12 points
        const templates12 = [
            {
                id: 'fortress_12',
                name: '🏰 Die Festung',
                description: 'Defensiv mit Turm und Läufern.',
                pieces: ['r', 'b', 'b', 'p'], // 5+3+3+1 = 12
                cost: 12
            },
            {
                id: 'rush_12',
                name: '⚡ Der Ansturm',
                description: 'Aggressiv mit Dame und Bauern.',
                pieces: ['q', 'p', 'p', 'p'], // 9+1+1+1 = 12
                cost: 12
            },
            {
                id: 'flexible_12',
                name: '🔄 Flexibel',
                description: 'Ausgewogen mit Springer und Läufer.',
                pieces: ['n', 'n', 'b', 'p', 'p', 'p'], // 3+3+3+1+1+1 = 12
                cost: 12
            },
            {
                id: 'swarm_12',
                name: '🐝 Der Schwarm',
                description: 'Viele leichte Figuren.',
                pieces: ['n', 'b', 'p', 'p', 'p', 'p', 'p'], // 3+3+1+1+1+1+1+1 = 12
                cost: 12
            }
        ];

        // Templates for 15 points
        const templates15 = [
            {
                id: 'fortress_15',
                name: '🏰 Die Festung',
                description: 'Defensivstark mit 2 Türmen. Gut für Anfänger.',
                pieces: ['r', 'r', 'b', 'p', 'p'], // 5+5+3+1+1 = 15
                cost: 15
            },
            {
                id: 'rush_15',
                name: '⚡ Der Ansturm',
                description: 'Aggressiv mit Dame und Springern. Für Taktiker.',
                pieces: ['q', 'n', 'n'], // 9+3+3 = 15
                cost: 15
            },
            {
                id: 'flexible_15',
                name: '🔄 Flexibel',
                description: 'Ausgewogen mit Erzbischof und Turm.',
                pieces: ['a', 'r', 'b'], // 7+5+3 = 15
                cost: 15
            },
            {
                id: 'swarm_15',
                name: '🐝 Der Schwarm',
                description: 'Viele Figuren für maximale Kontrolle.',
                pieces: ['n', 'n', 'b', 'b', 'p', 'p', 'p'], // 3+3+3+3+1+1+1 = 15
                cost: 15
            }
        ];

        // Templates for 18 points
        const templates18 = [
            {
                id: 'fortress_18',
                name: '🏰 Die Festung',
                description: 'Maximale Defensive mit 2 Türmen und Erzbischof.',
                pieces: ['r', 'r', 'a', 'p'], // 5+5+7+1 = 18
                cost: 18
            },
            {
                id: 'rush_18',
                name: '⚡ Der Ansturm',
                description: 'Doppelte Damen für maximalen Druck.',
                pieces: ['q', 'q'], // 9+9 = 18
                cost: 18
            },
            {
                id: 'flexible_18',
                name: '🔄 Flexibel',
                description: 'Kanzler, Dame und Bauer für Vielseitigkeit.',
                pieces: ['c', 'q', 'p'], // 8+9+1 = 18
                cost: 18
            },
            {
                id: 'swarm_18',
                name: '🐝 Der Schwarm',
                description: 'Erzbischof mit vielen leichten Figuren.',
                pieces: ['a', 'n', 'n', 'b', 'p', 'p'], // 7+3+3+3+1+1 = 18
                cost: 18
            }
        ];

        // Return templates matching the current game's point budget
        if (points === 12) return templates12;
        if (points === 18) return templates18;
        return templates15; // Default to 15 points
    }

    applySetupTemplate(templateId) {
        const template = this.getSetupTemplates().find(t => t.id === templateId);
        if (!template) return;

        // Determine current corridor
        const isWhite = this.game.phase === PHASES.SETUP_WHITE_PIECES;
        const corridor = isWhite ? this.game.whiteCorridor : this.game.blackCorridor;
        if (!corridor) return;

        // Clear existing pieces in corridor (except King)
        // And refund points
        for (let r = corridor.rowStart; r < Math.min(corridor.rowStart + 3, BOARD_SIZE); r++) {
            for (let c = corridor.colStart; c < Math.min(corridor.colStart + 3, BOARD_SIZE); c++) {
                // Bounds check
                if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) continue;

                const piece = this.game.board[r][c];
                if (piece && piece.type !== 'k') {
                    // Refund
                    const value = Object.values(this.game.SHOP_PIECES || {}).find(p => p.symbol === piece.type)?.points || 0;
                    // Note: We need access to SHOP_PIECES, assuming it's available or we use hardcoded values
                    // Better to rely on gameController logic or just reset points to 15
                    this.game.board[r][c] = null;
                }
            }
        }

        // Reset points
        this.game.points = this.game.initialPoints;

        // Smart Placement Logic

        // 1. Define Rows
        const rows = [];
        if (isWhite) {
            rows.push(corridor.rowStart + 2); // Front (e.g. 6)
            rows.push(corridor.rowStart + 1); // Middle (e.g. 7)
            rows.push(corridor.rowStart);     // Back (e.g. 8)
        } else {
            rows.push(corridor.rowStart + 2); // Front (e.g. 2)
            rows.push(corridor.rowStart + 1); // Middle (e.g. 1)
            rows.push(corridor.rowStart);     // Back (e.g. 0)
        }
        // Actually, for White, rowStart is top-left of 3x3. 
        // If whiteCorridor is rows 6-8:
        // rowStart = 6.
        // Front is 6 (closest to center? No, wait).
        // Board is 0..8. 0 is Black side, 8 is White side.
        // White pawns move UP (decreasing row index)? No, usually White is at bottom (rows 7-8) moving to 0.
        // Let's check gameEngine.js or config.js for direction.
        // Standard chess: White at 7,8 moving to 0.
        // If White is at bottom (rows 6,7,8), then Front is 6, Back is 8.
        // If Black is at top (rows 0,1,2), then Front is 2, Back is 0.

        // Let's verify direction.
        // In moveController/gameEngine:
        // White pawns move -1 (up), Black pawns move +1 (down).
        // So White is at bottom (high indices), Black at top (low indices).

        let frontRow, middleRow, backRow;
        if (isWhite) {
            frontRow = corridor.rowStart;     // 6
            middleRow = corridor.rowStart + 1; // 7
            backRow = corridor.rowStart + 2;   // 8
        } else {
            frontRow = corridor.rowStart + 2; // 2
            middleRow = corridor.rowStart + 1; // 1
            backRow = corridor.rowStart;      // 0
        }

        // Helper to get empty squares in a specific row
        const getEmptyInRow = (r) => {
            if (r < 0 || r >= 9) return [];
            const squares = [];
            for (let c = corridor.colStart; c < corridor.colStart + 3; c++) {
                if (!this.game.board[r][c]) squares.push({ r, c });
            }
            // Sort by distance from center column (4) to prioritize central placement?
            // Or prioritize corners for rooks?
            return squares;
        };

        const frontSquares = getEmptyInRow(frontRow);
        const middleSquares = getEmptyInRow(middleRow);
        const backSquares = getEmptyInRow(backRow);

        // Sort back squares to prioritize corners (first and last in list)
        // Actually, just sorting by column distance from center might be enough
        // But for Rooks, we want corners.

        // Helper to get value for sorting
        const getVal = (type) => {
            const map = { q: 9, c: 8, a: 7, r: 5, n: 3, b: 3, p: 1, e: 12 };
            return map[type] || 0;
        };

        // Separate pieces
        const pawns = template.pieces.filter(p => p === 'p');
        const others = template.pieces.filter(p => p !== 'p');

        // Sort others by value (descending)
        others.sort((a, b) => getVal(b) - getVal(a));

        // Placement Queue
        // 1. Pawns -> Front Row
        // 2. Rooks/Chancellors -> Back Row Corners
        // 3. Rest -> Back Row -> Middle Row -> Front Row

        // 1. Place Pawns
        pawns.forEach(p => {
            if (frontSquares.length > 0) {
                const sq = frontSquares.shift(); // Take from front row
                this.placePiece(sq.r, sq.c, p, isWhite);
            } else if (middleSquares.length > 0) {
                const sq = middleSquares.shift();
                this.placePiece(sq.r, sq.c, p, isWhite);
            } else if (backSquares.length > 0) {
                const sq = backSquares.shift();
                this.placePiece(sq.r, sq.c, p, isWhite);
            }
        });

        // 2. Place Rooks/Chancellors (Corner preference)
        const cornerPieces = others.filter(p => ['r', 'c'].includes(p));
        const otherPieces = others.filter(p => !['r', 'c'].includes(p));

        cornerPieces.forEach(p => {
            // Try to find a corner in back row
            // We can identify corners by checking column index relative to corridor
            const corners = backSquares.filter(sq => sq.c === corridor.colStart || sq.c === corridor.colStart + 2);

            if (corners.length > 0) {
                // Pick a corner
                const sq = corners[0];
                // Remove from backSquares
                const idx = backSquares.indexOf(sq);
                if (idx > -1) backSquares.splice(idx, 1);

                this.placePiece(sq.r, sq.c, p, isWhite);
            } else if (backSquares.length > 0) {
                const sq = backSquares.shift();
                this.placePiece(sq.r, sq.c, p, isWhite);
            } else if (middleSquares.length > 0) {
                const sq = middleSquares.shift();
                this.placePiece(sq.r, sq.c, p, isWhite);
            } else if (frontSquares.length > 0) {
                const sq = frontSquares.shift();
                this.placePiece(sq.r, sq.c, p, isWhite);
            }
        });

        // 3. Place remaining pieces
        otherPieces.forEach(p => {
            // Fill Back -> Middle -> Front
            if (backSquares.length > 0) {
                const sq = backSquares.shift();
                this.placePiece(sq.r, sq.c, p, isWhite);
            } else if (middleSquares.length > 0) {
                const sq = middleSquares.shift();
                this.placePiece(sq.r, sq.c, p, isWhite);
            } else if (frontSquares.length > 0) {
                const sq = frontSquares.shift();
                this.placePiece(sq.r, sq.c, p, isWhite);
            }
        });

        // Update UI
        UI.renderBoard(this.game);
        UI.updateShopUI(this.game);

        // Log
        this.game.log(`Tutor: Aufstellung "${template.name}" angewendet.`);
    }

    placePiece(r, c, type, isWhite) {
        this.game.board[r][c] = {
            type: type,
            color: isWhite ? 'white' : 'black',
            hasMoved: false
        };

        // Deduct points
        const getVal = (type) => {
            const map = { q: 9, c: 8, a: 7, r: 5, n: 3, b: 3, p: 1, e: 12 };
            return map[type] || 0;
        };
        this.game.points -= getVal(type);
    }
}

