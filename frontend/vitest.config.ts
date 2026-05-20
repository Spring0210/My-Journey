import { defineConfig } from 'vitest/config'
import path from 'path'

// Standalone Vitest config so Vite 8's rolldown-based plugin types don't
// conflict with Vitest 3.x's rollup-based plugin types under `tsc -b`. We
// repeat the @/ alias here so tests resolve imports the same way as the
// app bundle. The Vite React plugin is NOT loaded -- @testing-library
// renders into jsdom directly, no transform needed.

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
