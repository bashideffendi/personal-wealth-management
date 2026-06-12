import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Scope ke pola file yang sama dengan config "next" — rule react-hooks/*
    // error kalau kena file di luar registrasi plugin (mis. *.cjs).
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      // Hidrasi localStorage/theme/SW di mount pakai setState-in-effect — idiom
      // yang sengaja (lazy initializer bakal mismatch SSR). Turunin ke warn biar
      // kode baru tetep ke-flag tapi gak ngeblok CI; refactor per-komponen nyusul.
      'react-hooks/set-state-in-effect': 'warn',
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
    },
  },
]);

export default eslintConfig;
