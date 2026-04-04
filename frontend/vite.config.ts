import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

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
