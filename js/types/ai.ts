/**
 * AI-related type definitions
 */

import type { Move, Square, GameState } from './game.js';

export interface AIConfig {
    depth: number;
    timeLimit: number;
    personality: AIPersonality;
    eloRating: number;
}

export type AIPersonality = 'balanced' | 'aggressive' | 'defensive' | 'tactical' | 'positional';

export interface SearchResult {
    bestMove: Move | null;
    score: number;
    depth: number;
    nodes: number;
    time: number;
    pv: Move[];
}

export interface EvaluationResult {
    score: number;
    breakdown: {
        material: number;
        position: number;
        mobility: number;
        kingSafety: number;
        pawnStructure: number;
    };
}

export interface TranspositionEntry {
    hash: bigint;
    depth: number;
    score: number;
    flag: 'EXACT' | 'LOWER' | 'UPPER';
    bestMove: Move | null;
    age: number;
}

export interface OpeningBookEntry {
    hash: string;
    moves: {
        move: Move;
        weight: number;
        games: number;
        winRate: number;
    }[];
}

export interface AnalysisLine {
    moves: Move[];
    score: number;
    depth: number;
    mate?: number;
}

export interface ThreatInfo {
    square: Square;
    attacker: Square;
    defender: Square | null;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface OpportunityInfo {
    square: Square;
    type: 'fork' | 'pin' | 'skewer' | 'discovered_attack' | 'hanging_piece';
    score: number;
}
