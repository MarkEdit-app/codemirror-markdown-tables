import { mock, when } from "strong-mock"
import { describe, expect, it } from "vitest"

import { capturePointer, isPrimaryButton } from "#ext/dom/pointerEvents"

describe("primary pointer button", () => {
  it.each([0, 1])("accepts a primary pointerdown with buttons %i", (buttons) => {
    expect(isPrimaryButton({ type: "pointerdown", button: 0, buttons })).toBe(true)
  })

  describe("pointer capture cleanup", () => {
    it.each([true, false])("cleans up when capture is still held: %s", (captured) => {
      const event = mock<PointerEvent>()
      const element = mock<Element>()
      when(() => event.pointerId)
        .thenReturn(1)
        .anyTimes()
      when(() => element.setPointerCapture(1)).thenReturn(undefined)
      when(() => element.hasPointerCapture(1)).thenReturn(captured)
      if (captured) when(() => element.releasePointerCapture(1)).thenReturn(undefined)
      const release = capturePointer(event, element)
      expect(() => release()).not.toThrow()
    })
  })

  it.each([
    { button: 1, buttons: 4 },
    { button: 2, buttons: 2 },
    { button: 2, buttons: 0 },
  ])("rejects non-primary pointerdown $button", ({ button, buttons }) => {
    expect(isPrimaryButton({ type: "pointerdown", button, buttons })).toBe(false)
  })

  it("keeps checking held buttons while dragging", () => {
    expect(isPrimaryButton({ type: "pointermove", button: -1, buttons: 1 })).toBe(true)
    expect(isPrimaryButton({ type: "pointermove", button: -1, buttons: 0 })).toBe(false)
    expect(isPrimaryButton({ type: "pointermove", button: 0, buttons: 0 })).toBe(false)
    expect(isPrimaryButton({ type: "pointermove", button: -1, buttons: 2 })).toBe(false)
  })
})
