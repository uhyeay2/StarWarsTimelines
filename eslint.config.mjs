// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from '@angular-eslint/eslint-plugin';
import angularTemplate from '@angular-eslint/eslint-plugin-template';
import templateParser from '@angular-eslint/template-parser';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/', '.angular/', 'out-tsc/'] },

  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.ts'],
    plugins: { '@angular-eslint': angular },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],

      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@angular-eslint/prefer-standalone': 'error',
      '@angular-eslint/no-output-on-prefix': 'error',
      '@angular-eslint/no-output-rename': 'error',
      '@angular-eslint/no-input-rename': 'error',
      '@angular-eslint/use-component-view-encapsulation': 'error',
      '@angular-eslint/no-lifecycle-call': 'error',
      '@angular-eslint/prefer-signals': 'error',
      '@angular-eslint/no-uncalled-signals': 'error',
      '@angular-eslint/use-injectable-provided-in': 'error',
    },
  },

  {
    files: ['**/*.html'],
    languageOptions: {
      parser: templateParser,
    },
    plugins: { '@angular-eslint/template': angularTemplate },
    rules: {
      // Disabled: the rule predates Angular signals and flags every signal
      // read (e.g. `{{ title() }}`, `[disabled]="first()"`) as a call
      // expression, which is the recommended reactive pattern with OnPush.
      // '@angular-eslint/template/no-call-expression': 'warn',
      '@angular-eslint/template/cyclomatic-complexity': ['warn', { maxComplexity: 8 }],
      '@angular-eslint/template/conditional-complexity': ['warn', { maxComplexity: 3 }],
      '@angular-eslint/template/no-negated-async': 'error',
      '@angular-eslint/template/use-track-by-function': 'error',

      '@angular-eslint/template/click-events-have-key-events': 'error',
      '@angular-eslint/template/mouse-events-have-key-events': 'error',
      '@angular-eslint/template/interactive-supports-focus': 'error',
      '@angular-eslint/template/elements-content': 'error',
      '@angular-eslint/template/label-has-associated-control': 'error',
      '@angular-eslint/template/role-has-required-aria': 'error',
      '@angular-eslint/template/valid-aria': 'error',
      '@angular-eslint/template/no-positive-tabindex': 'error',
      '@angular-eslint/template/button-has-type': 'error',
    },
  },
);
