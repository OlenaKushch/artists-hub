import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        YT: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["server.js", "api/**/*.js", "tests/**/*.js", "vite.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
];
