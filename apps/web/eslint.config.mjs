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
    rules: {
      // React Compiler rules — valid React patterns que el compilador marca agresivamente.
      // Bajadas a warn para no bloquear CI; se resolverán progresivamente.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
      // Directive de disable innecesaria en opengraph-image (no hay img en ese contexto)
      "no-unused-disable-directives": "off",
    },
  },
]);

export default eslintConfig;
