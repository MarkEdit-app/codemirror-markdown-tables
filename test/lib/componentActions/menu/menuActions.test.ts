import { beforeEach, describe, expect, it, vi } from "vitest"

import { defaultTableStrings, type TableStrings } from "#codemirror/config/tableStrings"

import { MenuActions, type MenuActionsProps } from "#componentActions/menu/menuActions"

import type { HeaderHandle } from "#componentModels/table/handle/handle"

import { Table } from "#core/models/table.svelte"

import { MarkEdit, type MenuItem } from "markedit-api"

import { txt } from "../../../../testSupport/helpers/txt"

vi.mock("markedit-api", () => ({
  MarkEdit: { showContextMenu: vi.fn() },
}))

const point = { x: 120, y: 80 }

function openMenu(
  location: HeaderHandle["location"],
  index: number,
  table = Table.of(txt`
    | Name | Value |
    | ---- | ----- |
    | z    | 2     |
    | a    | 1     |
  `),
  strings: TableStrings = defaultTableStrings,
): { tableState: MenuActionsProps["tableState"]; items: MenuItem[] } {
  const tableState: MenuActionsProps["tableState"] = {
    table,
    focusTable: vi.fn(),
    activeHandle: { state: "active", handle: { type: "header", location, index } },
    outlinedSection: undefined,
    activeCell: undefined,
    anchorCell: undefined,
    strings,
  }
  MenuActions.showMenu({
    tableState,
    handle: { type: "header", location, index },
    point,
  })
  const call = vi.mocked(MarkEdit.showContextMenu).mock.lastCall
  expect(call).toBeDefined()
  return { tableState, items: call![0] }
}

function click(items: MenuItem[], title: string): void {
  const action = items.find((item) => item.title === title)?.action
  expect(action).toBeTypeOf("function")
  action!()
}

describe("native table menus", () => {
  beforeEach(() => vi.clearAllMocks())

  it("shows row actions at the click position without retaining a modal handle", () => {
    const { tableState, items } = openMenu("row", 1)
    expect(MarkEdit.showContextMenu).toHaveBeenCalledExactlyOnceWith(items, point)
    expect(tableState.focusTable).toHaveBeenCalledOnce()
    expect(tableState.activeHandle).toBeUndefined()
    expect(tableState.activeCell).toEqual({ row: 1, col: 1 })
    expect(tableState.anchorCell).toEqual(tableState.activeCell)
    expect(tableState.outlinedSection?.rowRange).toEqual({ start: 1, endExclusive: 2 })
    expect(items.map((item) => item.title ?? "separator")).toEqual([
      "Add row above",
      "Add row below",
      "separator",
      "Move row up",
      "Move row down",
      "separator",
      "Duplicate row",
      "Clear row",
      "Delete row",
    ])
    expect(items.map((item) => item.icon)).toEqual([
      undefined,
      undefined,
      undefined,
      "arrow.up",
      "arrow.down",
      undefined,
      undefined,
      undefined,
      "trash",
    ])
  })

  it("shows column-only sorting and alignment actions", () => {
    const { items } = openMenu("col", 0)
    expect(items.map((item) => item.title ?? "separator")).toEqual([
      "Sort by column (A-Z)",
      "Sort by column (Z-A)",
      "separator",
      "Align none",
      "Align left",
      "Align center",
      "Align right",
      "separator",
      "Add column before",
      "Add column after",
      "separator",
      "Move column right",
      "separator",
      "Duplicate column",
      "Clear column",
      "Delete column",
    ])
    expect(items.map((item) => item.icon)).toEqual([
      "arrow.up",
      "arrow.down",
      undefined,
      undefined,
      "text.alignleft",
      "text.aligncenter",
      "text.alignright",
      undefined,
      undefined,
      undefined,
      undefined,
      "arrow.right",
      undefined,
      undefined,
      undefined,
      "trash",
    ])
  })

  it("uses a left arrow for moving a column left", () => {
    const { items } = openMenu("col", 1)
    expect(items.find((item) => item.title === "Move column left")?.icon).toBe("arrow.left")
  })

  it("uses configured strings without changing other defaults", () => {
    const strings = { ...defaultTableStrings, addRowAbove: "Zeile oberhalb hinzuf\u00fcgen" }
    const { items } = openMenu("row", 1, undefined, strings)
    expect(items.map((item) => item.title ?? "separator")).toContain(
      "Zeile oberhalb hinzuf\u00fcgen",
    )
    expect(items.map((item) => item.title ?? "separator")).toContain("Add row below")
  })

  it.each(["row", "col"] as const)("omits move and delete for a single %s", (location) => {
    const table = Table.of(txt`
      | Only |
      | ---- |
    `)
    const { items } = openMenu(location, 0, table)
    expect(items.some((item) => item.title?.startsWith("Move ") ?? false)).toBe(false)
    expect(items.some((item) => item.title?.startsWith("Delete ") ?? false)).toBe(false)
  })

  it.each([
    ["row", 0, "Move row up"],
    ["row", 2, "Move row down"],
    ["col", 0, "Move column left"],
    ["col", 1, "Move column right"],
  ] as const)("omits out-of-bounds movement for %s %i", (location, index, title) => {
    expect(openMenu(location, index).items.some((item) => item.title === title)).toBe(false)
  })

  it.each([
    ["Add row above", 1],
    ["Add row below", 2],
  ] as const)("runs %s and preserves the active selection", (title, activeRow) => {
    const { tableState, items } = openMenu("row", 1)
    click(items, title)
    expect(tableState.table.rowCount).toBe(4)
    expect(tableState.table.cellAt({ row: activeRow, col: 0 }).toString()).toBe("")
    expect(tableState.activeCell).toEqual({ row: activeRow, col: 1 })
    expect(tableState.anchorCell).toEqual(tableState.activeCell)
  })

  it.each(["none", "left", "center", "right"] as const)("aligns a column %s", (alignment) => {
    const { tableState, items } = openMenu("col", 1)
    const setAlignment = vi.spyOn(tableState.table, "setAlignmentAt")
    click(items, `Align ${alignment}`)
    expect(setAlignment).toHaveBeenCalledExactlyOnceWith(1, alignment)
  })

  it("clears a row", () => {
    const { tableState, items } = openMenu("row", 1)
    click(items, "Clear row")
    expect(tableState.table.cellAt({ row: 1, col: 0 }).toString()).toBe("")
    expect(tableState.table.cellAt({ row: 1, col: 1 }).toString()).toBe("")
  })

  it("duplicates a column", () => {
    const { tableState, items } = openMenu("col", 0)
    click(items, "Duplicate column")
    expect(tableState.table.colCount).toBe(3)
    expect(tableState.table.cellAt({ row: 1, col: 1 }).toString()).toBe("z")
  })

  it.each([
    ["Move row up", 0],
    ["Move row down", 2],
  ] as const)("runs %s and moves the active selection", (title, row) => {
    const { tableState, items } = openMenu("row", 1)
    click(items, title)
    expect(tableState.table.cellAt({ row, col: 0 }).toString()).toBe("z")
    expect(tableState.activeCell).toEqual({ row, col: 1 })
    expect(tableState.anchorCell).toEqual(tableState.activeCell)
    expect(tableState.outlinedSection?.rowRange).toEqual({ start: row, endExclusive: row + 1 })
  })

  it("deletes the last row and moves selection to the preceding row", () => {
    const { tableState, items } = openMenu("row", 2)
    click(items, "Delete row")
    expect(tableState.table.rowCount).toBe(2)
    expect(tableState.activeCell).toEqual({ row: 1, col: 1 })
    expect(tableState.anchorCell).toEqual(tableState.activeCell)
  })

  it.each([
    ["Sort by column (A-Z)", "a"],
    ["Sort by column (Z-A)", "z"],
  ])("runs %s without moving the header", (title, first) => {
    const { tableState, items } = openMenu("col", 0)
    click(items, title)
    expect(tableState.table.cellAt({ row: 0, col: 0 }).toString()).toBe("Name")
    expect(tableState.table.cellAt({ row: 1, col: 0 }).toString()).toBe(first)
  })

  it("does not mutate the table when the native menu is dismissed", () => {
    const { tableState } = openMenu("row", 1)
    expect(tableState.table.rowCount).toBe(3)
    expect(tableState.table.cellAt({ row: 1, col: 0 }).toString()).toBe("z")
    expect(tableState.activeHandle).toBeUndefined()
  })

  it("surfaces host errors without leaving a modal handle", () => {
    vi.mocked(MarkEdit.showContextMenu).mockImplementationOnce(() => {
      throw new Error("Native menu unavailable")
    })
    expect(() => openMenu("row", 1)).toThrow("Native menu unavailable")
  })
})
