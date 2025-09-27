module.exports = {
  root: true,
  ignorePatterns: ["dist", "build", "node_modules"],
  env: {
    es2022: true,
    browser: true,
    node: true
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    sourceType: "module",
    ecmaVersion: "latest",
    ecmaFeatures: {
      jsx: true
    },
    project: null,
    warnOnUnsupportedTypeScriptVersion: false
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  rules: {
    "@typescript-eslint/consistent-type-imports": "error"
  }
};
