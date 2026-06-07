import type { Editor } from './editor'

export type EditorMode = 'edit' | 'split' | 'preview'

export interface ToolbarOptions {
  onModeChange: (mode: EditorMode) => void
  onCollapseToggle: (collapsed: boolean) => void
  onStatusBarToggle: (visible: boolean) => void
}

// ── SVG icons (inline, no external font dependency) ───────────────────
const ICON_BOLD = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>`
const ICON_ITALIC = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>`
const ICON_STRIKE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="16" y1="4" x2="8" y2="4"/><path d="M18 12H5"/><path d="M8 20h8a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4z"/></svg>`
const ICON_CODE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`
const ICON_LINK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`
const ICON_IMAGE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`
const ICON_HEADING = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h9"/></svg>`
const ICON_QUOTE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 2v12c0 1.25.755 2.017 2 2h1zM13 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 2v12c0 1.25.755 2.017 2 2h1z"/></svg>`
const ICON_UL = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>`
const ICON_OL = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>`
const ICON_TASK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`
const ICON_TABLE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`
const ICON_STATUSBAR = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="17" x2="21" y2="17"/></svg>`
const ICON_CHEVRON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`

// ── Format button descriptor ──────────────────────────────────────────
interface FmtButtonDef {
  icon: string
  title: string
  action: () => void
}

type FmtItem = FmtButtonDef | 'sep'

// ── Toolbar ───────────────────────────────────────────────────────────
export class Toolbar {
  private editor: Editor | null = null
  private currentMode: EditorMode = 'split'
  private collapsed = false
  private statusBarVisible = false
  private statusBarBtn: HTMLButtonElement | null = null
  private readonly modeButtons: Partial<Record<EditorMode, HTMLButtonElement>> = {}

  constructor(
    private readonly container: HTMLElement,
    private readonly opts: ToolbarOptions,
  ) {
    this.render()
  }

  /** Wire the editor instance once it's ready; buttons are no-ops until then. */
  setEditor(editor: Editor): void {
    this.editor = editor
  }

  private makeSep(): HTMLElement {
    const sep = document.createElement('div')
    sep.className = 'toolbar-sep'
    return sep
  }

  private makeFmtButton(def: FmtButtonDef): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.className = 'fmt-btn'
    btn.title = def.title
    btn.setAttribute('aria-label', def.title)
    btn.innerHTML = def.icon
    btn.addEventListener('click', def.action)
    return btn
  }

  private render(): void {
    this.container.innerHTML = ''
    for (const key of Object.keys(this.modeButtons) as EditorMode[]) {
      delete this.modeButtons[key]
    }

    // ── Segmented mode control ────────────────────────────────────────
    const modeGroup = document.createElement('div')
    modeGroup.className = 'mode-group'
    const modes: ReadonlyArray<[EditorMode, string]> = [
      ['edit', 'Edit'],
      ['split', 'Split'],
      ['preview', 'Preview'],
    ]
    for (const [mode, label] of modes) {
      const btn = document.createElement('button')
      btn.className = 'mode-btn'
      btn.textContent = label
      btn.title = `${label} mode`
      btn.addEventListener('click', () => { this.setMode(mode) })
      this.modeButtons[mode] = btn
      modeGroup.appendChild(btn)
    }
    this.container.appendChild(modeGroup)
    this.container.appendChild(this.makeSep())

    // ── Format buttons ────────────────────────────────────────────────
    // All editor actions guard with this.editor?.  — no-op before wired.
    const items: FmtItem[] = [
      { icon: ICON_BOLD,    title: 'Bold (Ctrl+B)',           action: () => { this.editor?.wrapSelection('**', '**', 'bold text') } },
      { icon: ICON_ITALIC,  title: 'Italic (Ctrl+I)',         action: () => { this.editor?.wrapSelection('_', '_', 'italic text') } },
      { icon: ICON_STRIKE,  title: 'Strikethrough',           action: () => { this.editor?.wrapSelection('~~', '~~', 'text') } },
      { icon: ICON_CODE,    title: 'Inline code (Ctrl+`)',    action: () => { this.editor?.wrapSelection('`', '`', 'code') } },
      'sep',
      { icon: ICON_HEADING, title: 'Heading',                 action: () => { this.editor?.insertAtLineStart('## ') } },
      { icon: ICON_QUOTE,   title: 'Blockquote',              action: () => { this.editor?.insertAtLineStart('> ') } },
      'sep',
      { icon: ICON_UL,      title: 'Unordered list',         action: () => { this.editor?.insertAtLineStart('- ') } },
      { icon: ICON_OL,      title: 'Ordered list',           action: () => { this.editor?.insertAtLineStart('1. ') } },
      { icon: ICON_TASK,    title: 'Task list item',          action: () => { this.editor?.insertAtLineStart('- [ ] ') } },
      'sep',
      { icon: ICON_LINK,    title: 'Link (Ctrl+K)',           action: () => { this.editor?.wrapSelection('[', '](url)', 'link text') } },
      { icon: ICON_IMAGE,   title: 'Image',                   action: () => { this.editor?.wrapSelection('![', '](url)', 'alt text') } },
      { icon: ICON_TABLE,   title: 'Insert table',            action: () => {
        this.editor?.insertText('\n| Header 1 | Header 2 | Header 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n')
      }},
    ]

    for (const item of items) {
      this.container.appendChild(item === 'sep' ? this.makeSep() : this.makeFmtButton(item))
    }

    // ── Right-side controls ───────────────────────────────────────────
    const spacer = document.createElement('div')
    spacer.className = 'toolbar-spacer'
    this.container.appendChild(spacer)

    // Status bar toggle
    const statusBarBtn = document.createElement('button')
    statusBarBtn.className = 'toolbar-icon-btn'
    statusBarBtn.title = 'Toggle word count'
    statusBarBtn.setAttribute('aria-label', 'Toggle word count')
    statusBarBtn.setAttribute('aria-pressed', String(this.statusBarVisible))
    statusBarBtn.innerHTML = ICON_STATUSBAR
    statusBarBtn.classList.toggle('active', this.statusBarVisible)
    statusBarBtn.addEventListener('click', () => {
      this.statusBarVisible = !this.statusBarVisible
      statusBarBtn.setAttribute('aria-pressed', String(this.statusBarVisible))
      statusBarBtn.classList.toggle('active', this.statusBarVisible)
      this.opts.onStatusBarToggle(this.statusBarVisible)
    })
    this.statusBarBtn = statusBarBtn
    this.container.appendChild(statusBarBtn)

    // Collapse toggle
    const toggleBtn = document.createElement('button')
    toggleBtn.className = 'toolbar-toggle-btn'
    toggleBtn.title = 'Toggle toolbar'
    toggleBtn.setAttribute('aria-label', 'Toggle toolbar')
    toggleBtn.innerHTML = ICON_CHEVRON
    toggleBtn.addEventListener('click', () => {
      this.collapsed = !this.collapsed
      this.container.classList.toggle('collapsed', this.collapsed)
      this.opts.onCollapseToggle(this.collapsed)
    })
    this.container.appendChild(toggleBtn)

    this.syncModeButtons()
  }

  setCollapsed(collapsed: boolean): void {
    this.collapsed = collapsed
    this.container.classList.toggle('collapsed', collapsed)
  }

  setStatusBarVisible(visible: boolean): void {
    this.statusBarVisible = visible
    if (this.statusBarBtn) {
      this.statusBarBtn.setAttribute('aria-pressed', String(visible))
      this.statusBarBtn.classList.toggle('active', visible)
    }
  }

  setMode(mode: EditorMode): void {
    this.currentMode = mode
    this.syncModeButtons()
    this.opts.onModeChange(mode)
  }

  private syncModeButtons(): void {
    for (const [mode, btn] of Object.entries(this.modeButtons) as Array<[EditorMode, HTMLButtonElement]>) {
      btn.classList.toggle('active', mode === this.currentMode)
      btn.setAttribute('aria-pressed', String(mode === this.currentMode))
    }
    this.container.dataset['mode'] = this.currentMode
  }
}
