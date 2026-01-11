/**
 * UI-related type definitions
 */

import type { Square, Piece, Move } from './game.js';

export interface ToastOptions {
    type: 'success' | 'error' | 'warning' | 'info';
    title?: string;
    duration?: number;
}

export interface ModalOptions {
    title: string;
    content: string;
    buttons?: ModalButton[];
    closable?: boolean;
    onClose?: () => void;
}

export interface ModalButton {
    text: string;
    variant?: 'primary' | 'secondary' | 'danger';
    onClick: () => void;
}

export interface BoardRendererOptions {
    showCoordinates?: boolean;
    showValidMoves?: boolean;
    showLastMove?: boolean;
    showThreats?: boolean;
    showOpportunities?: boolean;
    orientation?: 'white' | 'black';
    theme?: BoardTheme;
}

export type BoardTheme = 'classic' | 'blue' | 'green' | 'wooden' | 'dark';
export type PieceSkin = 'classic' | 'modern' | 'pixel' | 'medieval';

export interface DragState {
    isDragging: boolean;
    piece: Piece | null;
    fromSquare: Square | null;
    currentX: number;
    currentY: number;
}

export interface AnimationState {
    isAnimating: boolean;
    move: Move | null;
    progress: number;
    duration: number;
}

export interface OverlayState {
    isOpen: boolean;
    type: OverlayType;
    data?: unknown;
}

export type OverlayType =
    | 'menu'
    | 'settings'
    | 'help'
    | 'game-over'
    | 'promotion'
    | 'confirmation'
    | 'puzzle-complete'
    | 'analysis';

export interface SettingsState {
    soundEnabled: boolean;
    volume: number;
    theme: BoardTheme;
    pieceSkin: PieceSkin;
    showCoordinates: boolean;
    showValidMoves: boolean;
    autoQueen: boolean;
    mentorLevel: 'OFF' | 'STANDARD' | 'STRICT';
}
