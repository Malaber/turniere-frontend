import js from '@eslint/js';
import google from 'eslint-config-google';
import react from 'eslint-plugin-react';
import globals from 'globals';

const googleRules = {...google.rules};

delete googleRules['require-jsdoc'];
delete googleRules['valid-jsdoc'];

export default [
    {
        ignores: [
            '.next/**',
            'e2e/node_modules/**',
            'e2e/screenshots/**',
            'e2e/scripts/**',
            'e2e/test-results/**',
            'node_modules/**'
        ]
    },
    js.configs.recommended,
    {
        files: ['**/*.{js,mjs}'],
        languageOptions: {
            ecmaVersion: 2022,
            globals: {
                ...globals.browser,
                ...globals.es2015,
                ...globals.node
            },
            parserOptions: {
                ecmaFeatures: {
                    jsx: true
                }
            },
            sourceType: 'module'
        },
        plugins: {
            react
        },
        rules: {
            ...googleRules,
            'arrow-parens': ['error', 'as-needed'],
            'comma-dangle': ['error', 'never'],
            'indent': [
                'error',
                4
            ],
            'linebreak-style': [
                'error',
                'unix'
            ],
            'max-len': [
                'error',
                {code: 120}
            ],
            'no-unused-vars': [
                'error',
                {
                    args: 'none',
                    caughtErrors: 'none'
                }
            ],
            'quotes': [
                'error',
                'single'
            ],
            'react/jsx-uses-react': 'error',
            'react/jsx-uses-vars': 'error',
            'semi': [
                'error',
                'always'
            ]
        },
        settings: {
            react: {
                version: 'detect'
            }
        }
    }
];
