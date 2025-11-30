/**
 * 3D Piece Models for Battle Chess
 * Procedurally generated low-poly chess pieces
 * @module pieces3D
 */

import * as THREE from 'three';

export const PIECE_COLORS = {
    white: 0xf0f0f0,
    black: 0x1a1a1a,
};

/**
 * Create a 3D chess piece
 * @param {string} type - Piece type (p, n, b, r, q, k, a, c, e)
 * @param {string} color - Piece color ('white' or 'black')
 * @returns {THREE.Group} 3D piece group
 */
export function createPiece3D(type, color) {
    const pieceGroup = new THREE.Group();
    const colorHex = color === 'white' ? PIECE_COLORS.white : PIECE_COLORS.black;

    // Base material
    const material = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.6,
        metalness: 0.2,
    });

    // Accent material (for decorations)
    const accentColor = color === 'white' ? 0xffd700 : 0x8b4513;
    const accentMaterial = new THREE.MeshStandardMaterial({
        color: accentColor,
        roughness: 0.4,
        metalness: 0.6,
    });

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
    pieceGroup.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    return pieceGroup;
}

/**
 * Create a Pawn
 */
function createPawn(group, material) {
    // Base
    const baseGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.15, 16);
    const base = new THREE.Mesh(baseGeo, material);
    base.position.y = 0.075;
    group.add(base);

    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.6, 12);
    const body = new THREE.Mesh(bodyGeo, material);
    body.position.y = 0.45;
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const head = new THREE.Mesh(headGeo, material);
    head.position.y = 0.85;
    group.add(head);
}

/**
 * Create a Knight
 */
function createKnight(group, material) {
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
 * Create a Bishop
 */
function createBishop(group, material, accentMaterial) {
    // Base
    const baseGeo = new THREE.CylinderGeometry(0.27, 0.32, 0.15, 16);
    const base = new THREE.Mesh(baseGeo, material);
    base.position.y = 0.075;
    group.add(base);

    // Body (tapered)
    const bodyGeo = new THREE.CylinderGeometry(0.12, 0.22, 0.7, 12);
    const body = new THREE.Mesh(bodyGeo, material);
    body.position.y = 0.5;
    group.add(body);

    // Mitre (bishop hat)
    const mitreGeo = new THREE.ConeGeometry(0.15, 0.35, 12);
    const mitre = new THREE.Mesh(mitreGeo, material);
    mitre.position.y = 1.025;
    group.add(mitre);

    // Top ball
    const ballGeo = new THREE.SphereGeometry(0.08, 12, 12);
    const ball = new THREE.Mesh(ballGeo, accentMaterial);
    ball.position.y = 1.25;
    group.add(ball);

    // Diagonal slash (mitre decoration)
    const slashGeo = new THREE.BoxGeometry(0.25, 0.05, 0.05);
    const slash = new THREE.Mesh(slashGeo, accentMaterial);
    slash.position.set(0, 1.0, 0.08);
    slash.rotation.z = Math.PI / 4;
    group.add(slash);
}

/**
 * Create a Rook
 */
function createRook(group, material) {
    // Base
    const baseGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.15, 16);
    const base = new THREE.Mesh(baseGeo, material);
    base.position.y = 0.075;
    group.add(base);

    // Tower body
    const bodyGeo = new THREE.CylinderGeometry(0.25, 0.28, 0.8, 4);
    const body = new THREE.Mesh(bodyGeo, material);
    body.position.y = 0.55;
    group.add(body);

    // Battlements (top)
    const battlementGeo = new THREE.BoxGeometry(0.08, 0.15, 0.08);

    const positions = [
        [0.15, 1.05, 0.15],
        [0.15, 1.05, -0.15],
        [-0.15, 1.05, 0.15],
        [-0.15, 1.05, -0.15],
    ];

    positions.forEach((pos) => {
        const battlement = new THREE.Mesh(battlementGeo, material);
        battlement.position.set(...pos);
        group.add(battlement);
    });
}

/**
 * Create a Queen
 */
function createQueen(group, material, accentMaterial) {
    // Base
    const baseGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.15, 16);
    const base = new THREE.Mesh(baseGeo, material);
    base.position.y = 0.075;
    group.add(base);

    // Body (elegant curve)
    const bodyGeo = new THREE.CylinderGeometry(0.15, 0.27, 0.8, 16);
    const body = new THREE.Mesh(bodyGeo, material);
    body.position.y = 0.55;
    group.add(body);

    // Crown base
    const crownBaseGeo = new THREE.CylinderGeometry(0.2, 0.18, 0.15, 16);
    const crownBase = new THREE.Mesh(crownBaseGeo, material);
    crownBase.position.y = 1.05;
    group.add(crownBase);

    // Crown points
    const pointGeo = new THREE.ConeGeometry(0.06, 0.25, 8);

    const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    angles.forEach((angle) => {
        const point = new THREE.Mesh(pointGeo, accentMaterial);
        const radius = 0.15;
        point.position.set(
            Math.cos(angle) * radius,
            1.25,
            Math.sin(angle) * radius,
        );
        group.add(point);
    });

    // Central jewel
    const jewelGeo = new THREE.SphereGeometry(0.08, 12, 12);
    const jewel = new THREE.Mesh(jewelGeo, accentMaterial);
    jewel.position.y = 1.3;
    group.add(jewel);
}

/**
 * Create a King
 */
function createKing(group, material, accentMaterial) {
    // Base
    const baseGeo = new THREE.CylinderGeometry(0.32, 0.36, 0.15, 16);
    const base = new THREE.Mesh(baseGeo, material);
    base.position.y = 0.075;
    group.add(base);

    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.18, 0.28, 0.9, 16);
    const body = new THREE.Mesh(bodyGeo, material);
    body.position.y = 0.6;
    group.add(body);

    // Crown base (wider than queen)
    const crownBaseGeo = new THREE.CylinderGeometry(0.25, 0.22, 0.2, 16);
    const crownBase = new THREE.Mesh(crownBaseGeo, material);
    crownBase.position.y = 1.15;
    group.add(crownBase);

    // Cross on top
    const crossVGeo = new THREE.BoxGeometry(0.06, 0.35, 0.06);
    const crossV = new THREE.Mesh(crossVGeo, accentMaterial);
    crossV.position.y = 1.45;
    group.add(crossV);

    const crossHGeo = new THREE.BoxGeometry(0.25, 0.06, 0.06);
    const crossH = new THREE.Mesh(crossHGeo, accentMaterial);
    crossH.position.y = 1.5;
    group.add(crossH);
}

/**
 * Create an Archbishop (Bishop + Knight hybrid)
 */
function createArchbishop(group, material, accentMaterial) {
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
function createChancellor(group, material, accentMaterial) {
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

    batPositions.forEach((pos) => {
        const bat = new THREE.Mesh(battlementGeo, accentMaterial);
        bat.position.set(...pos);
        group.add(bat);
    });
}

/**
 * Create an Angel (premium piece)
 */
function createAngel(group, material, accentMaterial) {
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
