import { BOARD_SIZE } from '../gameEngine.js';

export class PGNParser {
    games: any[] = [];

    constructor() {
        this.games = [];
    }

    /**
     * Parse a PGN string containing one or more games
     * @param pgnString
     * @returns List of parsed games
     */
    parse(pgnString: string): any[] {
        this.games = [];
        const lines = pgnString.split(/\r?\n/);
        let currentGame: any = { headers: {}, moves: [] };
        let isReadingMoves = false;

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            if (line.startsWith('[')) {
                if (isReadingMoves) {
                    this.games.push(currentGame);
                    currentGame = { headers: {}, moves: [] };
                    isReadingMoves = false;
                }

                const match = line.match(/^\[(\w+)\s+"(.*)"\]$/);
                if (match) {
                    currentGame.headers[match[1]] = match[2];
                }
            } else {
                isReadingMoves = true;
                let cleanLine = line.replace(/\{[^}]*\}/g, '');
                cleanLine = cleanLine.replace(/\d+\./g, '');

                const tokens = cleanLine.split(/\s+/);
                for (const token of tokens) {
                    if (['1-0', '0-1', '1/2-1/2', '*'].includes(token)) {
                        currentGame.headers.Result = token;
                        continue;
                    }
                    if (!token) continue;

                    currentGame.moves.push(token);
                }
            }
        }

        if (Object.keys(currentGame.headers).length > 0 || currentGame.moves.length > 0) {
            this.games.push(currentGame);
        }

        return this.games;
    }

    /**
     * Convert simplified PGN moves to coordinates
     */
    replayGame(movesSan: string[], engine: any): any[] {
        const history: any[] = [];

        for (const san of movesSan) {
            const legalMoves = engine.getAllLegalMoves(engine.turn);
            let matchedMove: any = null;

            for (const move of legalMoves) {
                const notation = this.generateNotationForCheck(move, engine, legalMoves);

                const cleanSan = san.replace(/[+#]/g, '');
                const cleanNotation = notation.replace(/[+#]/g, '');

                if (cleanSan === cleanNotation) {
                    matchedMove = move;
                    break;
                }
            }

            if (matchedMove) {
                const hash = engine.getBoardHash();
                history.push({
                    hash: hash,
                    move: matchedMove,
                    san: san,
                });

                engine.executeMove(matchedMove.from, matchedMove.to);
            } else {
                console.warn(`Could not parse move: ${san} for turn ${engine.turn}`);
                break;
            }
        }

        return history;
    }

    /**
     * Minimal notation generator for matching purposes
     */
    generateNotationForCheck(move: any, engine: any, allLegalMoves: any[]): string {
        const piece = engine.board[move.from.r][move.from.c];
        if (!piece) return '';

        const boardSize = engine.boardSize || BOARD_SIZE;
        const toRowIndex = boardSize - move.to.r;
        const toColChar = String.fromCharCode(97 + move.to.c);
        const dest = `${toColChar}${toRowIndex}`;

        // Castling
        if (piece.type === 'k') {
            if (move.to.c - move.from.c === 2) return 'O-O';
            if (move.from.c - move.to.c === 2) return 'O-O-O';
        }

        // Pawn
        if (piece.type === 'p') {
            if (engine.board[move.to.r][move.to.c]) {
                const fromColChar = String.fromCharCode(97 + move.from.c);
                return `${fromColChar}x${dest}`;
            }
            return dest;
        }

        // Pieces
        const typeUpper = piece.type === 'n' ? 'N' : piece.type.toUpperCase();

        // Check for ambiguity
        const others = allLegalMoves.filter(m => {
            const p = engine.board[m.from.r][m.from.c];
            return (
                p.type === piece.type &&
                p.color === piece.color &&
                (m.from.r !== move.from.r || m.from.c !== move.from.c) &&
                m.to.r === move.to.r &&
                m.to.c === move.to.c
            );
        });

        let disambiguator = '';
        if (others.length > 0) {
            const sameCol = others.some(m => m.from.c === move.from.c);
            const sameRow = others.some(m => m.from.r === move.from.r);

            if (!sameCol) {
                disambiguator = String.fromCharCode(97 + move.from.c);
            } else if (!sameRow) {
                disambiguator = String(boardSize - move.from.r);
            } else {
                disambiguator = String.fromCharCode(97 + move.from.c) + (boardSize - move.from.r);
            }
        }

        const capture = engine.board[move.to.r][move.to.c] ? 'x' : '';

        return `${typeUpper}${disambiguator}${capture}${dest}`;
    }
}
