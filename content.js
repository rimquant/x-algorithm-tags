(() => {
  const channel = "x-visibility-report-v1";
  let active = false;
  let finished = false;
  let captureTimer;

  function sendError(code) {
    if (finished) return;
    finished = true;
    clearTimeout(captureTimer);
    chrome.runtime.sendMessage({ type: "REPORT_ERROR", code });
  }

  window.addEventListener("message", (event) => {
    if (
      !active ||
      finished ||
      event.source !== window ||
      event.origin !== location.origin ||
      event.data?.channel !== channel
    ) {
      return;
    }

    finished = true;
    clearTimeout(captureTimer);
    chrome.runtime.sendMessage({ type: "REPORT_CAPTURED", report: event.data.report });
  });

  function findDownloadButton() {
    return [...document.querySelectorAll("button")].find((button) => {
      const label = `${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`.trim();
      return /(^|\s)(Download|下载)(\s|$)/.test(label) && !button.disabled;
    });
  }

  function requirementStatus(needle) {
    const candidates = [...document.querySelectorAll("body *")]
      .filter((element) => element.textContent?.includes(needle))
      .sort((left, right) => left.textContent.length - right.textContent.length);

    let current = candidates[0];
    for (let depth = 0; current && depth < 5; depth += 1, current = current.parentElement) {
      const statuses = [...current.querySelectorAll("[aria-label], img[alt]")]
        .map((element) => element.getAttribute("aria-label") || element.getAttribute("alt") || "")
        .join(" ");
      if (/not met|unmet|未满足/i.test(statuses)) return false;
      if (/\bmet\b|已满足/i.test(statuses)) return true;
    }
    return null;
  }

  function waitForReportPage() {
    const startedAt = Date.now();

    const poll = () => {
      if (finished) return;

      const bodyText = document.body?.innerText || "";
      if (/Log in to X|登录 X|登录到 X/.test(bodyText)) {
        sendError("LOGIN_REQUIRED");
        return;
      }

      const button = findDownloadButton();
      if (button) {
        button.click();
        captureTimer = setTimeout(() => sendError("CAPTURE_TIMEOUT"), 10_000);
        return;
      }

      const elapsed = Date.now() - startedAt;
      if (elapsed > 3_000) {
        const postRequirement = requirementStatus("10 or more posts in the prior month");
        const ageRequirement = requirementStatus("Account at least 1 year old");
        if (postRequirement === false) return sendError("POST_REQUIREMENT");
        if (ageRequirement === false) return sendError("AGE_REQUIREMENT");
      }

      if (elapsed >= 20_000) {
        const hasRequirements = /10 or more posts in the prior month/.test(bodyText);
        sendError(hasRequirements ? "NOT_ELIGIBLE" : "DOWNLOAD_NOT_FOUND");
        return;
      }

      setTimeout(poll, 250);
    };

    poll();
  }

  chrome.runtime.sendMessage({ type: "PAGE_READY" }, (response) => {
    if (chrome.runtime.lastError || !response?.run) return;
    active = true;
    waitForReportPage();
  });
})();
