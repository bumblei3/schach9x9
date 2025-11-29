/**
 * Particle Effects System for Schach 9x9
 */

export class ParticleSystem {
    constructor() {
        this.particles = [];
        this.container = document.getElementById('board-container') || document.body;
        this.animating = false;
    }

    spawn(x, y, type, color = '#fff') {
        const count = type === 'CAPTURE' ? 20 : type === 'MOVE' ? 8 : 15;

        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'particle';

            // Randomize physics
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 2;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const life = Math.random() * 0.5 + 0.3; // seconds

            p.style.left = x + 'px';
            p.style.top = y + 'px';
            p.style.backgroundColor = color;

            if (type === 'CAPTURE') {
                p.style.width = (Math.random() * 6 + 2) + 'px';
                p.style.height = p.style.width;
                p.style.boxShadow = `0 0 6px ${color}`;
            } else {
                p.style.width = '3px';
                p.style.height = '3px';
            }

            this.container.appendChild(p);

            this.particles.push({
                el: p,
                x, y, vx, vy, life, maxLife: life
            });
        }

        if (!this.animating) {
            this.animating = true;
            requestAnimationFrame(() => this.update());
        }
    }

    update() {
        if (this.particles.length === 0) {
            this.animating = false;
            return;
        }

        const now = Date.now();
        // Use fixed time step or delta for smoother animation if needed, 
        // but simple per-frame update is fine for this.

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
            p.el.style.opacity = p.life / p.maxLife;
        }

        requestAnimationFrame(() => this.update());
    }
}

export const particleSystem = new ParticleSystem();
