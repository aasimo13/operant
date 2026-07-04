import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  // Bundle the workspace package (its `main` points at TypeScript source, which
  // Node can't run). Real npm deps (pg, ws, dotenv) stay external — they're in
  // node_modules at runtime.
  noExternal: ['@operant/core'],
});
