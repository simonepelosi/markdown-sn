/**
 * Ambient override for @standardnotes/component-relay.
 *
 * The package's own .d.ts imports types from @standardnotes/snjs (an
 * install-time peer dependency we do not want). This declaration covers
 * exactly the surface we use, without any top-level imports so that
 * TypeScript treats it as a pure ambient module replacement rather than
 * a module-augmentation.
 */
declare module '@standardnotes/component-relay' {
  export interface ComponentRelayOptions {
    coallesedSaving?: boolean
    coallesedSavingDelay?: number
    acceptsThemes?: boolean
    debug?: boolean
  }

  export interface ComponentRelayParams {
    targetWindow: Window
    onReady?: () => void
    onThemesChange?: () => void
    /** Return the component's current pixel height; undefined is acceptable. */
    handleRequestForContentHeight: () => number | undefined
    options?: ComponentRelayOptions
  }

  export default class ComponentRelay {
    constructor(params: ComponentRelayParams)
    deinit(): void
    /**
     * Registers a callback invoked whenever the current note changes.
     * The payload is untyped at the relay boundary; callers must narrow.
     */
    streamContextItem(callback: (data: unknown) => void): void
    /**
     * Persists a note. `presave` runs inside the debounce window so
     * mutations to `item` land in the same flush.
     * We accept `object` here — any note-shaped record satisfies this.
     */
    saveItemWithPresave(
      item: object,
      presave: () => void,
      callback?: () => void,
    ): void
    get platform(): string | undefined
    get environment(): string | undefined
    isRunningInDesktopApplication(): boolean
    isRunningInMobileApplication(): boolean
  }
}
