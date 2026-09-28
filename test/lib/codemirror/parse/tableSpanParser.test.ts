import { history, invertedEffects, redo, undo } from "@codemirror/commands"
import { markdown } from "@codemirror/lang-markdown"
import {
  ChangeSet,
  EditorSelection,
  EditorState,
  type Extension,
  StateField,
  type Transaction,
} from "@codemirror/state"
import { Table } from "@lezer/markdown"
import { describe, expect, it, vi } from "vitest"

import { tableFormattingFilterSpec } from "#codemirror/format/tableFormattingUpdater"
import * as TableSpanParser from "#codemirror/parse/tableSpanParser"
import { tablesStateField } from "#codemirror/state/tablesStateField"
import { viewStateField } from "#codemirror/state/viewStateField"
import * as TableAnnotation from "#codemirror/transaction/tableAnnotation"
import { tableEffectAnnotationExtenderSpec } from "#codemirror/transaction/tableEffectAnnotationExtender"
import { tableInvertedEffectsSpec } from "#codemirror/transaction/tableInvertedEffects"

vi.mock("markedit-api", () => ({ MarkEdit: {} }))

const table =
  "| Header A | Header B |\n| -------- | -------- |\n| one      | ple      |\n| three    | four     |"

function format(state: EditorState): EditorState {
  const changes = ChangeSet.of(TableSpanParser.parseFull(state).formatting, state.doc.length)
  if (changes.empty) return state
  return state.update({
    changes,
    selection: state.selection.map(changes),
    annotations: TableAnnotation.of("table.format"),
  }).state
}

function create(doc: string, selection: EditorSelection, extensions: Extension = []): EditorState {
  return EditorState.create({
    doc,
    selection,
    extensions: [
      markdown({ extensions: Table }),
      EditorState.allowMultipleSelections.of(true),
      history(),
      viewStateField,
      tablesStateField,
      invertedEffects.of(tableInvertedEffectsSpec),
      EditorState.transactionExtender.of(tableEffectAnnotationExtenderSpec),
      EditorState.transactionFilter.of(tableFormattingFilterSpec),
      extensions,
    ],
  })
}

describe("selection after table formatting", () => {
  it("does not build a discarded editor state while filtering", () => {
    const updates: string[] = []
    const observer = StateField.define({
      create: () => 0,
      update(value, transaction) {
        updates.push(transaction.newDoc.toString())
        return value
      },
    })
    const doc = `\n${table}\n\n`
    const from = doc.indexOf("ple")
    const state = create(doc, EditorSelection.single(from + 3), observer).update({
      changes: { from, to: from + 3, insert: "please" },
      selection: EditorSelection.cursor(from + 6),
    }).state
    expect(updates).toEqual([state.doc.toString()])
    expect(state.doc.toString()).toContain("| please   |")
  })

  it("does not format a former table when the same edit puts it inside a code block", () => {
    const doc = `\n${table}\n\n`
    const from = doc.indexOf("ple")
    const transaction = create(doc, EditorSelection.single(from)).update({
      changes: [
        { from: 0, insert: "```\n" },
        { from, to: from + 3, insert: "please" },
        { from: doc.length, insert: "```" },
      ],
    })
    expect(transaction.annotation(TableAnnotation.type)).toBeUndefined()
    expect(transaction.newDoc.toString()).toBe("```\n" + doc.replace("ple", "please") + "```")
    expect(transaction.state.field(tablesStateField).tables).toHaveLength(0)
  })

  it("leaves structural edits to the regular formatting path without swallowing newlines", () => {
    const doc = `\n${table}\n\n`
    const end = doc.length - 2
    const transaction = create(doc, EditorSelection.single(end)).update({
      changes: { from: end, insert: "\n" },
    })
    expect(transaction.annotation(TableAnnotation.type)).toBeUndefined()
    expect(transaction.newDoc.toString()).toBe(doc + "\n")
  })

  it.each(["please", "loooooongcompletion", "p"])(
    "keeps a completion caret in the same cell for %s",
    (completion) => {
      const doc = `\n${table}\n\n`
      const from = doc.indexOf("ple")
      let state = create(doc, EditorSelection.single(from + 3))
      state = state.update({
        changes: { from, to: from + 3, insert: completion },
        selection: EditorSelection.cursor(from + completion.length),
      }).state
      state = format(state)
      const expected = state.doc.toString().indexOf(completion) + completion.length
      expect(state.selection.main).toEqual(EditorSelection.cursor(expected))
      expect(state.doc.lineAt(expected).number).toBe(4)
    },
  )

  it("preserves reversed selections across cells and formatting-added blank lines", () => {
    const doc = `Before\n${table.replace("ple", "please")}\nAfter`
    const state = format(
      create(doc, EditorSelection.single(doc.indexOf("four") + 3, doc.indexOf("please") + 2)),
    )
    const text = state.doc.toString()
    expect(state.selection.main.anchor).toBe(text.indexOf("four") + 3)
    expect(state.selection.main.head).toBe(text.indexOf("please") + 2)
  })

  it("preserves multiple selections in different tables and outside them", () => {
    const doc = `Before\n\n${table.replace("ple", "please")}\n\n${table.replace("ple", "complete")}\n\nAfter`
    const selection = EditorSelection.create(
      [
        EditorSelection.cursor(2),
        EditorSelection.cursor(doc.indexOf("please") + 6),
        EditorSelection.range(doc.indexOf("complete"), doc.indexOf("complete") + 8),
        EditorSelection.cursor(doc.length),
      ],
      2,
    )
    const state = format(create(doc, selection))
    const text = state.doc.toString()
    expect(state.selection.toJSON()).toEqual(
      EditorSelection.create(
        [
          EditorSelection.cursor(2),
          EditorSelection.cursor(text.indexOf("please") + 6),
          EditorSelection.range(text.indexOf("complete"), text.indexOf("complete") + 8),
          EditorSelection.cursor(text.length),
        ],
        2,
      ).toJSON(),
    )
  })

  it("keeps an empty-cell caret in the same column", () => {
    const doc = "\n| h | wide |\n| --- | --- |\n| value |     |\n\n"
    const state = format(create(doc, EditorSelection.single(doc.indexOf("|     |") + 2)))
    const text = state.doc.toString()
    expect(state.selection.main.head).toBe(text.indexOf("|      |", text.indexOf("value")) + 2)
  })

  it("maps escaped pipes, line breaks and trimmed cell content", () => {
    const doc = "\nA|B\n---|---\none|<br> a\\|b<br>c <br>\n\n"
    const state = format(create(doc, EditorSelection.single(doc.indexOf("b<br>c") + 6)))
    expect(state.selection.main.head).toBe(state.doc.toString().indexOf("b<br>c") + 6)
  })

  it("does not move a selection when no formatting is needed", () => {
    const doc = `\n${table}\n\n`
    const selection = EditorSelection.single(doc.indexOf("ple") + 3)
    expect(format(create(doc, selection)).selection.toJSON()).toEqual(selection.toJSON())
  })

  it("does not mistake trimmed line-break markup for matching cell content", () => {
    const doc = "\na|b\n---|---\none|<br>br<br>\n\n"
    const state = format(create(doc, EditorSelection.single(doc.indexOf(">br") + 3)))
    expect(state.selection.main.head).toBe(state.doc.toString().lastIndexOf("br") + 2)
  })

  it.each([table, "| A   | B   |\n| --- | --- |\n| one | ple |"])(
    "undoes and redoes the completion and formatting together in %s",
    (input) => {
      const doc = `\n${input}\n\n`
      const from = doc.indexOf("ple")
      let state = create(doc, EditorSelection.single(from + 3))
      state = format(
        state.update({
          changes: { from, to: from + 3, insert: "please" },
          selection: EditorSelection.cursor(from + 6),
        }).state,
      )
      const completed = state
      const target = {
        get state() {
          return state
        },
        dispatch(transaction: Transaction) {
          state = transaction.state
        },
      }
      expect(undo(target)).toBe(true)
      expect(state.doc.toString()).toBe(doc)
      expect(state.selection.main.head).toBe(from + 3)
      expect(
        state.field(tablesStateField).tables[0].table.cellAt({ row: 1, col: 1 }).toString(),
      ).toBe("ple")
      expect(redo(target)).toBe(true)
      expect(state.doc).toEqual(completed.doc)
      expect(state.selection).toEqual(completed.selection)
      expect(
        state.field(tablesStateField).tables[0].table.cellAt({ row: 1, col: 1 }).toString(),
      ).toBe("please")
    },
  )
})
