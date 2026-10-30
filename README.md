# Company Highlighter

A lightweight browser extension that highlights the company names from your own list on any web page.

Useful when scanning job boards, LinkedIn feeds, news or search results for companies you care about (target employers, clients, competitors, a blocklist, ...).

## Features

- Highlights every occurrence of a company from `companies.txt` on every page you visit
- Case-insensitive, whole-name matching (`Acme` does not match `Acmeish`); names with symbols such as `AT&T` or `C++` work
- Prefers the longest name when entries overlap (`Acme Labs` over `Acme`)
- Keeps up with dynamic pages (infinite scroll, single-page apps) through a debounced `MutationObserver`
- Scales to large lists: names are compiled into a small number of regular expressions (500 names each) rather than checked one by one
- Leaves scripts, styles, `<textarea>` fields, SVG and editable areas (`contenteditable`) untouched
- Inserts highlights as plain DOM nodes, never as HTML, so page text cannot inject markup
- No network requests, no tracking, no storage: the list never leaves your machine

## How it works

```
companies.txt ──> content.js (loads list, builds regexes) ──> walks page text nodes
                                                           └─> wraps matches in <span class="company-highlight">
```

| File                    | Purpose |
|-------------------------|---------|
| `manifest.json`         | Manifest V3 definition: content script on all pages, `companies.txt` exposed as a web-accessible resource |
| `content.js`            | Loads the list, finds matches and highlights them; re-runs when the page changes |
| `styles.css`            | Highlight style (`.company-highlight`: yellow background, bold) |
| `companies.example.txt` | Sample list to copy from |
| `companies.txt`         | **Your** list (not committed, ignored by Git) |

## Installation

1. Clone or download this repository.
2. Create your list:
   ```bash
   cp companies.example.txt companies.txt
   ```
   then edit `companies.txt` (see [The company list](#the-company-list)).
3. Load the folder as an unpacked extension in your browser.

### Chrome / Edge / Brave (Chromium)

1. Open `chrome://extensions` (Edge: `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select the repository folder.

### Firefox (109+)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...** and select `manifest.json`.
3. If highlights do not appear, open `about:addons`, select Company Highlighter, and under **Permissions** allow access to all websites.

Temporary add-ons are removed when Firefox restarts.

### Updating the list

After editing `companies.txt`, reload the extension (the reload icon on the extensions page, or **Reload** in `about:debugging`) and refresh the tabs you want to scan.

## The company list

`companies.txt` is a plain UTF-8 text file with **one company name per line**:

```
Google
Microsoft
Acme Labs
AT&T
```

- Matching is case-insensitive; the page's original casing is kept.
- Leading/trailing spaces, blank lines and Windows line endings are ignored.
- Names are matched as whole words: a name is not highlighted when it is directly preceded or followed by a letter, digit or underscore.
- Duplicates are removed automatically.

If `companies.txt` is missing or empty, the extension does nothing and logs a warning in the page's developer console.

## Customising the highlight

Edit `styles.css` and reload the extension:

```css
.company-highlight {
  background-color: yellow;
  color: black;
  font-weight: bold;
  padding: 1px 2px;
  border-radius: 3px;
}
```

## Permissions

The extension requests no API permissions. The browser will still show that it can **read and change data on all websites**, because:

| Manifest entry | Why it is needed |
|----------------|------------------|
| `content_scripts.matches: ["<all_urls>"]` | The highlighter has to run on every page to find company names in the page text. It only reads text and wraps matches in `<span>` elements. |
| `web_accessible_resources: companies.txt` | Lets the content script load your list from the extension package. A side effect is that a web page that knows the extension's ID could request the file; do not put secrets in it. |

The extension makes no network requests and stores no data.

## Troubleshooting

- **Nothing is highlighted**: open DevTools on the page and look for `Company Highlighter:` messages in the console. `loaded companies: 0` or a warning means `companies.txt` is missing or empty.
- **Changes to the list are ignored**: reload the extension, then refresh the page.
- **Browser internal pages** (`chrome://`, `about:`, the extension stores, PDF viewer) cannot be scripted by extensions.

## Contributing

Bug reports and pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
