import { runRulesFuzzTest } from './rules.fuzz.js';

describe('Rules Engine Fuzz Test', () => {
  test('should run 500 random moves without inconsistency', () => {
    // We wrap the fuzz test in a Jest test to benefit from the test runner
    // and to integrate it into the CI pipeline if desired.
    // Reduced from 5000 to 500 for faster CI runs
    expect(() => runRulesFuzzTest(500)).not.toThrow();
  }, 30000); // 30s timeout
});
