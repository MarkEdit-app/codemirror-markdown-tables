# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This changelog includes the MarkEdit fork's changes relative to
[ckant/codemirror-markdown-tables](https://github.com/ckant/codemirror-markdown-tables).
The fork starts from upstream v1.0.1, including its
[changelog update (`1a6558f`)](https://github.com/ckant/codemirror-markdown-tables/commit/1a6558fddceb885c53b3b64790cad95c9f5d9eb0).
The v1.0.2 entry below includes all fork-specific changes since that baseline;
earlier entries describe upstream releases.

## [Unreleased](https://github.com/MarkEdit-app/codemirror-markdown-tables/compare/v1.0.2...HEAD)

## [1.0.2](https://github.com/MarkEdit-app/codemirror-markdown-tables/releases/tag/v1.0.2) - 2026-09-28

### Changed

- Replace HTML row and column menus with native macOS menus through `MarkEdit.showContextMenu`, positioned at the requested click location and using SF Symbol icons. Keep the existing add, move, duplicate, clear, delete, column-sort, and column-alignment actions and their boundary restrictions.
- Delegate menu input tracking, appearance, positioning, and dismissal to macOS. Clear the active handle before opening a menu so dismissal or a host error cannot leave a stale modal handle; retain the selected row or column and action-driven selection updates.
- Require the MarkEdit host for native menus; they are unavailable in the standalone browser demo. Menu appearance is no longer controlled by the removed HTML menu styles.
- Apply table formatting as cell-aware changes instead of replacing the entire table, preserving position mapping around cell text, delimiters, and padding.
- Format external text edits confined to existing, still-valid tables in the same transaction as the edit. Structural edits, edits outside tables, and edits that invalidate a table continue through the regular formatting path.

### Fixed

- Preserve cell selections when external edits, such as native word completion, reformat a table, including completions that widen or shrink a column.
- Preserve reversed and multiple selections, selections outside tables, and empty-cell carets when formatting changes spacing or inserts surrounding blank lines.
- Map selections correctly through escaped pipes, `<br>` line breaks, and trimmed cell content.
- Keep supported external text edits inside existing tables and their formatting in one undo step, including formatting that touches other rows. Refresh table cells after formatting and redo so rendered content matches the document.
- Keep tables visible when mouse selection rebuilds their widgets, including in MarkEdit Preview's syntax-hidden mode. Give each rendered DOM its own component cleanup so destroying an older render cannot empty the current one.

### Added

- Build JavaScript bundles and TypeScript declarations automatically on Git installation through a `prepare` script. Install scripts must be enabled; generated `dist` files remain untracked.
- Add CodeMirror and Lezer peer packages as development dependencies with matching version ranges so Yarn Classic can build in its isolated Git preparation directory without automatically installing peers.
- Add `markedit-api` v0.35.0 as a Git development dependency and explicitly externalize it from library bundles so the host supplies the API at runtime.
- Add regression tests for native menu actions, icons, boundary restrictions, selection updates, dismissal, and host errors; and for formatting position mapping, completion, undo/redo, and structural-edit fallbacks.
- Document the MarkEdit-specific menu requirements and Git-installation setup in the README.

### Removed

- Remove the `@floating-ui/dom` dependency, HTML menu components and their styles, the CodeMirror menu tooltip, and menu-only state and DOM event handlers. Native menus replace the previous pointer, wheel, and keyboard interception.

### Build

- Pin `vitest`, `@vitest/ui`, and `@vitest/coverage-v8` to `4.0.18` to avoid the [Yarn Classic/Vite linking issue](https://github.com/vitest-dev/vitest/issues/9859) during Git dependency preparation. Update the npm lockfile for the fork's dependency and version changes; Yarn Classic does not use this lockfile.

## [1.0.1](https://github.com/ckant/codemirror-markdown-tables/releases/tag/v1.0.1) - 2026-07-23

### Removed

- Dependency on `@mobily/ts-belt` (no change in functionality)

## [1.0.0](https://github.com/ckant/codemirror-markdown-tables/releases/tag/v1.0.0) - 2026-03-07

### Added

- Initial release
