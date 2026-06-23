/** Invisible focus target on the book canvas — keeps Tab/focus off page chrome after move/select clicks. */
export function BookOverlayFocusSink() {
  return (
    <div
      data-book-overlay-focus-sink
      tabIndex={-1}
      className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-hidden opacity-0"
      aria-hidden
    />
  )
}
