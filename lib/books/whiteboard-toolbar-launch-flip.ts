/** FLIP transform so a panel-sized element at `panel` rect visually matches `button` rect. */
export function panelFlightTransformToMatchButton(
  button: DOMRectReadOnly,
  panel: DOMRectReadOnly,
): string {
  const scaleX = button.width / panel.width
  const scaleY = button.height / panel.height
  const translateX = button.left + button.width / 2 - (panel.left + panel.width / 2)
  const translateY = button.top + button.height / 2 - (panel.top + panel.height / 2)
  return `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`
}
