import typescriptEslint from '@typescript-eslint/eslint-plugin';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import svelteParser from 'svelte-eslint-parser';
import js from '@eslint/js';
import sveltePlugin from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';

export default [
	js.configs.recommended,
	{
		ignores: [
			'**/.DS_Store',
			'**/node_modules',
			'build',
			'.svelte-kit',
			'.vercel',
			'package',
			'**/.env',
			'**/.env.*',
			'!**/.env.example',
			'**/pnpm-lock.yaml',
			'**/package-lock.json',
			'**/yarn.lock'
		]
	},
	{
		files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			},
			ecmaVersion: 2020,
			sourceType: 'module'
		}
	},
	{
		files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
		plugins: {
			'@typescript-eslint': typescriptEslint
		},
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
				...globals.serviceworker,
				NodeJS: 'readonly'
			},
			parser: tsParser,
			ecmaVersion: 2020,
			sourceType: 'module'
		},
		rules: {
			...typescriptEslint.configs.recommended.rules,
			'svelte/no-navigation-without-resolve': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_'
				}
			]
		}
	},
	...sveltePlugin.configs['flat/recommended'],
	{
		files: ['**/*.svelte.ts', '**/*.svelte.js'],
		plugins: {
			'@typescript-eslint': typescriptEslint
		},
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
				// Svelte 5 runes
				$state: 'readonly',
				$derived: 'readonly',
				$effect: 'readonly',
				$props: 'readonly',
				$bindable: 'readonly',
				$inspect: 'readonly'
			},
			parser: tsParser,
			ecmaVersion: 2020,
			sourceType: 'module'
		},
		rules: {
			...typescriptEslint.configs.recommended.rules
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
				NodeJS: 'readonly'
			},
			parser: svelteParser,
			parserOptions: {
				parser: tsParser
			}
		},
		rules: {
			'svelte/no-at-html-tags': 'off',
			'svelte/no-navigation-without-resolve': 'off',
			'@typescript-eslint/no-unused-expressions': 'off',
			'no-undef': 'off',
			'no-unused-vars': 'off',
			'svelte/require-each-key': 'warn' // Downgrade to warning instead of error
		}
	},
	{
		// Disable svelte navigation rule for all TS files (not .svelte)
		files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts', '**/*.js', '**/*.cjs', '**/*.mjs'],
		rules: {
			'svelte/no-navigation-without-resolve': 'off'
		}
	},
	prettier
];
