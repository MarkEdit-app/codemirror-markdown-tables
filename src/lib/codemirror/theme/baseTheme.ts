import type { ThemeSpec } from "@codemirror/view"

import { tableAutocompleterTheme } from "#codemirror/completion/tableAutocompleterTheme"
import { tableWidgetTheme } from "#codemirror/decoration/tableWidgetTheme"

import { blockingOverlayTheme } from "#components/table/blockingOverlay/blockingOverlayTheme"
import { cellEditorTheme } from "#components/table/cell/cellEditor/cellEditorTheme"
import { cellTheme } from "#components/table/cell/cellTheme"
import { cellViewTheme } from "#components/table/cell/cellView/cellViewTheme"
import { handleTheme } from "#components/table/handle/handleTheme"
import { selectAllOverlayTheme } from "#components/table/selectAllOverlay/selectAllOverlayTheme"
import { tableTheme } from "#components/table/tableTheme"

export const baseThemeSpec: ThemeSpec = {
  ...tableAutocompleterTheme,
  ...tableWidgetTheme,
  ...tableTheme,
  ...blockingOverlayTheme,
  ...cellTheme,
  ...cellEditorTheme,
  ...cellViewTheme,
  ...handleTheme,
  ...selectAllOverlayTheme,
}
