import { PHASES } from './gameEngine.js';
import { SHOP_PIECES } from './config.js';
import { logger } from './logger.js';
import * as UI from './ui.js';
import * as aiEngine from './aiEngine.js';

// Piece values for shop
const PIECES: any = SHOP_PIECES;

export const AI_PERSONALITIES: any = {
  balanced: {
    id: 'BALANCED',
    name: 'Balanced',
    mobilityWeight: 1.0,
    safetyWeight: 1.0,
    pawnStructureWeight: 1.0,
    centerControlWeight: 1.0,
    attackWeight: 1.0,
  },
  aggressive: {
    id: 'AGGRESSIVE',
    name: 'Aggressive',
    mobilityWeight: 1.2,
    safetyWeight: 0.8,
    pawnStructureWeight: 0.9,
    centerControlWeight: 1.2,
    attackWeight: 1.5,
  },
  defensive: {
    id: 'DEFENSIVE',
    name: 'Defensive',
    mobilityWeight: 0.8,
    safetyWeight: 1.5,
    pawnStructureWeight: 1.2,
    centerControlWeight: 1.0,
    attackWeight: 0.7,
  },
  positional: {
    id: 'POSITIONAL',
    name: 'Positional',
    mobilityWeight: 1.0,
    safetyWeight: 1.1,
    pawnStructureWeight: 1.5,
    centerControlWeight: 1.4,
    attackWeight: 0.9,
  },
  trapper: {
    id: 'POSITIONAL', // Maps to positional for now, but with custom weights
    name: 'Der Fallensteller',
    mobilityWeight: 0.7,
    safetyWeight: 1.3,
    pawnStructureWeight: 1.1,
    centerControlWeight: 0.9,
    attackWeight: 1.6,
  },
};

export class AIController {
  public game: any;
  public aiWorker: Worker | null;
  public aiWorkers: Worker[];
  public analysisActive: boolean;
  public analysisUI: any;
  public currentBookMode: string | null;
  public openingBookData: any;
  private _aiMoveStartTime: number;

  constructor(game: any) {
    this.game = game;
    this.aiWorker = null;
    this.aiWorkers = [];
    this.analysisActive = false;
    this.analysisUI = null;
    this.currentBookMode = null;
    this._aiMoveStartTime = 0;
  }

  public setAnalysisUI(analysisUI: any): void {
    this.analysisUI = analysisUI;
  }

  public toggleAnalysisMode(): boolean {
    this.analysisActive = !this.analysisActive;

    if (this.game.evaluationBar) {
      this.game.evaluationBar.show(this.analysisActive);
    }

    if (this.game.analysisManager) {
      this.game.analysisManager.showBestMove = this.analysisActive;
      this.game.analysisManager.updateArrows();
    }

    if (this.analysisActive) {
      this.analyzePosition();
    }
    return this.analysisActive;
  }

  public aiSetupKing(): void {
    // Choose random corridor (0, 3, 6)
    const cols = [0, 3, 6];
    const randomCol = cols[Math.floor(Math.random() * cols.length)];
    // Black King goes to row 0-2 (top), specifically row 1, col randomCol+1
    this.game.placeKing(1, randomCol + 1, 'black');
    UI.renderBoard(this.game);
  }

  public aiSetupPieces(): void {
    // blackCorridor is just the colStart number, not an object
    const colStart = this.game.blackCorridor;
    if (colStart === null || colStart === undefined) {
      return;
    }

    // Black corridor is at top (row 0-2)
    const rowStart = 0;

    // Map piece names to their symbols
    const pieceSymbols: Record<string, string> = {
      QUEEN: 'q',
      CHANCELLOR: 'c',
      ARCHBISHOP: 'a',
      ROOK: 'r',
      BISHOP: 'b',
      KNIGHT: 'n',
      PAWN: 'p',
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

      // Find empty spot in the 3x3 corridor
      const emptySpots: { r: number; c: number }[] = [];
      for (let r = rowStart; r < rowStart + 3; r++) {
        for (let c = colStart; c < colStart + 3; c++) {
          if (!this.game.board[r][c]) emptySpots.push({ r, c });
        }
      }

      if (emptySpots.length === 0) break;

      // Heuristic Placement Logic
      let candidates: { r: number; c: number }[] = [];
      const kingPos = this.game.findKing('black'); // Should be present from aiSetupKing

      if (symbol === 'p' && kingPos) {
        // Pawns prefer protecting the King (same col or adjacent) and being forward
        candidates = emptySpots.filter(s => s.r > kingPos.r);
        // Sort by closeness to King's column
        candidates.sort((a, b) => Math.abs(a.c - kingPos.c) - Math.abs(b.c - kingPos.c));
      } else if (symbol === 'r' || symbol === 'q') {
        // Rooks/Queens prefer back rank
        candidates = emptySpots.filter(s => s.r === rowStart);
      } else if (symbol === 'n' || symbol === 'b') {
        // Knights/Bishops prefer not to be on edges of valid area if possible
        candidates = emptySpots.filter(s => s.r > rowStart);
      }

      // Fallback if no specific candidates found
      if (candidates.length === 0) {
        candidates = emptySpots;
      }

      const spot = candidates[Math.floor(Math.random() * candidates.length)];
      this.game.placeShopPiece(spot.r, spot.c);
    }
    this.game.finishSetupPhase();
  }

  public aiSetupUpgrades(): void {
    if (this.game.gameController && this.game.gameController.shopManager) {
      this.game.gameController.shopManager.aiPerformUpgrades();
    }
  }

  public async aiMove(): Promise<void> {
    // Don't move in puzzle mode - player solves alone
    if (this.game.mode === 'puzzle') {
      logger.debug('[AI] Skipping aiMove - puzzle mode');
      return;
    }

    logger.info('[AI] Starting aiMove...');
    this._aiMoveStartTime = Date.now();

    // Check if AI should resign
    if (await this.aiShouldResign()) {
      this.game.resign('black');
      return;
    }

    // Check if AI should offer draw
    if (await this.aiShouldOfferDraw()) {
      this.game.offerDraw('black');
      // Continue with move if player hasn't responded yet
    }

    // Check if there's a pending draw offer from player
    if (this.game.drawOffered && this.game.drawOfferedBy === 'white') {
      await this.aiEvaluateDrawOffer();
      // If draw was accepted, game is over, so return
      if (this.game.phase === PHASES.GAME_OVER) {
        return;
      }
    }

    const spinner = document.getElementById('spinner-overlay');
    if (spinner) spinner.classList.remove('hidden');

    // Initialize persistent worker pool if not exists
    if (!this.aiWorkers || this.aiWorkers.length === 0) {
      this.initWorkerPool();
    } else if (this.currentBookMode !== this.game.mode) {
      // Reload workers if mode changed (different opening book)
      logger.info(
        `[AI] Mode changed from ${this.currentBookMode} to ${this.game.mode}. Reloading workers.`
      );
      this.terminate();
      this.initWorkerPool();
    }

    // Difficulty to depth mapping
    const depthMap: Record<string, number> = {
      beginner: 1,
      easy: 2,
      medium: 3,
      hard: 4,
      expert: 5,
    };

    let depth: number;
    if (this.game.mode === 'classic') {
      depth = 3;
      logger.debug(`[AI] Classic mode: using depth ${depth} for faster play`);
    } else {
      depth = depthMap[this.game.difficulty] || 3;
      logger.debug(`[AI] Difficulty ${this.game.difficulty}: using depth ${depth}`);
    }

    // Prepare board state for workers - Optimization: Use Int8Array instead of JSON cloning
    const boardInt = aiEngine.convertBoardToInt(this.game.board);
    const lastMove = this.game.lastMove; // Needed for En Passant

    // Track results
    const workerResults: any[] = [];
    let completedWorkers = 0;
    const numWorkers = this.aiWorkers.length;

    return new Promise<void>(resolve => {
      const processResults = () => {
        console.log('[DEBUG] AI processResults started');
        const elapsed = Date.now() - this._aiMoveStartTime;
        logger.info(`[AI] Processing results after ${elapsed}ms`);

        if (spinner) spinner.classList.add('hidden');

        // Find best result
        const bestResult = workerResults.find(r => r && r.move);
        logger.debug(
          '[AI] Worker results:',
          workerResults.map(r =>
            r && r.move
              ? `${r.move.from?.r},${r.move.from?.c}->${r.move.to?.r},${r.move.to?.c}`
              : 'null'
          )
        );

        if (bestResult && bestResult.move) {
          logger.info(
            `[AI] Executing move: ${bestResult.move.from.r},${bestResult.move.from.c} -> ${bestResult.move.to.r},${bestResult.move.to.c}${bestResult.move.promotion ? ` (Promote to ${bestResult.move.promotion})` : ''}`
          );
          this.game.executeMove(
            bestResult.move.from,
            bestResult.move.to,
            false,
            bestResult.move.promotion
          );
          if (this.game.renderBoard) this.game.renderBoard();

          // Display AI Thinking (PV)
          if (bestResult.pv && bestResult.pv.length > 0) {
            const bestMoveEl = document.getElementById('ai-best-move');
            if (bestMoveEl) {
              const pvText = bestResult.pv
                .map((m: any) => {
                  const size = this.game.boardSize;
                  const from = String.fromCharCode(97 + m.from.c) + (size - m.from.r);
                  const to = String.fromCharCode(97 + m.to.c) + (size - m.to.r);
                  return `${from}${to}`;
                })
                .join(' ');
              bestMoveEl.textContent = `KI Plan: ${pvText}`;
            }
          }
        } else {
          logger.warn('[AI] No valid move found in worker results!');
          this.game.log('KI kann nicht ziehen (Patt oder Matt?)');
        }
        console.log('[DEBUG] AI processResults calling resolve');
        resolve();
      };

      // Add timeout to prevent game from freezing if workers hang
      let hasProcessed = false;
      const timeoutId = setTimeout(() => {
        if (!hasProcessed) {
          hasProcessed = true;
          logger.error('[AI] Worker timeout after 30 seconds! Making fallback move.');
          if (spinner) spinner.classList.add('hidden');

          // Make a random legal move as fallback
          const allMoves = this.game.getAllLegalMoves('black');
          if (allMoves.length > 0) {
            const randomMove = allMoves[Math.floor(Math.random() * allMoves.length)];
            this.game.executeMove(randomMove.from, randomMove.to);
          } else {
            this.game.log('KI kann nicht ziehen (Patt oder Matt?)');
          }
          resolve();
        }
      }, 30000); // 30 second timeout

      const processResultsWithTimeout = () => {
        if (hasProcessed) return;
        hasProcessed = true;
        clearTimeout(timeoutId);
        processResults();
      };

      // Dispatch tasks to persistent workers
      this.aiWorkers.forEach((worker, i) => {
        // Use one-time message handler for the move search
        const moveHandler = (e: MessageEvent) => {
          const { type, data } = e.data;
          if (type === 'bestMove') {
            console.log(`[DEBUG] AI worker ${i} bestMove received`);
            worker.removeEventListener('message', moveHandler);
            workerResults[i] = data;
            completedWorkers++;
            console.log(`[DEBUG] AI completedWorkers: ${completedWorkers}`);
            if (completedWorkers === 1) {
              console.log('[DEBUG] AI triggering processResultsWithTimeout');
              processResultsWithTimeout();
            }
          }
        };
        worker.addEventListener('message', moveHandler);

        worker.onerror = err => {
          logger.error(`[AI] Worker ${i} error:`, err);
          completedWorkers++;
          if (completedWorkers === numWorkers) processResultsWithTimeout();
        };

        logger.debug(`[AI] Dispatching search to worker ${i}`);

        // Calculate Time Limit based on difficulty
        let timeLimit = 5000;
        if (this.game.mode === 'standard8x8' || this.game.mode === 'classic') {
          timeLimit = 8000;
        } else {
          const timeMap: Record<string, number> = {
            beginner: 2000,
            easy: 3000,
            medium: 4000,
            hard: 5000,
            expert: 8000,
          };
          timeLimit = timeMap[this.game.difficulty] || 5000;
        }

        const personalityConfig = AI_PERSONALITIES[this.game.aiPersonality || 'balanced'];

        // Send search request
        worker.postMessage({
          type: 'getBestMove',
          data: {
            board: boardInt,
            color: 'black',
            depth: depth,
            personality: personalityConfig.id,
            difficulty: this.game.difficulty,
            moveNumber: Math.floor(this.game.moveHistory.length / 2),
            config: personalityConfig,
            lastMove: lastMove,
            timeLimit: timeLimit,
          },
        });
      });
    });
  }

  public initWorkerPool(): void {
    const numWorkers = Math.min(navigator.hardwareConcurrency || 2, 4);
    logger.debug(`[AI] Initializing pool with ${numWorkers} workers`);

    this.aiWorkers = [];
    this.currentBookMode = this.game.mode;

    const bookFile =
      this.game.mode === 'standard8x8' ? 'opening-book-8x8.json' : 'opening-book.json';

    // Load opening book once
    fetch(bookFile)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
        return r.json();
      })
      .then(book => {
        logger.info(
          `[AIController] Opening book loaded successfully. Positions: ${Object.keys(book.positions || {}).length}`
        );
        this.openingBookData = book;
        this.aiWorkers.forEach(w => w.postMessage({ type: 'loadBook', data: { book } }));
      })
      .catch(err => {
        logger.error('[AIController] Could not load opening-book.json:', err);
      });

    for (let i = 0; i < numWorkers; i++) {
      let worker: Worker;
      try {
        /*
         * Note: In Vitest environment, import.meta.url might be problematic.
         * The test mocks global.Worker, so we expect this to succeed if URL resolution works.
         */
        const workerUrl = new URL('./ai/aiWorker.ts', import.meta.url);
        worker = new Worker(workerUrl, { type: 'module' });
      } catch (err) {
        logger.error(
          `[AIController] Failed to create worker ${i}. import.meta.url=${import.meta.url}`,
          err
        );
        throw err;
      }
      this.aiWorkers.push(worker);

      // Dedicated message handler per worker
      worker.onmessage = e => this.handleWorkerMessage(e, i);

      if (this.openingBookData) {
        worker.postMessage({ type: 'loadBook', data: { book: this.openingBookData } });
      }
    }
  }

  /**
   * Central worker message dispatcher
   */
  private handleWorkerMessage(e: MessageEvent, workerIndex: number): void {
    const { type, data } = e.data;

    if (type === 'progress') {
      if (workerIndex === 0) this.updateAIProgress(data);
    } else if (type === 'bestMove') {
      // Handled by specific promises in aiMove, but we can store it here too
      this.game.lastBestMove = data;
    } else if (type === 'analysis') {
      this.handleAnalysisResult(data);
    }
  }

  /**
   * Processes live engine analysis results
   */
  private handleAnalysisResult(data: any): void {
    if (this.analysisUI) {
      this.analysisUI.update(data);
    }

    // Update global game state for best move arrows
    if (data.topMoves && data.topMoves.length > 0) {
      this.game.bestMoves = data.topMoves.map((m: any) => ({
        move: m.move,
        score: m.score,
        notation: m.notation,
      }));

      // Automatically trigger arrow update if analysis manager is present
      if (this.game.analysisManager) {
        this.game.analysisManager.updateArrows();
      }
    }

    // Also update eval bar outside the panel
    if (this.game.evaluationBar) {
      this.game.evaluationBar.update(data.score);
    }
  }

  public terminate(): void {
    if (this.aiWorkers) {
      this.aiWorkers.forEach(w => w.terminate());
      this.aiWorkers = [];
    }
    if (this.aiWorker) {
      this.aiWorker.terminate();
      this.aiWorker = null;
    }
  }

  public updateAIProgress(data: any): void {
    const depthEl = document.getElementById('ai-depth');
    const nodesEl = document.getElementById('ai-nodes');
    const bestMoveEl = document.getElementById('ai-best-move');
    const progressFill = document.getElementById('progress-fill');

    if (!data) return; // Guard against null data

    if (data && depthEl) {
      depthEl.textContent = `Tiefe ${data.depth}/${data.maxDepth}`;
    }

    if (nodesEl && data.nodes !== undefined) {
      const nodesFormatted = data.nodes.toLocaleString('de-DE');
      nodesEl.textContent = `${nodesFormatted} Positionen`;
    }

    if (bestMoveEl && data.bestMove) {
      const size = this.game.boardSize;
      const from = String.fromCharCode(97 + data.bestMove.from.c) + (size - data.bestMove.from.r);
      const to = String.fromCharCode(97 + data.bestMove.to.c) + (size - data.bestMove.to.r);
      bestMoveEl.textContent = `Bester Zug: ${from}-${to}`;

      // Show engine arrow
      if (UI.drawEngineArrow) {
        UI.drawEngineArrow(data.bestMove.from, data.bestMove.to);
      }
    }

    if (progressFill && data.maxDepth > 0) {
      const progress = (data.depth / data.maxDepth) * 100;
      progressFill.style.width = `${progress}%`;
    }
  }

  public async aiEvaluateDrawOffer(): Promise<void> {
    if (!this.game.drawOffered) {
      return;
    }

    const aiColor = 'black'; // Assuming AI is always black
    let shouldAccept = false;

    const score = await aiEngine.evaluatePosition(this.game.board, aiColor);

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

  public async aiShouldOfferDraw(): Promise<boolean> {
    if (this.game.drawOffered) {
      return false; // Already an offer pending
    }

    const aiColor = 'black';
    const score = await aiEngine.evaluatePosition(this.game.board, aiColor);

    // Offer draw if position is bad but not hopeless (-300 to -100)
    if (score >= -300 && score <= -100 && this.game.moveHistory.length > 20) {
      this.game.log('KI bietet Remis an (schlechte Position).');
      return true;
    }

    // Offer draw if threefold repetition is imminent
    const currentHash = this.game.getBoardHash();
    const occurrences = this.game.positionHistory.filter((h: string) => h === currentHash).length;
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

  public async aiShouldResign(): Promise<boolean> {
    const aiColor = 'black';
    const score = await aiEngine.evaluatePosition(this.game.board, aiColor);

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

  public analyzePosition(): void {
    // Check if either dedicated analysis mode OR live engine overlay is active
    if (!this.game.analysisMode && !this.analysisActive) {
      return;
    }

    if (!this.aiWorkers || this.aiWorkers.length === 0) {
      this.initWorkerPool();
    }

    // Use worker 0 for analysis to avoid conflict with game search
    const worker = this.aiWorkers[0];
    const boardInt = aiEngine.convertBoardToInt(this.game.board);

    // Deep analysis depth
    const analysisDepth = this.game.analysisMode ? 12 : 8;

    worker.postMessage({
      type: 'analyze',
      data: {
        board: boardInt,
        color: this.game.turn,
        depth: analysisDepth,
        topMovesCount: 3,
      },
    });
  }

  public updateAnalysisUI(data: any): void {
    if (this.analysisUI) {
      this.analysisUI.update(data);
    }
  }

  public updateAnalysisStats(data: any): void {
    const engineInfo = document.getElementById('analysis-engine-info');
    if (engineInfo) {
      const depth = data.depth || 0;
      const maxDepth = data.maxDepth || 0;
      const nodes = data.nodes ? data.nodes.toLocaleString('de-DE') : 0;
      engineInfo.textContent = `Tiefe: ${depth}/${maxDepth} | Knoten: ${nodes}`;
    }
  }

  public highlightMove(move: any): void {
    if (!move || !move.from || !move.to) return;

    // Clear previous highlights
    document.querySelectorAll('.cell').forEach(cell => {
      cell.classList.remove('analysis-from', 'analysis-to');
    });

    // Highlight the from and to squares
    const fromCell = document.querySelector(
      `.cell[data-r="${move.from.r}"][data-c="${move.from.c}"]`
    );
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

  public getAlgebraicNotation(move: any): string {
    if (!move || !move.from || !move.to) return '??';
    const size = this.game.boardSize;
    const fromFile = String.fromCharCode(97 + move.from.c);
    const fromRank = size - move.from.r;
    const toFile = String.fromCharCode(97 + move.to.c);
    const toRank = size - move.to.r;
    return `${fromFile}${fromRank}-${toFile}${toRank}`;
  }
}
