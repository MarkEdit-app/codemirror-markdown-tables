import { mock, when } from "strong-mock"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { type ResizeActionProps, ResizeActions } from "#componentActions/resize/resizeActions"

import { Table } from "#core/models/table.svelte"

import { txt } from "../../../../testSupport/helpers/txt"

const input = vi.hoisted(() => ({
  listeners: new Map<string, (event: PointerEvent) => void>(),
  release: vi.fn(),
}))

vi.mock("svelte/events", () => ({
  on: (_target: EventTarget, type: string, listener: (event: PointerEvent) => void) => {
    input.listeners.set(type, listener)
    return () => input.listeners.delete(type)
  },
}))
vi.mock("#ext/dom/pointerEvents", () => ({ capturePointer: () => input.release }))
vi.mock("#componentModels/table/cell/emptyCellMeasurer", () => ({
  measure: () => ({ width: 10, height: 10 }),
}))

function pointer(pointerId = 1, x = 40, y = 60): PointerEvent {
  const event = mock<PointerEvent>()
  when(() => event.pointerId)
    .thenReturn(pointerId)
    .anyTimes()
  when(() => event.clientX)
    .thenReturn(x)
    .anyTimes()
  when(() => event.clientY)
    .thenReturn(y)
    .anyTimes()
  when(() => event.preventDefault())
    .thenReturn(undefined)
    .anyTimes()
  return event
}

function start(location: "right" | "bottom" = "right"): ResizeActionProps["tableState"] {
  const state: ResizeActionProps["tableState"] = {
    table: Table.of(txt`
      | A | B |
      | --- | --- |
      | one | two |
    `),
    tableElement: mock<HTMLTableElement>(),
    resize: undefined,
    activeHandle: undefined,
    activeCell: undefined,
    anchorCell: undefined,
    outlinedSection: undefined,
    focusTable: vi.fn(),
  }
  ResizeActions.startResize({
    event: pointer(),
    tableState: state,
    handle: { type: "table", location },
  })
  return state
}

describe("table resize lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    input.listeners.clear()
    input.release.mockImplementation(() => {
      input.listeners.get("lostpointercapture")?.(pointer())
    })
  })

  it.each(["pointercancel", "lostpointercapture"])("cancels without inserting on %s", (type) => {
    const state = start()
    expect(state.resize).toBeDefined()
    input.listeners.get(type)!(pointer())
    expect(state.resize).toBeUndefined()
    expect(state.activeHandle).toBeUndefined()
    expect(state.table.colCount).toBe(2)
    expect(state.table.rowCount).toBe(2)
    expect(input.release).toHaveBeenCalledOnce()
    expect(input.listeners.size).toBe(0)
  })

  it.each(["right", "bottom"] as const)(
    "preserves changes from an interrupted %s drag",
    (location) => {
      const state = start(location)
      input.listeners.get("pointermove")!(pointer(1, 70, 90))
      const rows = state.table.rowCount
      const cols = state.table.colCount
      expect(location === "right" ? cols : rows).toBeGreaterThan(2)
      const activeCell = state.activeCell
      const anchorCell = state.anchorCell
      const outlinedSection = state.outlinedSection
      input.listeners.get("pointercancel")!(pointer())
      expect(state.table.rowCount).toBe(rows)
      expect(state.table.colCount).toBe(cols)
      expect(state.activeCell).toEqual(activeCell)
      expect(state.anchorCell).toEqual(anchorCell)
      expect(state.outlinedSection).toBe(outlinedSection)
      expect(state.resize).toBeUndefined()
      expect(state.activeHandle).toBeUndefined()
    },
  )

  it.each(["right", "bottom"] as const)(
    "preserves a normal %s handle click exactly once",
    (location) => {
      const state = start(location)
      const up = input.listeners.get("pointerup")!
      up(pointer())
      up(pointer())
      expect(state.table.colCount).toBe(location === "right" ? 3 : 2)
      expect(state.table.rowCount).toBe(location === "bottom" ? 3 : 2)
      expect(state.resize).toBeUndefined()
      expect(input.release).toHaveBeenCalledOnce()
      expect(input.listeners.size).toBe(0)
    },
  )

  it("finishes a normal drag without adding a click operation", () => {
    const state = start()
    input.listeners.get("pointermove")!(pointer(1, 70))
    const cols = state.table.colCount
    expect(cols).toBeGreaterThan(2)
    input.listeners.get("pointerup")!(pointer())
    expect(state.table.colCount).toBe(cols)
    expect(state.resize).toBeUndefined()
    expect(state.activeHandle).toBeUndefined()
    expect(input.listeners.size).toBe(0)
  })

  it("ignores other pointers without interrupting the resize", () => {
    const state = start()
    for (const type of ["pointermove", "pointerup", "pointercancel", "lostpointercapture"]) {
      input.listeners.get(type)!(pointer(2, 70, 90))
    }
    expect(state.table.colCount).toBe(2)
    expect(state.table.rowCount).toBe(2)
    expect(state.resize).toBeDefined()
    expect(input.release).not.toHaveBeenCalled()
    input.listeners.get("pointercancel")!(pointer())
    expect(state.resize).toBeUndefined()
  })
})
