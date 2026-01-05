import { BOARD_SIZE } from '../gameEngine.js';
import * as aiEngine from '../aiEngine.js';

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
        targets: valuableThreatened.map(t => t.pos),
      });
    }

    // 2. CAPTURE - Taking material
    if (capturedPiece) {
      const pieceName = analyzer.getPieceName(capturedPiece.type);

      // Use SEE to check if capture is profitable
      const seeScore = aiEngine.see(game.board, from, to);
      const isProfitable = seeScore >= 0;

      patterns.push({
        type: 'capture',
        severity: isProfitable ? 'medium' : 'low',
        explanation: isProfitable
          ? `⚔️ Schlägt ${pieceName} (Vorteilhaft)`
          : `⚔️ Schlägt ${pieceName} (Riskant! Verlust möglich)`,
        question: 'Gibt es eine gegnerische Figur, die du vorteilhaft schlagen kannst?',
        targets: [{ r: to.r, c: to.c }],
      });
    }

    // 3. CHECK - Threatening opponent's king
    if (game.isInCheck(opponentColor)) {
      // Find king pos
      let kingPos = null;
      for (let r = 0; r < BOARD_SIZE; r++) {
        // Optimization: search only if needed
        for (let c = 0; c < BOARD_SIZE; c++) {
          const p = game.board[r][c];
          if (p && p.type === 'k' && p.color === opponentColor) {
            kingPos = { r, c };
            break;
          }
        }
        if (kingPos) break;
      }

      patterns.push({
        type: 'check',
        severity: 'high',
        explanation: '♔ Schach! Bedroht gegnerischen König',
        question: 'Wie kannst du den gegnerischen König unter Druck setzen?',
        targets: kingPos ? [kingPos] : [],
      });
    }

    // 4. PIN - Piece is pinning an opponent piece
    const pinned = detectPins(game, analyzer, to, piece.color);
    if (pinned.length > 0) {
      const pinnedPiece = pinned[0];
      const targets = [pinnedPiece.pinnedPos];
      if (pinnedPiece.behindPos) targets.push(pinnedPiece.behindPos);

      patterns.push({
        type: 'pin',
        severity: 'high',
        explanation: `📌 Fesselung! ${pinnedPiece.pinnedName} kann nicht ziehen`,
        question: 'Kannst du eine gegnerische Figur an den König fesseln?',
        targets: targets,
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
        targets: target.targetPos ? [target.targetPos] : [],
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
        targets: [defended.pos],
      });
    }
    // 7. SKEWER - Valuable piece forced to move, exposing something behind
    const skewers = detectSkewers(game, analyzer, to, piece.color);
    if (skewers.length > 0) {
      const skewer = skewers[0];
      patterns.push({
        type: 'skewer',
        severity: 'high',
        explanation: `🍢 Spieß! ${skewer.frontName} muss fliehen und entblößt ${skewer.behindName}`,
        question:
          'Kannst du eine wertvolle Figur zwingen wegzuziehen, um eine dahinterstehende anzugreifen?',
        targets: [skewer.frontPos, skewer.behindPos], // For arrows
      });
    }

    // 8. BATTERY - Aligning pieces
    const battery = detectBattery(game, analyzer, to, piece.color);
    if (battery.length > 0) {
      const b = battery[0];
      patterns.push({
        type: 'battery',
        severity: 'medium',
        explanation: `🔋 Batterie gebildet! ${b.frontName} und ${b.behindName} vereinen ihre Kraft.`,
        question:
          'Kannst du diese geballte Kraft nutzen, um in die gegnerische Stellung einzudringen?',
        targets: [b.behindPos], // Point to the supporting piece
      });
    }

    // 9. REMOVING THE GUARD - Capturing a defender
    if (capturedPiece) {
      const removingGuard = detectRemovingGuard(game, analyzer, to, capturedPiece);
      if (removingGuard.length > 0) {
        const undefendedName = removingGuard[0].undefendedName; // Just take first
        patterns.push({
          type: 'removing_guard',
          severity: 'medium',
          explanation: `🔓 Zerstörung der Verteidigung! ${undefendedName} ist nun angreifbar`,
          question: 'Kannst du einen Verteidiger ausschalten, um eine andere Figur zu schwächen?',
          targets: removingGuard.map(rg => rg.undefendedPos),
        });
      }
    }
  } finally {
    // Restore board
    game.board[from.r][from.c] = piece;
    game.board[to.r][to.c] = capturedPiece;
  }

  return patterns;
}

/**
 * Detect Skewers: Similar to Pin, but valuable piece is in front
 */
export function detectSkewers(game, analyzer, pos, attackerColor) {
  const skewers = [];
  const piece = game.board[pos.r][pos.c];

  if (!piece || !['r', 'b', 'q', 'a', 'c'].includes(piece.type)) {
    return skewers; // Only sliding pieces can skewer
  }

  const opponentColor = attackerColor === 'white' ? 'black' : 'white';
  const moves = game.getValidMoves(pos.r, pos.c, piece);

  for (const move of moves) {
    const targetPiece = game.board[move.r][move.c];
    if (!targetPiece || targetPiece.color !== opponentColor) continue;

    // Check line behind
    const dr = Math.sign(move.r - pos.r);
    const dc = Math.sign(move.c - pos.c);

    let r = move.r + dr;
    let c = move.c + dc;

    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
      const behindPiece = game.board[r][c];
      if (behindPiece) {
        if (behindPiece.color === opponentColor) {
          // Heuristic: Front piece value > Behind piece value OR Front is King
          // Value: k=100, q=9, etc.
          const val = { k: 100, q: 9, c: 8, a: 7, r: 5, n: 3, b: 3, p: 1, e: 12 };
          const frontVal = val[targetPiece.type] || 0;
          const behindVal = val[behindPiece.type] || 0;

          if (frontVal > behindVal || targetPiece.type === 'k') {
            skewers.push({
              frontPiece: targetPiece,
              frontName: analyzer.getPieceName(targetPiece.type),
              frontPos: { r: move.r, c: move.c },
              behindPiece: behindPiece,
              behindName: analyzer.getPieceName(behindPiece.type),
              behindPos: { r, c },
            });
          }
        }
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return skewers;
}

/**
 * Detect Removing the Guard: Did capturing 'capturedPiece' leave someone undefended?
 */
export function detectRemovingGuard(game, analyzer, capturePos, capturedPiece) {
  const revealedVulnerabilities = [];
  const defenderColor = capturedPiece.color;

  // We already simulated the capture in the main loop (board has attacker at capturePos).
  // Now check if any piece that WAS defended by capturedPiece is now UNDER ATTACK and NOT SUFFICIENTLY DEFENDED.

  // 1. Find pieces that were defended by the captured piece
  // This is hard to do perfectly without "undoing" the capture simulation, checking, then re-doing.
  // Instead, let's scan all opponent pieces (defenders friends).
  // If one is under attack, check if the capturedPiece COULD have defended it (was guarding that square).

  // Simplified approach: scan all defender's pieces.
  // If they are under attack NOW, and they might have been defended by the captured piece.

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = game.board[r][c];
      if (!p || p.color !== defenderColor) continue;

      // Is it under attack now?
      // Wait, attackerColor is 'our' color (the one moving). defenderColor is victim.
      const ourColor = defenderColor === 'white' ? 'black' : 'white';

      if (game.isSquareUnderAttack(r, c, ourColor)) {
        // It is under attack. Was it defended by the captured piece?
        // Check if capturedPiece (at capturePos) had a valid move to (r,c) (pseudo-move)
        // We need to put capturedPiece back temporarily to check its moves?
        // Yes, or use geometry. Let's assume standard piece movement geometry.

        // Ideally:
        // 1. Defenders count NOW.
        // 2. Defenders count IF captured piece was still there.
        // If (2) > (1) and (1) < Attackers, then we removed a guard.

        const defendersNow = countDefenders(game, r, c, defenderColor);
        const attackersNow = countAttackers(game, r, c, ourColor);

        if (attackersNow > defendersNow) {
          // Was capturedPiece capable of defending (r, c) from capturePos?
          // Check if capturedPiece *could* attack (r,c)
          // essentially.
          const couldDefend = canPieceAttackSquare(game, capturedPiece, capturePos, { r, c });

          if (couldDefend) {
            revealedVulnerabilities.push({
              undefendedPiece: p,
              undefendedName: analyzer.getPieceName(p.type),
              undefendedPos: { r, c },
            });
          }
        }
      }
    }
  }
  return revealedVulnerabilities;
}

function canPieceAttackSquare(game, piece, from, to) {
  // Check if piece at 'from' can move to 'to' on the current board
  // (ignoring that 'from' might be occupied by attacker now, assume it's piece)

  // Determine offsets
  const dr = to.r - from.r;
  const dc = to.c - from.c;
  const absDr = Math.abs(dr);
  const absDc = Math.abs(dc);
  const signDr = Math.sign(dr);
  const signDc = Math.sign(dc);

  if (piece.type === 'n') {
    return (absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2);
  }
  if (piece.type === 'p') {
    // Pawns capture diagonally
    const forward = piece.color === 'white' ? -1 : 1;
    return dr === forward && absDc === 1;
  }
  if (piece.type === 'k') {
    return absDr <= 1 && absDc <= 1;
  }

  // Sliding pieces logic
  let validDir = false;
  if (['r', 'c', 'q'].includes(piece.type) && (dr === 0 || dc === 0)) validDir = true;
  if (['b', 'a', 'q'].includes(piece.type) && absDr === absDc) validDir = true;
  if (piece.type === 'a' && ((absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2)))
    validDir = true; // Archbishop is B+N
  if (piece.type === 'c' && ((absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2)))
    validDir = true; // Chancellor is R+N

  if (!validDir) return false;

  // Check path for obstruction
  // For knight/jump parts of A/C, no obstruction check needed.
  const isKnightMove = (absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2);
  if (isKnightMove) return true;

  let r = from.r + signDr;
  let c = from.c + signDc;
  while (r !== to.r || c !== to.c) {
    if (game.board[r][c]) return false; // Blocked
    r += signDr;
    c += signDc;
  }
  return true;
}

/**
 * Checks if a move has tactical significance (e.g., capture, fork, pin)
 * @param {Object} game - The game instance
 * @param {Object} move - The move to check
 * @returns {boolean} True if tactical
 */
export function isTactical(game, move) {
  // Simplest check: is it a capture?
  if (game.board[move.to.r][move.to.c]) return true;

  // Is it a promotion?
  const piece = game.board[move.from.r][move.from.c];
  if (piece && piece.type === 'p') {
    const promotionRow = piece.color === 'white' ? 0 : BOARD_SIZE - 1;
    if (move.to.r === promotionRow) return true;
  }

  // Check for other tactical patterns (simplified to avoid deep recursion)
  // We check if the move creates a fork or pin
  const analyzer = { getPieceName: t => t };
  const patterns = detectTacticalPatterns(game, analyzer, move);
  return patterns.length > 0;
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
            behindPos: { r, c },
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
              targetPos: { r: checkR, c: checkC },
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
        // Pawns are now included for STRICT mode detection

        // Is this piece under attack?
        const isUnderAttack = aiEngine.isSquareAttacked(game.board, r, c, opponentColor);
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

/**
 * Detect Battery: Aligning two sliding pieces
 */
export function detectBattery(game, analyzer, pos, color) {
  const batteries = [];
  const piece = game.board[pos.r][pos.c];
  if (!piece || !['r', 'b', 'q', 'a', 'c'].includes(piece.type)) return batteries;

  // Check all 8 directions for a friendly sliding piece
  // Orthogonal: R, Q, C
  // Diagonal: B, Q, A

  const ort = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];
  const diag = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];

  const checkDirs = (dirs, types) => {
    dirs.forEach(d => {
      let r = pos.r + d[0];
      let c = pos.c + d[1];
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        const p = game.board[r][c];
        if (p) {
          if (p.color === color && types.includes(p.type)) {
            batteries.push({
              frontPos: pos,
              frontName: analyzer.getPieceName(piece.type),
              behindPos: { r, c },
              behindName: analyzer.getPieceName(p.type),
            });
          }
          break;
        }
        r += d[0];
        c += d[1];
      }
    });
  };

  const isOrthogonal = ['r', 'q', 'c'].includes(piece.type);
  const isDiagonal = ['b', 'q', 'a'].includes(piece.type);

  if (isOrthogonal) checkDirs(ort, ['r', 'q', 'c']);
  if (isDiagonal) checkDirs(diag, ['b', 'q', 'a']);

  return batteries;
}
