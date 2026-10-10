import { on } from "svelte/events"

import * as PointerEvents from "#ext/dom/pointerEvents"
import { def } from "#ext/stdlib/existence"
import * as Functions from "#ext/stdlib/functions"

import {
  type ResizeHandle,
  type ResizeOperation,
  ResizeTracker,
} from "#componentActions/resize/resizeTracker"

import * as EmptyCellMeasurer from "#componentModels/table/cell/emptyCellMeasurer"
import type { TableState } from "#componentModels/table/tableState.svelte"

export interface ResizeActionProps {
  readonly event: PointerEvent
  readonly tableState: Pick<
    TableState,
    | "table"
    | "tableElement"
    | "resize"
    | "activeHandle"
    | "activeCell"
    | "anchorCell"
    | "outlinedSection"
    | "focusTable"
  >
  readonly handle: ResizeHandle
}

export class ResizeActions {
  private readonly tableState: ResizeActionProps["tableState"]
  private readonly resizeTracker: ResizeTracker

  private removeEventListeners: (() => void) | undefined

  private start(event: PointerEvent): void {
    event.preventDefault()

    const resizeResult = this.resizeTracker.start()

    this.tableState.resize = {}
    this.tableState.activeHandle = resizeResult.activeHandle

    this.tableState.focusTable()

    const target = this.tableState.tableElement!
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

    const resizeResult = this.resizeTracker.drag({
      position: { x: event.clientX, y: event.clientY },
    })
    if (def(resizeResult)) {
      this.resizeTable(resizeResult.operation)

      this.tableState.activeHandle = resizeResult.activeHandle
      this.tableState.activeCell = resizeResult.activeCell
      this.tableState.anchorCell = resizeResult.anchorCell
      this.tableState.outlinedSection = resizeResult.outlinedSection
    }
  }

  private end(cancelled = false): void {
    const removeEventListeners = this.removeEventListeners
    if (removeEventListeners === undefined) return
    this.removeEventListeners = undefined
    removeEventListeners()

    if (cancelled) {
      this.tableState.activeHandle = undefined
      this.tableState.resize = undefined
      return
    }

    const resizeResult = this.resizeTracker.end()

    if ("operation" in resizeResult) {
      this.resizeTable(resizeResult.operation)
      this.tableState.activeCell = resizeResult.activeCell
      this.tableState.anchorCell = resizeResult.anchorCell
      this.tableState.outlinedSection = resizeResult.outlinedSection
    }

    this.tableState.activeHandle = resizeResult.activeHandle

    this.tableState.resize = undefined
  }

  private resizeTable({ row, col }: ResizeOperation): void {
    if (def(row)) {
      const { action, index, count } = row
      if (action === "add") {
        this.tableState.table.addEmptyRowsAt({ row: index, count })
      } else {
        this.tableState.table.removeRowsAt({ row: index, count })
      }
    }
    if (def(col)) {
      const { action, index, count } = col
      if (action === "add") {
        this.tableState.table.addEmptyColsAt({ col: index, count })
      } else {
        this.tableState.table.removeColsAt({ col: index, count })
      }
    }
  }

  static startResize(props: ResizeActionProps): void {
    new ResizeActions(props).start(props.event)
  }

  private constructor({ event, tableState, handle }: ResizeActionProps) {
    this.tableState = tableState

    const { width, height } = EmptyCellMeasurer.measure(tableState)

    this.resizeTracker = ResizeTracker.of({
      tableState: this.tableState,
      handle,
      position: { x: event.clientX, y: event.clientY },
      cellSizePixels: { row: height, col: width },
      dragThresholdPixels: { row: height / 2, col: width / 2 },
    })
  }
}
