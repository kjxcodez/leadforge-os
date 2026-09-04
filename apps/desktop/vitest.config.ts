import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 20000,
    include: ['src/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/.next/**',
      '**/*.js',
      '**/*.d.ts',
      // Native Electron SQLite integration tests executed via test:integration runner
      'src/main/services/audiences.test.ts',
      'src/main/services/campaign.test.ts',
      'src/main/services/fresh-database.test.ts',
      'src/main/services/fresh-database-all-queries.test.ts',
      'src/main/services/post-release-stabilization.test.ts',
      'src/main/services/release-qualification.test.ts'
    ],
    alias: {
      '@leadforge/schema': path.resolve(__dirname, '../../packages/schema/src/index.ts'),
      '@leadforge/sdk': path.resolve(__dirname, '../../packages/sdk/src/index.ts'),
      '@leadforge/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@leadforge/logger': path.resolve(__dirname, '../../packages/logger/src/index.ts'),
      '@leadforge/auth': path.resolve(__dirname, '../../packages/auth/src/index.ts')
    }
  }
});
