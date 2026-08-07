import react from 'eslint-plugin-react';

export default [
  {
    files: ['src/**/*.{js,jsx}', 'tests/**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { react },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }], 'react/jsx-uses-vars': 'error' },
  },
  {
    files: ['webpack.config.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs' },
    rules: { 'no-unused-vars': 'error' },
  },
];
