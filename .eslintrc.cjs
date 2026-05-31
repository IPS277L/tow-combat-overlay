module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  globals: {
    game: 'readonly',
    ui: 'readonly',
    Hooks: 'readonly',
    ChatMessage: 'readonly',
    canvas: 'readonly',
    foundry: 'readonly',
    CONST: 'readonly',
    CONFIG: 'readonly',
    PIXI: 'readonly',
    Roll: 'readonly',
    Dialog: 'readonly',
    KeyboardManager: 'readonly',
    fromUuid: 'readonly',
    fromUuidSync: 'readonly',
    renderTemplate: 'readonly'
  },
  rules: {
    'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }],
    'no-console': 'off',
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'no-useless-catch': 'warn',
    'no-useless-escape': 'warn'
  }
};
