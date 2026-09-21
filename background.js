import { normalizeReport } from "./report.mjs";

const REPORT_URL = "https://x.com/i/under_the_hood";
const STATE_KEY = "appState";
const JOB_KEY = "activeCheck";

const ERROR_MESSAGES = {
  LOGIN_REQUIRED: "请先登录 X，再重新检查。",
  POST_REQUIREMENT: "上月发帖不足 10 条，暂时无法生成报告。",
  AGE_REQUIREMENT: "账号注册不足 1 年，暂时无法生成报告。",
  NOT_ELIGIBLE: "当前账号暂时无法生成报告，请确认上月发帖不少于 10 条且账号注册满 1 年。",
  DOWNLOAD_NOT_FOUND: "未找到 X 的报告下载入口，请稍后重试。",
  CAPTURE_TIMEOUT: "报告下载成功，但读取超时，请重新检查。",
  TAB_CLOSED: "检查页面已关闭，请重新检查。",
  UNKNOWN: "检查失败，请稍后重试。",
};

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
    { status: "error", message: ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN },
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

  if (/\/i\/flow\/login|\/login(?:\?|$)/.test(changeInfo.url)) {
    await failJob("LOGIN_REQUIRED", tabId);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const job = await getJob();
  if (job?.tabId === tabId) {
    await failJob("TAB_CLOSED", tabId, false);
  }
});
