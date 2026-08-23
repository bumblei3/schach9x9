/**
 * Lehrbuch-Modus (M3.4) — handkuratierte 9×9-Eröffnungslinien.
 *
 * Getrennt vom Vielfalt-Buch (OpeningBook): Diese Linien sind fest
 * vorgegeben, von Menschen gepflegt und dienen dem Lernen. Jede Linie
 * wird beim Import durch checkTextbookSolvability gegen die echte
 * Zuglogik geprüft — eine unlösbare Zeile ist ein Testfehler.
 */

import { BOARD_SIZE } from '../gameEngine.js';
import { RulesEngine } from '../RulesEngine.js';
import type { Piece } from '../types/game.js';

export interface TextbookLine {
  id: string;
  name: string;
  description: string;
  /** Koordinaten-Züge in Brett-Reihenfolge r,c (0-indexiert, Weiß beginnt) */
  moves: Array<{ from: { r: number; c: number }; to: { r: number; c: number } }>;
}

/** Startaufstellung wie Game.setupClassicBoard(): R N B A K C B N R */
export function createClassicStartBoard(): (Piece | null)[][] {
  const board: (Piece | null)[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill(null)
  );
  const pieces = ['r', 'n', 'b', 'a', 'k', 'c', 'b', 'n', 'r'] as const;
  for (let c = 0; c < BOARD_SIZE; c++) {
    board[1][c] = { type: 'p', color: 'black', hasMoved: false } as Piece;
    board[BOARD_SIZE - 2][c] = { type: 'p', color: 'white', hasMoved: false } as Piece;
    board[0][c] = { type: pieces[c], color: 'black', hasMoved: false } as Piece;
    board[BOARD_SIZE - 1][c] = { type: pieces[c], color: 'white', hasMoved: false } as Piece;
  }
  return board;
}

/**
 * Spielt alle Linien auf einem echten RulesEngine-Brett nach.
 * @returns Liste unspielbarer Züge (soll leer sein).
 */
export function checkTextbookSolvability(
  lines: TextbookLine[],
  isMoveLegal?: (
    _board: (Piece | null)[][],
    _from: { r: number; c: number },
    _to: { r: number; c: number },
    _turn: 'white' | 'black'
  ) => boolean
): Array<{ lineId: string; index: number }> {
  const illegal: Array<{ lineId: string; index: number }> = [];

  for (const line of lines) {
    const board = createClassicStartBoard();
    let turn: 'white' | 'black' = 'white';

    for (let i = 0; i < line.moves.length; i++) {
      const move = line.moves[i];
      const legal = isMoveLegal
        ? isMoveLegal(board, move.from, move.to, turn)
        : defaultIsLegal(board, move.from, move.to, turn);

      if (!legal) {
        illegal.push({ lineId: line.id, index: i });
        break;
      }

      // Apply move
      const moving = board[move.from.r][move.from.c];
      if (moving) moving.hasMoved = true;
      board[move.to.r][move.to.c] = moving;
      board[move.from.r][move.from.c] = null;
      turn = turn === 'white' ? 'black' : 'white';
    }
  }
  return illegal;
}

function defaultIsLegal(
  board: (Piece | null)[][],
  from: { r: number; c: number },
  to: { r: number; c: number },
  turn: 'white' | 'black'
): boolean {
  const piece = board[from.r][from.c];
  if (!piece || piece.color !== turn) return false;
  const rules = new RulesEngine({ board } as never);
  const moves = rules.getValidMoves(from.r, from.c, piece);
  return moves.some(m => m.r === to.r && m.c === to.c);
}

// ---------------------------------------------------------------------------
// Kuratierte Linien — klassische Entwicklungsideen auf 9×9:
// Zentrum besetzen, Leichtfiguren entwickeln, Königssicherheit via Rochade-
// Äquivalent (Kanzler/Erzbischof flankieren), Frühlingsangriff vermeiden.
// ---------------------------------------------------------------------------

export const TEXTBOOK_LINES: TextbookLine[] = [
  {
    id: 'tb_center_pawn',
    name: 'Lehrbuch 1: Das Zentrum',
    description: 'Besetze das Zentrum mit einem Bauernzug aus der Mitte.',
    moves: [
      { from: { r: 7, c: 4 }, to: { r: 5, c: 4 } }, // e-pawn zwei Felder
      { from: { r: 1, c: 4 }, to: { r: 3, c: 4 } }, // Schwarz hält dagegen
    ],
  },
  {
    id: 'tb_knight_out',
    name: 'Lehrbuch 2: Springer raus',
    description: 'Entwickle den Springer ins Spiel statt einen Randbauern.',
    moves: [
      { from: { r: 8, c: 1 }, to: { r: 6, c: 2 } }, // Sb1-c3-Äquivalent
      { from: { r: 0, c: 7 }, to: { r: 2, c: 6 } }, // Schwarz entwickelt ebenfalls
    ],
  },
  {
    id: 'tb_bishop_line',
    name: 'Lehrbuch 3: Die Diagonale öffnen',
    description: 'Ein Bauernzug, der die Läufer-Diagonale freimacht.',
    moves: [
      { from: { r: 7, c: 3 }, to: { r: 6, c: 3 } }, // d-Bauer ein Feld vor
      { from: { r: 1, c: 2 }, to: { r: 2, c: 2 } },
    ],
  },
  {
    id: 'tb_bishop_develop',
    name: 'Lehrbuch 3b: Läufer freispielen',
    description: 'Erst Bauernzug, dann Läufer auf die offene Diagonale.',
    moves: [
      { from: { r: 7, c: 3 }, to: { r: 6, c: 3 } }, // d-Bauer ein Feld
      { from: { r: 1, c: 6 }, to: { r: 2, c: 6 } },
      { from: { r: 8, c: 2 }, to: { r: 7, c: 3 } }, // Läufer auf die offene Diagonale
      { from: { r: 1, c: 0 }, to: { r: 2, c: 0 } },
    ],
  },
  {
    id: 'tb_early_queen_warn',
    name: 'Lehrbuch 4: Frühangriff vermeiden',
    description: 'Warum die Dame nicht früh herauskommen sollte — Entwicklung zuerst.',
    moves: [
      { from: { r: 7, c: 4 }, to: { r: 5, c: 4 } },
      { from: { r: 1, c: 0 }, to: { r: 3, c: 0 } },
      { from: { r: 8, c: 1 }, to: { r: 6, c: 2 } }, // Springer entwickeln statt Dame ziehen
      { from: { r: 1, c: 8 }, to: { r: 2, c: 8 } },
    ],
  },
  {
    id: 'tb_flank_pawn',
    name: 'Lehrbuch 5: Der Flanken-Bauer',
    description: 'Randbauern-Züge entwickeln nichts — hier zum Vergleich.',
    moves: [
      { from: { r: 7, c: 0 }, to: { r: 6, c: 0 } },
      { from: { r: 1, c: 4 }, to: { r: 3, c: 4 } },
      { from: { r: 7, c: 5 }, to: { r: 6, c: 5 } }, // Weiß zieht einen zweiten Bauern
      { from: { r: 3, c: 4 }, to: { r: 4, c: 4 } },
    ],
  },
  {
    id: 'tb_double_knight',
    name: 'Lehrbuch 6: Beide Springer',
    description: 'Beide Leichtfiguren kommen vor den Bauern.',
    moves: [
      { from: { r: 8, c: 1 }, to: { r: 6, c: 2 } },
      { from: { r: 0, c: 1 }, to: { r: 2, c: 2 } },
      { from: { r: 8, c: 7 }, to: { r: 6, c: 6 } },
      { from: { r: 0, c: 7 }, to: { r: 2, c: 6 } },
    ],
  },
];
