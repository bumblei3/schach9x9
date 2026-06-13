/**
 * AI Personality definitions - shared between aiController and aiEngine
 * Separate file to avoid circular imports
 */

import { PHASES } from '../config';

export interface AIPersonality {
  id: string;
  name: string;
  // Evaluation weights
  mobilityWeight: number;
  safetyWeight: number;
  pawnStructureWeight: number;
  centerControlWeight: number;
  attackWeight: number;
  // Search behavior modifiers
  aggressionLevel: number;        // 0.5-2.0: affects aspiration windows, pruning thresholds
  timeManagementFactor: number;   // 0.5-2.0: multiplies allocated time per move
  riskTolerance: number;          // 0.0-1.0: willingness to play sharp/complex lines
  // Maps to WASM Personality enum
  wasmPersonality: 'AGGRESSIVE' | 'SOLID' | 'GENTLE' | 'NORMAL';
}

export const AI_PERSONALITIES: Record<string, AIPersonality> = {
  balanced: {
    id: 'BALANCED',
    name: 'Ausgewogen',
    mobilityWeight: 1.0,
    safetyWeight: 1.0,
    pawnStructureWeight: 1.0,
    centerControlWeight: 1.0,
    attackWeight: 1.0,
    aggressionLevel: 1.0,
    timeManagementFactor: 1.0,
    riskTolerance: 0.5,
    wasmPersonality: 'NORMAL',
  },
  aggressive: {
    id: 'AGGRESSIVE',
    name: 'Aggressiv',
    mobilityWeight: 1.2,
    safetyWeight: 0.8,
    pawnStructureWeight: 0.9,
    centerControlWeight: 1.2,
    attackWeight: 1.5,
    aggressionLevel: 1.5,
    timeManagementFactor: 1.2,
    riskTolerance: 0.8,
    wasmPersonality: 'AGGRESSIVE',
  },
  defensive: {
    id: 'DEFENSIVE',
    name: 'Defensiv',
    mobilityWeight: 0.8,
    safetyWeight: 1.5,
    pawnStructureWeight: 1.2,
    centerControlWeight: 1.0,
    attackWeight: 0.7,
    aggressionLevel: 0.6,
    timeManagementFactor: 1.1,
    riskTolerance: 0.2,
    wasmPersonality: 'SOLID',
  },
  positional: {
    id: 'POSITIONAL',
    name: 'Positionell',
    mobilityWeight: 1.0,
    safetyWeight: 1.1,
    pawnStructureWeight: 1.5,
    centerControlWeight: 1.4,
    attackWeight: 0.9,
    aggressionLevel: 0.8,
    timeManagementFactor: 1.0,
    riskTolerance: 0.3,
    wasmPersonality: 'SOLID',
  },
  trapper: {
    id: 'TRAPPER',
    name: 'Der Fallensteller',
    mobilityWeight: 0.7,
    safetyWeight: 1.3,
    pawnStructureWeight: 1.1,
    centerControlWeight: 0.9,
    attackWeight: 1.6,
    aggressionLevel: 1.3,
    timeManagementFactor: 1.3,
    riskTolerance: 0.9,
    wasmPersonality: 'AGGRESSIVE',
  },
};