import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    server: {
      deps: {
        // @qntm-code/utils MJS build uses bare directory imports that are invalid
        // in native Node.js ESM. Inlining it lets Vite resolve them correctly.
        inline: [/@qntm-code/],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      exclude: ['src/**/*.test.ts'],
    },
  },
});
