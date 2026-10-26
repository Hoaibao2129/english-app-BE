/** @type {import('jest').Config} */
export default {
  collectCoverageFrom: ['src/**/*.{ts,js}'],
  coverageDirectory: 'coverage',
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: 'src/.*\\.spec\\.ts$',
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
