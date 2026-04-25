// @ts-check

import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: [
      ".agents/**",
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  tseslint.configs.stylistic,
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
  },
  {
    files: ["**/*.{ts,mts,cts}"],
    rules: {
      "no-undef": "off",
    },
  },
  {
    files: ["src/main.ts", "src/domain/builder.ts"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2024,
      },
    },
    rules: {
      "no-undef": "error",
    },
  },
  {
    files: [
      "src/constants.ts",
      "src/data/presets.ts",
      "src/domain/parameters.ts",
      "src/io/parameters.ts",
      "src/state/crystalMutations.ts",
      "src/state/stateHelpers.ts",
    ],
    languageOptions: {
      globals: {
        ...globals.es2024,
        structuredClone: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
    },
  },
);
