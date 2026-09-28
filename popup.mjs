import { knownLabelTitles, translateLabel } from "./labels.mjs";
import { normalizeLanguage, t } from "./i18n.mjs";
import { getReportSummary } from "./report.mjs";

const STATE_KEY = "appState";
const LANGUAGE_KEY = "language";
const screens = [...document.querySelectorAll(".screen")];
const homeButton = document.querySelector("#home");
const refreshButton = document.querySelector("#refresh");
const settings = document.querySelector(".settings");
const languageButtons = [...document.querySelectorAll("[data-language]")];
let language = "zh";
let currentState = { status: "idle" };

document.querySelector("#version").textContent = `v${chrome.runtime.getManifest().version}`;

function applyTranslations() {
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n, language);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    const label = t(element.dataset.i18nAriaLabel, language);
    element.setAttribute("aria-label", label);
    element.setAttribute("title", label);
  });
  languageButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.language === language));
  });
}

function showScreen(id) {
  screens.forEach((screen) => screen.classList.toggle("hidden", screen.id !== id));
  homeButton.classList.toggle("hidden", id !== "result");
  refreshButton.classList.toggle("hidden", id !== "result");
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
  element.textContent = t("clear", language);
  return element;
}

function createLabelCard(kind, item) {
  const translated = translateLabel(kind, item, language);
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
      ? t("markedOf", language, { posts: item.posts, total: item.totalPostsInMonth })
      : t("marked", language, { posts: item.posts });
    stats.textContent = item.percentageOfPosts
      ? language === "zh" ? `${count}（${item.percentageOfPosts}）` : `${count} (${item.percentageOfPosts})`
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
  getReportSummary(report, language).forEach(({ text, highlight }) => {
    if (!highlight) return summary.append(text);
    const strong = document.createElement("strong");
    strong.textContent = text;
    summary.append(strong);
  });
  document.querySelector("#post-label-count").textContent = t("labelCount", language, { count: report.postLabels.length });

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
      const hitTitles = new Set(labels.map((item) => translateLabel(kind, item, "zh").title));
      const chineseTitles = knownLabelTitles(kind);
      const localizedTitles = knownLabelTitles(kind, language);
      const list = document.querySelector(selector);
      clear(list);
      chineseTitles.forEach((title, index) => {
        if (hitTitles.has(title)) return;
        const item = document.createElement("li");
        item.append(localizedTitles[index]);
        const icon = document.createElement("span");
        icon.className = "unchecked-icon";
        icon.setAttribute("aria-label", t("notMatched", language));
        icon.textContent = "✕";
        item.append(icon);
        list.append(item);
      });
    });

  showScreen("result");
}

function render(state) {
  currentState = state || { status: "idle" };
  if (!state || state.status === "idle") return showScreen("idle");
  if (state.status === "loading") return showScreen("loading");
  if (state.status === "success" && state.report) return renderResult(state.report);

  document.querySelector("#error-message").textContent = state.code
    ? t(`error_${state.code}`, language)
    : language === "zh" && state.message ? state.message : t("error_UNKNOWN", language);
  showScreen("error");
}

async function startCheck() {
  showScreen("loading");
  try {
    await chrome.runtime.sendMessage({ type: "START_CHECK" });
  } catch {
    render({ status: "error", code: "START_FAILED" });
  }
}

async function setLanguage(event) {
  language = normalizeLanguage(event.currentTarget.dataset.language);
  applyTranslations();
  render(currentState);
  await chrome.storage.local.set({ [LANGUAGE_KEY]: language });
}

document.querySelector("#start").addEventListener("click", startCheck);
document.querySelector("#retry").addEventListener("click", startCheck);
homeButton.addEventListener("click", goHome);
refreshButton.addEventListener("click", startCheck);
languageButtons.forEach((button) => button.addEventListener("click", setLanguage));
document.addEventListener("click", (event) => {
  if (!settings.contains(event.target)) settings.open = false;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[LANGUAGE_KEY] && changes[LANGUAGE_KEY].newValue !== language) {
    language = normalizeLanguage(changes[LANGUAGE_KEY].newValue || chrome.i18n.getUILanguage());
    applyTranslations();
    render(currentState);
  }
  if (changes[STATE_KEY]) render(changes[STATE_KEY].newValue);
});

const stored = await chrome.storage.local.get([STATE_KEY, LANGUAGE_KEY]);
language = normalizeLanguage(stored[LANGUAGE_KEY] || chrome.i18n.getUILanguage());
applyTranslations();
render(stored[STATE_KEY]);
