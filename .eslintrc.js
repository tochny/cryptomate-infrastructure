module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es6: true
  },
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  plugins: [
    'eslint-plugin',
    '@typescript-eslint',
    'eslint-comments',
    'jest'
  ],
  // add your custom rules here
  rules: {}
}
