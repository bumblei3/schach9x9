/**
 * Particle Effects System for Schach 9x9
 */

export class ParticleSystem {
  particles: Array<{
    el: HTMLElement;
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    type: string;
  }>;
  container: HTMLElement;
  animating: boolean;

  constructor() {
    this.particles = [];
    this.container = document.getElementById('board-container') || document.body;
    this.animating = false;
  }

  spawn(x: number, y: number, type: string, color: string = '#fff'): void {
    const count = type === 'CAPTURE' ? 25 : type === 'MOVE' ? 8 : type === 'TRAIL' ? 1 : 15;

    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle';

      // Randomize physics
      const angle = Math.random() * Math.PI * 2;
      let speed = Math.random() * 4 + 2;
      let life = Math.random() * 0.5 + 0.3; // seconds

      if (type === 'TRAIL') {
        speed = Math.random() * 1; // Slow for trail
        life = 0.25; // Short life
      }

      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.backgroundColor = color;

      if (type === 'CAPTURE') {
        p.style.width = Math.random() * 6 + 3 + 'px';
        p.style.height = p.style.width;
        p.style.boxShadow = `0 0 8px ${color}`;
      } else if (type === 'TRAIL') {
        p.style.width = '4px';
        p.style.height = '4px';
        p.style.opacity = '0.6';
        p.style.borderRadius = '50%';
      } else {
        p.style.width = '3px';
        p.style.height = '3px';
      }

      this.container.appendChild(p);

      this.particles.push({
        el: p,
        x,
        y,
        vx,
        vy,
        life,
        maxLife: life,
        type: type, // Store type to allow custom update logic
      });
    }

    if (!this.animating) {
      this.animating = true;
      requestAnimationFrame(() => this.update());
    }
  }

  spawnTrail(x: number, y: number, color: string = '#fff'): void {
    const p = document.createElement('div');
    p.className = 'particle';

    const life = 0.4; // seconds
    const vx = (Math.random() - 0.5) * 0.5;
    const vy = (Math.random() - 0.5) * 0.5;

    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.backgroundColor = color;
    p.style.width = '6px';
    p.style.height = '6px';
    p.style.borderRadius = '50%';
    p.style.opacity = '0.6';
    p.style.boxShadow = `0 0 10px ${color}`;

    this.container.appendChild(p);

    this.particles.push({
      el: p,
      x,
      y,
      vx,
      vy,
      life,
      maxLife: life,
      type: 'TRAIL',
    });

    if (!this.animating) {
      this.animating = true;
      requestAnimationFrame(() => this.update());
    }
  }

  update(): void {
    if (this.particles.length === 0) {
      this.animating = false;
      return;
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= 0.016; // approx 60fps

      if (p.life <= 0) {
        p.el.remove();
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2; // Gravity

      p.el.style.transform = `translate(${p.x - parseFloat(p.el.style.left)}px, ${p.y - parseFloat(p.el.style.top)}px) scale(${p.life / p.maxLife})`;
      p.el.style.opacity = (p.life / p.maxLife).toString();
    }

    requestAnimationFrame(() => this.update());
  }
}

export class FloatingTextManager {
  container: HTMLElement;

  constructor() {
    this.container = document.getElementById('board-container') || document.body;
  }

  show(x: number, y: number, text: string, type: string = 'score'): void {
    const el = document.createElement('div');
    el.className = `floating-text ${type}`;
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';

    this.container.appendChild(el);

    // Animation via CSS transitions/animations
    setTimeout(() => {
      el.classList.add('animate');
    }, 10);

    setTimeout(() => {
      el.remove();
    }, 1500);
  }
}

/**
 * Triggers haptic feedback (vibration)
 * @param {string} type - 'light', 'medium', 'heavy'
 */
export function triggerVibration(type: 'light' | 'medium' | 'heavy' = 'light'): void {
  if (!navigator.vibrate) return;

  switch (type) {
    case 'heavy':
      navigator.vibrate([100, 50, 100]);
      break;
    case 'medium':
      navigator.vibrate(50);
      break;
    default:
      navigator.vibrate(20);
      break;
  }
}

/**
 * Visual screen shake effect
 * @param {number} intensity - Magnitude of shake
 * @param {number} duration - Duration in ms
 */
export function shakeScreen(intensity: number = 5, duration: number = 300): void {
  const container = document.getElementById('board-wrapper') || document.body;
  const originalTransition = container.style.transition;
  const start = Date.now();

  function animate() {
    const elapsed = Date.now() - start;
    if (elapsed < duration) {
      const x = (Math.random() - 0.5) * intensity;
      const y = (Math.random() - 0.5) * intensity;
      container.style.transform = `translate(${x}px, ${y}px)`;
      requestAnimationFrame(animate);
    } else {
      container.style.transform = '';
      container.style.transition = originalTransition;
    }
  }

  container.style.transition = 'none';
  animate();
}

export const particleSystem = new ParticleSystem();
export const floatingTextManager = new FloatingTextManager();

export class ConfettiSystem {
  particles: Array<{
    el: HTMLElement;
    x: number;
    y: number;
    vx: number;
    vy: number;
    rotation: number;
    rotationSpeed: number;
    gravity: number;
    drag: number;
    life: number;
    decay: number;
  }>;
  animating: boolean;
  colors: string[];
  container: HTMLElement | null;

  constructor() {
    this.particles = [];
    this.animating = false;
    this.colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#ffffff'];
    this.container = null;
  }

  spawn(): void {
    this.container = document.getElementById('board-container') || document.body;
    const count = 150;
    const rect =
      this.container && typeof this.container.getBoundingClientRect === 'function'
        ? this.container.getBoundingClientRect()
        : {
            width: window.innerWidth || 800,
            height: window.innerHeight || 600,
            left: 0,
            top: 0,
            bottom: 0,
            right: 0,
          };
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'confetti';

      // Random starting position (explosion center)
      const x = centerX;
      const y = centerY;

      const angle = Math.random() * Math.PI * 2;
      const velocity = Math.random() * 15 + 10;
      const vx = Math.cos(angle) * velocity;
      const vy = Math.sin(angle) * velocity;

      const color = this.colors[Math.floor(Math.random() * this.colors.length)];

      p.style.position = 'absolute';
      p.style.width = '8px';
      p.style.height = '8px';
      p.style.backgroundColor = color;
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
      p.style.zIndex = '1000';
      p.style.pointerEvents = 'none';

      if (this.container) {
        this.container.appendChild(p);
      }

      this.particles.push({
        el: p,
        x,
        y,
        vx,
        vy,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        gravity: 0.5,
        drag: 0.96,
        life: 1.0,
        decay: Math.random() * 0.01 + 0.005,
      });
    }

    if (!this.animating) {
      this.animating = true;
      requestAnimationFrame(() => this.update());
    }
  }

  update(): void {
    if (this.particles.length === 0) {
      this.animating = false;
      return;
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      p.life -= p.decay;

      if (p.life <= 0) {
        p.el.remove();
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.rotation += p.rotationSpeed;

      p.el.style.transform = `translate(${p.x - parseFloat(p.el.style.left)}px, ${p.y - parseFloat(p.el.style.top)}px) rotate(${p.rotation}deg)`;
      p.el.style.opacity = p.life.toString();
    }

    requestAnimationFrame(() => this.update());
  }
}

export const confettiSystem = new ConfettiSystem();
