import { knownLabelTitles, translateLabel } from "./labels.mjs";
import { getReportSummary } from "./report.mjs";

const STATE_KEY = "appState";
const screens = [...document.querySelectorAll(".screen")];
const homeButton = document.querySelector("#home");
const refreshButton = document.querySelector("#refresh");

document.querySelector("#version").textContent = `v${chrome.runtime.getManifest().version}`;

function showScreen(id) {
  screens.forEach((screen) => screen.classList.toggle("hidden", screen.id !== id));
  homeButton.classList.toggle("hidden", id !== "result");
  refreshButton.classList.toggle("hidden", !["result", "error"].includes(id));
}

async function goHome() {
  await chrome.storage.local.remove(STATE_KEY);
  render({ status: "idle" });
}

function clear(element) {
  element.replaceChildren();
}

function createClearState() {
  const element = document.createElement("div");
  element.className = "clear";
  element.textContent = "🟢 未发现限流标签";
  return element;
}

function createLabelCard(kind, item) {
  const translated = translateLabel(kind, item.label, item.effect);
  const card = document.createElement("article");
  card.className = "label-card";

  const row = document.createElement("div");
  row.className = "label-row";

  const title = document.createElement("span");
  title.className = "label-title";
  title.textContent = translated.title;
  row.append(title);

  if (kind === "post") {
    const stats = document.createElement("span");
    stats.className = "label-stats";
    const count = item.totalPostsInMonth
      ? `已标记 ${item.posts}/${item.totalPostsInMonth} 条`
      : `已标记 ${item.posts} 条`;
    stats.textContent = item.percentageOfPosts
      ? `${count}（${item.percentageOfPosts}）`
      : count;
    row.append(stats);
  }

  const effect = document.createElement("p");
  effect.className = "label-effect";
  effect.textContent = translated.effect;

  card.append(row, effect);
  return card;
}

function renderResult(report) {
  const summary = document.querySelector("#report-summary");
  clear(summary);
  getReportSummary(report).forEach(({ text, highlight }) => {
    if (!highlight) return summary.append(text);
    const strong = document.createElement("strong");
    strong.textContent = text;
    summary.append(strong);
  });
  document.querySelector("#post-label-count").textContent = `（${report.postLabels.length} 类）`;

  const accountLabels = document.querySelector("#account-labels");
  const postLabels = document.querySelector("#post-labels");
  clear(accountLabels);
  clear(postLabels);

  if (report.accountLabels.length === 0) {
    accountLabels.append(createClearState());
  } else {
    report.accountLabels.forEach((item) => accountLabels.append(createLabelCard("account", item)));
  }

  if (report.postLabels.length === 0) {
    postLabels.append(createClearState());
  } else {
    report.postLabels.forEach((item) => postLabels.append(createLabelCard("post", item)));
  }

  document.querySelector("#raw-json").textContent = JSON.stringify(report, null, 2);

  [["account", "#unchecked-account-labels", report.accountLabels], ["post", "#unchecked-post-labels", report.postLabels]]
    .forEach(([kind, selector, labels]) => {
      const hitTitles = new Set(labels.map((item) => translateLabel(kind, item.label, item.effect).title));
      const list = document.querySelector(selector);
      clear(list);
      knownLabelTitles(kind).filter((title) => !hitTitles.has(title)).forEach((title) => {
        const item = document.createElement("li");
        item.append(title);
        const icon = document.createElement("span");
        icon.className = "unchecked-icon";
        icon.setAttribute("aria-label", "未命中");
        icon.textContent = "✕";
        item.append(icon);
        list.append(item);
      });
    });

  showScreen("result");
}

function render(state) {
  if (!state || state.status === "idle") return showScreen("idle");
  if (state.status === "loading") return showScreen("loading");
  if (state.status === "success" && state.report) return renderResult(state.report);

  document.querySelector("#error-message").textContent = state.message || "检查失败，请稍后重试。";
  showScreen("error");
}

async function startCheck() {
  showScreen("loading");
  try {
    await chrome.runtime.sendMessage({ type: "START_CHECK" });
  } catch {
    render({ status: "error", message: "无法启动检查，请重新加载插件。" });
  }
}

document.querySelector("#start").addEventListener("click", startCheck);
document.querySelector("#retry").addEventListener("click", startCheck);
homeButton.addEventListener("click", goHome);
refreshButton.addEventListener("click", startCheck);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STATE_KEY]) render(changes[STATE_KEY].newValue);
});

const stored = await chrome.storage.local.get(STATE_KEY);
render(stored[STATE_KEY]);
