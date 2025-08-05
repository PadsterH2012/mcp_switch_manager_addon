module.exports = {
    env: {
        browser: true,
        commonjs: true,
        es2021: true,
        node: true,
        jest: true
    },
    extends: [
        'eslint:recommended'
    ],
    parserOptions: {
        ecmaVersion: 12
    },
    rules: {
        'indent': ['error', 2],
        'linebreak-style': ['error', 'unix'],
        'quotes': ['off'],
        'semi': ['error', 'always'],
        'no-unused-vars': ['warn'],
        'no-console': ['off'],
        'no-case-declarations': ['off']
    }
};
