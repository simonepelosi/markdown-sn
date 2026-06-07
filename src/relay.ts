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
  // SN activates themes by injecting CSS into the iframe — usually a
  // <link rel="stylesheet"> appended to <head>, but depending on platform
  // it can also arrive as an inline <style> or as a class/style change on
  // the root element. A <link> fires its callback BEFORE the network
  // request completes, so getComputedStyle still returns empty SN vars at
  // that point; we re-fire onThemesChange after the stylesheet has loaded.
  // <style> and attribute changes apply synchronously, so we re-fire at
  // once. Watching all three keeps theme inheritance working across web,
  // desktop and mobile webviews.
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.type === 'attributes') {
        params.onThemesChange()
        continue
      }
      for (const node of m.addedNodes) {
        if (node instanceof HTMLLinkElement && node.rel === 'stylesheet') {
          node.addEventListener('load',  params.onThemesChange, { once: true })
          node.addEventListener('error', params.onThemesChange, { once: true })
        } else if (node instanceof HTMLStyleElement) {
          params.onThemesChange()
        }
      }
    }
  })
  observer.observe(document.head, { childList: true, subtree: true })
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'style'],
  })
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class', 'style'],
  })

  _relay = new ComponentRelay({
    targetWindow: window,
    onReady: params.onReady,
    // Keep the relay callback too — it's a no-op if the stylesheet hasn't
    // loaded yet (updateTheme falls back to prefers-color-scheme), and the
    // observer fires again with the correct values once the link loads.
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
