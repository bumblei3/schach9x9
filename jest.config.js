export default {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>'],
  moduleFileExtensions: ['js', 'json'],
  transform: {},
  verbose: true,
  testPathIgnorePatterns: ['/node_modules/', '/tests/browser/', '\\.spec\\.js$'],
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],
};
