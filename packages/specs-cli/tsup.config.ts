import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  clean: true,
  splitting: false,
  dts: false,
  noExternal: ['@sitespecs/analyzer-core', '@sitespecs/contracts'],
  outDir: 'dist',
});
