const enabledInput = document.getElementById("enabled");
const matchesLabel = document.getElementById("matches");
const listSizeLabel = document.getElementById("listSize");

async function showMatchCount(enabled) {
  if (!enabled) {
    matchesLabel.textContent = "Highlighting is off";
    return;
  }
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const { count } = await chrome.tabs.sendMessage(tab.id, { type: "getCount" });
    matchesLabel.textContent = count === 1 ? "1 match on this page" : `${count} matches on this page`;
  } catch {
    // Browser pages (settings, new tab, web stores) do not run content scripts
    matchesLabel.textContent = "Not available on this page";
  }
}

async function init() {
  const settings = await loadSettings();
  enabledInput.checked = settings.enabled;
  const n = settings.companies.length;
  listSizeLabel.textContent = n === 1 ? "1 company in your list" : `${n} companies in your list`;
  showMatchCount(settings.enabled);
}

enabledInput.addEventListener("change", async () => {
  await saveSettings({ enabled: enabledInput.checked });
  // Give the page a moment to apply the change before counting
  setTimeout(() => showMatchCount(enabledInput.checked), 700);
});

document.getElementById("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

init();
