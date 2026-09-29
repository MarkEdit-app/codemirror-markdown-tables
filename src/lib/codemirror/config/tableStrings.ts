export interface TableStrings {
  readonly tableCompletion: (rows: number, cols: number) => string
  readonly sortColumnAscending: string
  readonly sortColumnDescending: string
  readonly alignNone: string
  readonly alignLeft: string
  readonly alignCenter: string
  readonly alignRight: string
  readonly addRowAbove: string
  readonly addRowBelow: string
  readonly addColumnBefore: string
  readonly addColumnAfter: string
  readonly moveRowUp: string
  readonly moveRowDown: string
  readonly moveColumnLeft: string
  readonly moveColumnRight: string
  readonly duplicateRow: string
  readonly duplicateColumn: string
  readonly clearRow: string
  readonly clearColumn: string
  readonly deleteRow: string
  readonly deleteColumn: string
}

export const defaultTableStrings: TableStrings = {
  tableCompletion: (rows, cols) => `${rows}\u00d7${cols} table`,
  sortColumnAscending: "Sort by column (A-Z)",
  sortColumnDescending: "Sort by column (Z-A)",
  alignNone: "Align none",
  alignLeft: "Align left",
  alignCenter: "Align center",
  alignRight: "Align right",
  addRowAbove: "Add row above",
  addRowBelow: "Add row below",
  addColumnBefore: "Add column before",
  addColumnAfter: "Add column after",
  moveRowUp: "Move row up",
  moveRowDown: "Move row down",
  moveColumnLeft: "Move column left",
  moveColumnRight: "Move column right",
  duplicateRow: "Duplicate row",
  duplicateColumn: "Duplicate column",
  clearRow: "Clear row",
  clearColumn: "Clear column",
  deleteRow: "Delete row",
  deleteColumn: "Delete column",
}

export function resolveTableStrings(strings?: Partial<TableStrings>): TableStrings {
  return { ...defaultTableStrings, ...strings }
}
