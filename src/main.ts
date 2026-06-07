import './styles.css'
import { initRelay, onNote, saveNote, type SNNote } from './relay'
import { Editor } from './editor'
import { renderMarkdown, extractPreviewPlain } from './preview'
import { Toolbar, type EditorMode } from './toolbar'

// ── DOM refs ──────────────────────────────────────────────────────────
const $editorPane    = document.getElementById('editor-pane') as HTMLElement
const $previewPane   = document.getElementById('preview-pane') as HTMLElement
const $previewContent = document.getElementById('preview-content') as HTMLElement
const $toolbarEl     = document.getElementById('toolbar') as HTMLElement
const $statusbar     = document.getElementById('statusbar') as HTMLElement
const $workspace     = document.getElementById('workspace') as HTMLElement
const $divider       = document.getElementById('divider') as HTMLElement

// ── State ─────────────────────────────────────────────────────────────
let currentNote: SNNote | null = null
let ignoreEditorChange = false
let initialLoad = true
let currentMode: EditorMode = 'split'
let editor: Editor | null = null
/** Latest text that may not yet be flushed to the relay (inside debounce). */
let pendingText: string | null = null
/** Cursor position for status bar, updated without re-computing word count. */
let statusLine = 1
let statusCol = 0

// ── Theme ─────────────────────────────────────────────────────────────
function updateTheme(): void {
  const s = getComputedStyle(document.documentElement)
  const get = (v: string) => s.getPropertyValue(v).trim()

  const snBg      = get('--sn-stylekit-background-color')
  const snFg      = get('--sn-stylekit-foreground-color')
  const snEdBg    = get('--sn-stylekit-editor-background-color')
  const snEdFg    = get('--sn-stylekit-editor-foreground-color')
  const snBorder  = get('--sn-stylekit-border-color')
  const snContrast = get('--sn-stylekit-contrast-background-color')
  const snAccent  = get('--sn-stylekit-info-color')

  const root = document.documentElement
  if (snBg)       root.style.setProperty('--bg', snBg)
  if (snFg)       root.style.setProperty('--fg', snFg)
  if (snEdBg)   { root.style.setProperty('--ed-bg', snEdBg); root.style.setProperty('--pv-bg', snEdBg) }
  if (snEdFg)   { root.style.setProperty('--ed-fg', snEdFg); root.style.setProperty('--pv-fg', snEdFg) }
  if (snBorder)   root.style.setProperty('--border', snBorder)
  if (snContrast) root.style.setProperty('--bg2', snContrast)
  if (snAccent)   root.style.setProperty('--accent', snAccent)

  // Detect dark by perceived luminance of the background
  const isDark = snBg
    ? perceivedLuminance(snBg) < 128
    : window.matchMedia('(prefers-color-scheme: dark)').matches
  root.classList.toggle('dark', isDark)
}

/** Returns 0..255 perceived luminance (ITU-R BT.601 coefficients). */
function perceivedLuminance(color: string): number {
  const hex = /^#([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(color)
  const rgb = /rgb[a]?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(color)
  if (hex) {
    const [, r, g, b] = hex.map(x => parseInt(x, 16))
    return (r * 299 + g * 587 + b * 114) / 1000
  }
  if (rgb) {
    const [, r, g, b] = rgb.map(Number)
    return (r * 299 + g * 587 + b * 114) / 1000
  }
  return 255 // assume light if unparseable
}

// ── Mode management ───────────────────────────────────────────────────
function setMode(mode: EditorMode, persist: boolean): void {
  currentMode = mode
  $workspace.dataset['mode'] = mode
  $divider.style.display = mode === 'split' ? '' : 'none'
  if (mode === 'edit') editor?.focus()

  if (!persist || !currentNote) return
  const note = currentNote
  const text = pendingText ?? editor?.getValue() ?? note.content.text
  saveNote(note, () => {
    note.content.text = text
    note.clientData = { ...note.clientData, mode }
  })
}

// ── Preview ───────────────────────────────────────────────────────────
function updatePreview(markdown: string): void {
  $previewContent.innerHTML = renderMarkdown(markdown)
}

// ── Status bar ────────────────────────────────────────────────────────
function updateStatusBar(text: string, line?: number, col?: number): void {
  if (line !== undefined) statusLine = line
  if (col  !== undefined) statusCol  = col

  const words   = text.trim().length > 0 ? text.trim().split(/\s+/).length : 0
  const chars   = text.length
  const readMin = Math.max(1, Math.ceil(words / 200))

  $statusbar.innerHTML = `
    <div class="statusbar-left">
      <span class="statusbar-item">${words.toLocaleString()} words</span>
      <span class="statusbar-item">${chars.toLocaleString()} chars</span>
    </div>
    <div class="statusbar-right">
      <span class="statusbar-item">~${readMin} min read</span>
      <span class="statusbar-item">Ln&nbsp;${statusLine}, Col&nbsp;${statusCol}</span>
    </div>`
}

// ── Divider drag-to-resize ────────────────────────────────────────────
function initDivider(): void {
  let dragging = false
  let startX = 0
  let startEditorRatio = 0

  $divider.addEventListener('mousedown', (e: MouseEvent) => {
    dragging = true
    startX = e.clientX
    const ws = $workspace.getBoundingClientRect()
    startEditorRatio = $editorPane.getBoundingClientRect().width / ws.width
    $divider.classList.add('dragging')
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    e.preventDefault()
  })

  window.addEventListener('mousemove', (e: MouseEvent) => {
    if (!dragging) return
    const ws = $workspace.getBoundingClientRect()
    const delta = (e.clientX - startX) / ws.width
    const edRatio = Math.max(0.2, Math.min(0.8, startEditorRatio + delta))
    $editorPane.style.flex  = String(edRatio)
    $previewPane.style.flex = String(1 - edRatio)
  })

  window.addEventListener('mouseup', () => {
    if (!dragging) return
    dragging = false
    $divider.classList.remove('dragging')
    document.body.style.cursor     = ''
    document.body.style.userSelect = ''
  })
}

// ── Toolbar mode sync (restoring from clientData) ─────────────────────
function syncToolbarMode(mode: EditorMode): void {
  $toolbarEl.dataset['mode'] = mode
  $toolbarEl.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach(btn => {
    const label = btn.title.replace(' mode', '').toLowerCase() as EditorMode
    const active = label === mode
    btn.classList.toggle('active', active)
    btn.setAttribute('aria-pressed', String(active))
  })
}

// ── Editor init ───────────────────────────────────────────────────────
function initEditor(): void {
  editor = new Editor($editorPane, {
    onChange(value: string) {
      if (ignoreEditorChange || !currentNote) return
      pendingText = value
      updatePreview(value)
      updateStatusBar(value)
      const note = currentNote
      const mode = currentMode
      saveNote(note, () => {
        note.content.text          = value
        note.content.preview_plain = extractPreviewPlain(value)
        note.content.preview_html  = null
        note.clientData            = { ...note.clientData, mode }
      })
    },
    onScroll(pct: number) {
      if (currentMode !== 'split') return
      const max = $previewPane.scrollHeight - $previewPane.clientHeight
      if (max > 0) $previewPane.scrollTop = pct * max
    },
    onCursor(line: number, col: number) {
      updateStatusBar(editor?.getValue() ?? '', line, col)
    },
  })

  new Toolbar($toolbarEl, {
    editor,
    onModeChange(mode: EditorMode) {
      setMode(mode, true)
    },
  })

  initDivider()
  updateStatusBar('')
  setMode(currentMode, false)

  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', updateTheme)
}

// ── Relay wiring ──────────────────────────────────────────────────────
initRelay({
  onReady() {
    document.body.setAttribute('data-ready', 'true')
    initEditor()
    updateTheme()
  },
  onThemesChange() {
    updateTheme()
  },
})

onNote((note: SNNote) => {
  const isNewNote = !currentNote || currentNote.uuid !== note.uuid
  if (isNewNote) {
    initialLoad = true
    pendingText = null
  }

  if (note.isMetadataUpdate) {
    currentNote = note
    return
  }

  const text = note.content.text ?? ''

  if (editor && text !== editor.getValue()) {
    ignoreEditorChange = true
    editor.setValue(text)
    ignoreEditorChange = false
    updatePreview(text)
    updateStatusBar(text)
  }

  editor?.setSpellcheck(note.content.spellcheck ?? false)

  if (initialLoad) {
    initialLoad = false
    editor?.clearHistory()
    const savedMode =
      (note.clientData?.['mode'] as EditorMode | undefined) ?? 'split'
    setMode(savedMode, false)
    syncToolbarMode(savedMode)
  }

  currentNote = note
})
