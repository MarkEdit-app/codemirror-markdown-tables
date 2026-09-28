import { EditorState } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"
import { mock, when } from "strong-mock"
import { mount, unmount } from "svelte"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TableWidget } from "#codemirror/decoration/tableWidget.svelte"
import { TableDescription } from "#codemirror/state/tableDescription.svelte"
import { viewStateField } from "#codemirror/state/viewStateField"

const dom = vi.hoisted(() => ({
  createElement: vi.fn(() => ({
    className: "",
    tabIndex: 0,
    addEventListener: vi.fn(),
    getBoundingClientRect: () => ({ height: 42 }),
  })),
  onResize: vi.fn(() => vi.fn()),
  estimateHeight: vi.fn(() => 42),
}))

vi.mock("markedit-api", () => ({ MarkEdit: {} }))
vi.mock("svelte", () => ({ mount: vi.fn(() => ({})), unmount: vi.fn() }))
vi.mock("#components/table/Table.svelte", () => ({ default: {} }))
vi.mock("#ext/dom/nodes", () => ({ doc: () => ({ createElement: dom.createElement }) }))
vi.mock("#ext/dom/resizeObservers", () => ({ onResize: dom.onResize }))
vi.mock("#ext/codemirror/view/widgets", () => ({
  unknownHeight: -1,
  estimateHeight: dom.estimateHeight,
}))

function create(premeasure = false): { view: EditorView; widget: TableWidget } {
  const state = EditorState.create({
    doc: "| A | B |\n| --- | --- |\n| one | two |",
    extensions: [viewStateField],
  })
  const view = mock<EditorView>()
  when(() => view.dom)
    .thenReturn(mock<HTMLElement>())
    .anyTimes()
  when(() => view.state)
    .thenReturn(state)
    .anyTimes()
  // eslint-disable-next-line @typescript-eslint/unbound-method -- Configuring a mocked method.
  when(() => view.requestMeasure)
    .thenReturn(vi.fn<EditorView["requestMeasure"]>())
    .anyTimes()
  if (premeasure) state.field(viewStateField).view = view
  const table = TableDescription.of({
    span: { from: 0, to: state.doc.length },
    doc: state.doc,
    selection: state.selection,
  })
  return { view, widget: TableWidget.of(table, state) }
}

describe("table widget DOM lifecycle", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates separate DOM when rendered again before the previous DOM is destroyed", () => {
    const { view, widget } = create()
    const previous = widget.toDOM(view)
    const current = widget.toDOM(view)

    expect(current).not.toBe(previous)
    expect(mount).toHaveBeenCalledTimes(2)
    widget.destroy(previous)
    expect(unmount).toHaveBeenCalledExactlyOnceWith(vi.mocked(mount).mock.results[0]?.value)
    expect(dom.onResize.mock.results[0]?.value).toHaveBeenCalledTimes(1)
    expect(dom.onResize.mock.results[1]?.value).not.toHaveBeenCalled()

    widget.destroy(current)
    expect(unmount).toHaveBeenCalledTimes(2)
    expect(unmount).toHaveBeenLastCalledWith(vi.mocked(mount).mock.results[1]?.value)
    expect(dom.onResize.mock.results[1]?.value).toHaveBeenCalledTimes(1)
  })

  it("does not destroy the current component when old DOM is destroyed again", () => {
    const { view, widget } = create()
    const previous = widget.toDOM(view)
    widget.destroy(previous)
    const current = widget.toDOM(view)

    widget.destroy(previous)
    expect(unmount).toHaveBeenCalledTimes(1)
    expect(dom.onResize.mock.results[1]?.value).not.toHaveBeenCalled()

    widget.destroy(current)
    expect(unmount).toHaveBeenCalledTimes(2)
  })

  it("uses premeasured DOM only for the first render and retains the known height", () => {
    const { view, widget } = create(true)
    expect(widget.estimatedHeight).toBe(42)
    expect(mount).toHaveBeenCalledTimes(1)
    const previous = widget.toDOM(view)
    expect(dom.estimateHeight).toHaveBeenCalledExactlyOnceWith(view, previous)
    expect(mount).toHaveBeenCalledTimes(1)
    const current = widget.toDOM(view)

    expect(current).not.toBe(previous)
    expect(mount).toHaveBeenCalledTimes(2)
    widget.destroy(previous)
    expect(widget.estimatedHeight).toBe(42)
    widget.destroy(current)
  })
})
