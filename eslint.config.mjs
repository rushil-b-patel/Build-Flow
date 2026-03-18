import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default [
    { files: ["**/*.{js,mjs,cjs,ts,tsx}"] },
    { languageOptions: { globals: globals.node } },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            "no-console": "warn",
            "@typescript-eslint/no-explicit-any": "warn",
            "prefer-const": "error",
            "no-var": "error",
            eqeqeq: ["error", "always"],
            "prettier/prettier": ["error", { tabWidth: 4 }],
        },
    },
    eslintPluginPrettierRecommended,
    {
        ignores: ["**/node_modules/**", "**/dist/**", "**/output/**"],
    },
];
