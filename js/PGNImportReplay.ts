/**
 * PGN Import & Replay Module for Schach 9x9
 * Imports PGN files/strings and provides replay functionality
 */

import { logger } from './logger.js';
import { PGNParser, PGNGame, PGNHistoryEntry } from './utils/PGNParser.js';

/**
 * Minimal engine interface for PGN replay
 */
interface PgnEngine {
  turn: string;
  boardSize: number;
  board: Array<Array<{ type: string; color: string; hasMoved: boolean } | null>>;
  getAllLegalMoves: () => { from: { r: number; c: number }; to: { r: number; c: number }; promotion?: string }[];
  getBoardHash: () => string;
  executeMove: (_from: { r: number; c: number }, _to: { r: number; c: number }) => void;
}

/**
 * Imports a PGN file/string and converts it to a replayable game state
 */
export interface PGNImportResult {
  success: boolean;
  game: PGNGame | null;
  history: PGNHistoryEntry[];
  error?: string;
}

/**
 * PGN Import & Replay Manager
 */
export class PGNImportReplay {
  private parser: PGNParser;
  private currentGame: PGNGame | null = null;
  private history: PGNHistoryEntry[] = [];
  private currentMoveIndex: number = -1;

  constructor() {
    this.parser = new PGNParser();
  }

  /**
   * Import PGN from string
   * @param pgnString - PGN string from file
   * @returns Import result with parsed game and replay history
   */
  importPGN(pgnString: string): PGNImportResult {
    try {
      const games = this.parser.parse(pgnString);

      if (games.length === 0) {
        return { success: false, game: null, history: [], error: 'No games found in PGN' };
      }

      this.currentGame = games[0]; // Use first game for now

      // Create a minimal engine for replay
      const mockEngine = this.createMockEngine();

      // Generate replay history
      this.history = this.parser.replayGame(this.currentGame.moves, mockEngine);
      this.currentMoveIndex = -1;

      return {
        success: true,
        game: this.currentGame,
        history: this.history
      };
    } catch (err) {
      logger.error('[PGNImportReplay] Import failed:', err);
      return {
        success: false,
        game: null,
        history: [],
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }

  /**
   * Import PGN from file
   * @param file - File object from file input
   * @returns Promise with import result
   */
  async importPGNFile(file: File): Promise<PGNImportResult> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const text = e.target?.result as string;
        resolve(this.importPGN(text));
      };
      reader.onerror = () => resolve({
        success: false,
        game: null,
        history: [],
        error: 'Failed to read file'
      });
      reader.readAsText(file);
    });
  }

  /**
   * Creates a mock engine for PGN replay
   */
  private createMockEngine(): PgnEngine {
    // Minimal engine that can replay moves
    type PieceWithHasMoved = { type: string; color: string; hasMoved: boolean } | null;

    const board: PieceWithHasMoved[][] = Array(9).fill(null).map(() => Array(9).fill(null));

    // Setup initial position
    const whiteBack = ['r', 'n', 'b', 'a', 'k', 'c', 'b', 'n', 'r'];
    const whitePawns = Array(9).fill('p');
    const blackBack = ['R', 'N', 'B', 'A', 'K', 'C', 'B', 'N', 'R'];
    const blackPawns = Array(9).fill('P');

    blackBack.forEach((piece: string, c: number) => { board[0][c] = { type: piece.toLowerCase(), color: 'black', hasMoved: false }; });
    blackPawns.forEach((_piece: string, c: number) => { board[1][c] = { type: 'p', color: 'black', hasMoved: false }; });
    whitePawns.forEach((piece: string, c: number) => { board[7][c] = { type: piece, color: 'white', hasMoved: false }; });
    whiteBack.forEach((piece: string, c: number) => { board[8][c] = { type: piece, color: 'white', hasMoved: false }; });

    return {
      turn: 'white',
      boardSize: 9,
      board,
      getAllLegalMoves: (): { from: { r: number; c: number }; to: { r: number; c: number }; promotion?: string }[] => {
        // Simplified - just return all possible moves for basic replay
        return [];
      },
      getBoardHash: (): string => '',
      executeMove: (_from: { r: number; c: number }, _to: { r: number; c: number }): void => {
        // Simplified move execution
      }
    };
  }

  /**
   * Get current move index
   */
  getCurrentMoveIndex(): number {
    return this.currentMoveIndex;
  }

  /**
   * Get total moves
   */
  getTotalMoves(): number {
    return this.history.length;
  }

  /**
   * Can go to next move
   */
  get canGoNext(): boolean {
    return this.currentMoveIndex < this.history.length - 1;
  }

  /**
   * Can go to previous move
   */
  get canGoPrev(): boolean {
    return this.currentMoveIndex >= 0;
  }

  /**
   * Go to specific move
   * @param moveIndex - Move index to jump to
   * @returns Updated game state info
   */
  goToMove(moveIndex: number): {
    history: PGNHistoryEntry[];
    currentIndex: number;
    totalMoves: number;
    canGoNext: boolean;
    canGoPrev: boolean;
  } {
    moveIndex = Math.max(-1, Math.min(moveIndex, this.history.length - 1));
    this.currentMoveIndex = moveIndex;

    return {
      history: this.history.slice(0, this.currentMoveIndex + 1),
      currentIndex: this.currentMoveIndex,
      totalMoves: this.history.length,
      canGoNext: this.currentMoveIndex < this.history.length - 1,
      canGoPrev: this.currentMoveIndex >= 0
    };
  }

  /**
   * Go to first move
   */
  goToFirst(): { history: PGNHistoryEntry[]; currentIndex: number; totalMoves: number; canGoNext: boolean; canGoPrev: boolean } {
    return this.goToMove(0);
  }

  /**
   * Go to last move
   */
  goToLast(): { history: PGNHistoryEntry[]; currentIndex: number; totalMoves: number; canGoNext: boolean; canGoPrev: boolean } {
    return this.goToMove(this.history.length - 1);
  }

  /**
   * Go to next move
   */
  goToNext(): { history: PGNHistoryEntry[]; currentIndex: number; totalMoves: number; canGoNext: boolean; canGoPrev: boolean } {
    return this.goToMove(this.currentMoveIndex + 1);
  }

  /**
   * Go to previous move
   */
  goToPrev(): { history: PGNHistoryEntry[]; currentIndex: number; totalMoves: number; canGoNext: boolean; canGoPrev: boolean } {
    return this.goToMove(this.currentMoveIndex - 1);
  }

  /**
   * Get current PGN history
   */
  getHistory(): PGNHistoryEntry[] {
    return this.history;
  }

  /**
   * Get current game info
   */
  getGameInfo(): PGNGame | null {
    return this.currentGame;
  }

  /**
   * Get PGN move list with annotations for UI
   */
  getMoveListWithAnnotations(): Array<{
    moveNumber: number;
    white: string;
    black: string;
    annotations?: { quality?: string; eval?: string; time?: string; pv?: string };
  }> {
    if (!this.currentGame) return [];

    const moves: Array<{
      moveNumber: number;
      white: string;
      black: string;
      annotations?: { quality?: string; eval?: string; time?: string; pv?: string };
    }> = [];

    let moveNumber = 1;

    for (let i = 0; i < this.currentGame.moves.length; i++) {
      const san = this.currentGame.moves[i];

      if (i % 2 === 0) {
        moves.push({
          moveNumber: moveNumber++,
          white: san,
          black: '',
          annotations: {}
        });
      } else {
        if (moves.length > 0) {
          moves[moves.length - 1].black = san;
        }
      }
    }

    return moves;
  }

  /**
   * Reset to start
   */
  reset(): void {
    this.currentMoveIndex = -1;
  }

  /**
   * Export current state as PGN string
   */
  exportPGN(): string {
    if (!this.currentGame) return '';

    const headers = [
      `[Event "${this.currentGame.headers.Event || 'Imported Game'}"]`,
      `[Site "${this.currentGame.headers.Site || 'Local'}"]`,
      `[Date "${new Date().toISOString().split('T')[0]}"]`,
      `[Round "${this.currentGame.headers.Round || '1'}"]`,
      `[White "${this.currentGame.headers.White || 'Player'}"]`,
      `[Black "${this.currentGame.headers.Black || 'Player'}"]`,
      `[Result "${this.currentGame.headers.Result || '*'}"]`,
    ];

    let moveText = '';
    let moveNumber = 1;

    for (let i = 0; i < this.currentGame.moves.length; i++) {
      if (i % 2 === 0) {
        moveText += `${moveNumber}. ${this.currentGame.moves[i]} `;
      } else {
        moveText += `${this.currentGame.moves[i]} `;
        moveNumber++;
      }
    }

    return headers.join('\n') + '\n\n' + moveText.trim();
  }
}

/**
 * PGN Import UI Controller
 * Handles file input, drag & drop, and replay UI
 */
export class PGNImportUI {
  private importer: PGNImportReplay;
  private fileInput: HTMLInputElement | null = null;
  private dropZone: HTMLElement | null = null;
  private replayControls: HTMLElement | null = null;
  private moveListContainer: HTMLElement | null = null;
  private onPGNLoaded?: (_importer: PGNImportReplay) => void;

  constructor() {
    this.importer = new PGNImportReplay();
  }

  /**
   * Initialize UI elements
   */
  init(
    fileInputId: string = 'pgn-file-input',
    dropZoneId: string = 'pgn-drop-zone',
    replayControlsId: string = 'pgn-replay-controls',
    moveListId: string = 'pgn-move-list',
    _onPGNLoaded?: (_importer: PGNImportReplay) => void
  ): void {
    this.fileInput = document.getElementById(fileInputId) as HTMLInputElement;
    this.dropZone = document.getElementById(dropZoneId);
    this.replayControls = document.getElementById(replayControlsId) as HTMLElement;
    this.moveListContainer = document.getElementById(moveListId) as HTMLElement;
    this.onPGNLoaded = _onPGNLoaded;

    if (this.fileInput) {
      this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }

    if (this.dropZone) {
      this.dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
      this.dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
      this.dropZone.addEventListener('drop', (e) => this.handleDrop(e));
    }

    this.setupReplayControls();
  }

  private handleFileSelect(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.loadPGNFile(input.files[0]);
    }
  }

  private handleDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.dropZone?.classList.add('drag-over');
  }

  private handleDragLeave(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.dropZone?.classList.remove('drag-over');
  }

  private handleDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.dropZone?.classList.remove('drag-over');

    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      this.loadPGNFile(e.dataTransfer.files[0]);
    }
  }

  private async loadPGNFile(file: File): Promise<void> {
    if (!file.name.endsWith('.pgn') && !file.name.endsWith('.txt')) {
      alert('Bitte eine .pgn oder .txt Datei auswählen');
      return;
    }

    try {
      const result = await this.importer.importPGNFile(file);

      if (result.success) {
        this.showReplayControls();
        this.renderMoveList();
        this.onPGNLoaded?.(this.importer);
      } else {
        alert(`Fehler beim Import: ${result.error}`);
      }
    } catch (err) {
      logger.error('[PGNImportUI] Load failed:', err);
      alert('Fehler beim Laden der PGN Datei');
    }
  }

  private showReplayControls(): void {
    if (this.replayControls) {
      this.replayControls.classList.remove('hidden');
      this.updateReplayButtons();
    }
  }

  private setupReplayControls(): void {
    const firstBtn = document.getElementById('pgn-first-btn');
    const prevBtn = document.getElementById('pgn-prev-btn');
    const nextBtn = document.getElementById('pgn-next-btn');
    const lastBtn = document.getElementById('pgn-last-btn');
    const moveInput = document.getElementById('pgn-move-input') as HTMLInputElement;
    const gotoBtn = document.getElementById('pgn-goto-btn');

    firstBtn?.addEventListener('click', () => this.goToFirst());
    prevBtn?.addEventListener('click', () => this.goToPrev());
    nextBtn?.addEventListener('click', () => this.goToNext());
    lastBtn?.addEventListener('click', () => this.goToLast());

    gotoBtn?.addEventListener('click', () => {
      const moveNum = parseInt(moveInput?.value || '1');
      if (!isNaN(moveNum)) this.goToMove(moveNum);
    });

    moveInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const moveNum = parseInt(moveInput.value);
        if (!isNaN(moveNum)) this.goToMove(moveNum);
      }
    });
  }

  private goToFirst(): void {
    const state = this.importer.goToFirst();
    this.updateReplayButtons();
    this.updateMoveListHighlight(state.currentIndex);
  }

  private goToPrev(): void {
    const state = this.importer.goToPrev();
    this.updateReplayButtons();
    this.updateMoveListHighlight(state.currentIndex);
  }

  private goToNext(): void {
    const state = this.importer.goToNext();
    this.updateReplayButtons();
    this.updateMoveListHighlight(state.currentIndex);
  }

  private goToLast(): void {
    const state = this.importer.goToLast();
    this.updateReplayButtons();
    this.updateMoveListHighlight(state.currentIndex);
  }

  private goToMove(moveNum: number): void {
    const state = this.importer.goToMove(moveNum - 1); // 1-based input
    this.updateReplayButtons();
    this.updateMoveListHighlight(state.currentIndex);
  }

  private updateReplayButtons(): void {
    const firstBtn = document.getElementById('pgn-first-btn') as HTMLButtonElement;
    const prevBtn = document.getElementById('pgn-prev-btn') as HTMLButtonElement;
    const nextBtn = document.getElementById('pgn-next-btn') as HTMLButtonElement;
    const lastBtn = document.getElementById('pgn-last-btn') as HTMLButtonElement;
    const moveInput = document.getElementById('pgn-move-input') as HTMLInputElement;

    if (firstBtn) firstBtn.disabled = !this.importer.canGoPrev;
    if (prevBtn) prevBtn.disabled = !this.importer.canGoPrev;
    if (nextBtn) nextBtn.disabled = !this.importer.canGoNext;
    if (lastBtn) lastBtn.disabled = !this.importer.canGoNext;

    if (moveInput) {
      moveInput.max = String(this.importer.getTotalMoves());
      moveInput.value = String(this.importer.getCurrentMoveIndex() + 1);
    }
  }

  private renderMoveList(): void {
    if (!this.moveListContainer) return;

    const moveList = this.importer.getMoveListWithAnnotations();

    this.moveListContainer!.innerHTML = moveList.map((m, index) => `
      <div class="pgn-move-item" data-index="${index}" style="padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; gap: 1rem;">
        <span class="move-number" style="font-weight: bold; min-width: 3rem;">${m.moveNumber}.</span>
        <span class="white-move" style="flex: 1;">${m.white}</span>
        <span class="black-move" style="flex: 1;">${m.black}</span>
      </div>
    `).join('');

    // Add click handlers
    this.moveListContainer?.querySelectorAll('.pgn-move-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        this.importer.goToMove(index);
        this.updateReplayButtons();
        this.updateMoveListHighlight(index);
      });
    });
  }

  private updateMoveListHighlight(activeIndex: number): void {
    this.moveListContainer?.querySelectorAll<HTMLElement>('.pgn-move-item').forEach((item, index) => {
      if (index === activeIndex) {
        item.classList.add('active');
        item.style.background = 'rgba(99, 102, 241, 0.2)';
      } else {
        item.classList.remove('active');
        item.style.background = '';
      }
    });
  }
}
