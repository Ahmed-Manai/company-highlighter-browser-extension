const enabledInput = document.getElementById("enabled");
const colorInput = document.getElementById("color");
const companiesInput = document.getElementById("companies");
const countLabel = document.getElementById("count");
const statusLabel = document.getElementById("status");
const importFile = document.getElementById("importFile");

function showStatus(text) {
  statusLabel.textContent = text;
  setTimeout(() => {
    if (statusLabel.textContent === text) statusLabel.textContent = "";
  }, 2500);
}

function updateCount() {
  const n = parseCompanyList(companiesInput.value).length;
  countLabel.textContent = n === 1 ? "1 company" : `${n} companies`;
}

async function init() {
  const settings = await loadSettings();
  enabledInput.checked = settings.enabled;
  colorInput.value = settings.color;
  companiesInput.value = settings.companies.join("\n");
  updateCount();
}

enabledInput.addEventListener("change", () => saveSettings({ enabled: enabledInput.checked }));
colorInput.addEventListener("change", () => saveSettings({ color: colorInput.value }));
companiesInput.addEventListener("input", updateCount);

document.getElementById("save").addEventListener("click", async () => {
  const companies = parseCompanyList(companiesInput.value);
  await saveSettings({ companies });
  companiesInput.value = companies.join("\n");
  updateCount();
  showStatus("Saved");
});

document.getElementById("import").addEventListener("click", () => importFile.click());

importFile.addEventListener("change", async () => {
  const file = importFile.files[0];
  if (!file) return;
  const imported = parseCompanyList(await file.text());
  const merged = parseCompanyList([companiesInput.value, ...imported].join("\n"));
  companiesInput.value = merged.join("\n");
  importFile.value = "";
  updateCount();
  showStatus(`Imported ${imported.length}. Click Save to keep them.`);
});

document.getElementById("clear").addEventListener("click", async () => {
  if (!confirm("Clear your company list?")) return;
  await saveSettings({ companies: [] });
  companiesInput.value = "";
  updateCount();
  showStatus("Cleared");
});

document.getElementById("export").addEventListener("click", () => {
  const text = parseCompanyList(companiesInput.value).join("\n") + "\n";
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "companies.txt";
  link.click();
  // Revoking right away can cancel the download in some browsers
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

init();
