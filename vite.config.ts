import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Split heavy rendering deps into their own chunks so the browser
        // can parse them in parallel with the core editor chunk.
        manualChunks: {
          katex:   ['katex'],
          hljs:    ['highlight.js', 'marked-highlight'],
          relay:   ['@standardnotes/component-relay'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['@standardnotes/component-relay'],
  },
})
