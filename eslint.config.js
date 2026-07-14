import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const restrictedImportPatterns = [
  "@ownables/*/dist/*",
  "@ownables/*/src/*",
];

export default tseslint.config(
  {
    ignores: [
      "build/**",
      "dist/**",
      "features/**",
      "node_modules/**",
      "ownables/**/pkg/**",
      "ownables/**/schema/**",
      "public/**",
      "src/verification/**",
    ],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tseslint.parser,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}", "features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: restrictedImportPatterns,
        },
      ],
    },
  },
  {
    files: ["src/index.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  }
);
