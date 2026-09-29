import type { TableConfig } from "#codemirror/config/tableConfig"
import { resolveTableStrings, type TableStrings } from "#codemirror/config/tableStrings"
import { TableStyle } from "#codemirror/config/tableStyle"
import { TableTheme } from "#codemirror/config/tableTheme"

type TableConfigOptions = Omit<Partial<TableConfig>, "strings"> & {
  readonly strings?: Partial<TableStrings>
}

/**
 * Creates a {@link TableConfig} with defaults overridden by the given {@link config}.
 *
 * Defaults to the following:
 * ```typescript
 * {
 *   strings: defaultTableStrings,
 *   theme: { light: TableTheme.light, dark: TableTheme.dark },
 *   style: TableStyle.default,
 *   selectionType: "codemirror",
 *   handlePosition: "outside",
 *   lineWrapping: "wrap",
 *   markdownConfig: {
 *     extensions: undefined,         // CM MarkdownConfig default: []
 *     completeHTMLTags: undefined,   // CM MarkdownConfig default: true
 *     pasteURLAsLink: undefined,     // CM MarkdownConfig default: true
 *     htmlTagLanguage: undefined,    // CM MarkdownConfig default: default html language
 *   },
 *   extensions: [],
 *   globalKeyBindings: [],
 * }
 * ```
 */
export function of(config?: TableConfigOptions): TableConfig {
  return {
    strings: resolveTableStrings(config?.strings),
    theme: config?.theme ?? { light: TableTheme.light, dark: TableTheme.dark },
    style: config?.style ?? TableStyle.default,
    selectionType: config?.selectionType ?? "codemirror",
    handlePosition: config?.handlePosition ?? "outside",
    lineWrapping: config?.lineWrapping ?? "wrap",
    markdownConfig: {
      extensions: config?.markdownConfig?.extensions ?? undefined,
      completeHTMLTags: config?.markdownConfig?.completeHTMLTags ?? undefined,
      pasteURLAsLink: config?.markdownConfig?.pasteURLAsLink ?? undefined,
      htmlTagLanguage: config?.markdownConfig?.htmlTagLanguage ?? undefined,
    },
    extensions: config?.extensions ?? [],
    globalKeyBindings: config?.globalKeyBindings ?? [],
  }
}
