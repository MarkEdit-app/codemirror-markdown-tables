export function isPrimaryButton(event: Pick<MouseEvent, "type" | "button" | "buttons">): boolean {
  // Sidecar's synthesized pointerdown reports button 0 without a held-buttons bit.
  if (event.type === "pointerdown") return event.button === 0
  return event.buttons === 1
}

export function capturePointer(event: PointerEvent, element: Element): () => void {
  element.setPointerCapture(event.pointerId)
  return () => {
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId)
  }
}
