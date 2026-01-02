import { BOARD_SIZE } from '../gameEngine.js';
import * as UI from '../ui.js';
import * as TacticsDetector from './TacticsDetector.js';

/**
 * Analyzes a move and provides a detailed explanation
 */
export function analyzeMoveWithExplanation(game, move, score, bestScore) {
    const diff = score - bestScore;
    let moveQuality = 'good';
    let qualityLabel = 'Guter Zug';

    if (diff < -300) {
        moveQuality = 'blunder';
        qualityLabel = 'Blunder (Grober Patzer)';
    } else if (diff < -100) {
        moveQuality = 'mistake';
        qualityLabel = 'Fehler';
    } else if (diff > -10) {
        moveQuality = 'best';
        qualityLabel = 'Bester Zug';
    }

    const tacticalPatterns = TacticsDetector.detectTacticalPatterns(game, this, move);
    const strategicPatterns = analyzeStrategicValue(game, move);
    const threats = TacticsDetector.detectThreatsAfterMove(game, this, move);

    const explanations = [
        ...tacticalPatterns.map(p => p.explanation),
        ...strategicPatterns.map(p => p.explanation),
        ...threats.map(t => t.warning),
    ];

    if (explanations.length === 0) {
        explanations.push('Solider Entwicklungszug.');
    }

    return {
        move,
        score,
        quality: moveQuality,
        label: qualityLabel,
        explanations,
        notation: getMoveNotation(game, move),
    };
}

/**
 * Analyzes strategic value of a move
 */
export function analyzeStrategicValue(game, move) {
    const patterns = [];
    const from = move.from;
    const to = move.to;
    const piece = game.board[from.r][from.c];

    if (!piece) return patterns;

    // 1. Center Control
    if (to.r >= 3 && to.r <= 5 && to.c >= 3 && to.c <= 5) {
        patterns.push({
            type: 'center_control',
            explanation: '🏰 Kontrolliert das Zentrum',
        });
    }

    // 2. Development
    const homeRow = piece.color === 'white' ? 8 : 0;
    if (from.r === homeRow && to.r !== homeRow) {
        patterns.push({
            type: 'development',
            explanation: '🚀 Entwickelt eine Figur',
        });
    }

    // 3. Mobility
    // This is a bit simplified as we don't have the board state after move here easily
    // without re-simulating. But detectTacticalPatterns already does simulation.

    return patterns;
}

/**
 * Gets a description for a score
 */
export function getScoreDescription(score) {
    // Score is in centipawns (100 = 1 pawn advantage)
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

/**
 * Gets algebraic notation for a move
 */
export function getMoveNotation(game, move) {
    const piece = game.board[move.from.r][move.from.c];

    // Handle null piece gracefully
    if (!piece) {
        const fromNotation = String.fromCharCode(97 + move.from.c) + (BOARD_SIZE - move.from.r);
        const toNotation = String.fromCharCode(97 + move.to.c) + (BOARD_SIZE - move.to.r);
        return `Zug ${fromNotation}→${toNotation}`;
    }

    const targetPiece = game.board[move.to.r][move.to.c];
    const pieceSymbol = UI.getPieceText ? UI.getPieceText(piece) : '';
    const toNotation = String.fromCharCode(97 + move.to.c) + (BOARD_SIZE - move.to.r);

    const pieceName = getPieceName(piece.type);

    if (targetPiece) {
        const targetName = getPieceName(targetPiece.type);
        return `${pieceSymbol} ${pieceName} schlägt ${targetName} (${toNotation})`;
    } else {
        return `${pieceSymbol} ${pieceName} nach ${toNotation}`;
    }
}

/**
 * Gets a localized piece name
 */
export function getPieceName(type) {
    const names = {
        p: 'Bauer',
        r: 'Turm',
        n: 'Springer',
        b: 'Läufer',
        q: 'Dame',
        k: 'König',
        a: 'Erzbischof',
        c: 'Kanzler',
        e: 'Engel',
    };
    return names[type] || type;
}

/**
 * Handles player moves for Guess the Move and warnings
 */
export function handlePlayerMove(game, tutorController, from, to) {
    if (!game.isAI || game.turn !== 'white') return;

    // If in "Guess the Move" mode
    if (game.guessMoveMode) {
        const isBest = game.bestMoves && game.bestMoves.some(m => m.r === to.r && m.c === to.c);
        if (isBest) {
            UI.showToast('Korrekt! Das war der beste Zug. (+10 Punkte)');
            game.points.white += 10;
        }
    }
}

/**
 * Checks for blunders
 */
export function checkBlunder(game, tutorController, moveRecord) {
    if (!game.isAI || moveRecord.piece.color !== 'white') return;

    // We need current and previous evaluation
    if (game.moveHistory.length < 2) return;
    const prevMove = game.moveHistory[game.moveHistory.length - 2];
    const currentEval = moveRecord.evalScore;
    const prevEval = prevMove.evalScore;

    // If evaluation dropped significantly (> 200 cents)
    if (currentEval < prevEval - 200) {
        const analysis = analyzeMoveWithExplanation.call(
            tutorController,
            game,
            { from: moveRecord.from, to: moveRecord.to },
            currentEval,
            prevEval
        );
        showBlunderWarning(analysis);
    }
}

/**
 * Shows a blunder warning
 */
export function showBlunderWarning(analysis) {
    UI.showModal({
        title: '⚠️ Blunder Warnung',
        content: `
      <div class="blunder-analysis">
        <p>Dein letzter Zug <strong>${analysis.notation}</strong> war ein grober Fehler.</p>
        <ul>
          ${analysis.explanations.map(e => `<li>${e}</li>`).join('')}
        </ul>
        <p>Die Bewertung fiel von ${analysis.score} auf einen deutlich schlechteren Wert.</p>
      </div>
    `,
        buttons: [
            { text: 'Zug zurücknehmen', action: 'undo', primary: true },
            { text: 'Fortfahren', action: 'close' },
        ],
        callback: (action) => {
            if (action === 'undo') {
                if (window.gameInstance && window.gameInstance.moveController) {
                    window.gameInstance.moveController.undoMove();
                }
            }
        },
    });
}
