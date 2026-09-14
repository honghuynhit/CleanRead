/* CleanRead — service worker (Manifest V3).
 * Nhiệm vụ: nhận lệnh bật/tắt từ popup hoặc phím tắt, inject content script
 * đúng một lần cho mỗi tab, và hiển thị trạng thái trên nút công cụ. */

const FILES = [
  "vendor/Readability.js",
  "src/lib/settings.js",
  "src/content/styles.js",
  "src/content/reader.js",
];

const BLOCKED_PAGE =
  "CleanRead chỉ chạy trên trang web http/https. Hãy mở một bài viết rồi thử lại.";

function isInjectable(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function isReaderLoaded(tabId) {
  try {
    const [frame] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => Boolean(window.__CleanRead__),
    });
    return Boolean(frame && frame.result);
  } catch (error) {
    return false;
  }
}

/* Lần đầu thì inject (content script tự bật ngay khi chạy xong),
 * những lần sau chỉ gửi thông điệp để tránh khai báo lại biến toàn cục. */
async function toggleReader(tab) {
  if (!tab || typeof tab.id !== "number") {
    return { ok: false, error: "Không xác định được tab đang mở." };
  }
  if (!isInjectable(tab.url)) {
    return { ok: false, error: BLOCKED_PAGE };
  }

  try {
    if (await isReaderLoaded(tab.id)) {
      const response = await chrome.tabs.sendMessage(tab.id, { type: "CLEANREAD_TOGGLE" });
      return { ok: true, active: Boolean(response && response.active) };
    }
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: FILES });
    return { ok: true, active: true };
  } catch (error) {
    return { ok: false, error: "Không chạy được trên trang này: " + describe(error) };
  }
}

async function readState(tab) {
  if (!tab || typeof tab.id !== "number" || !isInjectable(tab.url)) {
    return { injectable: false, active: false };
  }
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "CLEANREAD_PING" });
    return { injectable: true, active: Boolean(response && response.active) };
  } catch (error) {
    return { injectable: true, active: false };
  }
}

function setBadge(tabId, active) {
  if (typeof tabId !== "number") return;
  chrome.action.setBadgeText({ tabId, text: active ? "ON" : "" }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#175E6B" }).catch(() => {});
}

function describe(error) {
  const message = error && error.message ? error.message : String(error);
  return message.replace(/^Error:\s*/, "");
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-reader") return;
  const tab = await getActiveTab();
  const result = await toggleReader(tab);
  if (result.ok) setBadge(tab.id, result.active);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return;

  if (message.type === "CLEANREAD_STATE") {
    setBadge(sender.tab && sender.tab.id, message.active);
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "CLEANREAD_REQUEST_TOGGLE") {
    getActiveTab()
      .then(async (tab) => {
        const result = await toggleReader(tab);
        if (result.ok) setBadge(tab.id, result.active);
        sendResponse(result);
      })
      .catch((error) => sendResponse({ ok: false, error: describe(error) }));
    return true;
  }

  if (message.type === "CLEANREAD_REQUEST_STATE") {
    getActiveTab()
      .then(async (tab) => sendResponse(await readState(tab)))
      .catch(() => sendResponse({ injectable: false, active: false }));
    return true;
  }
});

/* Tab tải lại trang là content script biến mất — xoá luôn huy hiệu. */
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") setBadge(tabId, false);
});
