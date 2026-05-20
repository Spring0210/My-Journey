import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Vitest config lives in vitest.config.ts so this file stays Vite-pure;
// Vite 8 (rolldown) and Vitest 3.x (pinned to a rollup-based Vite) have
// incompatible plugin type signatures, and keeping `test` in here trips
// `tsc -b`.

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      // Allow "@/components/..." style imports
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    // Output directly into Spring Boot's static resource directory
    outDir: '../src/main/resources/static',
    // Do not wipe the entire directory — old files coexist during migration
    emptyOutDir: false,
    sourcemap: false,
    // Lightning CSS (Vite 8's default) over-eagerly drops the space between
    // adjacent filter functions, turning "saturate(180%) blur(20px)" into
    // "saturate(180%)blur(20px)" — which breaks -webkit-backdrop-filter
    // parsing in Safari and silently disables our frosted-glass topbar /
    // lightbox strip. esbuild is more conservative and preserves the space.
    cssMinify: 'esbuild',
  },

  server: {
    port: 5173,
    // Proxy all /api calls to Spring Boot during local development
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/oauth2': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
