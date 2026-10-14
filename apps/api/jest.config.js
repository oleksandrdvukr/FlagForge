/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '\\.(spec|int-spec|e2e-spec)\\.ts$',
  moduleNameMapper: {
    // Test against shared sources so a prior build is not required.
    '^@flagforge/shared$': '<rootDir>/../../packages/shared/src',
  },
  // Resets the `<db>_test` database and applies all migrations once per run.
  globalSetup: '<rootDir>/test/setup/global-setup.ts',
  setupFiles: ['<rootDir>/test/setup/auth-env.ts'],
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/**/index.ts'],
  coverageReporters: ['text-summary', 'lcov'],
  coverageThreshold: {
    // The evaluation engine is the core of the product: every line and branch must be tested.
    './src/evaluation/engine/': { lines: 100, branches: 100, functions: 100, statements: 100 },
  },
};
