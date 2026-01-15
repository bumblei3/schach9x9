import { describe, test, expect, beforeEach } from 'vitest';
import { campaignManager } from '../js/campaign/CampaignManager.js';

// Minimal mock for level data to test Mission 2 specifically
const MISSION_2_ID = 'bandit_ambush';

describe('Mission 2 Remis Victory', () => {
  beforeEach(() => {
    campaignManager.resetState();
  });

  test('Mission 2 should have drawCountsAsWin flag', () => {
    const level = campaignManager.getLevel(MISSION_2_ID);
    expect(level).toBeDefined();
    expect(level?.winCondition.drawCountsAsWin).toBe(true);
  });

  test('completeLevel should calculate 1 star for a base completion (e.g. draw)', () => {
    // Even if we don't meet any goals, a completion should give 1 star
    const stats = { moves: 99, materialDiff: -10, promotedCount: 0 };
    const stars = campaignManager.completeLevel(MISSION_2_ID, stats);
    expect(stars).toBe(1);
    expect(campaignManager.isLevelCompleted(MISSION_2_ID)).toBe(true);
  });

  test('completeLevel should calculate 3 stars if goals are met', () => {
    // Chapter 2 goals: 2 stars < 25 moves, 3 stars < 12 moves
    const stats = { moves: 10, materialDiff: 0, promotedCount: 0 };
    const stars = campaignManager.completeLevel(MISSION_2_ID, stats);
    expect(stars).toBe(3);
  });
});
