import eslint from "@eslint/js";
import astro from "eslint-plugin-astro";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "dist/**",
      "docs/site/**",
      "node_modules/**",
      "public/vendor/**",
      "reference/**",
      "src/env.d.ts",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs["flat/recommended"],
  {
    // eslint-plugin-astro's own TS-parser auto-detection doesn't resolve
    // @typescript-eslint/parser in this project's node_modules layout, so
    // .astro frontmatter falls back to plain espree and rejects TypeScript
    // syntax (e.g. `interface`) without this explicit override.
    files: ["**/*.astro"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".astro"],
      },
    },
  },
  {
    files: ["**/*.{js,mjs,ts,astro}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["scripts/**/*.{js,mjs}", "eslint.config.js"],
    languageOptions: {
      globals: {
        Buffer: "readonly",
        console: "readonly",
        process: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["src/worker.ts"],
    rules: {
      "no-control-regex": "off",
    },
  },
];
