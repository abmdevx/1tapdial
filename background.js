const VOICE_URL_PATTERN = "*://voice.google.com/*";
const SHEETS_URL_PREFIX = "https://docs.google.com/spreadsheets/";
const DEBUG = true;
const VOICE_URL_PREFIX = "https://voice.google.com/";
const HEARTBEAT_ALARM = "autodialer-heartbeat";
const HEARTBEAT_MINUTES = 1;

function ensureSheetsInjected(tabId, url) {
  if (!url || !url.startsWith(SHEETS_URL_PREFIX)) return;
  chrome.scripting.executeScript(
    {
      target: { tabId, allFrames: true },
      files: ["content-sheets.js"]
    },
    () => {
      if (chrome.runtime.lastError) {
        if (DEBUG) console.debug("[Autodialer] Sheets inject failed:", chrome.runtime.lastError.message);
        return;
      }
      if (DEBUG) console.debug("[Autodialer] Sheets content script injected.");
    }
  );
}

function ensureVoiceInjected(tabId, url, callback) {
  if (!url || !url.startsWith(VOICE_URL_PREFIX)) {
    if (callback) callback();
    return;
  }
  chrome.scripting.executeScript(
    {
      target: { tabId },
      files: ["content-voice.js"]
    },
    () => {
      if (chrome.runtime.lastError) {
        if (DEBUG) console.debug("[Autodialer] Voice inject failed:", chrome.runtime.lastError.message);
      } else if (DEBUG) {
        console.debug("[Autodialer] Voice content script injected.");
      }
      if (callback) callback();
    }
  );
}

function reconnectAll() {
  chrome.tabs.query({ url: "*://docs.google.com/spreadsheets/*" }, (tabs) => {
    if (!tabs) return;
    for (const tab of tabs) {
      ensureSheetsInjected(tab.id, tab.url);
    }
  });

  chrome.tabs.query({ url: VOICE_URL_PATTERN }, (tabs) => {
    if (!tabs) return;
    for (const tab of tabs) {
      ensureVoiceInjected(tab.id, tab.url);
    }
  });
}

function scheduleHeartbeat() {
  if (!chrome.alarms) {
    if (DEBUG) console.debug("[Autodialer] Alarms API not available.");
    return;
  }
  chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: HEARTBEAT_MINUTES });
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleHeartbeat();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleHeartbeat();
});

if (chrome.alarms && chrome.alarms.onAlarm) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== HEARTBEAT_ALARM) return;
    reconnectAll();
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    ensureSheetsInjected(tabId, tab.url);
    ensureVoiceInjected(tabId, tab.url);
  }
  if (changeInfo.url) {
    ensureSheetsInjected(tabId, changeInfo.url);
    ensureVoiceInjected(tabId, changeInfo.url);
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (!tab) return;
    ensureSheetsInjected(tabId, tab.url);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "RECONNECT") {
    reconnectAll();
    sendResponse({ ok: true });
    return true;
  }
  if (!message || message.type !== "DIAL_NUMBER") return;

  const number = message.number;
  if (!number) return;

  if (DEBUG) console.debug("[Autodialer] Received number:", number);

  chrome.tabs.query({ url: VOICE_URL_PATTERN }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      console.warn("[Autodialer] No Google Voice tab found.");
      return;
    }

    const targetTab = tabs[0];
    if (DEBUG) console.debug("[Autodialer] Sending to tab:", targetTab.id);
    ensureVoiceInjected(targetTab.id, targetTab.url, () => {
      chrome.tabs.sendMessage(targetTab.id, {
        type: "INJECT_NUMBER",
        number
      });
    });
  });
});
