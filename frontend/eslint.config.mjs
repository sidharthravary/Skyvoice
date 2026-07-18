import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Legacy voice/dashboard code wraps untyped browser speech APIs and
      // fetch-in-effect patterns — surface these as warnings, not CI failures.
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
      // The React-compiler strictness rules misfire on the imperative
      // speech/audio plumbing in useVoiceAI (hoisted function declarations,
      // fetch/Audio calls flagged as "render") — keep them advisory.
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
