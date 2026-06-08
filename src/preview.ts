import { marked, type MarkedExtension, type Tokens } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js/lib/common'
import DOMPurify from 'dompurify'
import katex from 'katex'

// ── Math token shapes ─────────────────────────────────────────────────
interface MathToken {
  type: string
  raw: string
  math: string
}

function isMathToken(t: unknown): t is MathToken {
  return (
    t !== null &&
    typeof t === 'object' &&
    'math' in t &&
    typeof (t as { math: unknown }).math === 'string'
  )
}

// ── Math extension ────────────────────────────────────────────────────
// marked's Tokens.Generic uses [key: string]: unknown, so we validate
// before accessing the 'math' field.
const mathExtension: MarkedExtension = {
  extensions: [
    {
      name: 'blockMath',
      level: 'block',
      start(src: string): number { return src.indexOf('$$') },
      tokenizer(src: string) {
        const match = /^\$\$\n?([\s\S]*?)\n?\$\$/.exec(src)
        if (match) {
          return { type: 'blockMath', raw: match[0], math: match[1].trim() }
        }
        return undefined
      },
      renderer(token): string {
        const math = isMathToken(token) ? token.math : ''
        try {
          return `<div class="math-block">${katex.renderToString(math, {
            displayMode: true,
            throwOnError: false,
          })}</div>\n`
        } catch {
          return `<div class="math-error">${math}</div>\n`
        }
      },
    },
    {
      name: 'inlineMath',
      level: 'inline',
      start(src: string): number { return src.indexOf('$') },
      tokenizer(src: string) {
        const match = /^\$([^$\n]+?)\$/.exec(src)
        if (match) {
          return { type: 'inlineMath', raw: match[0], math: match[1].trim() }
        }
        return undefined
      },
      renderer(token): string {
        const math = isMathToken(token) ? token.math : ''
        try {
          return `<span class="math-inline">${katex.renderToString(math, {
            throwOnError: false,
          })}</span>`
        } catch {
          return `<span class="math-error">${math}</span>`
        }
      },
    },
  ],
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(text: string, encode: boolean): string {
  const pattern = encode
    ? /[&<>"']/g
    : /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g
  return pattern.test(text)
    ? text.replace(pattern, ch => HTML_ESCAPES[ch] ?? ch)
    : text
}

// ── Configure marked ──────────────────────────────────────────────────
marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code: string, lang: string): string {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    },
  }),
)

marked.use({
  renderer: {
    code({ text, lang, escaped }: Tokens.Code): string {
      const langMatch = (lang ?? '').match(/\S+/)
      const language = langMatch ? langMatch[0].toLowerCase() : ''
      const classAttr = language
        ? ` class="hljs language-${escapeHtml(language, true)}"`
        : ' class="hljs"'
      const langAttr = language
        ? ` data-lang="${escapeHtml(language, true)}"`
        : ''
      const code = text.replace(/\n$/, '')
      return `<pre${langAttr}><code${classAttr}>${escaped ? code : escapeHtml(code, true)}\n</code></pre>`
    },
  },
})

marked.use(mathExtension)

marked.use({ gfm: true, breaks: false })

// ── DOMPurify config ──────────────────────────────────────────────────
// KaTeX outputs nested <span> elements with class names. MathML tags
// are emitted for accessibility. Both need to be allowed through.
const KATEX_TAGS = [
  'annotation', 'annotation-xml', 'math', 'menclose', 'merror', 'mfrac',
  'mglyph', 'mi', 'mlabeledtr', 'mmultiscripts', 'mn', 'mo', 'mover',
  'mpadded', 'mphantom', 'mroot', 'mrow', 'ms', 'mspace', 'msqrt',
  'mstyle', 'msub', 'msup', 'msubsup', 'mtable', 'mtd', 'mtext',
  'mtr', 'munder', 'munderover', 'semantics',
]

// ── Public API ────────────────────────────────────────────────────────
export function renderMarkdown(source: string): string {
  // marked.parse is synchronous when no async extensions are registered
  const html = marked.parse(source) as string
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true, mathMl: true },
    ADD_TAGS: KATEX_TAGS,
    ADD_ATTR: [
      'encoding', 'columnalign', 'rowalign', 'rowspacing', 'columnspacing',
      'aria-hidden', 'data-lang',
    ],
    FORBID_TAGS: ['script', 'style'],
    FORBID_ATTR: [
      'onerror', 'onload', 'onfocus', 'onblur', 'onmouseover',
      'onmouseout', 'onclick', 'onkeydown', 'onkeyup',
    ],
  })
}

export function extractPreviewPlain(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, '')              // headings
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')  // bold / italic
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')    // underscore variants
    .replace(/~~([^~]+)~~/g, '$1')             // strikethrough
    .replace(/`{1,3}[^`]+`{1,3}/g, '')        // code
    .replace(/!?\[([^\]]+)\]\([^)]+\)/g, '$1') // links / images
    .replace(/^[>\-*+] /gm, '')               // blockquotes / lists
    .replace(/\$\$[\s\S]*?\$\$/g, '')         // block math
    .replace(/\$[^$]+\$/g, '')               // inline math
    .replace(/\n{2,}/g, ' ')                 // collapse blank lines
    .trim()
    .slice(0, 200)
}
