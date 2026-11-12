import globals from 'globals';
const unused = [
  'error',
  { varsIgnorePattern: '^[A-Z]', argsIgnorePattern: '^_', ignoreRestSiblings: true },
];
export default [
  { ignores: ['**/dist/**', '**/node_modules/**', '.npm-cache/**'] },
  {
    files: ['client/src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: { 'no-undef': 'error', 'no-unused-vars': unused },
  },
  {
    files: ['server/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
    rules: { 'no-undef': 'error', 'no-unused-vars': unused },
  },
];
