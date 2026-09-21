import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { knownLabelTitles, translateLabel } from "./labels.mjs";
import { formatPeriod, getReportSummary, normalizeReport } from "./report.mjs";

const manifest = JSON.parse(await readFile(new URL("./manifest.json", import.meta.url), "utf8"));
const popupHtml = await readFile(new URL("./popup.html", import.meta.url), "utf8");
const popupScript = await readFile(new URL("./popup.mjs", import.meta.url), "utf8");
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.name, "X 推荐检查器");
assert.equal(manifest.version, "0.1.2");
assert.deepEqual(manifest.permissions, ["storage"]);
assert.match(popupHtml, /id="home"[^>]*>返回首页<\/button>/);
assert.match(popupScript, /chrome\.storage\.local\.remove\(STATE_KEY\)/);
assert.match(popupScript, /已标记/);

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
assert.equal(translateLabel("post", "SPAM_HIGH_RECALL").title, "垃圾内容风险");
assert.equal(translateLabel("post", "NSFW_ADMIN_STAMPED").title, "成人/暴力账号发帖");
assert.equal(translateLabel("account", "LegalRequest(CN)").title, "法律要求限制");
assert.ok(knownLabelTitles("post").includes("恶意链接"));
assert.ok(knownLabelTitles("account").includes("账号只读"));
assert.throws(() => normalizeReport({ postLabels: [], accountLabels: null }), /标签列表/);

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

console.log("v0.1.2 checks passed");
