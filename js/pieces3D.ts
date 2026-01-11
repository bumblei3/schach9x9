/**
 * 3D Piece Models for Battle Chess
 * Procedurally generated low-poly chess pieces
 * @module pieces3D
 */

import * as THREE from 'three';

// Skin preset configurations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SKIN_PRESETS: Record<string, any> = {
  classic: {
    name: 'Classic',
    white: {
      base: { color: 0xf0f0f0, roughness: 0.6, metalness: 0.2 },
      accent: { color: 0xffd700, roughness: 0.4, metalness: 0.6 },
    },
    black: {
      base: { color: 0x1a1a1a, roughness: 0.6, metalness: 0.2 },
      accent: { color: 0x8b4513, roughness: 0.4, metalness: 0.6 },
    },
  },
  modern: {
    name: 'Modern',
    white: {
      base: { color: 0xe0e0e0, roughness: 0.2, metalness: 0.9 },
      accent: { color: 0xffd700, roughness: 0.15, metalness: 0.95 },
    },
    black: {
      base: { color: 0x2a2a2a, roughness: 0.25, metalness: 0.85 },
      accent: { color: 0xb8860b, roughness: 0.2, metalness: 0.9 },
    },
  },
  pixel: {
    name: 'Pixel',
    white: {
      base: { color: 0xffffff, roughness: 0.9, metalness: 0.0 },
      accent: { color: 0x4a90e2, roughness: 0.8, metalness: 0.0 },
    },
    black: {
      base: { color: 0x000000, roughness: 0.9, metalness: 0.0 },
      accent: { color: 0xff6b6b, roughness: 0.8, metalness: 0.0 },
    },
  },
  infernale: {
    name: 'Infernale',
    white: {
      base: {
        color: 0xffcc00,
        roughness: 0.3,
        metalness: 0.4,
        emissive: 0xff9900,
        emissiveIntensity: 0.3,
      },
      accent: {
        color: 0xff6600,
        roughness: 0.2,
        metalness: 0.5,
        emissive: 0xff3300,
        emissiveIntensity: 0.5,
      },
    },
    black: {
      base: {
        color: 0x330000,
        roughness: 0.3,
        metalness: 0.4,
        emissive: 0x660000,
        emissiveIntensity: 0.3,
      },
      accent: {
        color: 0xff0000,
        roughness: 0.2,
        metalness: 0.5,
        emissive: 0xcc0000,
        emissiveIntensity: 0.5,
      },
    },
  },
  wood: {
    name: 'Wood',
    white: {
      base: { color: 0xdeb887, roughness: 0.8, metalness: 0.0 },
      accent: { color: 0xd4af37, roughness: 0.6, metalness: 0.1 },
    },
    black: {
      base: { color: 0x3e2723, roughness: 0.75, metalness: 0.0 },
      accent: { color: 0xcd7f32, roughness: 0.65, metalness: 0.05 },
    },
  },
  neon: {
    name: 'Neon',
    white: {
      base: {
        color: 0x00ffff,
        roughness: 0.3,
        metalness: 0.4,
        emissive: 0x00cccc,
        emissiveIntensity: 0.5,
      },
      accent: {
        color: 0x0099ff,
        roughness: 0.2,
        metalness: 0.5,
        emissive: 0x0066cc,
        emissiveIntensity: 0.7,
      },
    },
    black: {
      base: {
        color: 0xff00ff,
        roughness: 0.3,
        metalness: 0.4,
        emissive: 0xcc00cc,
        emissiveIntensity: 0.5,
      },
      accent: {
        color: 0xff0099,
        roughness: 0.2,
        metalness: 0.5,
        emissive: 0xcc0066,
        emissiveIntensity: 0.7,
      },
    },
  },
  minimalist: {
    name: 'Minimalist',
    white: {
      base: { color: 0xe0f2ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.7 },
      accent: { color: 0x3b82f6, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.8 },
    },
    black: {
      base: { color: 0x1e1e1e, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.6 },
      accent: { color: 0x6366f1, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.7 },
    },
  },
};

// Legacy color export for backwards compatibility
export const PIECE_COLORS = {
  white: 0xf0f0f0,
  black: 0x1a1a1a,
};

/**
 * Create a 3D chess piece
 * @param {string} type - Piece type (p, n, b, r, q, k, a, c, e)
 * @param {string} color - Piece color ('white' or 'black')
 * @param {string} skinStyle - Skin preset name (default: 'classic')
 * @returns {THREE.Group} 3D piece group
 */
export function createPiece3D(
  type: string,
  color: string,
  skinStyle: string = 'classic'
): THREE.Group {
  const pieceGroup = new THREE.Group();

  // Get skin preset
  const skin = SKIN_PRESETS[skinStyle] || SKIN_PRESETS.classic;
  const colorScheme = color === 'white' ? skin.white : skin.black;

  // Create base and accent materials from skin preset
  const material = new THREE.MeshStandardMaterial(colorScheme.base);
  const accentMaterial = new THREE.MeshStandardMaterial(colorScheme.accent);

  switch (type.toLowerCase()) {
    case 'p': // Pawn
      createPawn(pieceGroup, material);
      break;
    case 'n': // Knight
      createKnight(pieceGroup, material);
      break;
    case 'b': // Bishop
      createBishop(pieceGroup, material, accentMaterial);
      break;
    case 'r': // Rook
      createRook(pieceGroup, material);
      break;
    case 'q': // Queen
      createQueen(pieceGroup, material, accentMaterial);
      break;
    case 'k': // King
      createKing(pieceGroup, material, accentMaterial);
      break;
    case 'a': // Archbishop (Bishop + Knight)
      createArchbishop(pieceGroup, material, accentMaterial);
      break;
    case 'c': // Chancellor (Rook + Knight)
      createChancellor(pieceGroup, material, accentMaterial);
      break;
    case 'e': // Angel
      createAngel(pieceGroup, material, accentMaterial);
      break;
    default:
      createPawn(pieceGroup, material);
  }

  // Make all pieces cast shadows
  pieceGroup.traverse(child => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((child as any).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return pieceGroup;
}

/**
 * Create a Pawn with LatheGeometry
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createPawn(group: THREE.Group, material: any): void {
  const points: THREE.Vector2[] = [];
  // Base
  points.push(new THREE.Vector2(0.26, 0.0));
  points.push(new THREE.Vector2(0.26, 0.1));
  points.push(new THREE.Vector2(0.22, 0.15));
  // Body curve
  points.push(new THREE.Vector2(0.12, 0.4));
  points.push(new THREE.Vector2(0.08, 0.6));
  // Collar
  points.push(new THREE.Vector2(0.12, 0.62));
  points.push(new THREE.Vector2(0.12, 0.65));
  points.push(new THREE.Vector2(0.06, 0.68));
  // Head
  points.push(new THREE.Vector2(0.14, 0.75));
  points.push(new THREE.Vector2(0.14, 0.9));
  points.push(new THREE.Vector2(0.0, 0.95));

  const geometry = new THREE.LatheGeometry(points, 32);
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);
}

/**
 * Create a Knight
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createKnight(group: THREE.Group, material: any): void {
  // Base
  const baseGeo = new THREE.CylinderGeometry(0.28, 0.32, 0.15, 16);
  const base = new THREE.Mesh(baseGeo, material);
  base.position.y = 0.075;
  group.add(base);

  // Body
  const bodyGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.5, 12);
  const body = new THREE.Mesh(bodyGeo, material);
  body.position.y = 0.4;
  group.add(body);

  // Horse head (stylized L-shape)
  const neckGeo = new THREE.BoxGeometry(0.15, 0.4, 0.15);
  const neck = new THREE.Mesh(neckGeo, material);
  neck.position.set(0, 0.7, 0.1);
  neck.rotation.x = 0.3;
  group.add(neck);

  const headGeo = new THREE.BoxGeometry(0.2, 0.25, 0.3);
  const head = new THREE.Mesh(headGeo, material);
  head.position.set(0, 0.95, 0.25);
  group.add(head);

  // Ears
  const earGeo = new THREE.ConeGeometry(0.05, 0.15, 8);
  const ear1 = new THREE.Mesh(earGeo, material);
  ear1.position.set(-0.08, 1.1, 0.25);
  group.add(ear1);

  const ear2 = new THREE.Mesh(earGeo, material);
  ear2.position.set(0.08, 1.1, 0.25);
  group.add(ear2);
}

/**
 * Create a Bishop with LatheGeometry
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createBishop(group: THREE.Group, material: any, accentMaterial: any): void {
  // Body Lathe
  const points: THREE.Vector2[] = [];
  points.push(new THREE.Vector2(0.28, 0.0));
  points.push(new THREE.Vector2(0.28, 0.1));
  points.push(new THREE.Vector2(0.12, 0.3));
  points.push(new THREE.Vector2(0.08, 0.6));
  points.push(new THREE.Vector2(0.15, 0.8)); // Mitre bulge
  points.push(new THREE.Vector2(0.12, 1.0));
  points.push(new THREE.Vector2(0.0, 1.1)); // Tip

  const geometry = new THREE.LatheGeometry(points, 32);
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);

  // Top ball (Accent)
  const ballGeo = new THREE.SphereGeometry(0.06, 16, 16);
  const ball = new THREE.Mesh(ballGeo, accentMaterial);
  ball.position.y = 1.15;
  group.add(ball);

  // Diagonal slash (Mitre decoration)
  const slashGeo = new THREE.BoxGeometry(0.2, 0.04, 0.04);
  const slash = new THREE.Mesh(slashGeo, accentMaterial);
  slash.position.set(0, 0.9, 0.12);
  slash.rotation.x = Math.PI / 6;
  group.add(slash);
}

/**
 * Create a Rook with LatheGeometry
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createRook(group: THREE.Group, material: any): void {
  const points: THREE.Vector2[] = [];
  // Base to column
  points.push(new THREE.Vector2(0.3, 0.0));
  points.push(new THREE.Vector2(0.3, 0.15));
  points.push(new THREE.Vector2(0.25, 0.2));
  points.push(new THREE.Vector2(0.22, 0.7)); // Slight taper
  points.push(new THREE.Vector2(0.28, 0.8)); // Flaring top
  points.push(new THREE.Vector2(0.28, 0.95));
  points.push(new THREE.Vector2(0.2, 0.95)); // Inner rim

  const geometry = new THREE.LatheGeometry(points, 32);
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);

  // Battlements (top)
  const battlementGeo = new THREE.BoxGeometry(0.08, 0.12, 0.08);
  const positions = [
    [0.18, 1.0, 0.18],
    [0.18, 1.0, -0.18],
    [-0.18, 1.0, 0.18],
    [-0.18, 1.0, -0.18],
  ];

  positions.forEach(pos => {
    const battlement = new THREE.Mesh(battlementGeo, material);
    battlement.position.set(pos[0], pos[1], pos[2]);
    group.add(battlement);
  });
}

/**
 * Create a Queen with LatheGeometry
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createQueen(group: THREE.Group, material: any, accentMaterial: any): void {
  const points: THREE.Vector2[] = [];
  points.push(new THREE.Vector2(0.32, 0.0));
  points.push(new THREE.Vector2(0.32, 0.15));
  points.push(new THREE.Vector2(0.18, 0.3));
  points.push(new THREE.Vector2(0.12, 0.6));
  points.push(new THREE.Vector2(0.15, 0.9)); // Flaring neck
  points.push(new THREE.Vector2(0.25, 1.1)); // Crown flare
  points.push(new THREE.Vector2(0.0, 1.15)); // Inner dip

  const geometry = new THREE.LatheGeometry(points, 32);
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);

  // Crown points (Accents)
  const pointGeo = new THREE.ConeGeometry(0.05, 0.15, 8);
  const angles = [
    0,
    Math.PI / 2,
    Math.PI,
    (3 * Math.PI) / 2,
    Math.PI / 4,
    (3 * Math.PI) / 4,
    (5 * Math.PI) / 4,
    (7 * Math.PI) / 4,
  ];

  angles.forEach(angle => {
    const point = new THREE.Mesh(pointGeo, accentMaterial);
    const radius = 0.2;
    point.position.set(Math.cos(angle) * radius, 1.15, Math.sin(angle) * radius);
    point.rotation.x = -0.2; // Tilt out
    group.add(point);
  });

  // Central jewel
  const jewelGeo = new THREE.SphereGeometry(0.09, 16, 16);
  const jewel = new THREE.Mesh(jewelGeo, accentMaterial);
  jewel.position.y = 1.15;
  group.add(jewel);
}

/**
 * Create a King with LatheGeometry
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createKing(group: THREE.Group, material: any, accentMaterial: any): void {
  const points: THREE.Vector2[] = [];
  points.push(new THREE.Vector2(0.35, 0.0));
  points.push(new THREE.Vector2(0.35, 0.15));
  points.push(new THREE.Vector2(0.2, 0.3));
  points.push(new THREE.Vector2(0.15, 0.7));
  points.push(new THREE.Vector2(0.22, 1.0)); // Crown base
  points.push(new THREE.Vector2(0.25, 1.2)); // Crown flare
  points.push(new THREE.Vector2(0.0, 1.25));

  const geometry = new THREE.LatheGeometry(points, 32);
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);

  // Cross on top
  const crossWidth = 0.08;
  const crossHeight = 0.3;

  const crossVGeo = new THREE.BoxGeometry(crossWidth, crossHeight, crossWidth);
  const crossV = new THREE.Mesh(crossVGeo, accentMaterial);
  crossV.position.y = 1.4;
  group.add(crossV);

  const crossHGeo = new THREE.BoxGeometry(0.25, crossWidth, crossWidth);
  const crossH = new THREE.Mesh(crossHGeo, accentMaterial);
  crossH.position.y = 1.45;
  group.add(crossH);
}

/**
 * Create an Archbishop (Bishop + Knight hybrid)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createArchbishop(group: THREE.Group, material: any, accentMaterial: any): void {
  // Base
  const baseGeo = new THREE.CylinderGeometry(0.29, 0.33, 0.15, 16);
  const base = new THREE.Mesh(baseGeo, material);
  base.position.y = 0.075;
  group.add(base);

  // Body (bishop-like)
  const bodyGeo = new THREE.CylinderGeometry(0.14, 0.24, 0.65, 12);
  const body = new THREE.Mesh(bodyGeo, material);
  body.position.y = 0.475;
  group.add(body);

  // Knight head element (smaller)
  const headGeo = new THREE.BoxGeometry(0.15, 0.2, 0.25);
  const head = new THREE.Mesh(headGeo, material);
  head.position.set(0, 0.9, 0.1);
  head.rotation.x = 0.2;
  group.add(head);

  // Bishop mitre on top
  const mitreGeo = new THREE.ConeGeometry(0.12, 0.25, 12);
  const mitre = new THREE.Mesh(mitreGeo, accentMaterial);
  mitre.position.y = 1.15;
  group.add(mitre);

  // Top orb
  const orbGeo = new THREE.SphereGeometry(0.06, 12, 12);
  const orb = new THREE.Mesh(orbGeo, accentMaterial);
  orb.position.y = 1.32;
  group.add(orb);
}

/**
 * Create a Chancellor (Rook + Knight hybrid)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createChancellor(group: THREE.Group, material: any, accentMaterial: any): void {
  // Base
  const baseGeo = new THREE.CylinderGeometry(0.31, 0.35, 0.15, 16);
  const base = new THREE.Mesh(baseGeo, material);
  base.position.y = 0.075;
  group.add(base);

  // Tower body (rook-like, but with knight head)
  const bodyGeo = new THREE.CylinderGeometry(0.22, 0.27, 0.6, 4);
  const body = new THREE.Mesh(bodyGeo, material);
  body.position.y = 0.45;
  group.add(body);

  // Knight head on top
  const neckGeo = new THREE.BoxGeometry(0.13, 0.3, 0.13);
  const neck = new THREE.Mesh(neckGeo, material);
  neck.position.set(0, 0.85, 0.08);
  neck.rotation.x = 0.25;
  group.add(neck);

  const headGeo = new THREE.BoxGeometry(0.18, 0.2, 0.25);
  const head = new THREE.Mesh(headGeo, material);
  head.position.set(0, 1.05, 0.2);
  group.add(head);

  // Rook battlements integrated
  const battlementGeo = new THREE.BoxGeometry(0.06, 0.1, 0.06);
  const batPositions = [
    [0.12, 0.8, 0.12],
    [-0.12, 0.8, 0.12],
  ];

  batPositions.forEach(pos => {
    const bat = new THREE.Mesh(battlementGeo, accentMaterial);
    bat.position.set(pos[0], pos[1], pos[2]);
    group.add(bat);
  });
}

/**
 * Create an Angel (premium piece)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createAngel(group: THREE.Group, material: any, accentMaterial: any): void {
  // Base
  const baseGeo = new THREE.CylinderGeometry(0.32, 0.37, 0.15, 16);
  const base = new THREE.Mesh(baseGeo, material);
  base.position.y = 0.075;
  group.add(base);

  // Body (elegant, tall)
  const bodyGeo = new THREE.CylinderGeometry(0.16, 0.26, 0.9, 16);
  const body = new THREE.Mesh(bodyGeo, material);
  body.position.y = 0.6;
  group.add(body);

  // Head
  const headGeo = new THREE.SphereGeometry(0.15, 16, 16);
  const head = new THREE.Mesh(headGeo, material);
  head.position.y = 1.2;
  group.add(head);

  // Halo
  const haloGeo = new THREE.TorusGeometry(0.2, 0.03, 8, 16);
  const haloMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xffaa00,
    emissiveIntensity: 0.5,
    metalness: 0.8,
  });
  const halo = new THREE.Mesh(haloGeo, haloMaterial);
  halo.position.y = 1.45;
  halo.rotation.x = Math.PI / 2;
  group.add(halo);

  // Wings (simplified)
  const wingGeo = new THREE.BoxGeometry(0.4, 0.6, 0.05);
  const wingMaterial = new THREE.MeshStandardMaterial({
    color: accentMaterial.color,
    transparent: true,
    opacity: 0.8,
  });

  const leftWing = new THREE.Mesh(wingGeo, wingMaterial);
  leftWing.position.set(-0.25, 0.8, -0.1);
  leftWing.rotation.set(0.3, -0.3, -0.5);
  group.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeo, wingMaterial);
  rightWing.position.set(0.25, 0.8, -0.1);
  rightWing.rotation.set(0.3, 0.3, 0.5);
  group.add(rightWing);
}
