import { ChangeSet, Text } from "@codemirror/state"
import { describe, expect, it } from "vitest"

import * as TableParser from "#core/tableParser"

import { txt } from "../../../testSupport/helpers/txt"
import { expectDef, expectNil } from "../../../testSupport/vitest/existence"

describe("formatChanges", () => {
  it.each([
    "| a | b |\n| --- | --- |\n| one | please |",
    "a|b\n---|---\nfirst|second",
    "a|b\n---|---\n| first |",
    "a|b\n---|---\nfirst|second|extra",
    "a|b\n---|---\n||",
    "||\n|-|\n||",
    "| | wide |\n| --- | :---: |\n| value | |",
    "a|b\n---|---\n| | last |",
    "a|b\n---|---\none|<br> a\\|b<br>c <br>",
    "a|b\n---|---\none|<br><br>",
    "| a | b |\n| --- | --- |\n| cafe\u0301 | \u{1F600} |",
  ])("produces exactly the normalized table for %s", (input) => {
    const original = Text.of(input.split("\n"))
    const formatted = TableParser.parse(original).text
    const changes = ChangeSet.of(TableParser.formatChanges(original, formatted), original.length)
    expect(changes.apply(original)).toEqual(formatted)
  })

  it("does not replace unchanged cell text", () => {
    const original = txt`
      | a | b |
      | --- | --- |
      | one | please |
    `
    const formatted = TableParser.parse(original).text
    const changes = ChangeSet.of(TableParser.formatChanges(original, formatted), original.length)
    const from = original.toString().indexOf("please")
    changes.iterChanges((start, end) => {
      expect(start < from + 6 && end > from).toBe(false)
    })
  })
})

describe("parse", () => {
  it("throws when not a table", () => {
    expect(() => TableParser.parse(txt``)).toThrow(/^Text is not a table$/)
  })
  it("parses table", () => {
    const unformattedText = txt`
        |      | a  | b   | c de |   |    |
        | ---  |-----| :-: | :--| - | -: |
        |   | fg | h   | ij   |   |    |
        k|||n||p
      `

    const { text, colSizes, alignments, contentSizes } = TableParser.parse(unformattedText)

    expect(text).toStrictEqual(txt`
        |   | a  | b   | c de |   |    |
        | - | -- | :-: | :--- | - | -: |
        |   | fg | h   | ij   |   |    |
        | k |    |     | n    |   | p  |
      `)
    expect(colSizes).toStrictEqual([3, 4, 5, 6, 3, 4])
    expect(alignments).toStrictEqual(["none", "none", "center", "left", "none", "right"])
    expect(contentSizes).toStrictEqual([
      [0, 1, 1, 4, 0, 0],
      [0, 2, 1, 2, 0, 0],
      [1, 0, 0, 1, 0, 1],
    ])
  })
})

describe("parseOrNil", () => {
  it("returns nil when not a table", () => {
    expectNil(TableParser.parseOrNil(txt``))
  })
  it("parses table", () => {
    const unformattedText = txt`
        |      | a  | b   | c de |   |    |
        | ---  |-----| :-: | :--| - | -: |
        |   | fg | h   | ij   |   |    |
        k|||n||p
      `

    const tableProps = TableParser.parseOrNil(unformattedText)

    expectDef(tableProps)
    const { text, colSizes, alignments, contentSizes } = tableProps
    expect(text).toStrictEqual(txt`
        |   | a  | b   | c de |   |    |
        | - | -- | :-: | :--- | - | -: |
        |   | fg | h   | ij   |   |    |
        | k |    |     | n    |   | p  |
      `)
    expect(colSizes).toStrictEqual([3, 4, 5, 6, 3, 4])
    expect(alignments).toStrictEqual(["none", "none", "center", "left", "none", "right"])
    expect(contentSizes).toStrictEqual([
      [0, 1, 1, 4, 0, 0],
      [0, 2, 1, 2, 0, 0],
      [1, 0, 0, 1, 0, 1],
    ])
  })
})
