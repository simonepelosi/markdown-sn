import ComponentRelay from '@standardnotes/component-relay'

// ── Domain types ──────────────────────────────────────────────────────
export interface SNNoteContent {
  text: string
  spellcheck?: boolean
  preview_plain?: string
  preview_html?: string | null
}

export interface SNNote {
  uuid: string
  content: SNNoteContent
  clientData?: Record<string, unknown>
  isMetadataUpdate?: boolean
}

// ── Module state ──────────────────────────────────────────────────────
let _relay: ComponentRelay | null = null
let _noteHandler: ((note: SNNote) => void) | null = null

// ── Init ──────────────────────────────────────────────────────────────
export function initRelay(params: {
  onReady: () => void
  onThemesChange: () => void
}): void {
  _relay = new ComponentRelay({
    targetWindow: window,
    onReady: params.onReady,
    onThemesChange: params.onThemesChange,
    handleRequestForContentHeight: () =>
      document.getElementById('app')?.clientHeight,
    options: {
      coallesedSaving: true,
      coallesedSavingDelay: 250,
      acceptsThemes: true,
    },
  })

  _relay.streamContextItem((data: unknown) => {
    // Narrow: SN always delivers a note-shaped object here. Validate before use.
    if (
      data !== null &&
      typeof data === 'object' &&
      'uuid' in data &&
      typeof (data as { uuid: unknown }).uuid === 'string' &&
      'content' in data &&
      typeof (data as { content: unknown }).content === 'object'
    ) {
      _noteHandler?.(data as SNNote)
    }
  })
}

// ── Public API ────────────────────────────────────────────────────────
export function onNote(cb: (note: SNNote) => void): void {
  _noteHandler = cb
}

export function saveNote(note: SNNote, presave: () => void): void {
  _relay?.saveItemWithPresave(note, presave)
}

export function getRelayPlatform(): string {
  return _relay?.platform ?? ''
}

export function getRelayEnvironment(): string {
  return _relay?.environment ?? ''
}
