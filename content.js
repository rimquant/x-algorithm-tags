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
      event.data?.channel !== channel ||
      event.data?.type !== "REPORT_CAPTURED" ||
      !Array.isArray(event.data?.report?.postLabels) ||
      !Array.isArray(event.data?.report?.accountLabels)
    ) {
      return;
    }

    finished = true;
    clearTimeout(captureTimer);
    chrome.runtime.sendMessage({ type: "REPORT_CAPTURED", report: event.data.report });
  });

  function findDownloadButton() {
    const signal = document.querySelector(
      'a[href^="https://jf.x.com/under_the_hood/download"], a[download], a[href^="blob:"], [data-testid*="download" i], [data-icon*="download" i]',
    );
    const signaledButton = signal?.closest('button, a, [role="button"]');
    if (
      signaledButton
      && !signaledButton.disabled
      && signaledButton.getAttribute("aria-disabled") !== "true"
    ) {
      return signaledButton;
    }

    return [...document.querySelectorAll('button, [role="button"]')].find((button) => {
      const label = `${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`.trim();
      return /\bdownload\b|下载/i.test(label)
        && !button.disabled
        && button.getAttribute("aria-disabled") !== "true";
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
        const url = button.href || button.getAttribute("href");
        if (url?.startsWith("https://jf.x.com/under_the_hood/download")) {
          window.postMessage({ channel, type: "FETCH_REPORT", url }, location.origin);
        } else {
          button.click();
        }
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
