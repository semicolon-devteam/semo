import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: [
      'dist/**',
      'node_modules/**',
      'src/commands/commitments.test.ts',
      'src/commands/skill-sync.test.ts',
    ],
  },
});
