import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(
 {ignores:['dist/**','node_modules/**','.wrangler/**','apps/web/public/app.js']},
 js.configs.recommended,
 ...tseslint.configs.recommended,
 {files:['**/*.ts','**/*.tsx','**/*.mjs'],rules:{'no-undef':'off','@typescript-eslint/no-explicit-any':'off','@typescript-eslint/no-unused-vars':'off','no-unused-vars':'off','@typescript-eslint/no-non-null-assertion':'off'}},
);
