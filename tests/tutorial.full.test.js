import { jest } from '@jest/globals';

// Mock PIECE_SVGS
global.window.PIECE_SVGS = {
    white: { p: 'wp', r: 'wr', n: 'wn', b: 'wb', q: 'wq', k: 'wk', e: 'we', a: 'wa', c: 'wc' },
    black: { p: 'bp', r: 'br', n: 'bn', b: 'bb', q: 'bq', k: 'bk', e: 'be', a: 'ba', c: 'bc' }
};

// Mock dependencies
jest.unstable_mockModule('../js/chess-pieces.js', () => ({
    PIECE_SVGS: global.window.PIECE_SVGS
}));

const { Tutorial } = await import('../js/tutorial.js');

describe('Tutorial System', () => {
    let tutorial;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="tutorial-overlay" class="hidden">
                <div id="tutorial-title"></div>
                <div id="tutorial-description"></div>
                <div id="tutorial-demo-container"></div>
                <div id="tutorial-steps"></div>
                <div id="tutorial-current-step"></div>
                <div id="tutorial-total-steps"></div>
                <button id="tutorial-prev"></button>
                <button id="tutorial-next"></button>
                <button id="tutorial-close"></button>
            </div>
        `;
        tutorial = new Tutorial();
        jest.clearAllMocks();
    });

    test('should initialize with correct number of steps', () => {
        expect(tutorial.steps.length).toBeGreaterThan(0);
        expect(tutorial.currentStep).toBe(0);
    });

    test('should show and close the tutorial', () => {
        tutorial.show();
        const overlay = document.getElementById('tutorial-overlay');
        expect(overlay.classList.contains('hidden')).toBe(false);

        tutorial.close();
        expect(overlay.classList.contains('hidden')).toBe(true);
    });

    test('should navigate steps', () => {
        const initialStep = tutorial.currentStep;
        tutorial.nextStep();
        expect(tutorial.currentStep).toBe(initialStep + 1);

        tutorial.prevStep();
        expect(tutorial.currentStep).toBe(initialStep);
    });

    test('should update UI on step change', () => {
        tutorial.updateStep();
        const stepsContainer = document.getElementById('tutorial-steps');
        const activeStep = stepsContainer.querySelector('.tutorial-step.active');
        expect(activeStep).toBeDefined();
        expect(activeStep.querySelector('h2').textContent).toBe(tutorial.steps[0].title);
    });

    test('getMoveType should correctly identify move categories', () => {
        // center is 2,2
        // Bishop-like move: 0,0 (dr=2, dc=2)
        expect(tutorial.getMoveType('archbishop', 0, 0)).toBe('bishop-move');
        // Knight-like move: 0,1 (dr=2, dc=1)
        expect(tutorial.getMoveType('archbishop', 0, 1)).toBe('knight-move');
        // Rook-like move: 0,2 (dr=2, dc=0)
        expect(tutorial.getMoveType('chancellor', 0, 2)).toBe('rook-move');
    });

    test('createMoveGrid should return HTML string with cells', () => {
        const html = tutorial.createMoveGrid('archbishop');
        expect(html).toContain('piece-demo-grid');
        expect(html.split('demo-cell').length - 1).toBe(25); // 5x5 grid
    });

    test('demos should return HTML strings', () => {
        expect(tutorial.createArchbishopDemo()).toContain('Erzbischof');
        expect(tutorial.createChancellorDemo()).toContain('Kanzler');
        expect(tutorial.createCorridorDemo()).toContain('Korridor');
        expect(tutorial.createShopDemo()).toContain('Punkte');
    });

    test('keyboard navigation should work', () => {
        tutorial.show();
        const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
        document.dispatchEvent(event);
        expect(tutorial.currentStep).toBe(1);

        const eventPrev = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
        document.dispatchEvent(eventPrev);
        expect(tutorial.currentStep).toBe(0);

        const eventEsc = new KeyboardEvent('keydown', { key: 'Escape' });
        document.dispatchEvent(eventEsc);
        expect(document.getElementById('tutorial-overlay').classList.contains('hidden')).toBe(true);
    });
});
