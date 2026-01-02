import { BOARD_SIZE } from '../gameEngine.js';

/**
 * Detects tactical patterns for a given move
 * @param {Object} game - The game instance
 * @param {Object} analyzer - The analyzer instance (for getPieceName)
 * @param {Object} move - The move to analyze {from, to}
 * @returns {Array} List of detected patterns
 */
export function detectTacticalPatterns(game, analyzer, move) {
  const patterns = [];
  const from = move.from;
  const to = move.to;
  const piece = game.board[from.r][from.c];

  if (!piece) return patterns;

  // Simulate the move temporarily
  const capturedPiece = game.board[to.r][to.c];
  game.board[to.r][to.c] = piece;
  game.board[from.r][from.c] = null;

  try {
    const opponentColor = piece.color === 'white' ? 'black' : 'white';

    // 1. FORK - Attacks 2+ valuable pieces
    const threatened = getThreatenedPieces(game, analyzer, to, piece.color);
    const valuableThreatened = threatened.filter(t => t.type !== 'p');

    if (valuableThreatened.length >= 2) {
      const pieces = valuableThreatened.map(t => t.name).join(' und ');
      patterns.push({
        type: 'fork',
        severity: 'high',
        explanation: `🍴 Gabelangriff! Bedroht: ${pieces}`,
        question: 'Siehst du eine Möglichkeit, zwei wertvolle Figuren gleichzeitig zu bedrohen?',
      });
    }

    // 2. CAPTURE - Taking material
    if (capturedPiece) {
      const pieceName = analyzer.getPieceName(capturedPiece.type);
      patterns.push({
        type: 'capture',
        severity: 'medium',
        explanation: `⚔️ Schlägt ${pieceName}`,
        question: 'Gibt es eine gegnerische Figur, die du vorteilhaft schlagen kannst?',
      });
    }

    // 3. CHECK - Threatening opponent's king
    if (game.isInCheck(opponentColor)) {
      patterns.push({
        type: 'check',
        severity: 'high',
        explanation: '♔ Schach! Bedroht gegnerischen König',
        question: 'Wie kannst du den gegnerischen König unter Druck setzen?',
      });
    }

    // 4. PIN - Piece is pinning an opponent piece
    const pinned = detectPins(game, analyzer, to, piece.color);
    if (pinned.length > 0) {
      const pinnedPiece = pinned[0];
      patterns.push({
        type: 'pin',
        severity: 'high',
        explanation: `📌 Fesselung! ${pinnedPiece.pinnedName} kann nicht ziehen`,
        question: 'Kannst du eine gegnerische Figur an den König fesseln?',
      });
    }

    // 5. DISCOVERED ATTACK - Moving reveals an attack
    const discoveredAttacks = detectDiscoveredAttacks(game, analyzer, from, to, piece.color);
    if (discoveredAttacks.length > 0) {
      const target = discoveredAttacks[0];
      patterns.push({
        type: 'discovered',
        severity: 'high',
        explanation: `🌟 Abzugsangriff auf ${target.name}!`,
        question:
          'Kannst du durch das Wegziehen einer Figur einen Angriff auf eine andere freilegen?',
      });
    }

    // 6. DEFENSE - Defending a threatened piece
    const defendedPieces = getDefendedPieces(game, analyzer, to, piece.color);
    if (defendedPieces.length > 0 && defendedPieces.some(d => d.wasThreatened)) {
      const defended = defendedPieces.find(d => d.wasThreatened);
      patterns.push({
        type: 'defense',
        severity: 'medium',
        explanation: `🛡️ Verteidigt bedrohten ${defended.name}`,
        question: 'Wie kannst du eine deiner bedrohten Figuren am besten schützen?',
      });
    }
  } finally {
    // Restore board
    game.board[from.r][from.c] = piece;
    game.board[to.r][to.c] = capturedPiece;
  }

  return patterns;
}

/**
 * Detect if a piece at the given position is pinning an opponent piece
 * Returns array of pinned pieces
 */
export function detectPins(game, analyzer, pos, attackerColor) {
  const pinned = [];
  const piece = game.board[pos.r][pos.c];

  if (!piece || !['r', 'b', 'q', 'a', 'c'].includes(piece.type)) {
    return pinned; // Only sliding pieces can pin
  }

  const opponentColor = attackerColor === 'white' ? 'black' : 'white';

  // Check all directions this piece can move
  const moves = game.getValidMoves(pos.r, pos.c, piece);

  for (const move of moves) {
    const targetPiece = game.board[move.r][move.c];
    if (!targetPiece || targetPiece.color !== opponentColor) continue;

    // Check if there's a more valuable piece behind this one in the same line
    const dr = Math.sign(move.r - pos.r);
    const dc = Math.sign(move.c - pos.c);

    let r = move.r + dr;
    let c = move.c + dc;

    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
      const behindPiece = game.board[r][c];
      if (behindPiece) {
        if (behindPiece.color === opponentColor && behindPiece.type === 'k') {
          // Found a pin!
          pinned.push({
            pinnedPos: { r: move.r, c: move.c },
            pinnedPiece: targetPiece,
            pinnedName: analyzer.getPieceName(targetPiece.type),
            behindPiece: behindPiece,
            behindName: analyzer.getPieceName(behindPiece.type),
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
export function detectDiscoveredAttacks(game, analyzer, from, to, attackerColor) {
  const discovered = [];
  const opponentColor = attackerColor === 'white' ? 'black' : 'white';

  // Check all our sliding pieces to see if moving from->to reveals an attack
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = game.board[r][c];
      if (!piece || piece.color !== attackerColor) continue;
      if (!['r', 'b', 'q', 'a', 'c'].includes(piece.type)) continue;
      if (r === from.r && c === from.c) continue; // Skip the moving piece

      // Check if 'from' is blocking this piece's attack
      const dr = Math.sign(from.r - r);
      const dc = Math.sign(from.c - c);

      // Must be on same line
      if (dr === 0 && dc === 0) continue;

      // Check if piece can move in this direction
      const canMoveInDirection = canPieceMove(piece.type, dr, dc);
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

        const targetPiece = game.board[checkR][checkC];
        if (targetPiece) {
          if (foundFrom && targetPiece.color === opponentColor && targetPiece.type !== 'p') {
            discovered.push({
              attackingPiece: piece,
              target: targetPiece,
              name: analyzer.getPieceName(targetPiece.type),
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
export function canPieceMove(type, dr, dc) {
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
export function detectThreatsAfterMove(game, analyzer, move) {
  const threats = [];
  const from = move.from;
  const to = move.to;
  const piece = game.board[from.r][from.c];

  if (!piece) return threats;

  // Simulate the move
  const capturedPiece = game.board[to.r][to.c];
  game.board[to.r][to.c] = piece;
  game.board[from.r][from.c] = null;

  try {
    const opponentColor = piece.color === 'white' ? 'black' : 'white';

    // Check if any of our pieces are now under attack and undefended
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const ownPiece = game.board[r][c];
        if (!ownPiece || ownPiece.color !== piece.color) continue;
        if (ownPiece.type === 'p') continue; // Don't warn about pawns

        // Is this piece under attack?
        const isUnderAttack = game.isSquareUnderAttack(r, c, opponentColor);
        if (isUnderAttack) {
          // Is it defended?
          const defenders = countDefenders(game, r, c, piece.color);
          const attackers = countAttackers(game, r, c, opponentColor);

          if (attackers > defenders) {
            threats.push({
              piece: ownPiece,
              pos: { r, c },
              warning: `⚠️ ${analyzer.getPieceName(ownPiece.type)} wird ungeschützt!`,
            });
          }
        }
      }
    }
  } finally {
    // Restore board
    game.board[from.r][from.c] = piece;
    game.board[to.r][to.c] = capturedPiece;
  }

  return threats;
}

/**
 * Count how many pieces defend a square
 */
export function countDefenders(game, r, c, defenderColor) {
  let count = 0;
  for (let pr = 0; pr < BOARD_SIZE; pr++) {
    for (let pc = 0; pc < BOARD_SIZE; pc++) {
      const piece = game.board[pr][pc];
      if (!piece || piece.color !== defenderColor) continue;

      const moves = game.getValidMoves(pr, pc, piece);
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
export function countAttackers(game, r, c, attackerColor) {
  let count = 0;
  for (let pr = 0; pr < BOARD_SIZE; pr++) {
    for (let pc = 0; pc < BOARD_SIZE; pc++) {
      const piece = game.board[pr][pc];
      if (!piece || piece.color !== attackerColor) continue;

      const moves = game.getValidMoves(pr, pc, piece);
      if (moves.some(m => m.r === r && m.c === c)) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Gets pieces threatened by a piece at pos
 */
export function getThreatenedPieces(game, analyzer, pos, attackerColor) {
  const threatened = [];
  const piece = game.board[pos.r][pos.c];
  if (!piece) return threatened;

  const moves = game.getValidMoves(pos.r, pos.c, piece);

  moves.forEach(move => {
    const targetPiece = game.board[move.r][move.c];
    if (targetPiece && targetPiece.color !== attackerColor) {
      threatened.push({
        piece: targetPiece,
        pos: { r: move.r, c: move.c },
        type: targetPiece.type,
        name: analyzer.getPieceName(targetPiece.type),
      });
    }
  });

  return threatened;
}

/**
 * Gets pieces defended by a piece at pos
 */
export function getDefendedPieces(game, analyzer, pos, defenderColor) {
  const defended = [];
  const piece = game.board[pos.r][pos.c];
  if (!piece) return defended;

  const moves = game.getValidMoves(pos.r, pos.c, piece);

  moves.forEach(move => {
    const targetPiece = game.board[move.r][move.c];
    if (targetPiece && targetPiece.color === defenderColor) {
      // Check if this piece is threatened by opponent
      const opponentColor = defenderColor === 'white' ? 'black' : 'white';
      const wasThreatened = game.isSquareUnderAttack(move.r, move.c, opponentColor);

      defended.push({
        piece: targetPiece,
        pos: { r: move.r, c: move.c },
        type: targetPiece.type,
        name: analyzer.getPieceName(targetPiece.type),
        wasThreatened,
      });
    }
  });

  return defended;
}
