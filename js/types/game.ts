/**
 * Core game type definitions for Schach 9x9
 */

export type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p' | 'e' | 'a' | 'c' | null;

export type Player = 'white' | 'black';
export type GamePhase = 'SETUP' | 'PLAY' | 'END';
export type Board = (Piece | null)[][];
export type GameMode = 'setup' | 'classic' | 'puzzle' | 'campaign' | 'standard8x8';

export interface Square {
    r: number;
    c: number;
}

export interface Piece {
    type: Exclude<PieceType, null>;
    color: Player;
    hasMoved?: boolean;
}

export interface Move {
    from: Square;
    to: Square;
    piece: PieceType;
    captured?: PieceType;
    promotion?: PieceType;
    isCheck?: boolean;
    isCheckmate?: boolean;
    isCastling?: boolean;
    isEnPassant?: boolean;
}

export interface GameState {
    board: (Piece | null)[][];
    turn: Player;
    phase: GamePhase;
    mode: GameMode;
    moveHistory: Move[];
    selectedSquare: Square | null;
    validMoves: Square[];
    points: number;
    whiteKingPos: Square | null;
    blackKingPos: Square | null;
    isCheck: boolean;
    isCheckmate: boolean;
    isStalemate: boolean;
    halfMoveClock: number;
    fullMoveNumber: number;
}

export interface ShopItem {
    piece: PieceType;
    cost: number;
    available: boolean;
}

export interface CampaignLevel {
    id: string;
    name: string;
    description: string;
    unlocked: boolean;
    completed: boolean;
    stars: number;
    maxStars: number;
}

export interface PuzzleState {
    id: string;
    fen: string;
    solution: Move[];
    currentMoveIndex: number;
    solved: boolean;
    failed: boolean;
}

export interface Statistics {
    gamesPlayed: number;
    gamesWon: number;
    gamesLost: number;
    gamesDrawn: number;
    totalMoves: number;
    averageGameLength: number;
    puzzlesSolved: number;
    bestWinStreak: number;
    currentWinStreak: number;
}
