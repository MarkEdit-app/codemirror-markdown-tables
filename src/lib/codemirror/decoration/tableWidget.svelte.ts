import { redo, undo } from "@codemirror/commands"
import type { EditorState } from "@codemirror/state"
import { EditorView, type Rect, WidgetType } from "@codemirror/view"
import { mount, unmount } from "svelte"

import * as Widgets from "#ext/codemirror/view/widgets"
import * as Nodes from "#ext/dom/nodes"
import * as ResizeObservers from "#ext/dom/resizeObservers"
import { def, nil } from "#ext/stdlib/existence"
import * as Functions from "#ext/stdlib/functions"

import { TableDescription } from "#codemirror/state/tableDescription.svelte"
import * as TableEditorState from "#codemirror/state/tableEditorState"
import * as TableAnnotation from "#codemirror/transaction/tableAnnotation"

import * as CellNodes from "#components/table/cell/cellNodes"
import TableComponent from "#components/table/Table.svelte"

import type { Selection } from "#core/models/selection"
import * as TableSelectionValues from "#core/models/tableSelectionValues"

export class TableWidget extends WidgetType {
  private readonly tableDescription: TableDescription

  private measuredWidgetElement: HTMLElement | undefined
  private height: number
  private readonly cleanups = new WeakMap<HTMLElement, () => void>()

  get estimatedHeight(): number {
    // CodeMirror correctly measures the height automatically, but it still has issues
    // scrolling to the right spot in certain cases for some reason (bug?)
    return this.height
  }

  coordsAt(dom: HTMLElement, pos: number, _side: number): Rect | null {
    const cell = this.tableDescription.table.closestCellAtPosition(pos)
    const cellElement = CellNodes.descendentCell(dom, cell)
    // eslint-disable-next-line unicorn/no-null -- WidgetType uses null
    if (nil(cellElement)) return null

    const rect = cellElement.getBoundingClientRect()
    return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left }
  }

  /**
   * CodeMirror may request new DOM before destroying the previous DOM.
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention -- WidgetType method
  toDOM(view: EditorView): HTMLElement {
    const widgetElement = this.measuredWidgetElement ?? this.create(view)
    this.measuredWidgetElement = undefined

    view.requestMeasure({
      read: () => {
        if (this.cleanups.has(widgetElement))
          this.height = widgetElement.getBoundingClientRect().height
      },
    })

    return widgetElement
  }

  /**
   * Called whenever the table is removed or the widget is hidden due to scrolling the viewport.
   * May be called again to redestroy after the widget has been recreated.
   */
  destroy(dom: HTMLElement): void {
    this.cleanups.get(dom)?.()
    this.cleanups.delete(dom)
  }

  private create(view: EditorView): HTMLElement {
    const widgetElement = Nodes.doc(view.dom).createElement("div")
    widgetElement.className = "tbl-table-widget"
    widgetElement.tabIndex = -1
    // Prevent clicks around the table from messing up focus
    widgetElement.addEventListener("pointerdown", (event) => {
      if (event?.target === widgetElement) event.preventDefault()
    })

    const tableDescription = this.tableDescription
    const cleanupEffects = $effect.root(() => {
      // Apply widget state to root editor state
      $effect(() => {
        const textChanged = !tableDescription.table.text.eq(tableDescription.editorTableText)
        const selectionChanged = !TableSelectionValues.equals(
          tableDescription.selection.value,
          tableDescription.editorSelectionValue,
        )

        if (!textChanged && !selectionChanged) return

        let newSelection: Selection | undefined
        if (tableDescription.selection.isCell()) {
          const { from: cellFrom } = tableDescription.table.cellSpan(
            tableDescription.selection.cell,
          )
          newSelection = {
            anchor:
              tableDescription.from + cellFrom + tableDescription.selection.cellSection.anchor,
            head: tableDescription.from + cellFrom + tableDescription.selection.cellSection.head,
          }
        } else if (tableDescription.selection.isAll()) {
          newSelection = { anchor: tableDescription.from, head: tableDescription.to }
        } else if (tableDescription.selection.isHidden()) {
          // Cursor is considered hidden when it is placed after the first `|`
          newSelection = { anchor: tableDescription.from + 1, head: tableDescription.from + 1 }
        }

        const newChanges = textChanged
          ? {
              from: tableDescription.from,
              to: tableDescription.to,
              insert: tableDescription.table.text,
            }
          : undefined

        // Synchronization state is stored in the shared table description
        tableDescription.markSynchronized()
        view.dispatch({
          annotations: TableAnnotation.of("table.edit"),
          changes: newChanges,
          selection: newSelection,
        })
      })
    })

    const { extensions, markdownConfig, globalKeyBindings, selectionType, lineWrapping, strings } =
      TableEditorState.getTableConfig(view.state)

    const component = mount(TableComponent, {
      target: widgetElement,
      props: {
        table: tableDescription.table,
        selection: tableDescription.selection,
        scrollElement: widgetElement,
        rootEditor: view,
        extensions,
        markdownConfig,
        globalKeyBindings,
        selectionType,
        lineWrapping,
        strings,
        onUndo: () => undo(view),
        onRedo: () => redo(view),
        onNavigate: (direction: "before" | "after") => {
          view.dispatch({
            annotations: TableAnnotation.of("table.navigate"),
            selection: {
              anchor: direction === "before" ? tableDescription.from - 1 : tableDescription.to + 1,
            },
          })
          view.focus()
        },
        onDelete: () => {
          view.dispatch({
            annotations: TableAnnotation.of("table.delete"),
            changes: { from: tableDescription.from, to: tableDescription.to },
            selection: view.state.selection,
          })
          view.focus()
        },
      },
    })
    const unmountComponent = () => void unmount(component)

    // ResizeObserver ensured `estimatedHeight` is always accurate for correct scrolling
    const disconnectObservers = ResizeObservers.onResize(widgetElement, ({ height }) => {
      if (this.cleanups.has(widgetElement)) this.height = height
    })

    this.cleanups.set(
      widgetElement,
      Functions.each(cleanupEffects, unmountComponent, disconnectObservers),
    )
    return widgetElement
  }

  static of(table: TableDescription, state: EditorState): TableWidget {
    return new TableWidget(table, state)
  }

  private constructor(table: TableDescription, state: EditorState) {
    super()
    this.tableDescription = table

    const view = TableEditorState.getView(state)
    if (def(view)) {
      this.measuredWidgetElement = this.create(view)
      this.height = Widgets.estimateHeight(view, this.measuredWidgetElement)
    } else {
      this.measuredWidgetElement = undefined
      this.height = Widgets.unknownHeight
    }
  }
}
