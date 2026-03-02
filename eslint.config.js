const js = require("@eslint/js");
const globals = require("globals");
const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  // Ignorados
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"]
  },

  // Base JS
  js.configs.recommended,

  // Base TS (incluye parser + reglas recomendadas)
  ...tseslint.configs.recommended,

  // Type-aware rules (requiere tsconfig)
  ...tseslint.configs.recommendedTypeChecked,

  // Estilo adicional para TS
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node
      },
      parserOptions: {
        project: true,
        tsconfigRootDir: __dirname
      }
    },
    rules: {
      // Ajustes prácticos
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports" }],

      // Calidad sin volverte loco
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off"
    }
  }
);
