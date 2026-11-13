import js from '@eslint/js';
import globals from 'globals';

export default [
    {
        // third-party and generated code
        ignores: ['dist/', 'test-lib/']
    },
    js.configs.recommended,
    {
        files: ['src/**/*.js', 'spec/**/*.js'],
        languageOptions: {
            ecmaVersion: 2015,
            sourceType: 'script',
            globals: {
                ...globals.browser,
                module: 'readonly'
            }
        },
        rules: {
            eqeqeq: 'error',
            'new-cap': 'error',
            'no-unused-vars': ['error', { args: 'all', caughtErrors: 'none' }]
        }
    },
    {
        files: ['spec/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.mocha,
                $: 'readonly',
                Tesseract: 'readonly'
            }
        }
    },
    {
        files: ['*.mjs', 'scripts/**/*.mjs'],
        languageOptions: {
            sourceType: 'module',
            globals: globals.node
        }
    }
];
