import { BOARD_SIZE } from '../gameEngine.js';

export class PGNParser {
  constructor() {
    this.games = [];
  }

  /**
   * Parse a PGN string containing one or more games
   * @param {string} pgnString
   * @returns {Array} List of parsed games
   */
  parse(pgnString) {
    this.games = [];
    const lines = pgnString.split(/\r?\n/);
    let currentGame = { headers: {}, moves: [] };
    let isReadingMoves = false;

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      if (line.startsWith('[')) {
        // New game start check
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
        // Parse moves
        // Remove move numbers (1. ) and comments ({...})
        // Also handle results like 1-0, 0-1, 1/2-1/2
        let cleanLine = line.replace(/\{[^}]*\}/g, ''); // Remove comments
        cleanLine = cleanLine.replace(/\d+\./g, ''); // Remove move numbers

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
   * This is a complex task because it requires game state to disambiguate moves.
   * For simplicity in this Opening Book generator, we assume:
   * 1. We replay standard 9x9 games
   * 2. We use a game engine simulation to validate and store state
   *
   * @param {Array} movesSan List of moves in Standard Algebraic Notation (SAN)
   * @param {GameEngine} engine A fresh game engine instance to replay moves on
   * @returns {Array} List of move objects {from, to, boardHash}
   */
  replayGame(movesSan, engine) {
    const history = [];

    for (const san of movesSan) {
      const legalMoves = engine.getAllLegalMoves(engine.turn);
      let matchedMove = null;

      // Filter moves that match the SAN
      // This requires the engine to have a 'moveToNotation' compatible check
      // OR we generate notation for all legal moves and find match

      // We'll iterate all legal moves, generate their SAN, and compare.
      // This is inefficient but robust for generation tools.

      // Let's rely on a helper or just implementing basic matching here:

      for (const move of legalMoves) {
        // We'll need a way to generate notation for 'move' to compare with 'san'
        // Since we don't have easy access to PGNGenerator here without import:
        const notation = this.generateNotationForCheck(move, engine, legalMoves);

        // Remove check/mate symbols from comparison if needed
        const cleanSan = san.replace(/[+#]/g, '');
        const cleanNotation = notation.replace(/[+#]/g, '');

        if (cleanSan === cleanNotation) {
          matchedMove = move;
          break;
        }
      }

      if (matchedMove) {
        // Record state before moving
        // We need a consistent hash for the book
        const hash = engine.getBoardHash(); // Ensure engine has this
        history.push({
          hash: hash,
          move: matchedMove,
          san: san,
        });

        engine.executeMove(matchedMove.from, matchedMove.to);
      } else {
        console.warn(`Could not parse move: ${san} for turn ${engine.turn}`);
        break; // Stop parsing this game
      }
    }

    return history;
  }

  /**
   * Minimal notation generator for matching purposes
   * Does not need to be perfect, just needs to match standard SAN output
   */
  generateNotationForCheck(move, engine, allLegalMoves) {
    const piece = engine.board[move.from.r][move.from.c];
    if (!piece) return '';

    const toRowIndex = BOARD_SIZE - move.to.r; // 9-based
    const toColChar = String.fromCharCode(97 + move.to.c); // a-i
    const dest = `${toColChar}${toRowIndex}`;

    // Castling
    if (piece.type === 'k') {
      if (move.to.c - move.from.c === 2) return 'O-O';
      if (move.from.c - move.to.c === 2) return 'O-O-O';
    }

    // Pawn
    if (piece.type === 'p') {
      // Capture
      if (engine.board[move.to.r][move.to.c]) {
        const fromColChar = String.fromCharCode(97 + move.from.c);
        return `${fromColChar}x${dest}`;
      }
      return dest;
    }

    // Pieces
    const typeUpper = piece.type === 'n' ? 'N' : piece.type.toUpperCase();

    // Check for ambiguity
    // Find other pieces of same type/color that can move to same square
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
        disambiguator = String(BOARD_SIZE - move.from.r);
      } else {
        disambiguator = String.fromCharCode(97 + move.from.c) + (BOARD_SIZE - move.from.r);
      }
    }

    const capture = engine.board[move.to.r][move.to.c] ? 'x' : '';

    return `${typeUpper}${disambiguator}${capture}${dest}`;
  }
}
