import * as Strings from "#ext/dom/strings"

import type { HeaderHandle } from "#componentModels/table/handle/handle"
import { TableSection } from "#componentModels/table/tableSection"
import type { TableState } from "#componentModels/table/tableState.svelte"

import type { Alignment } from "#core/models/alignment"
import * as CellLocations from "#core/models/cellLocations"
import type { Point } from "#core/models/point"
import type { RowOrCol } from "#core/models/rowOrCol"

import { MarkEdit, type MenuItem } from "markedit-api"

export interface MenuActionsProps {
  readonly tableState: Pick<
    TableState,
    "table" | "focusTable" | "activeHandle" | "outlinedSection" | "activeCell" | "anchorCell"
  >
  readonly handle: HeaderHandle
  readonly point: Point
}

export class MenuActions {
  private readonly tableState: MenuActionsProps["tableState"]
  private readonly handle: HeaderHandle
  private readonly point: Point

  private get rowOrCol(): RowOrCol {
    return this.handle.location
  }

  private get index(): number {
    return this.handle.index
  }

  private open(): void {
    this.tableState.focusTable()
    // Native menus own input tracking and expose no dismissal callback.
    this.tableState.activeHandle = undefined
    this.tableState.outlinedSection = TableSection.of(
      this.rowOrCol === "row"
        ? {
            row: { start: this.index, endExclusive: this.index + 1 },
            col: this.tableState.table.colRange,
          }
        : {
            row: this.tableState.table.rowRange,
            col: { start: this.index, endExclusive: this.index + 1 },
          },
    )

    const lastCell =
      this.rowOrCol === "row"
        ? { row: this.index, col: this.tableState.table.lastColIndex }
        : { row: this.tableState.table.lastRowIndex, col: this.index }
    this.tableState.activeCell = lastCell
    this.tableState.anchorCell = lastCell

    const rowOrColumn = this.rowOrCol === "row" ? "row" : "column"
    const items: MenuItem[] = []

    if (this.rowOrCol === "col") {
      items.push(
        {
          title: "Sort by column (A-Z)",
          icon: "arrow.up",
          action: () => this.clickSort("ascending"),
        },
        {
          title: "Sort by column (Z-A)",
          icon: "arrow.down",
          action: () => this.clickSort("descending"),
        },
        { separator: true },
        { title: "Align none", action: () => this.clickAlign("none") },
        { title: "Align left", icon: "text.alignleft", action: () => this.clickAlign("left") },
        {
          title: "Align center",
          icon: "text.aligncenter",
          action: () => this.clickAlign("center"),
        },
        { title: "Align right", icon: "text.alignright", action: () => this.clickAlign("right") },
        { separator: true },
      )
    }

    items.push(
      {
        title: `Add ${rowOrColumn} ${this.rowOrCol === "row" ? "above" : "before"}`,
        action: () => this.clickAdd("before"),
      },
      {
        title: `Add ${rowOrColumn} ${this.rowOrCol === "row" ? "below" : "after"}`,
        action: () => this.clickAdd("after"),
      },
      { separator: true },
    )

    const moveableBackward = this.index !== this.tableState.table.firstRowOrColIndex(this.rowOrCol)
    const moveableForward = this.index !== this.tableState.table.lastRowOrColIndex(this.rowOrCol)
    if (moveableBackward) {
      items.push({
        title: `Move ${rowOrColumn} ${this.rowOrCol === "row" ? "up" : "left"}`,
        icon: this.rowOrCol === "row" ? "arrow.up" : "arrow.left",
        action: () => this.clickMove("backward"),
      })
    }
    if (moveableForward) {
      items.push({
        title: `Move ${rowOrColumn} ${this.rowOrCol === "row" ? "down" : "right"}`,
        icon: this.rowOrCol === "row" ? "arrow.down" : "arrow.right",
        action: () => this.clickMove("forward"),
      })
    }
    if (moveableBackward || moveableForward) items.push({ separator: true })

    items.push(
      {
        title: `Duplicate ${rowOrColumn}`,
        action: () => this.clickDuplicate(),
      },
      { title: `Clear ${rowOrColumn}`, action: () => this.clickClear() },
    )
    if (!this.tableState.table.hasSingleRowOrCol(this.rowOrCol)) {
      items.push({
        title: `Delete ${rowOrColumn}`,
        icon: "trash",
        action: () => this.clickRemove(),
      })
    }

    MarkEdit.showContextMenu(items, this.point)
  }

  private clickAdd(direction: "before" | "after"): void {
    this.tableState.table.addEmptyRowsOrColsAt(this.rowOrCol, {
      index: direction === "before" ? this.index : this.index + 1,
      count: 1,
    })

    if (direction === "after") {
      this.tableState.outlinedSection = this.tableState.outlinedSection?.shift(
        this.rowOrCol,
        "forward",
      )

      const nextCell = CellLocations.shift(this.rowOrCol, this.tableState.activeCell!, "forward")
      this.tableState.activeCell = nextCell
      this.tableState.anchorCell = nextCell
    }
  }

  private clickAlign(alignment: Alignment): void {
    this.tableState.table.setAlignmentAt(this.index, alignment)
  }

  private clickClear(): void {
    this.tableState.table.clearRowOrCol(this.rowOrCol, this.index)
  }

  private clickDuplicate(): void {
    this.tableState.table.duplicateRowOrColAt(this.rowOrCol, this.index)
  }

  private clickMove(direction: "backward" | "forward"): void {
    this.tableState.table.moveRowOrColAt(this.rowOrCol, {
      fromIndex: this.index,
      toIndex: direction === "backward" ? this.index - 1 : this.index + 1,
    })

    this.tableState.outlinedSection = this.tableState.outlinedSection?.shift(
      this.rowOrCol,
      direction,
    )

    const nextCell = CellLocations.shift(this.rowOrCol, this.tableState.activeCell!, direction)
    this.tableState.activeCell = nextCell
    this.tableState.anchorCell = nextCell
  }

  private clickRemove(): void {
    this.tableState.table.removeRowsOrColsAt(this.rowOrCol, { index: this.index, count: 1 })

    if (!this.tableState.table.hasRowOrColAt(this.rowOrCol, this.index)) {
      this.tableState.outlinedSection = this.tableState.outlinedSection?.shift(
        this.rowOrCol,
        "backward",
      )

      const nextCell = CellLocations.shift(this.rowOrCol, this.tableState.activeCell!, "backward")
      this.tableState.activeCell = nextCell
      this.tableState.anchorCell = nextCell
    }
  }

  private clickSort(direction: "ascending" | "descending"): void {
    this.tableState.table.sortByColAt(
      this.index,
      direction === "ascending"
        ? (first, second) => Strings.lexicographicalCompare(first.toString(), second.toString())
        : (first, second) => Strings.lexicographicalCompare(second.toString(), first.toString()),
    )
  }

  static showMenu(props: MenuActionsProps): void {
    new MenuActions(props).open()
  }

  private constructor({ tableState, handle, point }: MenuActionsProps) {
    this.tableState = tableState
    this.handle = handle
    this.point = point
  }
}
