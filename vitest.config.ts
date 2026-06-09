import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['node_modules', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'lib/navigation.ts',
        'lib/claude.ts',
        'components/**/*.tsx',
        'app/api/me/route.ts',
        'app/api/settings/route.ts',
        'app/api/settings/validate-key/route.ts',
        'app/api/trips/route.ts',
        'app/api/trips/[id]/route.ts',
        'app/api/trips/[id]/data/route.ts',
        'app/api/trips/[id]/generate/route.ts',
      ],
      thresholds: {
        lines: 40,
        functions: 25,
        branches: 35,
        statements: 40,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
})
