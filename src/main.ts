import './styles.css'
import type { SNNote } from './relay'
import type { EditorMode } from './toolbar'
import { initRelay, onNote, saveNote, getRelayPlatform } from './relay'
import { Editor } from './editor'
import { renderMarkdown, extractPreviewPlain } from './preview'
import { Toolbar } from './toolbar'

// ── DOM refs ──────────────────────────────────────────────────────────
const $app           = document.getElementById('app')           as HTMLElement
const $editorPane     = document.getElementById('editor-pane')    as HTMLElement
const $previewPane    = document.getElementById('preview-pane')   as HTMLElement
const $previewContent = document.getElementById('preview-content') as HTMLElement
const $toolbarEl      = document.getElementById('toolbar')        as HTMLElement
const $statusbar      = document.getElementById('statusbar')      as HTMLElement
const $workspace      = document.getElementById('workspace')      as HTMLElement
const $divider        = document.getElementById('divider')        as HTMLElement

// ── Persistence keys ──────────────────────────────────────────────────
const LS_COLLAPSED  = 'markdown-pro:toolbar-collapsed:v1.2'
const LS_STATUSBAR  = 'markdown-pro:statusbar'

// ── State ─────────────────────────────────────────────────────────────
let currentNote: SNNote | null = null
let ignoreEditorChange = false
let initialLoad = true
let currentMode: EditorMode = 'split'
let editor: Editor | null = null
let toolbar: Toolbar | null = null

// ── Toolbar (rendered immediately — independent of SN onReady) ────────
// Buttons are no-ops until setEditor() is called; the toolbar UI is always
// visible so the user sees the chrome even if the relay handshake is slow.
{
  let saved: string | null = null
  try { saved = localStorage.getItem(LS_COLLAPSED) } catch { /* Safari ITP / sandboxed iframe */ }
  const collapsed = saved !== null ? saved === 'true' : window.matchMedia('(max-width: 680px)').matches
  let savedStatus: string | null = null
  try { savedStatus = localStorage.getItem(LS_STATUSBAR) } catch { /* ITP */ }
  const statusOn  = savedStatus === 'true'

  toolbar = new Toolbar($toolbarEl, {
    onModeChange(mode: EditorMode)  { setMode(mode, true) },
    onCollapseToggle(c: boolean)    { try { localStorage.setItem(LS_COLLAPSED, String(c)) } catch { /* ITP */ } },
    onStatusBarToggle(v: boolean)   { setStatusBarVisible(v, true) },
  })
  toolbar.setCollapsed(collapsed)
  // Apply initial statusbar CSS without calling setStatusBarVisible (toolbar already synced above)
  if (!statusOn) $app.classList.add('statusbar-hidden')
  toolbar.setStatusBarVisible(statusOn)
}
/** Latest text inside the save debounce window. */
let pendingText: string | null = null
/** Last value that was actually rendered to the preview pane. */
let lastRenderedText = ''
/** Timer handle for debounced preview re-render (150 ms). */
let renderTimer: ReturnType<typeof setTimeout> | null = null
/** Timer handle for debounced status-bar update (200 ms). */
let statusTimer: ReturnType<typeof setTimeout> | null = null
let statusLine = 1
let statusCol  = 0

// ── Mobile detection ──────────────────────────────────────────────────
function isMobile(): boolean {
  const p = getRelayPlatform()
  return p === 'ios' || p === 'android' ||
    window.matchMedia('(max-width: 680px)').matches
}

// ── Theme ─────────────────────────────────────────────────────────────
// All surface CSS vars reference --sn-stylekit-* directly, so SN theme
// stylesheets drive every colour through the cascade with zero JS.
// JS only toggles .dark so the editor/preview pick the matching syntax
// palette. SN themes expose --sn-stylekit-theme-type ('light' | 'dark') —
// the authoritative signal. Fall back to background luminance, then OS
// preference, only when running standalone (no SN theme injected).
function updateTheme(): void {
  const root = getComputedStyle(document.documentElement)
  const themeType = root.getPropertyValue('--sn-stylekit-theme-type').trim()
  let isDark: boolean
  if (themeType === 'dark') {
    isDark = true
  } else if (themeType === 'light') {
    isDark = false
  } else {
    const snBg = root.getPropertyValue('--sn-stylekit-background-color').trim()
    isDark = snBg
      ? perceivedLuminance(snBg) < 128
      : window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  document.documentElement.classList.toggle('dark', isDark)
}

/** Returns 0–255 perceived luminance (ITU-R BT.601). */
function perceivedLuminance(color: string): number {
  const hex = /^#([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(color)
  const rgb = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(color)
  if (hex) {
    const [, r, g, b] = hex.map(x => parseInt(x, 16))
    return (r * 299 + g * 587 + b * 114) / 1000
  }
  if (rgb) {
    const [, r, g, b] = rgb.map(Number)
    return (r * 299 + g * 587 + b * 114) / 1000
  }
  return 255 // unparseable → assume light
}

// ── Mode management ───────────────────────────────────────────────────
function setMode(mode: EditorMode, persist: boolean): void {
  currentMode = mode
  $workspace.dataset['mode'] = mode
  $divider.style.display = mode === 'split' ? '' : 'none'
  if (mode === 'edit') editor?.focus()

  // Switching to preview: flush any pending render immediately.
  if (mode === 'preview' || mode === 'split') flushPreview()

  if (!persist || !currentNote) return
  const note = currentNote
  const text = pendingText ?? editor?.getValue() ?? note.content.text
  saveNote(note, () => {
    note.content.text    = text
    note.clientData      = { ...note.clientData, mode }
  })
}

// ── Preview ───────────────────────────────────────────────────────────
/** Immediately paint the latest content into the preview pane. */
function flushPreview(text?: string): void {
  if (renderTimer !== null) { clearTimeout(renderTimer); renderTimer = null }
  const value = text ?? editor?.getValue() ?? pendingText ?? ''
  if (value === lastRenderedText) return
  lastRenderedText = value
  $previewContent.innerHTML = renderMarkdown(value)
}

/**
 * Schedule a preview re-render 150 ms after the last keystroke.
 * Skips work entirely if the value hasn't changed.
 */
function schedulePreview(value: string): void {
  if (renderTimer !== null) clearTimeout(renderTimer)
  renderTimer = setTimeout(() => {
    renderTimer = null
    if (value === lastRenderedText) return
    lastRenderedText = value
    $previewContent.innerHTML = renderMarkdown(value)
  }, 150)
}

// ── Status bar ────────────────────────────────────────────────────────
// Cursor position is stored immediately but the DOM write is batched
// with word/char counts at 200 ms to avoid per-keystroke reflows.
function scheduleStatusBar(text: string, line?: number, col?: number): void {
  if (line !== undefined) statusLine = line
  if (col  !== undefined) statusCol  = col
  if (statusTimer !== null) clearTimeout(statusTimer)
  statusTimer = setTimeout(() => {
    statusTimer = null
    paintStatusBar(text)
  }, 200)
}

function paintStatusBar(text: string): void {
  // Count words without allocating an array: iterate once with a state flag.
  let words = 0
  let inWord = false
  for (let i = 0; i < text.length; i++) {
    const ws = text.charCodeAt(i) <= 32
    if (!ws && !inWord) { words++; inWord = true }
    else if (ws) inWord = false
  }
  const chars   = text.length
  const readMin = Math.max(1, Math.ceil(words / 200))
  $statusbar.innerHTML = `
    <div class="statusbar-left">
      <span class="statusbar-item">${words.toLocaleString()} words</span>
      <span class="statusbar-item">${chars.toLocaleString()} chars</span>
    </div>
    <div class="statusbar-right">
      <span class="statusbar-item">~${readMin}&nbsp;min</span>
      <span class="statusbar-item">Ln&nbsp;${statusLine}, Col&nbsp;${statusCol}</span>
    </div>`
}

function setStatusBarVisible(visible: boolean, persist: boolean): void {
  $app.classList.toggle('statusbar-hidden', !visible)
  toolbar?.setStatusBarVisible(visible)
  if (persist) { try { localStorage.setItem(LS_STATUSBAR, String(visible)) } catch { /* ITP */ } }
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
    document.body.style.cursor     = 'col-resize'
    document.body.style.userSelect = 'none'
    e.preventDefault()
  })

  window.addEventListener('mousemove', (e: MouseEvent) => {
    if (!dragging) return
    const ws      = $workspace.getBoundingClientRect()
    const delta   = (e.clientX - startX) / ws.width
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

// ── Toolbar mode sync ─────────────────────────────────────────────────
function syncToolbarMode(mode: EditorMode): void {
  toolbar?.setMode(mode)
}

// ── Editor init (called by onReady once SN establishes communication) ──
function initEditor(): void {
  editor = new Editor($editorPane, {
    onChange(value: string) {
      if (ignoreEditorChange || !currentNote) return
      pendingText = value
      schedulePreview(value)
      scheduleStatusBar(value)
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
      statusLine = line
      statusCol  = col
    },
  })

  // Wire editor into the already-rendered toolbar.
  toolbar!.setEditor(editor)

  initDivider()
  paintStatusBar('')
  setMode(currentMode, false)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateTheme)
}

// ── Relay wiring ──────────────────────────────────────────────────────
initRelay({
  onReady() {
    document.body.setAttribute('data-ready', 'true')
    initEditor()
    updateTheme()
    // SN may inject the theme slightly after ready (especially in mobile
    // webviews). Poll for ~3 s, and re-check whenever the iframe regains
    // visibility or focus, so the surfaces catch up to the active theme.
    let polls = 0
    const tid = setInterval(() => {
      updateTheme()
      if (++polls >= 30) clearInterval(tid)
    }, 100)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) updateTheme()
    })
    window.addEventListener('focus', updateTheme)
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
    flushPreview(text)
    paintStatusBar(text)
  }

  editor?.setSpellcheck(note.content.spellcheck ?? false)

  if (initialLoad) {
    initialLoad = false
    editor?.clearHistory()

    // Respect saved mode, but default to 'edit' on mobile/narrow screens
    const defaultMode: EditorMode = isMobile() ? 'edit' : 'split'
    const savedMode =
      (note.clientData?.['mode'] as EditorMode | undefined) ?? defaultMode
    setMode(savedMode, false)
    syncToolbarMode(savedMode)
    toolbar?.setMode(savedMode)
  }

  currentNote = note
})
