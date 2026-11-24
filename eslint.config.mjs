import js from "@eslint/js";
import tseslint from "typescript-eslint";
export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".local-*/**",
      "storage/**",
      "docs/**",
      "next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mjs}"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        window: "readonly",
        document: "readonly",
        location: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        FormData: "readonly",
        File: "readonly",
        Headers: "readonly",
        Request: "readonly",
        Response: "readonly",
        URL: "readonly",
        Blob: "readonly",
        AbortController: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        BeforeUnloadEvent: "readonly",
        KeyboardEvent: "readonly",
        React: "readonly",
        getComputedStyle: "readonly",
        innerWidth: "readonly",
        matchMedia: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
