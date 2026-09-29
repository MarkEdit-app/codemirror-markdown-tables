import { CompletionContext } from "@codemirror/autocomplete"
import { EditorState } from "@codemirror/state"
import { describe, expect, it } from "vitest"

import * as TableAutocompleter from "#codemirror/completion/tableAutocompleter"

describe("table autocompleter strings", () => {
  it("uses the default completion label", () => {
    const source = TableAutocompleter.of({ options: [{ rows: 2, cols: 3 }] })
    const state = EditorState.create({ doc: "|" })
    expect(source(new CompletionContext(state, 1, false))?.options[0]?.label).toBe("2\u00d73 table")
  })

  it("uses a configured completion label", () => {
    const source = TableAutocompleter.of({
      options: [{ rows: 2, cols: 3 }],
      strings: { tableCompletion: (rows, cols) => `${rows} \u00d7 ${cols} Tabelle` },
    })
    const state = EditorState.create({ doc: "|" })
    expect(source(new CompletionContext(state, 1, false))?.options[0]?.label).toBe(
      "2 \u00d7 3 Tabelle",
    )
  })
})
