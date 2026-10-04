import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Os testes de integração usam o mesmo PostgreSQL do desenvolvimento.
    // `fileParallelism: false` evita que dois arquivos disputem o mesmo schema.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});