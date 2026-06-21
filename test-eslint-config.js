import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const tsParserOptions = {
  ecmaFeatures: { jsx: true },
  ecmaVersion: 'latest',
  sourceType: 'module',
  project: ['./tsconfig.eslint.json'],
  tsconfigRootDir: import.meta.dirname,
};

export default [
  { ignores: ['dist', 'build', 'node_modules', 'coverage'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: tsParserOptions,
      globals: { ...globals.browser, React: 'readonly' },
    },
    plugins: { react, 'react-hooks': reactHooks, '@typescript-eslint': typescript, 'jsx-a11y': jsxA11y },
    rules: {
      ...js.configs.recommended.rules,
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-type-alias': 'error',
    },
  },
];
