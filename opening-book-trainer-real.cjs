#!/usr/bin/env node

/**
 * Chess 9x9 Opening Book Trainer - Real Self-Play Implementation
 * Plays AI vs AI games and generates an opening book from successful openings
 */

const fs = require('fs');
const path = require('path');

// ========================================
// CONFIGURATION
// ========================================

const BOARD_SIZE = 9;
const DEFAULT_GAMES = 200;
const DEFAULT_DEPTH = 3;
const OPENING_DEPTH = 10; // Track first 10 moves

// Piece values for evaluation
const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
  a: 650, // Archbishop
  c: 850, // Chancellor
};

// ========================================
// GAME ENGINE (Simplified for Node.js)
// ========================================

class SimpleGame {
  constructor() {
    this.board = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null));
    this.turn = 'white';
    this.moveHistory = [];
    this.gameOver = false;
    this.winner = null;
  }

  // Initialize a random starting position (simplified)
  initializeRandomPosition() {
    // Place kings in random corridors
    const whiteCorridorCol = [0, 3, 6][Math.floor(Math.random() * 3)];
    const blackCorridorCol = [0, 3, 6][Math.floor(Math.random() * 3)];

    // White King
    this.board[7][whiteCorridorCol + 1] = { type: 'k', color: 'white', hasMoved: false };

    // Black King
    this.board[1][blackCorridorCol + 1] = { type: 'k', color: 'black', hasMoved: false };

    // Add some random pieces (simplified setup)
    this.addRandomPieces('white', 6, 8, whiteCorridorCol, whiteCorridorCol + 2);
    this.addRandomPieces('black', 0, 2, blackCorridorCol, blackCorridorCol + 2);
  }

  addRandomPieces(color, rowStart, rowEnd, colStart, colEnd) {
    const pieces = ['p', 'n', 'b', 'r', 'a'];
    const points = 15;
    let remaining = points;

    const emptySquares = [];
    for (let r = rowStart; r <= rowEnd; r++) {
      for (let c = colStart; c <= colEnd; c++) {
        if (!this.board[r][c]) {
          emptySquares.push({ r, c });
        }
      }
    }

    // Shuffle empty squares
    emptySquares.sort(() => Math.random() - 0.5);

    for (const square of emptySquares) {
      if (remaining <= 0) break;

      // Pick affordable piece
      const affordable = pieces.filter(p => this.getPieceCost(p) <= remaining);
      if (affordable.length === 0) break;

      const piece = affordable[Math.floor(Math.random() * affordable.length)];
      const cost = this.getPieceCost(piece);

      this.board[square.r][square.c] = { type: piece, color, hasMoved: false };
      remaining -= cost;
    }
  }

  getPieceCost(type) {
    const costs = { p: 1, n: 3, b: 3, r: 5, a: 7, q: 9, c: 9 };
    return costs[type] || 0;
  }

  makeMove(from, to) {
    const piece = this.board[from.r][from.c];
    if (!piece) return false;

    this.board[to.r][to.c] = piece;
    this.board[from.r][from.c] = null;
    piece.hasMoved = true;

    this.moveHistory.push({ from, to, piece: { ...piece } });
    this.turn = this.turn === 'white' ? 'black' : 'white';

    // Check for game over (simplified - just check if king is missing)
    if (!this.hasKing('white')) {
      this.gameOver = true;
      this.winner = 'black';
    } else if (!this.hasKing('black')) {
      this.gameOver = true;
      this.winner = 'white';
    } else if (this.moveHistory.length > 100) {
      // Draw after 100 moves
      this.gameOver = true;
      this.winner = 'draw';
    }

    return true;
  }

  hasKing(color) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = this.board[r][c];
        if (piece && piece.type === 'k' && piece.color === color) {
          return true;
        }
      }
    }
    return false;
  }

  getLegalMoves(color) {
    const moves = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = this.board[r][c];
        if (piece && piece.color === color) {
          const pieceMoves = this.getPieceMoves(r, c, piece);
          moves.push(...pieceMoves);
        }
      }
    }
    return moves;
  }

  getPieceMoves(r, c, piece) {
    const moves = [];
    const isInside = (r, c) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
    const isFriend = (r, c) => this.board[r][c] && this.board[r][c].color === piece.color;

    const addMove = (toR, toC) => {
      if (isInside(toR, toC) && !isFriend(toR, toC)) {
        moves.push({ from: { r, c }, to: { r: toR, c: toC } });
      }
    };

    const addLineMove = (dr, dc) => {
      let nr = r + dr,
        nc = c + dc;
      while (isInside(nr, nc)) {
        if (this.board[nr][nc]) {
          if (this.board[nr][nc].color !== piece.color) addMove(nr, nc);
          break;
        }
        addMove(nr, nc);
        nr += dr;
        nc += dc;
      }
    };

    switch (piece.type) {
      case 'p': {
        const dir = piece.color === 'white' ? -1 : 1;
        if (isInside(r + dir, c) && !this.board[r + dir][c]) addMove(r + dir, c);
        if (
          isInside(r + dir, c - 1) &&
          this.board[r + dir][c - 1] &&
          this.board[r + dir][c - 1].color !== piece.color
        )
          addMove(r + dir, c - 1);
        if (
          isInside(r + dir, c + 1) &&
          this.board[r + dir][c + 1] &&
          this.board[r + dir][c + 1].color !== piece.color
        )
          addMove(r + dir, c + 1);
        break;
      }
      case 'n': {
        [
          [-2, -1],
          [-2, 1],
          [-1, -2],
          [-1, 2],
          [1, -2],
          [1, 2],
          [2, -1],
          [2, 1],
        ].forEach(([dr, dc]) => addMove(r + dr, c + dc));
        break;
      }
      case 'b': {
        [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ].forEach(([dr, dc]) => addLineMove(dr, dc));
        break;
      }
      case 'r': {
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].forEach(([dr, dc]) => addLineMove(dr, dc));
        break;
      }
      case 'q': {
        [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].forEach(([dr, dc]) => addLineMove(dr, dc));
        break;
      }
      case 'a': {
        // Archbishop: Bishop + Knight
        [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ].forEach(([dr, dc]) => addLineMove(dr, dc));
        [
          [-2, -1],
          [-2, 1],
          [-1, -2],
          [-1, 2],
          [1, -2],
          [1, 2],
          [2, -1],
          [2, 1],
        ].forEach(([dr, dc]) => addMove(r + dr, c + dc));
        break;
      }
      case 'c': {
        // Chancellor: Rook + Knight
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].forEach(([dr, dc]) => addLineMove(dr, dc));
        [
          [-2, -1],
          [-2, 1],
          [-1, -2],
          [-1, 2],
          [1, -2],
          [1, 2],
          [2, -1],
          [2, 1],
        ].forEach(([dr, dc]) => addMove(r + dr, c + dc));
        break;
      }
      case 'k': {
        [
          [-1, -1],
          [-1, 0],
          [-1, 1],
          [0, -1],
          [0, 1],
          [1, -1],
          [1, 0],
          [1, 1],
        ].forEach(([dr, dc]) => addMove(r + dr, c + dc));
        break;
      }
    }

    return moves;
  }

  evaluate(forColor) {
    let score = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = this.board[r][c];
        if (!piece) continue;
        const value = PIECE_VALUES[piece.type] || 0;
        if (piece.color === forColor) score += value;
        else score -= value;
      }
    }
    return score;
  }

  getBoardHash() {
    // Simple hash for position
    let hash = '';
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = this.board[r][c];
        hash += piece ? `${piece.color[0]}${piece.type}` : '..';
      }
    }
    hash += this.turn[0];
    return hash;
  }

  clone() {
    const newGame = new SimpleGame();
    newGame.board = this.board.map(row => row.map(cell => (cell ? { ...cell } : null)));
    newGame.turn = this.turn;
    newGame.moveHistory = [...this.moveHistory];
    newGame.gameOver = this.gameOver;
    newGame.winner = this.winner;
    return newGame;
  }
}

// ========================================
// SIMPLE AI (Minimax)
// ========================================

function getBestMove(game, depth) {
  const moves = game.getLegalMoves(game.turn);
  if (moves.length === 0) return null;

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    const newGame = game.clone();
    newGame.makeMove(move.from, move.to);
    const score = minimax(newGame, depth - 1, false, game.turn);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

function minimax(game, depth, isMaximizing, aiColor, alpha = -Infinity, beta = Infinity) {
  if (depth === 0 || game.gameOver) {
    return game.evaluate(aiColor);
  }

  const moves = game.getLegalMoves(game.turn);
  if (moves.length === 0) {
    return isMaximizing ? -10000 : 10000;
  }

  if (isMaximizing) {
    let maxScore = -Infinity;
    for (const move of moves) {
      const newGame = game.clone();
      newGame.makeMove(move.from, move.to);
      const score = minimax(newGame, depth - 1, false, aiColor, alpha, beta);
      maxScore = Math.max(maxScore, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break; // Beta cutoff
    }
    return maxScore;
  } else {
    let minScore = Infinity;
    for (const move of moves) {
      const newGame = game.clone();
      newGame.makeMove(move.from, move.to);
      const score = minimax(newGame, depth - 1, true, aiColor, alpha, beta);
      minScore = Math.min(minScore, score);
      beta = Math.min(beta, score);
      if (beta <= alpha) break; // Alpha cutoff
    }
    return minScore;
  }
}

// ========================================
// OPENING BOOK BUILDER
// ========================================

class OpeningBookBuilder {
  constructor() {
    this.positions = new Map(); // hash -> { moves: Map, wins: {white, black, draw}, count }
  }

  recordGame(game, winner) {
    // Record first OPENING_DEPTH moves
    const movesToRecord = Math.min(game.moveHistory.length, OPENING_DEPTH);

    const tempGame = new SimpleGame();
    tempGame.initializeRandomPosition();

    for (let i = 0; i < movesToRecord; i++) {
      const hash = tempGame.getBoardHash();
      const move = game.moveHistory[i];

      if (!this.positions.has(hash)) {
        this.positions.set(hash, {
          moves: new Map(),
          wins: { white: 0, black: 0, draw: 0 },
          count: 0,
        });
      }

      const posData = this.positions.get(hash);
      posData.count++;

      // Track this move
      const moveKey = `${move.from.r},${move.from.c}-${move.to.r},${move.to.c}`;
      if (!posData.moves.has(moveKey)) {
        posData.moves.set(moveKey, {
          from: move.from,
          to: move.to,
          count: 0,
          wins: { white: 0, black: 0, draw: 0 },
        });
      }

      const moveData = posData.moves.get(moveKey);
      moveData.count++;
      moveData.wins[winner]++;

      // Make the move in temp game
      tempGame.makeMove(move.from, move.to);
    }
  }

  generateBook() {
    const book = {
      positions: {},
      metadata: {
        version: '2.0',
        type: 'self-play',
        description: `Generated from ${this.positions.size} unique positions`,
        generatedAt: new Date().toISOString(),
        totalPositions: this.positions.size,
      },
    };

    let posIndex = 0;
    for (const [hash, posData] of this.positions.entries()) {
      // Only include positions seen multiple times
      if (posData.count < 3) continue;

      const moves = [];
      for (const [, moveData] of posData.moves.entries()) {
        // Calculate weight based on win rate
        const totalGames = moveData.count;
        const wins = moveData.wins.white + moveData.wins.black;
        const winRate = totalGames > 0 ? wins / totalGames : 0.5;
        const weight = Math.max(1, Math.floor(winRate * 100));

        moves.push({
          from: moveData.from,
          to: moveData.to,
          weight,
          games: totalGames,
        });
      }

      // Sort by weight
      moves.sort((a, b) => b.weight - a.weight);

      // Use hash as key
      book.positions[hash] = {
        moves: moves.slice(0, 5), // Top 5 moves
        seenCount: posData.count,
      };
    }

    return book;
  }
}

// ========================================
// MAIN TRAINING LOOP
// ========================================

async function trainOpeningBook(numGames, depth) {
  console.log(`\n🎮 Starting Self-Play Training`);
  console.log(`   Games: ${numGames}`);
  console.log(`   Search Depth: ${depth}`);
  console.log(`   Opening Moves Tracked: ${OPENING_DEPTH}\n`);

  const builder = new OpeningBookBuilder();
  const results = { white: 0, black: 0, draw: 0 };
  const startTime = Date.now();

  for (let i = 0; i < numGames; i++) {
    const game = new SimpleGame();
    game.initializeRandomPosition();

    // Play game
    let moveCount = 0;
    while (!game.gameOver && moveCount < 100) {
      const move = getBestMove(game, depth);
      if (!move) break;
      game.makeMove(move.from, move.to);
      moveCount++;
    }

    // Record result
    if (game.winner) {
      results[game.winner]++;
      builder.recordGame(game, game.winner);
    }

    // Progress bar with ETA
    const elapsed = (Date.now() - startTime) / 1000;
    const avgTimePerGame = elapsed / (i + 1);
    const remaining = avgTimePerGame * (numGames - i - 1);
    const eta = remaining > 60 ? `${(remaining / 60).toFixed(1)}m` : `${remaining.toFixed(0)}s`;

    const progress = Math.floor(((i + 1) / numGames) * 40);
    const bar = '█'.repeat(progress) + '░'.repeat(40 - progress);
    const pct = Math.floor(((i + 1) / numGames) * 100);

    process.stdout.write(`\r   [${bar}] ${pct}% (${i + 1}/${numGames}) ETA: ${eta}  `);
  }

  console.log('\n');
  console.log(`\n📊 Training Results:`);
  console.log(`   White wins: ${results.white}`);
  console.log(`   Black wins: ${results.black}`);
  console.log(`   Draws: ${results.draw}`);

  return builder.generateBook();
}

// ========================================
// CLI
// ========================================

async function main() {
  console.log('\n🤖 Chess 9x9 Opening Book Trainer');
  console.log('====================================');

  // Parse arguments
  const args = process.argv.slice(2);
  let numGames = DEFAULT_GAMES;
  let depth = DEFAULT_DEPTH;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--games' && args[i + 1]) {
      numGames = parseInt(args[i + 1], 10);
    } else if (args[i] === '--depth' && args[i + 1]) {
      depth = parseInt(args[i + 1], 10);
    } else if (args[i] === '--help') {
      console.log('\nUsage: node opening-book-trainer-real.cjs [options]');
      console.log('\nOptions:');
      console.log('  --games <number>   Number of games to play (default: 200)');
      console.log('  --depth <number>   Search depth (default: 3)');
      console.log('  --help             Show this help\n');
      process.exit(0);
    }
  }

  const startTime = Date.now();
  const book = await trainOpeningBook(numGames, depth);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n✅ Training Complete!`);
  console.log(`   Time: ${elapsed}s`);
  console.log(`   Unique positions: ${Object.keys(book.positions).length}`);

  // Save book
  const outputPath = path.join(__dirname, 'opening-book.json');
  fs.writeFileSync(outputPath, JSON.stringify(book, null, 2));

  console.log(`\n💾 Opening book saved to: opening-book.json`);
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Restart your chess game (refresh browser)`);
  console.log(`   2. The AI will use the new opening book`);
  console.log(`   3. Watch console for "[Opening Book] Selected:" messages\n`);
}

if (require.main === module) {
  main().catch(console.error);
}
