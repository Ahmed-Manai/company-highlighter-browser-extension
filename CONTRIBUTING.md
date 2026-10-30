# Contributing

Thanks for helping improve Company Highlighter.

## Reporting bugs and requesting features

Open an issue using the **Bug report** or **Feature request** template. For bugs, include the browser version, the page (if public) and the minimal `companies.txt` lines that reproduce the problem.

## Development setup

There is no build step: the extension is plain JavaScript and CSS.

1. Fork and clone the repository.
2. `cp companies.example.txt companies.txt` and add a few test names.
3. Load the folder as an unpacked extension (see the README for Chrome, Edge and Firefox).
4. After each change, click reload on the extensions page and refresh the test tab.

Use the page's developer console to see `Company Highlighter:` log messages and errors.

## Guidelines

- Keep the extension dependency-free and permission-light. Do not add permissions unless they are required, and document any new one in the README's Permissions section.
- Never insert page text with `innerHTML`; build DOM nodes so page content cannot inject markup.
- Keep performance in mind: the content script runs on every page and on every DOM change.
- Do not commit your personal `companies.txt` (it is ignored by Git). Update `companies.example.txt` only with generic examples.
- Test in at least one Chromium browser; test Firefox when touching `manifest.json`.

## Pull requests

1. Create a branch from `main`.
2. Keep each pull request focused on one change.
3. Use clear commit messages, e.g. `fix: skip contenteditable elements` or `feat: add per-list colors`.
4. Fill in the pull request template, including how you tested.

By contributing, you agree that your contributions are licensed under the project's MIT License.
