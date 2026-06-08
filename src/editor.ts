import {
  Compartment,
  EditorSelection,
  EditorState,
  type Extension,
} from '@codemirror/state'
import {
  EditorView,
  type ViewUpdate,
  keymap,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  rectangularSelection,
  crosshairCursor,
} from '@codemirror/view'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo,
  undo,
} from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

let markdownExtension: Promise<Extension> | null = null

function loadMarkdownExtension(): Promise<Extension> {
  markdownExtension ??= import('@codemirror/lang-markdown').then(({ markdown, markdownLanguage }) =>
    markdown({ base: markdownLanguage }),
  )
  return markdownExtension
}

// ── Types ─────────────────────────────────────────────────────────────
export interface EditorOptions {
  onChange: (value: string) => void
  onScroll: (pct: number) => void
  onCursor: (line: number, col: number) => void
}

// ── Theme factory ─────────────────────────────────────────────────────
function makeThemeExtension(): Extension {
  const base = EditorView.theme({
    '&': {
      height: '100%',
      background: 'var(--ed-bg)',
      color: 'var(--ed-fg)',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { overflow: 'auto', height: '100%' },
    '.cm-content': {
      caretColor: 'var(--ed-cursor)',
      padding: '20px 24px',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--ed-cursor)',
    },
    '.cm-selectionBackground': {
      background: 'var(--ed-sel) !important',
    },
    '&.cm-focused .cm-selectionBackground': {
      background: 'var(--ed-sel-f) !important',
    },
    '.cm-activeLine': { background: 'var(--ed-active)' },
    '.cm-gutters': { display: 'none' },
    '.cm-activeLineGutter': { display: 'none' },
  })

  const highlight = HighlightStyle.define([
    // Per-level heading colours so H1/H2/H3 stand out from each other.
    // HighlightStyle uses the most-specific tag match, so per-level rules
    // override the generic heading rule below.
    { tag: tags.heading1, color: 'var(--syn-h1)', fontWeight: '700', fontSize: '1.4em' },
    { tag: tags.heading2, color: 'var(--syn-h2)', fontWeight: '700', fontSize: '1.25em' },
    { tag: tags.heading3, color: 'var(--syn-h3)', fontWeight: '700', fontSize: '1.1em' },
    { tag: [tags.heading4, tags.heading5, tags.heading6],
      color: 'var(--syn-h)', fontWeight: '700' },
    // Inline styles
    { tag: tags.strong,        fontWeight: '700', color: 'var(--syn-strong)' },
    { tag: tags.emphasis,      fontStyle: 'italic', color: 'var(--syn-em)' },
    { tag: tags.strikethrough, textDecoration: 'line-through', color: 'var(--syn-em)' },
    // Links and URLs
    { tag: tags.link,          color: 'var(--syn-link)', textDecoration: 'underline' },
    { tag: tags.url,           color: 'var(--syn-link)' },
    // Inline code — monospace + red
    { tag: tags.monospace,     fontFamily: 'var(--ed-mono)', color: 'var(--syn-code)',
      background: 'transparent' },
    // Block elements
    { tag: tags.quote,         color: 'var(--syn-quote)', fontStyle: 'italic' },
    { tag: tags.list,          color: 'var(--syn-list)' },
    { tag: tags.contentSeparator, color: 'var(--syn-hr)' },
    // Formatting markers (**, __, #, ```) — dimmed so the content reads first
    { tag: tags.punctuation,   color: 'var(--syn-fmt)', opacity: '0.55' },
    // Meta / processing instructions
    { tag: [tags.meta, tags.processingInstruction], color: 'var(--syn-meta)' },
    // ── Embedded fenced-code tokens ───────────────────────────────────
    { tag: [tags.comment, tags.lineComment, tags.blockComment],
      color: 'var(--syn-cmt)', fontStyle: 'italic' },
    { tag: tags.keyword, color: 'var(--syn-kw)' },
    { tag: [tags.regexp, tags.escape, tags.special(tags.string)],
      color: 'var(--syn-regexp)' },
    { tag: tags.string, color: 'var(--syn-str)' },
    { tag: [tags.number, tags.bool, tags.atom, tags.literal],
      color: 'var(--syn-num)' },
    { tag: [tags.typeName, tags.className, tags.namespace],
      color: 'var(--syn-cls)' },
    { tag: [tags.tagName, tags.angleBracket], color: 'var(--syn-tag)' },
    { tag: [tags.function(tags.variableName), tags.function(tags.propertyName),
            tags.definition(tags.function(tags.variableName)), tags.labelName],
      color: 'var(--syn-fn)' },
    { tag: [tags.propertyName, tags.attributeName,
            tags.definition(tags.propertyName)], color: 'var(--syn-prop)' },
    { tag: [tags.variableName, tags.definition(tags.variableName),
            tags.special(tags.variableName)], color: 'var(--syn-var)' },
    { tag: [tags.operator, tags.logicOperator, tags.arithmeticOperator,
            tags.compareOperator, tags.definitionOperator],
      color: 'var(--syn-op)' },
    { tag: [tags.bracket, tags.squareBracket, tags.paren, tags.brace,
            tags.separator], color: 'var(--syn-punc)' },
    { tag: tags.inserted, color: 'var(--syn-ins)' },
    { tag: tags.deleted, color: 'var(--syn-del)' },
  ])

  return [base, syntaxHighlighting(highlight)]
}

// ── Wrap / insert helpers ─────────────────────────────────────────────
function wrapSelection(
  view: EditorView,
  before: string,
  after: string,
  placeholder: string,
): boolean {
  const { state } = view
  const changes = state.changeByRange((range) => {
    const selected = state.doc.sliceString(range.from, range.to)
    const text = selected || placeholder
    return {
      changes: { from: range.from, to: range.to, insert: `${before}${text}${after}` },
      range: EditorSelection.range(
        range.from + before.length,
        range.from + before.length + text.length,
      ),
    }
  })
  view.dispatch(changes)
  return true
}

function insertAtLineStart(view: EditorView, prefix: string): boolean {
  const { state } = view
  const changes = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.from)
    const current = line.text
    // Toggle: remove if already present, add if not
    if (current.startsWith(prefix)) {
      return {
        changes: { from: line.from, to: line.from + prefix.length, insert: '' },
        range: EditorSelection.range(
          range.from - prefix.length,
          range.head - prefix.length,
        ),
      }
    }
    return {
      changes: { from: line.from, insert: prefix },
      range: EditorSelection.range(
        range.from + prefix.length,
        range.head + prefix.length,
      ),
    }
  })
  view.dispatch(changes)
  return true
}

// ── Editor class ──────────────────────────────────────────────────────
export class Editor {
  private view: EditorView
  private themeComp = new Compartment()
  private spellComp = new Compartment()
  private langComp = new Compartment()

  constructor(container: HTMLElement, private opts: EditorOptions) {
    const state = EditorState.create({
      doc: '',
      extensions: this.buildExtensions(),
    })
    this.view = new EditorView({ state, parent: container })
    this.enableMarkdown()
  }

  private enableMarkdown(): void {
    void loadMarkdownExtension().then((extension) => {
      this.view.dispatch({ effects: this.langComp.reconfigure(extension) })
    })
  }

  private buildExtensions(): Extension[] {
    return [
      history(),
      highlightSpecialChars(),
      drawSelection(),
      dropCursor(),
      highlightActiveLine(),
      rectangularSelection(),
      crosshairCursor(),
      highlightSelectionMatches(),
      EditorView.lineWrapping,
      this.langComp.of([]),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        indentWithTab,
        {
          key: 'Mod-b',
          run: (v) => wrapSelection(v, '**', '**', 'bold text'),
        },
        {
          key: 'Mod-i',
          run: (v) => wrapSelection(v, '_', '_', 'italic text'),
        },
        {
          key: 'Mod-`',
          run: (v) => wrapSelection(v, '`', '`', 'code'),
        },
        {
          key: 'Mod-Shift-x',
          run: (v) => wrapSelection(v, '~~', '~~', 'strikethrough'),
        },
        {
          key: 'Mod-k',
          run: (v) => wrapSelection(v, '[', '](url)', 'link text'),
        },
        {
          key: 'Mod-Shift-k',
          run: (v) => wrapSelection(v, '![', '](url)', 'alt text'),
        },
        {
          key: 'Mod-Shift-7',
          run: (v) => insertAtLineStart(v, '1. '),
        },
        {
          key: 'Mod-Shift-8',
          run: (v) => insertAtLineStart(v, '- '),
        },
        {
          key: 'Mod-Shift-.',
          run: (v) => insertAtLineStart(v, '> '),
        },
      ]),
      this.themeComp.of(makeThemeExtension()),
      this.spellComp.of(
        EditorView.contentAttributes.of({ spellcheck: 'false' }),
      ),
      EditorView.domEventHandlers({
        scroll: (_e, view) => {
          const el = view.scrollDOM
          const max = el.scrollHeight - el.clientHeight
          if (max > 0) this.opts.onScroll(el.scrollTop / max)
          return false
        },
      }),
      EditorView.updateListener.of((update: ViewUpdate) => {
        if (update.docChanged) {
          this.opts.onChange(update.state.doc.toString())
        }
        if (update.selectionSet) {
          const { head } = update.state.selection.main
          const line = update.state.doc.lineAt(head)
          this.opts.onCursor(line.number, head - line.from + 1)
        }
      }),
    ]
  }

  // ── Public API ────────────────────────────────────────────────────
  getValue(): string {
    return this.view.state.doc.toString()
  }

  setValue(text: string): void {
    this.view.dispatch(
      this.view.state.update({
        changes: { from: 0, to: this.view.state.doc.length, insert: text },
        selection: { anchor: 0 },
      }),
    )
  }

  focus(): void {
    this.view.focus()
  }

  clearHistory(): void {
    // Replace state without history
    const text = this.getValue()
    this.view.setState(
      EditorState.create({
        doc: text,
        extensions: this.buildExtensions(),
      }),
    )
    this.enableMarkdown()
  }

  setSpellcheck(enabled: boolean): void {
    this.view.dispatch({
      effects: this.spellComp.reconfigure(
        EditorView.contentAttributes.of({
          spellcheck: String(enabled),
        }),
      ),
    })
  }

  // Toolbar actions
  wrapSelection(before: string, after: string, placeholder: string): void {
    wrapSelection(this.view, before, after, placeholder)
    this.view.focus()
  }

  insertAtLineStart(prefix: string): void {
    insertAtLineStart(this.view, prefix)
    this.view.focus()
  }

  insertText(text: string): void {
    const { state } = this.view
    const { from, to } = state.selection.main
    this.view.dispatch(
      state.update({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
      }),
    )
    this.view.focus()
  }

  undo(): void {
    undo(this.view)
  }

  redo(): void {
    redo(this.view)
  }
}
