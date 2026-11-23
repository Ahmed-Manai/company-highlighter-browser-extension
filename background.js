// Chrome runs this file as a service worker; Firefox loads it as an event page after
// matcher.js and settings.js (see "background" in manifest.json).
if (typeof importScripts === "function") {
  importScripts("matcher.js", "settings.js");
}

chrome.action.setBadgeBackgroundColor({ color: "#1f6feb" });

// Show the number of highlights on the current tab in the toolbar badge
chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || message.type !== "count" || !sender.tab) return;
  chrome.action.setBadgeText({
    tabId: sender.tab.id,
    text: message.count > 0 ? String(Math.min(message.count, 999)) : ""
  });
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  const settings = await loadSettings();
  if (settings.companies.length > 0) return;

  // Versions before 1.0 read the list from a companies.txt file in the extension folder.
  // Import it once so existing users keep their list.
  try {
    const response = await fetch(chrome.runtime.getURL("companies.txt"));
    if (response.ok) {
      const companies = parseCompanyList(await response.text());
      if (companies.length > 0) {
        await saveSettings({ companies });
        return;
      }
    }
  } catch {
    // No companies.txt: nothing to import
  }

  if (reason === "install") {
    chrome.runtime.openOptionsPage();
  }
});

// Toggle highlighting via keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-highlight") {
    const settings = await loadSettings();
    await saveSettings({ enabled: !settings.enabled });
  }
});
