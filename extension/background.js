// Opens the Ca-Spell side panel and hands it the text to check.
const MENU_ID = "caspell-check";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Check “%s” with Ca-Spell",
    contexts: ["selection"],
  });
});

// sidePanel.open() only works while the click/shortcut is still "fresh", so it must be called
// before any await. The panel picks the text up from storage whether it was already open or not.
function openPanel(windowId) {
  return chrome.sidePanel.open({ windowId });
}

function sendText(text) {
  return chrome.storage.local.set({ pendingText: { text, at: Date.now() } });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) return;
  openPanel(tab.windowId);
  sendText(info.selectionText);
});

// Reads the selection from the page, including text selected inside a textarea or input.
function readSelection() {
  const el = document.activeElement;
  if (el && typeof el.selectionStart === "number" && el.selectionEnd > el.selectionStart) {
    return el.value.slice(el.selectionStart, el.selectionEnd);
  }
  return String(window.getSelection() ?? "");
}

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "check-selection" || !tab?.id) return;
  const opened = openPanel(tab.windowId);
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: readSelection,
    });
    const text = result?.result?.trim();
    if (text) await sendText(text);
  } catch {
    // Pages such as chrome:// and the Web Store cannot be read; the panel still opens.
  }
  await opened;
});
