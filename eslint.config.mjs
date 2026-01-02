import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-plugin-prettier";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([globalIgnores(["build", "dist"]), {
    plugins: {
        prettier,
    },

    linterOptions: {
        reportUnusedDisableDirectives: true,
    },
}, {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    extends: compat.extends("plugin:prettier/recommended"),

    rules: {
        "no-unused-vars": "off",
        "no-duplicate-imports": "error",
        "no-unused-expressions": "error",
    },
}, {
    files: ["**/*.ts", "**/*.tsx"],

    extends: compat.extends(
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
    ),

    languageOptions: {
        ecmaVersion: 5,
        sourceType: "script",

        parserOptions: {
            project: ["tsconfig.json"],
            createDefaultProgram: true,
        },
    },

    rules: {
        "@typescript-eslint/no-non-null-assertion": "off",

        "@typescript-eslint/no-unused-vars": ["error", {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
            caughtErrorsIgnorePattern: "^_",
        }],
    },
}]);