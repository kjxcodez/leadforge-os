import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      'report/**',
      'stitch_leadforge_dashboard_design_system/**',
      '**/*.js',
      '**/*.cjs',
      '**/*.test.ts'
    ]
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-wrapper-object-types': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
      'no-case-declarations': 'off',
      'no-empty': 'off',
      'no-constant-condition': 'off',
      'no-useless-escape': 'off',
      'no-inner-declarations': 'off',
      'no-async-promise-executor': 'off',
      'no-prototype-builtins': 'off',
      'no-cond-assign': 'off',
      'no-control-regex': 'off',
      'no-extra-boolean-cast': 'off',
      'no-fallthrough': 'off',
      'no-sparse-arrays': 'off',
      'no-useless-assignment': 'off',
      'preserve-caught-error': 'off',
      'prefer-const': 'off',
      'no-useless-catch': 'off'
    }
  }
);
