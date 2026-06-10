/**
 * Zentrale Spielkonstanten
 * Magic Numbers aus dem gesamten Codebase hier konsolidieren.
 */

// ===== AI / Draw Logic =====

/** Schwellenwerte für KI-Remis-Angebot (in Centipawns) */
export const DRAW_OFFER_THRESHOLD_LOW = -300;
export const DRAW_OFFER_THRESHOLD_HIGH = -100;

/** Minimale Zuganzahl bevor KI Remis anbieten kann */
export const DRAW_OFFER_MIN_MOVES = 20;

/** Schwellenwerte für KI-Remis-Akzeptanz */
export const DRAW_ACCEPT_SCORE_MAX = 50;       // Math.abs(score) < 50
export const DRAW_ACCEPT_MOVES_MIN = 40;       // moveHistory.length > 40

/** Half-Move-Clock Wert, ab dem KI Remis akzeptiert (50-Züge-Regel) */
export const HALF_MOVE_CLOCK_NEAR_50 = 80;

// ===== Evaluation =====

/** Maximaler Score für EvaluationBar (10 Bauern = 1000 Centipawns) */
export const EVAL_MAX_SCORE = 1000;

/** Score-Schwellenwert für "deutlich gewonnen" in der EvaluationBar */
export const EVAL_WINNING_THRESHOLD = 300;

// ===== Board =====

/** Standard-Zellengröße für ArrowRenderer (px) */
export const DEFAULT_CELL_SIZE = 64;

/** Arrow-Verkürzungsfaktor (25% kürzer an jedem Ende) */
export const ARROW_SHORTEN_FACTOR = 0.25;

// ===== Animation =====

/** Drag-Image Versteck-Offset (px) — negative Y-Position */
export const DRAG_IMAGE_HIDDEN_OFFSET = -1000;

// ===== Sound =====

/** Min/Max Werte für Lautstärke-Slider */
export const VOLUME_MIN = 0;
export const VOLUME_MAX = 100;
