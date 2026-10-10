import { on } from "svelte/events"

import { AutoScroller } from "#ext/dom/autoScroller"
import * as Nodes from "#ext/dom/nodes"
import * as PointerEvents from "#ext/dom/pointerEvents"
import * as Functions from "#ext/stdlib/functions"

import { MoveTracker } from "#componentActions/move/moveTracker"

import { TableSection } from "#componentModels/table/tableSection"
import type { TableState } from "#componentModels/table/tableState.svelte"

import type { RowOrCol } from "#core/models/rowOrCol"

export interface MoveActionsProps {
  readonly event: PointerEvent
  readonly tableState: Pick<
    TableState,
    | "table"
    | "outlinedSection"
    | "move"
    | "activeHandle"
    | "activeCell"
    | "anchorCell"
    | "focusTable"
    | "scrollElement"
    | "rootScrollElement"
    | "scrollOffsetX"
    | "scrollOffsetY"
    | "tableElement"
  >
  readonly rowOrCol: RowOrCol
  readonly index: number
  readonly onClick: () => void
}

export class MoveActions {
  private readonly tableState: MoveActionsProps["tableState"]
  private readonly rowOrCol: RowOrCol
  private readonly index: number
  private readonly onClick: () => void
  private readonly moveTracker: MoveTracker
  private readonly subject: TableSection
  private readonly autoScroller: AutoScroller

  private removeEventListeners: (() => void) | undefined

  private start(event: PointerEvent): void {
    event.preventDefault()

    const moveView = this.moveTracker.start()

    this.tableState.outlinedSection = this.subject
    this.tableState.move = moveView
    this.tableState.activeHandle = {
      state: "active",
      handle: { type: "header", index: this.index, location: this.rowOrCol },
    }

    const lastCell =
      this.rowOrCol === "row"
        ? { row: this.index, col: this.tableState.table.lastColIndex }
        : { row: this.tableState.table.lastRowIndex, col: this.index }
    this.tableState.activeCell = lastCell
    this.tableState.anchorCell = lastCell

    this.tableState.focusTable()

    const target = Nodes.htmlElement(event.target)
    const releasePointer = PointerEvents.capturePointer(event, target)
    this.removeEventListeners = Functions.each(
      on(target, "pointermove", (e) => {
        if (e.pointerId === event.pointerId) this.drag(e)
      }),
      on(target, "pointerup", (e) => {
        if (e.pointerId === event.pointerId) this.end()
      }),
      on(target, "pointercancel", (e) => {
        if (e.pointerId === event.pointerId) this.end(true)
      }),
      on(target, "lostpointercapture", (e) => {
        if (e.pointerId === event.pointerId) this.end(true)
      }),
      releasePointer,
    )
  }

  private drag(event: PointerEvent): void {
    event.preventDefault()

    this.autoScroller.updatePosition(event.clientX, event.clientY)

    this.tableState.move = this.moveTracker.drag({
      x: event.clientX + this.tableState.scrollOffsetX,
      y: event.clientY + this.tableState.scrollOffsetY,
    })
  }

  private end(cancelled = false): void {
    const removeEventListeners = this.removeEventListeners
    if (removeEventListeners === undefined) return
    this.removeEventListeners = undefined
    removeEventListeners()
    this.autoScroller.destroy()

    if (cancelled) {
      this.tableState.move = undefined
      this.tableState.activeHandle = undefined
      return
    }

    const endView = this.moveTracker.end()
    if (endView.moved) {
      this.tableState.table.moveRowOrColAt(this.rowOrCol, {
        fromIndex: this.index,
        toIndex: endView.toIndex,
      })
      this.tableState.outlinedSection = TableSection.of(
        this.rowOrCol === "row"
          ? {
              row: { start: endView.toIndex, endExclusive: endView.toIndex + 1 },
              col: this.tableState.table.colRange,
            }
          : {
              row: this.tableState.table.rowRange,
              col: { start: endView.toIndex, endExclusive: endView.toIndex + 1 },
            },
      )

      const lastCell =
        this.rowOrCol === "row"
          ? { row: endView.toIndex, col: this.tableState.table.lastColIndex }
          : { row: this.tableState.table.lastRowIndex, col: endView.toIndex }
      this.tableState.activeCell = lastCell
      this.tableState.anchorCell = lastCell
    }

    this.tableState.move = undefined
    this.tableState.activeHandle = undefined

    if (!endView.moved && !endView.dragged) this.onClick()
  }

  static startMove(props: MoveActionsProps): void {
    new MoveActions(props).start(props.event)
  }

  private constructor({ event, tableState, rowOrCol, index, onClick }: MoveActionsProps) {
    this.tableState = tableState
    this.rowOrCol = rowOrCol
    this.index = index
    this.subject = TableSection.of(
      rowOrCol === "row"
        ? { row: { start: index, endExclusive: index + 1 }, col: this.tableState.table.colRange }
        : { row: this.tableState.table.rowRange, col: { start: index, endExclusive: index + 1 } },
    )
    this.onClick = onClick
    this.autoScroller = AutoScroller.of({
      offset: 16,
      maxScroll: 32,
      boundaryElement: { x: tableState.scrollElement, y: tableState.rootScrollElement },
      scrollElement: { x: tableState.scrollElement, y: tableState.rootScrollElement },
    })
    this.moveTracker = MoveTracker.of({
      subject: this.subject,
      rowOrCol,
      index,
      position: {
        x: event.clientX + tableState.scrollOffsetX,
        y: event.clientY + tableState.scrollOffsetY,
      },
      tableElement: tableState.tableElement!,
      scrollOffsetX: () => this.tableState.scrollOffsetX,
      scrollOffsetY: () => this.tableState.scrollOffsetY,
    })
  }
}
