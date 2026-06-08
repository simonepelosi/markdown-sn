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
          cmCore: [
            '@codemirror/commands',
            '@codemirror/language',
            '@codemirror/search',
            '@codemirror/state',
            '@codemirror/view',
            '@lezer/highlight',
          ],
          cmMarkdown: ['@codemirror/lang-markdown'],
          markdown: ['marked', 'dompurify'],
          katex:    ['katex'],
          relay:    ['@standardnotes/component-relay'],
        }
      },
    },
  },
  optimizeDeps: {
    include: ['@standardnotes/component-relay'],
  },
})
