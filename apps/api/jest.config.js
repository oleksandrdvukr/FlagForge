/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '\\.(spec|e2e-spec)\\.ts$',
  moduleNameMapper: {
    // Test against shared sources so a prior build is not required.
    '^@flagforge/shared$': '<rootDir>/../../packages/shared/src',
  },
};
