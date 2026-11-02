// Settings shared by every part of the extension. Everything lives in storage.local:
// company lists can be large, and nothing ever leaves the browser.
const DEFAULT_SETTINGS = {
  companies: [],
  enabled: true,
  color: "#ffeb3b"
};

async function loadSettings() {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

function saveSettings(changes) {
  return chrome.storage.local.set(changes);
}

if (typeof module !== "undefined") {
  module.exports = { DEFAULT_SETTINGS, loadSettings, saveSettings };
}
