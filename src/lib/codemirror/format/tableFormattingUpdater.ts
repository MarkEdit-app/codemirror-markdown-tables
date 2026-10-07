import { ChangeSet, type TransactionFilterSpec } from "@codemirror/state"
import type { UpdateListenerSpec } from "@codemirror/view"

import * as EditorStates from "#ext/codemirror/state/editorStates"
import * as Arrays from "#ext/stdlib/arrays"

import * as TableEditorState from "#codemirror/state/tableEditorState"
import * as TableAnnotation from "#codemirror/transaction/tableAnnotation"
import * as TableTransactions from "#codemirror/transaction/tableTransactions"

import * as TableParser from "#core/tableParser"

export const tableFormattingFilterSpec: TransactionFilterSpec = (transaction) => {
  if (!transaction.docChanged || TableTransactions.hasTableEvent(transaction)) return transaction

  const { tables } = TableEditorState.getTableState(transaction.startState)
  let needsFallback = false
  transaction.changes.iterChangedRanges((from, to) => {
    if (!tables.some((table) => from >= table.from && to <= table.to)) needsFallback = true
  })
  if (needsFallback) return transaction

  const formatting = tables.flatMap((table) => {
    if (transaction.changes.touchesRange(table.from, table.to) === false) return []
    const from = transaction.changes.mapPos(table.from, -1)
    const to = transaction.changes.mapPos(table.to, 1)
    const text = transaction.newDoc.slice(from, to)
    const formatted = TableParser.parseOrNil(text)
    if (formatted === undefined || text.lines !== table.table.text.lines) {
      needsFallback = true
      return []
    }
    if (text.eq(formatted.text)) return []
    return TableParser.formatChanges(text, formatted.text).map((change) => ({
      ...change,
      from: from + change.from,
      to: from + change.to,
    }))
  })
  if (needsFallback || Arrays.isEmpty(formatting)) return transaction

  // Keep external edits and their formatting in one undo event, even when they touch different rows.
  const changes = ChangeSet.of(
    formatting,
    transaction.newDoc.length,
    transaction.startState.lineBreak,
  )
  return [
    transaction,
    {
      changes,
      selection: transaction.newSelection.map(changes),
      annotations: TableAnnotation.of("table.format"),
      sequential: true,
    },
  ]
}

export const tableFormattingUpdaterSpec: UpdateListenerSpec = ({
  state,
  docChanged,
  selectionSet,
  transactions,
  view,
}) => {
  if (!docChanged && !selectionSet && EditorStates.hasHistory(state)) return
  if (transactions.some((it) => TableTransactions.hasTableEvent(it))) return

  const { complete, formatting } = TableEditorState.getTableState(state)
  if (!complete || Arrays.isEmpty(formatting)) return

  const formattingChangeSet = ChangeSet.of(formatting, state.doc.length, state.lineBreak)
  const selection = state.selection.map(formattingChangeSet)

  view.dispatch({
    annotations: TableAnnotation.of("table.format"),
    changes: formattingChangeSet,
    selection,
  })
}
