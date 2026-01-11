/**
 * Arrow Renderer for chess board
 * Draws SVG arrows to show move suggestions
 */
export class ArrowRenderer {
  public boardElement: HTMLElement;
  public cellSize: number;
  public svgLayer: SVGSVGElement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public lastArrows: any[] | null = null;

  constructor(boardElement: HTMLElement) {
    this.boardElement = boardElement;
    this.cellSize = 64; // Default initialization
    this.updateCellSize();
    this.svgLayer = this.createSVGLayer();
    this.createArrowheadMarkers();
  }

  public updateCellSize(): void {
    // Get cell size from the first cell or compute it
    const firstCell = this.boardElement.querySelector('.cell') as HTMLElement;
    if (firstCell) {
      this.cellSize = firstCell.offsetWidth;
    } else {
      // Fallback if no cells yet
      this.cellSize = 64;
    }
  }

  public createSVGLayer(): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'arrow-layer';
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.pointerEvents = 'none'; // Don't block clicks
    svg.style.zIndex = '5';

    // Make parent relative for absolute positioning
    const parent = this.boardElement.parentElement;
    if (parent) {
      parent.style.position = 'relative';
      parent.appendChild(svg);
    }

    return svg;
  }

  public createArrowheadMarkers(): void {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // Create markers for each quality level
    const colors: Record<string, string> = {
      gold: '#FFD700',
      silver: '#C0C0C0',
      bronze: '#CD7F32',
      red: '#ef4444',
      green: '#22c55e',
      orange: '#f59e0b',
    };

    Object.entries(colors).forEach(([name, color]) => {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', `arrowhead-${name}`);
      marker.setAttribute('markerWidth', '10');
      marker.setAttribute('markerHeight', '10');
      marker.setAttribute('refX', '9');
      marker.setAttribute('refY', '3');
      marker.setAttribute('orient', 'auto');

      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', '0 0, 10 3, 0 6');
      polygon.setAttribute('fill', color);

      marker.appendChild(polygon);
      defs.appendChild(marker);
    });

    this.svgLayer.appendChild(defs);
  }

  public drawArrow(
    fromR: number,
    fromC: number,
    toR: number,
    toC: number,
    colorKey: string = 'gold'
  ): void {
    // Calculate center positions of cells
    const fromX = fromC * this.cellSize + this.cellSize / 2;
    const fromY = fromR * this.cellSize + this.cellSize / 2;
    const toX = toC * this.cellSize + this.cellSize / 2;
    const toY = toR * this.cellSize + this.cellSize / 2;

    // Shorten arrow so it doesn't overlap pieces
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const shortenBy = this.cellSize * 0.25; // 25% shorter on each end

    const adjustedFromX = fromX + Math.cos(angle) * shortenBy;
    const adjustedFromY = fromY + Math.sin(angle) * shortenBy;
    const adjustedToX = toX - Math.cos(angle) * shortenBy;
    const adjustedToY = toY - Math.sin(angle) * shortenBy;

    // Create path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${adjustedFromX} ${adjustedFromY} L ${adjustedToX} ${adjustedToY}`);

    const colors: Record<string, string> = {
      gold: '#FFD700',
      silver: '#C0C0C0',
      bronze: '#CD7F32',
      red: '#ef4444',
      green: '#22c55e',
      orange: '#f59e0b',
    };

    const color = colors[colorKey] || colors.gold;
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', `url(#arrowhead-${colorKey})`);
    path.setAttribute('opacity', '0.9');
    path.classList.add('tutor-arrow');

    // Add glow effect
    path.style.filter = `drop-shadow(0 0 4px ${color})`;

    this.svgLayer.appendChild(path);
  }

  public clearArrows(): void {
    const arrows = this.svgLayer.querySelectorAll('.tutor-arrow');
    arrows.forEach(arrow => arrow.remove());
  }

  public highlightMove(
    fromR: number,
    fromC: number,
    toR: number,
    toC: number,
    colorKey: string = 'gold'
  ): void {
    this.lastArrows = [{ fromR, fromC, toR, toC, colorKey }];
    this.clearArrows();
    this.drawArrow(fromR, fromC, toR, toC, colorKey);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public highlightMoves(moves: any[]): void {
    this.lastArrows = moves;
    this.clearArrows();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    moves.forEach((m: any) => this.drawArrow(m.fromR, m.fromC, m.toR, m.toC, m.colorKey));
  }

  public redraw(): void {
    this.updateCellSize();
    if (this.lastArrows) {
      this.clearArrows();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.lastArrows.forEach((m: any) =>
        this.drawArrow(m.fromR, m.fromC, m.toR, m.toC, m.colorKey || m.quality)
      );
    }
  }

  public destroy(): void {
    if (this.svgLayer && this.svgLayer.parentElement) {
      this.svgLayer.parentElement.removeChild(this.svgLayer);
    }
  }
}
