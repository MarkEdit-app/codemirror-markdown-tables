import { markdown } from "@codemirror/lang-markdown"
import { ensureSyntaxTree, syntaxTree, syntaxTreeAvailable } from "@codemirror/language"
import { ChangeSet, EditorState, type TransactionSpec } from "@codemirror/state"
import type { EditorView, ViewUpdate } from "@codemirror/view"
import { parser, Table } from "@lezer/markdown"
import { It, mock, when } from "strong-mock"
import { afterEach, describe, expect, it, vi } from "vitest"

import { tableFormattingUpdaterSpec } from "#codemirror/format/tableFormattingUpdater"
import { tablesStateField } from "#codemirror/state/tablesStateField"
import { viewStateField } from "#codemirror/state/viewStateField"
import * as TableAnnotation from "#codemirror/transaction/tableAnnotation"

import { expectDef } from "../../../../testSupport/vitest/existence"

vi.mock("markedit-api", () => ({ MarkEdit: {} }))
vi.mock("@codemirror/language", async (importOriginal) => {
  const language = await importOriginal<typeof import("@codemirror/language")>()
  return { ...language, syntaxTree: vi.fn(language.syntaxTree) }
})

function create(doc: string): EditorState {
  return EditorState.create({
    doc,
    selection: { anchor: doc.indexOf("cell") },
    extensions: [markdown({ extensions: Table }), viewStateField, tablesStateField],
  })
}

function runUpdater(state: EditorState, selectionSet = false): TransactionSpec | undefined {
  const dispatched = It.willCapture<TransactionSpec>()
  const view = mock<EditorView>()
  when(() => view.dispatch(dispatched))
    .thenReturn(undefined)
    .atMost(1)
  const update = mock<ViewUpdate>()
  when(() => update.state).thenReturn(state)
  when(() => update.docChanged).thenReturn(false)
  when(() => update.selectionSet).thenReturn(selectionSet)
  when(() => update.transactions).thenReturn([])
  when(() => update.view).thenReturn(view)
  tableFormattingUpdaterSpec(update)
  return dispatched.value
}

describe("formatting with partial syntax trees", () => {
  afterEach(() => vi.mocked(syntaxTree).mockReset())

  const header = "| Head ".repeat(8) + "|"
  const delimiter = "| ---- ".repeat(8) + "|"
  const row = "| cell ".repeat(8) + "|"
  const doc = [header, delimiter, ...new Array<string>(53).fill(row)].join("\n")

  it.each([false, true])(
    "waits for complete table state before formatting (selectionSet: %s)",
    (selectionSet) => {
      // Expose the truncated table tree observed in the host, independent of parser version.
      const partialEnd = doc.indexOf("\n", 3000) + 1
      const partialTree = parser.configure(Table).parse(doc.slice(0, partialEnd))
      const tree = vi.mocked(syntaxTree).mockReturnValue(partialTree)
      let state = create(doc)
      const tableState = state.field(tablesStateField)
      expect(syntaxTreeAvailable(state)).toBe(false)
      expect(tableState.complete).toBe(false)
      expect(partialTree.length).toBeLessThan(state.doc.length)

      const unsafeFormatting = ChangeSet.of(tableState.formatting, state.doc.length)
      const insertions: { from: number; text: string }[] = []
      unsafeFormatting.iterChanges((from, _to, _newFrom, _newTo, inserted) => {
        insertions.push({ from, text: inserted.toString() })
      })
      expect(insertions).toContainEqual({ from: partialTree.length, text: "\n" })
      expect(runUpdater(state, selectionSet)).toBeUndefined()
      expect(state.doc.toString()).toBe(doc)

      tree.mockReset()
      expect(ensureSyntaxTree(state, state.doc.length, 1000)).not.toBeNull()
      expect(syntaxTreeAvailable(state)).toBe(true)
      // Parser progress alone does not refresh the cached formatting changes.
      expect(state.field(tablesStateField).complete).toBe(false)
      expect(runUpdater(state, selectionSet)).toBeUndefined()

      state = state.update({}).state
      expect(state.field(tablesStateField).complete).toBe(true)
      const dispatched = runUpdater(state)
      expectDef(dispatched)
      const transaction = state.update(dispatched)
      expect(transaction.annotation(TableAnnotation.type)).toBe("table.format")
      expect(transaction.newDoc.toString()).toBe(`\n${doc}\n`)
      expect(transaction.newSelection.main.head).toBe(state.selection.main.head + 1)
      expect(transaction.state.field(tablesStateField).tables).toHaveLength(1)
      expect(transaction.state.field(tablesStateField).tables[0].to).toBe(doc.length + 1)
    },
  )

  it("still formats a fully parsed short table immediately", () => {
    const shortDoc = [header, delimiter, row].join("\n")
    const state = create(shortDoc)
    expect(state.field(tablesStateField).complete).toBe(true)
    const dispatched = runUpdater(state)
    expectDef(dispatched)
    const transaction = state.update(dispatched)
    expect(transaction.newDoc.toString()).toBe(`\n${shortDoc}\n`)
    expect(runUpdater(transaction.state)).toBeUndefined()
  })
})
