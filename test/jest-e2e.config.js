/** @type {import('jest').Config} */
export default {
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  rootDir: '..',
  setupFiles: ['<rootDir>/test/set-env.js'],
  testEnvironment: 'node',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        useESM: true,
      },
    ],
  },
};
