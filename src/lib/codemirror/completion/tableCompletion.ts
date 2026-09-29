import { type Completion, pickedCompletion } from "@codemirror/autocomplete"
import type { Text } from "@codemirror/state"

import * as Arrays from "#ext/stdlib/arrays"

import * as TableInserter from "#core/tableInserter"

export function of({
  pos,
  doc,
  lineBreak,
  rows,
  cols,
  label,
}: {
  pos: number
  doc: Text
  lineBreak: string
  rows: number
  cols: number
  label: (rows: number, cols: number) => string
}): Completion {
  const [headerRow, ...dataRows] = Arrays.repeat(`${"|   ".repeat(cols)}|`, { count: rows })
  const alignmentRow = `${"| - ".repeat(cols)}|`

  // Add line breaks around completion if necessary
  const { before, after } = TableInserter.computeInsertion({
    doc,
    lineBreak,
    span: { from: pos - 1, to: pos },
  })
  const table = `${before?.insert ?? ""}${[headerRow, alignmentRow, ...dataRows].join(lineBreak)}${after?.insert ?? ""}`

  return {
    label: label(rows, cols),
    type: "table",
    apply: (view, completion) => {
      view.dispatch({
        annotations: pickedCompletion.of(completion),
        changes: { from: pos - 1, to: pos, insert: table },
        selection: { anchor: pos + 1 + (before?.count ?? 0) },
      })
    },
  }
}
