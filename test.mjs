import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { normalizeLanguage, t } from "./i18n.mjs";
import { knownLabelTitles, translateLabel } from "./labels.mjs";
import { formatPeriod, getReportSummary, normalizeReport } from "./report.mjs";

const manifest = JSON.parse(await readFile(new URL("./manifest.json", import.meta.url), "utf8"));
const englishLocale = JSON.parse(await readFile(new URL("./_locales/en/messages.json", import.meta.url), "utf8"));
const chineseLocale = JSON.parse(await readFile(new URL("./_locales/zh_CN/messages.json", import.meta.url), "utf8"));
const popupHtml = await readFile(new URL("./popup.html", import.meta.url), "utf8");
const popupCss = await readFile(new URL("./popup.css", import.meta.url), "utf8");
const popupScript = await readFile(new URL("./popup.mjs", import.meta.url), "utf8");
const captureMainScript = await readFile(new URL("./capture-main.js", import.meta.url), "utf8");
const contentScript = await readFile(new URL("./content.js", import.meta.url), "utf8");
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.name, "__MSG_extensionName__");
assert.equal(manifest.version, "0.1.3");
assert.equal(manifest.default_locale, "zh_CN");
assert.equal(englishLocale.extensionName.message, "X Recommendation Checker");
assert.equal(chineseLocale.extensionName.message, "X 推荐检查器");
assert.deepEqual(manifest.permissions, ["storage"]);
assert.ok(manifest.content_scripts.every(({ matches }) => matches.includes("https://x.com/i/jf/under_the_hood*")));
assert.match(popupHtml, /id="settings-menu"/);
assert.match(popupHtml, /data-i18n="settings"[\s\S]*id="language-options"[\s\S]*id="version"/);
assert.match(popupHtml, /data-language="en"[^>]*>EN<[\s\S]*data-language="zh"[^>]*>中文</);
assert.doesNotMatch(popupHtml, /<select/);
assert.doesNotMatch(popupHtml, /role="switch"/);
assert.match(popupScript, /chrome\.storage\.local\.remove\(STATE_KEY\)/);
assert.match(popupScript, /\[LANGUAGE_KEY\]: language/);
assert.match(popupScript, /button\.setAttribute\("aria-pressed"/);
assert.match(popupScript, /if \(!settings\.contains\(event\.target\)\) settings\.open = false/);
assert.match(popupScript, /refreshButton\.classList\.toggle\("hidden", id !== "result"\)/);
assert.match(popupCss, /\.settings-menu\s*{[^}]*position:\s*absolute/s);
assert.match(popupCss, /:lang\(en\) \.label-row\s*{[^}]*flex-direction:\s*column/s);
assert.equal(normalizeLanguage("zh-TW"), "zh");
assert.equal(normalizeLanguage("en-US"), "en");
assert.equal(t("marked", "en", { posts: 2 }), "2 marked");
[...popupHtml.matchAll(/data-i18n="([^"]+)"/g)].forEach(([, key]) => {
  assert.notEqual(t(key, "zh"), key);
  assert.notEqual(t(key, "en"), key);
});
[...popupHtml.matchAll(/data-i18n-aria-label="([^"]+)"/g)].forEach(([, key]) => {
  assert.notEqual(t(key, "zh"), key);
  assert.notEqual(t(key, "en"), key);
});

const report = normalizeReport({
  period: { startDate: "2026-08-01", endDate: "2026-08-31", timezone: "UTC" },
  generatedAt: "2026-09-09T23:59:59Z",
  postCount: "489",
  postLabels: [
    {
      label: "SPAM_HIGH_RECALL",
      about: "Post detected by automated systems as one that may contain spam.",
      effect: "Post hidden from recommendations to non-followers.",
      posts: "2",
      totalPostsInMonth: "489",
      percentageOfPosts: "0.40%",
    },
  ],
  accountLabels: [],
  totalAccountLabels: 0,
});

assert.equal(report.postCount, 489);
assert.equal(report.postLabels[0].posts, 2);
assert.equal(formatPeriod(report.period), "2026年8月");
assert.equal(
  getReportSummary(report).map(({ text }) => text).join(""),
  "根据您 2026年8月的数据，您在此周期内的推文命中了 1 个标签，请查看下面的详细信息。",
);
assert.equal(
  getReportSummary({ ...report, postLabels: [], accountLabels: [] }).map(({ text }) => text).join(""),
  "根据您 2026年8月的数据，本期报告中未发现已知的限制推荐标签。",
);
assert.deepEqual(
  getReportSummary(report).filter(({ highlight }) => highlight).map(({ text }) => text),
  ["2026年8月", "1"],
);
assert.equal(formatPeriod(report.period, "en"), "August 2026");
assert.equal(
  getReportSummary(report, "en").map(({ text }) => text).join(""),
  "Based on your August 2026 data, your posts matched 1 label during this period. See the details below.",
);
assert.equal(translateLabel("post", { label: "SPAM_HIGH_RECALL" }).title, "垃圾内容风险");
assert.equal(translateLabel("post", { label: "NSFW_ADMIN_STAMPED" }).title, "成人/暴力账号发帖");
assert.equal(translateLabel("account", { label: "LegalRequest(CN)" }).title, "法律要求限制");
assert.deepEqual(
  translateLabel("post", report.postLabels[0], "en"),
  {
    title: "Spam risk",
    effect: "Post detected by automated systems as one that may contain spam. Post hidden from recommendations to non-followers.",
  },
);
assert.ok(knownLabelTitles("post").includes("恶意链接"));
assert.ok(knownLabelTitles("post", "en").includes("Malicious link"));
assert.ok(knownLabelTitles("account").includes("账号只读"));
assert.ok(knownLabelTitles("account", "en").includes("Read-only account"));
assert.equal(knownLabelTitles("account").length, knownLabelTitles("account", "en").length);
assert.throws(() => normalizeReport({ postLabels: [], accountLabels: null }), /标签列表/);

function downloadActions(tagName, label, role = "", signal = "") {
  let clicks = 0;
  let messageListener;
  const messages = [];
  const reports = [];
  const attributes = {
    role,
    ...(signal === "testid" ? { "data-testid": "download-report" } : {}),
    ...(signal === "download" ? { download: "report.json" } : {}),
    ...(signal === "blob" ? { href: "blob:https://x.com/report" } : {}),
    ...(signal === "jf" ? { href: "https://jf.x.com/under_the_hood/download" } : {}),
  };
  const control = {
    tagName,
    textContent: label,
    disabled: false,
    href: attributes.href || "",
    getAttribute(name) {
      return attributes[name] || "";
    },
    closest() { return control; },
    click() {
      clicks += 1;
    },
  };
  const icon = { closest() { return control; } };
  const document = {
    body: { innerText: "" },
    querySelector(selector) {
      if (signal === "testid" && selector.includes("data-testid")) return control;
      if (signal === "download" && selector.includes("a[download]")) return control;
      if (signal === "blob" && selector.includes('a[href^="blob:"]')) return control;
      if (signal === "jf" && selector.includes("jf.x.com")) return control;
      if (signal === "icon" && selector.includes("data-icon")) return icon;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "button") return tagName === "BUTTON" ? [control] : [];
      if (selector === 'button, [role="button"]') return tagName === "BUTTON" || role === "button" ? [control] : [];
      return [];
    },
  };
  const window = {
    addEventListener(type, listener) {
      if (type === "message") messageListener = listener;
    },
    postMessage(message, targetOrigin) {
      messages.push({ message, targetOrigin });
      messageListener?.({ source: window, origin: targetOrigin, data: message });
    },
  };
  vm.runInNewContext(contentScript, {
    chrome: {
      runtime: {
        lastError: null,
        sendMessage(message, callback) {
          if (message.type === "PAGE_READY") callback({ run: true });
          if (message.type === "REPORT_CAPTURED") reports.push(message.report);
        },
      },
    },
    clearTimeout() {},
    document,
    location: { origin: "https://x.com" },
    setTimeout() { return 1; },
    window,
  });
  return { clicks, messages, reports };
}

assert.equal(downloadActions("BUTTON", "Download report").clicks, 1);
assert.equal(downloadActions("BUTTON", "下载报告").clicks, 1);
assert.equal(downloadActions("DIV", "Download report", "button").clicks, 1);
assert.equal(downloadActions("BUTTON", "Télécharger le rapport", "", "testid").clicks, 1);
assert.equal(downloadActions("BUTTON", "Baixar relatório", "", "icon").clicks, 1);
assert.equal(downloadActions("A", "Rapport", "", "download").clicks, 1);
assert.equal(downloadActions("A", "Bericht", "", "blob").clicks, 1);
assert.equal(downloadActions("BUTTON", "Continuer").clicks, 0);
assert.deepEqual(JSON.parse(JSON.stringify(downloadActions("A", "Download", "", "jf"))), {
  clicks: 0,
  messages: [{
    message: {
      channel: "x-visibility-report-v1",
      type: "FETCH_REPORT",
      url: "https://jf.x.com/under_the_hood/download",
    },
    targetOrigin: "https://x.com",
  }],
  reports: [],
});

const captureListeners = {};
const captureMessages = [];
const fetchedUrls = [];
const captureWindow = {
  addEventListener(type, listener) {
    captureListeners[type] = listener;
  },
  postMessage(message, targetOrigin) {
    captureMessages.push({ message, targetOrigin });
  },
};
class TestURL extends URL {}
TestURL.createObjectURL = () => "blob:https://x.com/report";
vm.runInNewContext(captureMainScript, {
  Blob,
  fetch: async (url) => {
    fetchedUrls.push(String(url));
    return { ok: true, json: async () => report };
  },
  location: { origin: "https://x.com" },
  URL: TestURL,
  window: captureWindow,
});
await captureListeners.message({
  source: captureWindow,
  origin: "https://x.com",
  data: {
    channel: "x-visibility-report-v1",
    type: "FETCH_REPORT",
    url: "https://jf.x.com/under_the_hood/download",
  },
});
await new Promise(setImmediate);
assert.deepEqual(fetchedUrls, ["https://jf.x.com/under_the_hood/download"]);
assert.deepEqual(JSON.parse(JSON.stringify(captureMessages.at(-1))), {
  message: { channel: "x-visibility-report-v1", type: "REPORT_CAPTURED", report },
  targetOrigin: "https://x.com",
});
await captureListeners.message({
  source: captureWindow,
  origin: "https://x.com",
  data: { channel: "x-visibility-report-v1", type: "FETCH_REPORT", url: "https://example.com/report" },
});
assert.equal(fetchedUrls.length, 1);

const stores = { local: {}, session: {} };
const listeners = {};
const updatedTabs = [];
const removedTabs = [];

function memoryArea(name) {
  return {
    async get(key) {
      return { [key]: stores[name][key] };
    },
    async set(values) {
      Object.assign(stores[name], values);
    },
    async remove(key) {
      delete stores[name][key];
    },
  };
}

globalThis.chrome = {
  runtime: {
    onMessage: { addListener: (listener) => { listeners.message = listener; } },
  },
  storage: {
    local: memoryArea("local"),
    session: memoryArea("session"),
  },
  tabs: {
    async create(options) {
      assert.deepEqual(options, { url: "about:blank", active: false });
      return { id: 7 };
    },
    async update(tabId, options) {
      updatedTabs.push({ tabId, options });
    },
    async get(tabId) {
      return { id: tabId };
    },
    async remove(tabId) {
      removedTabs.push(tabId);
    },
    onUpdated: { addListener: (listener) => { listeners.updated = listener; } },
    onRemoved: { addListener: (listener) => { listeners.removed = listener; } },
  },
};

await import("./background.js?test");

function dispatch(message, sender = {}) {
  return new Promise((resolve) => {
    assert.equal(listeners.message(message, sender, resolve), true);
  });
}

assert.deepEqual(await dispatch({ type: "START_CHECK" }), { ok: true });
assert.equal(stores.local.appState.status, "loading");
assert.equal(stores.session.activeCheck.tabId, 7);
assert.deepEqual(updatedTabs, [{ tabId: 7, options: { url: "https://x.com/i/under_the_hood" } }]);
assert.deepEqual(await dispatch({ type: "PAGE_READY" }, { tab: { id: 7 } }), { run: true });
assert.deepEqual(await dispatch({ type: "REPORT_CAPTURED", report }, { tab: { id: 7 } }), { ok: true });
assert.equal(stores.local.appState.status, "success");
assert.equal(stores.local.appState.report.postLabels.length, 1);
assert.equal(stores.session.activeCheck, undefined);
assert.deepEqual(removedTabs, [7]);

await dispatch({ type: "START_CHECK" });
await listeners.updated(7, { url: "https://x.com/i/jf/onboarding/web?mode=login" });
assert.deepEqual(stores.local.appState, { status: "error", code: "LOGIN_REQUIRED" });

console.log("v0.1.3 checks passed");
