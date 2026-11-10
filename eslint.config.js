// Contrôle du code : npm run lint
import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist/**", "node_modules/**", "public/**"] },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: { react, "react-hooks": hooks },
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } },
    settings: { react: { version: "18" } },
    rules: {
      "react-hooks/rules-of-hooks": "error",     // les vraies règles des hooks
      "react-hooks/exhaustive-deps": "warn",     // les règles « compilateur React » (purity, refs…) ne sont pas utilisées ici
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "off",
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["scripts/**/*.{js,mjs}", "api/**/*.js", "vite.config.js", "eslint.config.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: { ...globals.node, ...globals.browser } },
    rules: { "no-unused-vars": "off", "no-empty": ["warn", { allowEmptyCatch: true }] },   // scripts et tests : des variables de travail inutilisées sont sans gravité
  },
];
