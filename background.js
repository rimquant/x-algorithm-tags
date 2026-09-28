import { normalizeReport } from "./report.mjs";

const REPORT_URL = "https://x.com/i/under_the_hood";
const STATE_KEY = "appState";
const JOB_KEY = "activeCheck";

const ERROR_CODES = new Set([
  "LOGIN_REQUIRED",
  "POST_REQUIREMENT",
  "AGE_REQUIREMENT",
  "NOT_ELIGIBLE",
  "DOWNLOAD_NOT_FOUND",
  "CAPTURE_TIMEOUT",
  "TAB_CLOSED",
  "UNKNOWN",
]);

async function getJob() {
  const stored = await chrome.storage.session.get(JOB_KEY);
  return stored[JOB_KEY] || null;
}

async function setState(state) {
  await chrome.storage.local.set({ [STATE_KEY]: state });
}

async function finishJob(state, tabId, closeTab = true) {
  await chrome.storage.session.remove(JOB_KEY);
  await setState(state);
  if (closeTab && Number.isInteger(tabId)) {
    try {
      await chrome.tabs.remove(tabId);
    } catch {
      // The temporary tab may already be closed.
    }
  }
}

async function failJob(code, tabId, closeTab = true) {
  await finishJob(
    { status: "error", code: ERROR_CODES.has(code) ? code : "UNKNOWN" },
    tabId,
    closeTab,
  );
}

async function startCheck() {
  const existing = await getJob();
  if (existing?.tabId) {
    try {
      await chrome.tabs.get(existing.tabId);
      await setState({ status: "loading" });
      return;
    } catch {
      await chrome.storage.session.remove(JOB_KEY);
    }
  }

  await setState({ status: "loading" });

  try {
    const tab = await chrome.tabs.create({ url: "about:blank", active: false });
    await chrome.storage.session.set({
      [JOB_KEY]: { tabId: tab.id, startedAt: Date.now() },
    });
    await chrome.tabs.update(tab.id, { url: REPORT_URL });
  } catch {
    await failJob("UNKNOWN");
  }
}

async function handleMessage(message, sender) {
  if (message?.type === "START_CHECK") {
    await startCheck();
    return { ok: true };
  }

  const job = await getJob();
  const tabId = sender.tab?.id;
  const isActiveJob = Number.isInteger(tabId) && job?.tabId === tabId;

  if (message?.type === "PAGE_READY") {
    return { run: isActiveJob };
  }

  if (!isActiveJob) return { ok: false };

  if (message?.type === "REPORT_CAPTURED") {
    try {
      const report = normalizeReport(message.report);
      await finishJob({ status: "success", report }, tabId);
      return { ok: true };
    } catch {
      await failJob("UNKNOWN", tabId);
      return { ok: false };
    }
  }

  if (message?.type === "REPORT_ERROR") {
    await failJob(message.code, tabId);
    return { ok: true };
  }

  return { ok: false };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(() => sendResponse({ ok: false }));
  return true;
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (!changeInfo.url) return;
  const job = await getJob();
  if (job?.tabId !== tabId) return;

  if (/\/i\/flow\/login|\/i\/jf\/onboarding\/web|\/login(?:\?|$)/.test(changeInfo.url)) {
    await failJob("LOGIN_REQUIRED", tabId);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const job = await getJob();
  if (job?.tabId === tabId) {
    await failJob("TAB_CLOSED", tabId, false);
  }
});
