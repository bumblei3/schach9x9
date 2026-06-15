import { debounce } from './utils.js';
import {
  detectTacticalPatterns,
  detectPins,
  detectDiscoveredAttacks,
  canPieceMove,
  detectThreatsAfterMove,
  countDefenders,
  countAttackers,
  getThreatenedPieces,
  getDefendedPieces,
  type Analyzer,
} from './tutor/TacticsDetector.js';
import {
  getMoveNotation,
  getPieceName,
  analyzeStrategicValue,
  getScoreDescription,
  analyzeMoveWithExplanation,
  handlePlayerMove,
  checkBlunder,
  showBlunderWarning,
  analyzePlayerMovePreExecution,
} from './tutor/MoveAnalyzer.js';
import {
  updateBestMoves,
  isTutorMove,
  getTutorHints,
  showTutorSuggestions,
  getSetupTemplates,
  applySetupTemplate,
  placePiece,
} from './tutor/HintGenerator.js';
import type { Game } from './gameEngine.js';
import type { MoveInfo, MoveExplanation, MoveRecord, SetupTemplate } from './tutor/MoveAnalyzer.js';

interface TutorControllerLike {
  showBlunderWarning(_analysis: MoveExplanation, _callback: () => void): void;
  getSetupTemplates(): SetupTemplate[];
  handlePlayerMove(_from: { r: number; c: number }, _to: { r: number; c: number }): void;
  analyzePlayerMovePreExecution(_move: { from: { r: number; c: number }; to: { r: number; c: number } }): Promise<MoveInfo | null>;
}

interface ScoreDescription {
  label: string;
  color: string;
  emoji: string;
}

/**
 * Orchestrator for tutor-related logic, delegating to specialized sub-modules.
 */
export class TutorController implements TutorControllerLike {
  public game: Game;
  public debouncedGetTutorHints: () => void;

  constructor(game: Game) {
    this.game = game;
    // Debounce the heavy calculation part
    this.debouncedGetTutorHints = debounce(async () => {
      this.game.bestMoves = (await getTutorHints(this.game, this)) as Game['bestMoves'];
      await showTutorSuggestions(this.game);
    }, 300);
  }

  public updateBestMoves(): void {
    return updateBestMoves(this.game, this);
  }

  public isTutorMove(from: { r: number; c: number }, to: { r: number; c: number }): boolean {
    return isTutorMove(this.game, from, to);
  }

  public async getTutorHints(): Promise<unknown[]> {
    return getTutorHints(this.game, this);
  }

  public getMoveNotation(move: unknown): string {
    return getMoveNotation(
      this.game,
      move as { from: { r: number; c: number }; to: { r: number; c: number } }
    );
  }

  public async showTutorSuggestions(): Promise<void> {
    return showTutorSuggestions(this.game);
  }

  public async showHint(): Promise<void> {
    // Force calculation if no hints available
    if (!this.game.bestMoves || this.game.bestMoves.length === 0) {
      this.game.bestMoves = (await this.getTutorHints()) as Game['bestMoves'];
    }
    await this.showTutorSuggestions();
  }

  public getPieceName(type: string): string {
    return getPieceName(type);
  }

  public getThreatenedPieces(pos: { r: number; c: number }, attackerColor: string): unknown {
    return getThreatenedPieces(this.game, this as unknown as Analyzer, pos, attackerColor);
  }

  public detectTacticalPatterns(move: unknown): unknown[] {
    return detectTacticalPatterns(
      this.game,
      this as unknown as Analyzer,
      move as { from: { r: number; c: number }; to: { r: number; c: number } }
    );
  }

  public detectPins(pos: { r: number; c: number }, attackerColor: string): unknown[] {
    return detectPins(this.game, this as unknown as Analyzer, pos, attackerColor);
  }

  public detectDiscoveredAttacks(
    from: { r: number; c: number },
    to: { r: number; c: number },
    attackerColor: string
  ): unknown[] {
    return detectDiscoveredAttacks(this.game, this as unknown as Analyzer, from, to, attackerColor);
  }

  public canPieceMove(type: string, dr: number, dc: number): boolean {
    return canPieceMove(type, dr, dc);
  }

  public detectThreatsAfterMove(move: unknown): unknown[] {
    return detectThreatsAfterMove(
      this.game,
      this as unknown as Analyzer,
      move as { from: { r: number; c: number }; to: { r: number; c: number } }
    );
  }

  public countDefenders(r: number, c: number, defenderColor: string): number {
    return countDefenders(this.game, r, c, defenderColor);
  }

  public countAttackers(r: number, c: number, attackerColor: string): number {
    return countAttackers(this.game, r, c, attackerColor);
  }

  public getDefendedPieces(pos: { r: number; c: number }, defenderColor: string): unknown {
    return getDefendedPieces(this.game, this, pos, defenderColor);
  }

  public analyzeStrategicValue(move: unknown): unknown[] {
    return analyzeStrategicValue(
      this.game,
      move as { from: { r: number; c: number }; to: { r: number; c: number } }
    );
  }

  public getScoreDescription(score: number): ScoreDescription {
    return getScoreDescription(score);
  }

  public analyzeMoveWithExplanation(move: unknown, score: number, bestScore: number): unknown {
    return analyzeMoveWithExplanation(this.game, move as MoveInfo, score, bestScore);
  }

  public handlePlayerMove(from: { r: number; c: number }, to: { r: number; c: number }): void {
    return handlePlayerMove(this.game, this, from, to);
  }

  public checkBlunder(moveRecord: unknown): Promise<void> {
    return checkBlunder(this.game, this, moveRecord as MoveRecord);
  }

  public showBlunderWarning(analysis: unknown, callback: () => void): void {
    return showBlunderWarning(this.game as Game & { moveController?: { undoMove: () => void }; undoMove?: () => void; lastEval?: number }, analysis as MoveExplanation, callback);
  }

  public getSetupTemplates(): unknown[] {
    return getSetupTemplates(this.game);
  }

  public applySetupTemplate(templateId: string): void {
    return applySetupTemplate(this.game, this, templateId);
  }

  public placePiece(r: number, c: number, type: string, isWhite: boolean): void {
    return placePiece(this.game, r, c, type, isWhite);
  }

  public analyzePlayerMovePreExecution(move: {
    from: { r: number; c: number };
    to: { r: number; c: number };
  }): Promise<unknown> {
    return analyzePlayerMovePreExecution(this.game, move);
  }
}
