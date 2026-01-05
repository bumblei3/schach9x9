export default {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>'],
  moduleFileExtensions: ['js', 'json'],
  transform: {},
  verbose: true,
  testPathIgnorePatterns: ['/node_modules/', '/tests/browser/', '\\.spec\\.js$'],
  setupFiles: ['<rootDir>/tests/jest.setup.cjs'],
};
