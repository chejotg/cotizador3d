import js from "@eslint/js";

const nodeGlobals = {
  console: "readonly",
  process: "readonly",
  Buffer: "readonly",
  fetch: "readonly",
};

const browserGlobals = {
  window: "readonly",
  document: "readonly",
  navigator: "readonly",
  location: "readonly",
  sessionStorage: "readonly",
  localStorage: "readonly",
  confirm: "readonly",
  alert: "readonly",
  HashChangeEvent: "readonly",
  setTimeout: "readonly",
};

export default [
  js.configs.recommended,
  {
    ignores: ["node_modules/**", "dist/**", "*.min.js", "public/sw.js"],
  },
  {
    files: [
      "src/**/*.{js,jsx}",
      "tests/**/*.js",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: browserGlobals,
    },
  },
  {
    // Playwright corre en Node controlando un browser: necesita ambos conjuntos
    files: [
      "run-sql.mjs",
      "vite.config.js",
      "scripts/**/*.mjs",
    ],
    languageOptions: { globals: { ...nodeGlobals, ...browserGlobals } },
  },
  {
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
