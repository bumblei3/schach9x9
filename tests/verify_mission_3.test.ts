import { describe, expect, test } from 'vitest';
import { CAMPAIGN_LEVELS } from '../js/campaign/campaignData';

describe('Mission 3 Simplification Verification', () => {
    const mission3 = CAMPAIGN_LEVELS.find(l => l.id === 'skirmish_bridge');

    test('Mission 3 should exist', () => {
        expect(mission3).toBeDefined();
    });

    test('Mission 3 should be easy difficulty', () => {
        expect(mission3?.difficulty).toBe('easy');
    });

    test('Mission 3 FEN should not contain enemy Queen', () => {
        // Original FEN had 'q' (black queen)
        // New FEN should likely replace it with '1' or be different
        const boardState = mission3?.fen.split(' ')[0];
        expect(boardState).toContain('rnb1kcbjr');
        expect(boardState).not.toContain('q');
    });

    test('Mission 3 goals should be relaxed', () => {
        const goals = mission3?.goals;
        if (!goals) throw new Error('Goals not defined');

        // Goal 2: < 60 moves (was 50)
        expect(goals[2]).toBeDefined();
        expect(goals[2].value).toBe(60);

        // Goal 3: +5 material (was 8)
        expect(goals[3]).toBeDefined();
        expect(goals[3].value).toBe(5);
    });
});
