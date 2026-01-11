import { runRulesFuzzTest } from './rules.fuzz.js';

describe('Rules Engine Fuzz Test', () => {
    test('should run 5000 random moves without inconsistency', () => {
        // We wrap the fuzz test in a Jest test to benefit from the test runner
        // and to integrate it into the CI pipeline if desired.
        expect(() => runRulesFuzzTest(5000)).not.toThrow();
    });
});
