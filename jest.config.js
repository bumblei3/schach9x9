export default {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }],
  },
  extensionsToTreatAsEsm: ['.ts'],
  verbose: true,
  testPathIgnorePatterns: ['/node_modules/', '/tests/browser/', '/e2e/', '\\.spec\\.[jt]s$'],
  setupFiles: ['<rootDir>/tests/jest.setup.cjs'],
};
