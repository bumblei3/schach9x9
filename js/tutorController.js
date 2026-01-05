import { debounce } from './utils.js';
import * as TacticsDetector from './tutor/TacticsDetector.js';
import * as MoveAnalyzer from './tutor/MoveAnalyzer.js';
import * as HintGenerator from './tutor/HintGenerator.js';

/**
 * Orchestrator for tutor-related logic, delegating to specialized sub-modules.
 */
export class TutorController {
  constructor(game) {
    this.game = game;
    // Debounce the heavy calculation part
    this.debouncedGetTutorHints = debounce(async () => {
      this.game.bestMoves = await this.getTutorHints();
    }, 300);
  }

  updateBestMoves() {
    return HintGenerator.updateBestMoves(this.game, this);
  }

  isTutorMove(from, to) {
    return HintGenerator.isTutorMove(this.game, from, to);
  }

  getTutorHints() {
    return HintGenerator.getTutorHints(this.game, this);
  }

  getMoveNotation(move) {
    return MoveAnalyzer.getMoveNotation(this.game, move);
  }

  showTutorSuggestions() {
    return HintGenerator.showTutorSuggestions(this.game);
  }

  async showHint() {
    // Force calculation if no hints available (e.g. initialization or race condition)
    if (!this.game.bestMoves || this.game.bestMoves.length === 0) {
      this.game.bestMoves = await this.getTutorHints();
    }
    this.showTutorSuggestions();
  }

  getPieceName(type) {
    return MoveAnalyzer.getPieceName(type);
  }

  getThreatenedPieces(pos, attackerColor) {
    return TacticsDetector.getThreatenedPieces(this.game, this, pos, attackerColor);
  }

  detectTacticalPatterns(move) {
    return TacticsDetector.detectTacticalPatterns(this.game, this, move);
  }

  detectPins(pos, attackerColor) {
    return TacticsDetector.detectPins(this.game, this, pos, attackerColor);
  }

  detectDiscoveredAttacks(from, to, attackerColor) {
    return TacticsDetector.detectDiscoveredAttacks(this.game, this, from, to, attackerColor);
  }

  canPieceMove(type, dr, dc) {
    return TacticsDetector.canPieceMove(type, dr, dc);
  }

  detectThreatsAfterMove(move) {
    return TacticsDetector.detectThreatsAfterMove(this.game, this, move);
  }

  countDefenders(r, c, defenderColor) {
    return TacticsDetector.countDefenders(this.game, r, c, defenderColor);
  }

  countAttackers(r, c, attackerColor) {
    return TacticsDetector.countAttackers(this.game, r, c, attackerColor);
  }

  getDefendedPieces(pos, defenderColor) {
    return TacticsDetector.getDefendedPieces(this.game, this, pos, defenderColor);
  }

  analyzeStrategicValue(move) {
    return MoveAnalyzer.analyzeStrategicValue(this.game, move);
  }

  getScoreDescription(score) {
    return MoveAnalyzer.getScoreDescription(score);
  }

  analyzeMoveWithExplanation(move, score, bestScore) {
    return MoveAnalyzer.analyzeMoveWithExplanation(this.game, move, score, bestScore);
  }

  handlePlayerMove(from, to) {
    return MoveAnalyzer.handlePlayerMove(this.game, this, from, to);
  }

  checkBlunder(moveRecord) {
    return MoveAnalyzer.checkBlunder(this.game, this, moveRecord);
  }

  showBlunderWarning(analysis) {
    return MoveAnalyzer.showBlunderWarning(this.game, analysis);
  }

  getSetupTemplates() {
    return HintGenerator.getSetupTemplates(this.game);
  }

  applySetupTemplate(templateId) {
    return HintGenerator.applySetupTemplate(this.game, this, templateId);
  }

  placePiece(r, c, type, isWhite) {
    return HintGenerator.placePiece(this.game, r, c, type, isWhite);
  }

  analyzePlayerMovePreExecution(move) {
    return MoveAnalyzer.analyzePlayerMovePreExecution(this.game, move);
  }
}
