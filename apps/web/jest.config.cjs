/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testRegex: '\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
          types: ['jest'],
          isolatedModules: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@flagforge/shared$': '<rootDir>/../../packages/shared/src',
  },
};
