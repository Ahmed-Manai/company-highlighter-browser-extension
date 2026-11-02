# Changelog

## 1.0.0

### Added
- Settings page to edit, import and export the company list, choose the highlight colour, and turn highlighting on or off.
- Toolbar popup with an on/off switch and the number of matches on the current page.
- Match count on the toolbar badge.
- Lines starting with `#` in the list are treated as comments.
- Icons.
- Firefox support from the same package (Firefox 121+).
- Automated tests and CI; tagged releases attach a store-ready zip.

### Changed
- The list is stored in the browser instead of a `companies.txt` file inside the extension folder. Changes apply to open tabs immediately.
- An existing `companies.txt` is imported once when upgrading.

### Removed
- `companies.txt` is no longer exposed as a web-accessible resource, so websites can no longer read your list.

## 0.x

- Highlighting from a bundled `companies.txt` file.
