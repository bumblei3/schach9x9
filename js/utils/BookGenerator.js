import fs from 'fs';
import { PGNParser } from './PGNParser.js';
import { OpeningBook } from '../ai/OpeningBook.js';
import { Game } from '../gameEngine.js'; // Assuming GameEngine is exportable for node

/**
 * Opening Book Generator
 * Usage: node js/utils/BookGenerator.js [pgnFile] [outputFile]
 */

const pgnFile = process.argv[2] || 'data/openings.pgn';
const outputFile = process.argv[3] || 'opening-book.json';
const mode = process.argv[4] || 'classic';

async function generateBook() {
  console.log(`Reading PGN from ${pgnFile}...`);
  console.log(`Using mode: ${mode}`);

  if (!fs.existsSync(pgnFile)) {
    console.error(`File not found: ${pgnFile}`);
    // Create empty if not exists just to show structure?
    // No, better to fail.
    return;
  }

  const pgnContent = fs.readFileSync(pgnFile, 'utf8');
  const parser = new PGNParser();
  const games = parser.parse(pgnContent);

  console.log(`Found ${games.length} games.`);

  // Load existing book or create new
  let bookData = {
    positions: {},
    metadata: { version: '2.0', generatedAt: new Date().toISOString(), mode: mode },
  };
  if (fs.existsSync(outputFile)) {
    try {
      bookData = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
      if (bookData.metadata && bookData.metadata.mode && bookData.metadata.mode !== mode) {
        console.warn(`Warning: Existing book has mode ${bookData.metadata.mode}, but we are generating for ${mode}. overwriting.`);
        bookData = { positions: {}, metadata: { version: '2.0', generatedAt: new Date().toISOString(), mode: mode } };
      }
      console.log(`Loaded existing book with ${Object.keys(bookData.positions).length} positions.`);
    } catch (e) {
      console.warn('Could not parse existing book, starting fresh.');
    }
  }

  const book = new OpeningBook(bookData);

  for (const gameData of games) {
    const gameEngine = new Game(15, mode); // Use selected mode
    // gameEngine.setupClassicBoard() is called in constructor

    const history = parser.replayGame(gameData.moves, gameEngine);

    for (const item of history) {
      if (item.hash) {
        addMoveDirectly(book, item.hash, item.move);
      }
    }
  }

  // Recalculate weights
  recalcWeights(book);

  fs.writeFileSync(outputFile, JSON.stringify(book.data, null, 2));
  console.log(
    `Book saved to ${outputFile}. Total positions: ${Object.keys(book.data.positions).length}`
  );
}

function addMoveDirectly(book, hash, move) {
  if (!book.data.positions[hash]) {
    book.data.positions[hash] = { moves: [], seenCount: 0 };
  }
  const pos = book.data.positions[hash];
  pos.seenCount++;

  const existing = pos.moves.find(
    m =>
      m.from.r === move.from.r &&
      m.from.c === move.from.c &&
      m.to.r === move.to.r &&
      m.to.c === move.to.c
  );
  if (existing) {
    existing.games++;
  } else {
    pos.moves.push({ from: move.from, to: move.to, weight: 1, games: 1 });
  }
}

function recalcWeights(book) {
  for (const hash in book.data.positions) {
    const pos = book.data.positions[hash];
    const totalGames = pos.moves.reduce((sum, m) => sum + m.games, 0);
    pos.moves.forEach(m => {
      m.weight = Math.round((m.games / totalGames) * 100);
    });
    pos.moves.sort((a, b) => b.weight - a.weight);
  }
}

generateBook().catch(console.error);
