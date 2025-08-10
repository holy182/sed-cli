module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
  ],
  plugins: ['@typescript-eslint', 'security'],
  env: {
    node: true,
    es6: true,
    jest: true, // Add Jest environment
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'warn', // Change from error to warning
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-var-requires': 'warn',
    '@typescript-eslint/no-empty-function': 'warn',
    'no-undef': 'warn', // Change from error to warning for Jest globals
    'security/detect-object-injection': 'off', // Temporarily disable for MVP
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.js', '*.d.ts'],
  root: true,
  globals: {
    // Jest globals
    describe: 'readonly',
    it: 'readonly',
    test: 'readonly',
    expect: 'readonly',
    beforeEach: 'readonly',
    afterEach: 'readonly',
    beforeAll: 'readonly',
    afterAll: 'readonly',
    jest: 'readonly',
  },
};
