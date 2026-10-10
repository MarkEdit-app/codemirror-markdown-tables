import { mock, when } from "strong-mock"
import { beforeEach, describe, expect, it, type MockInstance, vi } from "vitest"

import { MoveActions, type MoveActionsProps } from "#componentActions/move/moveActions"
import type { MoveTracker } from "#componentActions/move/moveTracker"

import { Table } from "#core/models/table.svelte"

import { txt } from "../../../../testSupport/helpers/txt"

const input = vi.hoisted(() => ({
  listeners: new Map<string, (event: PointerEvent) => void>(),
  release: vi.fn(),
  start: vi.fn(() => ({ cellMovement: vi.fn() })),
  drag: vi.fn(() => ({ cellMovement: vi.fn() })),
  end: vi.fn<MoveTracker["end"]>(),
  destroy: vi.fn(),
  updatePosition: vi.fn(),
}))

vi.mock("svelte/events", () => ({
  on: (_target: EventTarget, type: string, listener: (event: PointerEvent) => void) => {
    input.listeners.set(type, listener)
    return () => input.listeners.delete(type)
  },
}))
vi.mock("#ext/dom/nodes", () => ({ htmlElement: (target: EventTarget) => target }))
vi.mock("#ext/dom/pointerEvents", () => ({ capturePointer: () => input.release }))
vi.mock("#ext/dom/autoScroller", () => ({
  AutoScroller: {
    of: () => ({ destroy: input.destroy, updatePosition: input.updatePosition }),
  },
}))
vi.mock("#componentActions/move/moveTracker", () => ({
  MoveTracker: { of: () => ({ start: input.start, drag: input.drag, end: input.end }) },
}))

function pointer(pointerId = 1): PointerEvent {
  const event = mock<PointerEvent>()
  when(() => event.pointerId)
    .thenReturn(pointerId)
    .anyTimes()
  when(() => event.clientX)
    .thenReturn(40)
    .anyTimes()
  when(() => event.clientY)
    .thenReturn(60)
    .anyTimes()
  when(() => event.target)
    .thenReturn(mock<HTMLElement>())
    .anyTimes()
  when(() => event.preventDefault())
    .thenReturn(undefined)
    .anyTimes()
  return event
}

function start(location: "row" | "col" = "col"): {
  state: MoveActionsProps["tableState"]
  onClick: () => void
  move: MockInstance<Table["moveRowOrColAt"]>
} {
  const table = Table.of(txt`
    | A | B |
    | --- | --- |
    | one | two |
  `)
  const state: MoveActionsProps["tableState"] = {
    table,
    outlinedSection: undefined,
    move: undefined,
    activeHandle: undefined,
    activeCell: undefined,
    anchorCell: undefined,
    focusTable: vi.fn(),
    scrollElement: mock<HTMLElement>(),
    rootScrollElement: mock<HTMLElement>(),
    tableElement: mock<HTMLTableElement>(),
    scrollOffsetX: 0,
    scrollOffsetY: 0,
  }
  const onClick = vi.fn()
  const move = vi.spyOn(table, "moveRowOrColAt")
  MoveActions.startMove({
    event: pointer(),
    tableState: state,
    rowOrCol: location,
    index: 0,
    onClick,
  })
  return { state, onClick, move }
}

describe("table drag lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    input.listeners.clear()
    input.end.mockReturnValue({ moved: true, toIndex: 1 })
    input.release.mockImplementation(() => {
      input.listeners.get("lostpointercapture")?.(pointer())
    })
  })

  it.each(["row", "col"] as const)("commits a completed %s drag once", (location) => {
    const { state, onClick, move } = start(location)
    input.listeners.get("pointermove")!(pointer())
    input.listeners.get("pointerup")!(pointer())
    expect(move).toHaveBeenCalledExactlyOnceWith(location, { fromIndex: 0, toIndex: 1 })
    expect(state.move).toBeUndefined()
    expect(state.activeHandle).toBeUndefined()
    expect(input.destroy).toHaveBeenCalledOnce()
    expect(input.listeners.size).toBe(0)
    expect(onClick).not.toHaveBeenCalled()
  })

  it.each(["pointercancel", "lostpointercapture"])("abandons a drag on %s", (type) => {
    const { state, onClick, move } = start()
    input.listeners.get("pointermove")!(pointer())
    input.listeners.get(type)!(pointer())
    expect(state.move).toBeUndefined()
    expect(state.activeHandle).toBeUndefined()
    expect(input.destroy).toHaveBeenCalledOnce()
    expect(input.release).toHaveBeenCalledOnce()
    expect(input.listeners.size).toBe(0)
    expect(input.end).not.toHaveBeenCalled()
    expect(move).not.toHaveBeenCalled()
    expect(onClick).not.toHaveBeenCalled()
  })

  it("opens the menu for a completed tap", () => {
    input.end.mockReturnValue({ moved: false, dragged: false })
    const { onClick } = start()
    input.listeners.get("pointerup")!(pointer())
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("ignores events from a different pointer", () => {
    const { state } = start()
    for (const type of ["pointermove", "pointerup", "pointercancel", "lostpointercapture"]) {
      input.listeners.get(type)!(pointer(2))
    }
    expect(state.move).toBeDefined()
    expect(input.drag).not.toHaveBeenCalled()
    expect(input.destroy).not.toHaveBeenCalled()
    input.listeners.get("pointercancel")!(pointer())
    expect(state.move).toBeUndefined()
  })
})
