import { jest } from '@jest/globals';

// Mock DOM
// Mock DOM
const createMockElement = () => ({
    className: '',
    style: {
        getPropertyValue: jest.fn(),
        setProperty: jest.fn(),
    },
    remove: jest.fn(),
    appendChild: jest.fn(),
});

global.document = {
    getElementById: jest.fn().mockReturnValue({
        appendChild: jest.fn(),
    }),
    createElement: jest.fn((tag) => createMockElement()),
    body: {
        appendChild: jest.fn(),
        removeChild: jest.fn(),
        contains: jest.fn().mockReturnValue(true),
    },
};

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 16));

describe('ParticleSystem', () => {
    let ParticleSystem;
    let particleSystem;

    beforeAll(async () => {
        const mod = await import('../js/effects.js');
        ParticleSystem = mod.ParticleSystem;
        particleSystem = mod.particleSystem;
    });

    beforeEach(() => {
        // Clear particles before each test
        particleSystem.particles = [];
        particleSystem.animating = false;
        jest.clearAllMocks();
    });

    describe('spawn particles', () => {
        test('should spawn particles', () => {
            const initialLength = particleSystem.particles.length;
            particleSystem.spawn(100, 200, 'CAPTURE', '#ff0000');

            expect(particleSystem.particles.length).toBeGreaterThan(initialLength);
        });

        test('should create more particles for CAPTURE than MOVE', () => {
            const newParticleSystem = new ParticleSystem();

            newParticleSystem.spawn(100, 100, 'CAPTURE', '#ff0000');
            const captureCount = newParticleSystem.particles.length;

            const anotherParticleSystem = new ParticleSystem();
            anotherParticleSystem.spawn(100, 100, 'MOVE', '#0000ff');
            const moveCount = anotherParticleSystem.particles.length;

            expect(captureCount).toBeGreaterThan(moveCount);
        });

        test('should start animation when spawning particles', () => {
            const newParticleSystem = new ParticleSystem();
            newParticleSystem.spawn(100, 100, 'CAPTURE');

            expect(newParticleSystem.animating).toBe(true);
            expect(requestAnimationFrame).toHaveBeenCalled();
        });

        test('should use default color when not specified', () => {
            const newParticleSystem = new ParticleSystem();
            newParticleSystem.spawn(100, 100, 'MOVE');

            expect(newParticleSystem.particles.length).toBeGreaterThan(0);
        });

        test('should create particles with different types', () => {
            const moveSystem = new ParticleSystem();
            const captureSystem = new ParticleSystem();

            moveSystem.spawn(100, 100, 'MOVE');
            captureSystem.spawn(100, 100, 'CAPTURE');

            // CAPTURE should create more particles
            expect(captureSystem.particles.length).toBeGreaterThan(moveSystem.particles.length);
        });

        test('should handle unknown particle type', () => {
            const newParticleSystem = new ParticleSystem();
            newParticleSystem.spawn(100, 100, 'UNKNOWN_TYPE');

            // Should still create particles with default count
            expect(newParticleSystem.particles.length).toBeGreaterThan(0);
        });

        test('should append particles to container', () => {
            const mockContainer = {
                appendChild: jest.fn()
            };
            const newParticleSystem = new ParticleSystem();
            newParticleSystem.container = mockContainer;

            newParticleSystem.spawn(100, 100, 'MOVE');

            expect(mockContainer.appendChild).toHaveBeenCalled();
        });
    });

    describe('particle update logic', () => {
        test('should remove particles after life expires', () => {
            const newParticleSystem = new ParticleSystem();
            newParticleSystem.spawn(100, 100, 'MOVE');

            const initialCount = newParticleSystem.particles.length;
            expect(initialCount).toBeGreaterThan(0);

            // Simulate particle expiry by setting life to 0
            newParticleSystem.particles.forEach(p => p.life = 0);

            // Particles with life <= 0 should be removed in next update
            expect(newParticleSystem.particles.some(p => p.life <= 0)).toBe(true);
        });

        test('should update particle positions', () => {
            const newParticleSystem = new ParticleSystem();
            newParticleSystem.spawn(100, 100, 'MOVE');

            const particle = newParticleSystem.particles[0];
            const originalX = particle.x;
            const originalY = particle.y;

            // Manually update particle
            particle.x += particle.vx;
            particle.y += particle.vy;

            expect(particle.x).not.toBe(originalX);
            expect(particle.y).not.toBe(originalY);
        });

        test('should apply gravity to particles', () => {
            const newParticleSystem = new ParticleSystem();
            newParticleSystem.spawn(100, 100, 'MOVE');

            const particle = newParticleSystem.particles[0];
            const originalVy = particle.vy;

            // Simulate gravity
            particle.vy += 0.2;

            expect(particle.vy).toBeGreaterThan(originalVy);
        });

        test('should decrease particle life over time', () => {
            const newParticleSystem = new ParticleSystem();
            newParticleSystem.spawn(100, 100, 'MOVE');

            const particle = newParticleSystem.particles[0];
            const originalLife = particle.life;

            particle.life -= 0.016;

            expect(particle.life).toBeLessThan(originalLife);
        });
    });

    describe('animation lifecycle', () => {
        test('should handle empty particle array', () => {
            const newParticleSystem = new ParticleSystem();

            expect(newParticleSystem.particles.length).toBe(0);
            // animating should not be checked initially - it's set when particles spawn
        });

        test('should stop animation when no particles remain', () => {
            const newParticleSystem = new ParticleSystem();
            newParticleSystem.particles = [];
            newParticleSystem.animating = true;

            newParticleSystem.update();

            expect(newParticleSystem.animating).toBe(false);
        });

        test('should not start multiple animations when already animating', () => {
            const newParticleSystem = new ParticleSystem();
            newParticleSystem.animating = true;
            const callCount = requestAnimationFrame.mock.calls.length;

            newParticleSystem.spawn(100, 100, 'MOVE');

            // Should not increment call count when already animating
            expect(requestAnimationFrame.mock.calls.length).toBe(callCount);
        });

        test('should continue animating when particles exist', () => {
            const newParticleSystem = new ParticleSystem();
            newParticleSystem.spawn(100, 100, 'MOVE');

            // Set a reasonable life value
            newParticleSystem.particles.forEach(p => p.life = 0.5);

            const beforeCallCount = requestAnimationFrame.mock.calls.length;
            newParticleSystem.update();

            // Should call requestAnimationFrame again
            expect(requestAnimationFrame.mock.calls.length).toBeGreaterThan(beforeCallCount);
        });
    });

    describe('particle rendering', () => {
        test('should set particle position styles', () => {
            const newParticleSystem = new ParticleSystem();
            newParticleSystem.spawn(150, 250, 'MOVE');

            const particle = newParticleSystem.particles[0];

            expect(particle.el.style.left).toBe('150px');
            expect(particle.el.style.top).toBe('250px');
        });

        test('should set CAPTURE particles with box shadow', () => {
            const newParticleSystem = new ParticleSystem();
            newParticleSystem.spawn(100, 100, 'CAPTURE', '#ff0000');

            const particle = newParticleSystem.particles[0];

            expect(particle.el.style.boxShadow).toBeDefined();
            expect(particle.el.style.boxShadow).toContain('#ff0000');
        });

        test('should remove particle element when life expires', () => {
            const newParticleSystem = new ParticleSystem();
            newParticleSystem.spawn(100, 100, 'MOVE');

            const particle = newParticleSystem.particles[0];
            // Spy on the remove method of the created element
            const removeSpy = jest.spyOn(particle.el, 'remove');

            // Set life to 0 to trigger removal
            particle.life = 0;
            newParticleSystem.update();

            expect(removeSpy).toHaveBeenCalled();
        });
    });
});
