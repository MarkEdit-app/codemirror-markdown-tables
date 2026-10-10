import { describe, expect, it } from "vitest"

import { cellEditorTheme } from "#components/table/cell/cellEditor/cellEditorTheme"
import { handleTheme } from "#components/table/handle/handleTheme"
import { tableTheme } from "#components/table/tableTheme"

describe("table touch scrolling", () => {
  it("allows native gestures over table content and editable lines", () => {
    expect(tableTheme[".tbl-table-wrapper"]["touch-action"]).toBeUndefined()
    expect(tableTheme[".tbl-table"]["touch-action"]).toBeUndefined()
    expect(cellEditorTheme[".tbl-cell-editor .cm-editor .cm-line"]["touch-action"]).toBeUndefined()
  })

  it("keeps handles available for custom dragging", () => {
    expect(handleTheme[".tbl-handle"]["touch-action"]).toBe("none")
  })
})
