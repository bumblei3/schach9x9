import { debounce } from './utils.js';
import * as TacticsDetector from './tutor/TacticsDetector.js';
import * as MoveAnalyzer from './tutor/MoveAnalyzer.js';
import * as HintGenerator from './tutor/HintGenerator.js';

/**
 * Orchestrator for tutor-related logic, delegating to specialized sub-modules.
 */
export class TutorController {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public game: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public debouncedGetTutorHints: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(game: any) {
    this.game = game;
    // Debounce the heavy calculation part
    this.debouncedGetTutorHints = debounce(async () => {
      this.game.bestMoves = await this.getTutorHints();
    }, 300);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public updateBestMoves(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (HintGenerator as any).updateBestMoves(this.game, this);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public isTutorMove(from: any, to: any): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (HintGenerator as any).isTutorMove(this.game, from, to);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getTutorHints(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (HintGenerator as any).getTutorHints(this.game, this);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getMoveNotation(move: any): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (MoveAnalyzer as any).getMoveNotation(this.game, move);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async showTutorSuggestions(): Promise<any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (HintGenerator as any).showTutorSuggestions(this.game);
  }

  public async showHint(): Promise<void> {
    // Force calculation if no hints available (e.g. initialization or race condition)
    if (!this.game.bestMoves || this.game.bestMoves.length === 0) {
      this.game.bestMoves = await this.getTutorHints();
    }
    await this.showTutorSuggestions();
  }

  public getPieceName(type: string): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (MoveAnalyzer as any).getPieceName(type);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getThreatenedPieces(pos: any, attackerColor: string): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (TacticsDetector as any).getThreatenedPieces(this.game, this, pos, attackerColor);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public detectTacticalPatterns(move: any): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (TacticsDetector as any).detectTacticalPatterns(this.game, this, move);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public detectPins(pos: any, attackerColor: string): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (TacticsDetector as any).detectPins(this.game, this, pos, attackerColor);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public detectDiscoveredAttacks(from: any, to: any, attackerColor: string): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (TacticsDetector as any).detectDiscoveredAttacks(
      this.game,
      this,
      from,
      to,
      attackerColor
    );
  }

  public canPieceMove(type: string, dr: number, dc: number): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (TacticsDetector as any).canPieceMove(type, dr, dc);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public detectThreatsAfterMove(move: any): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (TacticsDetector as any).detectThreatsAfterMove(this.game, this, move);
  }

  public countDefenders(r: number, c: number, defenderColor: string): number {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (TacticsDetector as any).countDefenders(this.game, r, c, defenderColor);
  }

  public countAttackers(r: number, c: number, attackerColor: string): number {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (TacticsDetector as any).countAttackers(this.game, r, c, attackerColor);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getDefendedPieces(pos: any, defenderColor: string): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (TacticsDetector as any).getDefendedPieces(this.game, this, pos, defenderColor);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public analyzeStrategicValue(move: any): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (MoveAnalyzer as any).analyzeStrategicValue(this.game, move);
  }

  public getScoreDescription(score: number): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (MoveAnalyzer as any).getScoreDescription(score);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public analyzeMoveWithExplanation(move: any, score: number, bestScore: number): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (MoveAnalyzer as any).analyzeMoveWithExplanation(this.game, move, score, bestScore);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public handlePlayerMove(from: any, to: any): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (MoveAnalyzer as any).handlePlayerMove(this.game, this, from, to);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public checkBlunder(moveRecord: any): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (MoveAnalyzer as any).checkBlunder(this.game, this, moveRecord);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public showBlunderWarning(analysis: any, callback: () => void): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (MoveAnalyzer as any).showBlunderWarning(this.game, analysis, callback);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getSetupTemplates(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (HintGenerator as any).getSetupTemplates(this.game);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public applySetupTemplate(templateId: string): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (HintGenerator as any).applySetupTemplate(this.game, this, templateId);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public placePiece(r: number, c: number, type: string, isWhite: boolean): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (HintGenerator as any).placePiece(this.game, r, c, type, isWhite);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public analyzePlayerMovePreExecution(move: any): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (MoveAnalyzer as any).analyzePlayerMovePreExecution(this.game, move);
  }
}
