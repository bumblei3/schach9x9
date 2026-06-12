/**
 * ArrowRenderer - Draws SVG arrows on the board for last move indication
 * Similar to Lichess/Chess.com last move arrows
 */

import type { Square } from '../types/game.js';

interface ArrowOptions {
  from: Square;
  to: Square;
  color: string;
  /** Arrow head size in px */
  headSize?: number;
  /** Stroke width in px */
  strokeWidth?: number;
  /** Whether to animate the arrow drawing */
  animate?: boolean;
}

/**
 * Draws an arrow from one square to another on the board
 * @param boardContainer - The board container element (#board-container)
 * @param options - Arrow drawing options
 * @returns SVGElement that was created (for later removal)
 */
export function drawArrow(
  boardContainer: HTMLElement,
  options: ArrowOptions
): SVGSVGElement {
  const {
    from,
    to,
    color = '#6366f1',
    headSize = 14,
    strokeWidth = 4,
    animate = true,
  } = options;

  // Remove existing arrows first
  clearArrows(boardContainer);

  // Get board element for coordinate calculations
  const boardEl = boardContainer.querySelector('#board') as HTMLElement;
  if (!boardEl) return null as any;

  // Get cell dimensions
  const fromCell = boardEl.querySelector(
    `.cell[data-r="${from.r}"][data-c="${from.c}"]`
  ) as HTMLElement;
  const toCell = boardEl.querySelector(
    `.cell[data-r="${to.r}"][data-c="${to.c}"]`
  ) as HTMLElement;

  if (!fromCell || !toCell) return null as any;

  // Calculate positions relative to board container
  const boardRect = boardEl.getBoundingClientRect();
  const containerRect = boardContainer.getBoundingClientRect();

  const fromRect = fromCell.getBoundingClientRect();
  const toRect = toCell.getBoundingClientRect();

  // Center points of squares (relative to board container)
  const fromX = fromRect.left + fromRect.width / 2 - containerRect.left;
  const fromY = fromRect.top + fromRect.height / 2 - containerRect.top;
  const toX = toRect.left + toRect.width / 2 - containerRect.left;
  const toY = toRect.top + toRect.height / 2 - containerRect.top;

  // Create SVG overlay
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('last-move-arrow');
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.pointerEvents = 'none';
  svg.style.zIndex = '10';
  svg.style.overflow = 'visible';

  // Calculate angle and distance
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx);
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Shorten the line so it doesn't cover the piece entirely
  const piecePadding = fromRect.width * 0.35;
  const startX = fromX + Math.cos(angle) * piecePadding;
  const startY = fromY + Math.sin(angle) * piecePadding;
  const endX = toX - Math.cos(angle) * piecePadding;
  const endY = toY - Math.sin(angle) * piecePadding;

  // Arrow path
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const pathD = `M ${startX} ${startY} L ${endX} ${endY}`;
  path.setAttribute('d', pathD);
  path.setAttribute('stroke', color);
  path.setAttribute('stroke-width', strokeWidth.toString());
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('fill', 'none');
  path.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))';

  // Arrow head (triangle at the end)
  const headAngle = angle;
  const headX1 = endX - Math.cos(headAngle - Math.PI / 6) * headSize;
  const headY1 = endY - Math.sin(headAngle - Math.PI / 6) * headSize;
  const headX2 = endX - Math.cos(headAngle + Math.PI / 6) * headSize;
  const headY2 = endY - Math.sin(headAngle + Math.PI / 6) * headSize;

  const head = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  head.setAttribute('points', `${endX},${endY} ${headX1},${headY1} ${headX2},${headY2}`);
  head.setAttribute('fill', color);
  head.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))';

  // Group for animation
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.appendChild(path);
  group.appendChild(head);
  svg.appendChild(group);

  // Animation: draw path from start to end
  if (animate) {
    const pathLength = path.getTotalLength();
    path.style.strokeDasharray = pathLength.toString();
    path.style.strokeDashoffset = pathLength.toString();
    path.style.transition = 'stroke-dashoffset 0.4s cubic-bezier(0.4, 0, 0.2, 1)';

    // Arrow head fade in
    head.style.opacity = '0';
    head.style.transition = 'opacity 0.2s ease 0.3s';

    // Trigger animation
    requestAnimationFrame(() => {
      path.style.strokeDashoffset = '0';
      setTimeout(() => {
        head.style.opacity = '1';
      }, 300);
    });
  }

  boardContainer.appendChild(svg);
  return svg;
}

/**
 * Clears all last-move arrows from the board container
 */
export function clearArrows(boardContainer: HTMLElement | null): void {
  if (!boardContainer || typeof boardContainer.querySelectorAll !== 'function') return;
  const arrows = boardContainer.querySelectorAll('.last-move-arrow');
  arrows.forEach((arrow) => arrow.remove());
}

/**
 * Updates the last move arrow - clears old and draws new
 */
export function updateLastMoveArrow(
  boardContainer: HTMLElement | null,
  lastMove: { from: Square; to: Square } | null,
  isPlayerMove: boolean = true
): void {
  if (!boardContainer || typeof boardContainer.querySelectorAll !== 'function') return;
  if (!lastMove) {
    clearArrows(boardContainer);
    return;
  }

  // Color based on who moved: green for player, orange/red for AI
  const color = isPlayerMove ? '#22c55e' : '#ef4444';

  drawArrow(boardContainer, {
    from: lastMove.from,
    to: lastMove.to,
    color,
    animate: true,
  });
}
