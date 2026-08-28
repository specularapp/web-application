import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      ...jsxA11y.flatConfigs.strict.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "jsx-a11y/no-noninteractive-tabindex": ["error", { roles: ["tabpanel", "region"] }],
      "no-restricted-globals": [
        "error",
        { name: "localStorage", message: "Sem Web Storage. Ver src/docs/security.md" },
        { name: "sessionStorage", message: "Sem Web Storage. Ver src/docs/security.md" },
        { name: "indexedDB", message: "Sem Web Storage. Ver src/docs/security.md" },
      ],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "localStorage", message: "Sem Web Storage. Ver src/docs/security.md" },
        { object: "window", property: "sessionStorage", message: "Sem Web Storage. Ver src/docs/security.md" },
        { object: "window", property: "indexedDB", message: "Sem Web Storage. Ver src/docs/security.md" },
      ],
    },
  },
  {
    files: ["src/app/**/opengraph-image.tsx", "src/app/**/twitter-image.tsx"],
    rules: { "@next/next/no-img-element": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "src/types/database.ts"]),
]);
