(() => {
  const marker = "__xVisibilityCaptureInstalled";
  const channel = "x-visibility-report-v1";
  if (window[marker]) return;
  window[marker] = true;

  const nativeCreateObjectURL = URL.createObjectURL;

  function publishReport(report) {
    if (
      report
      && typeof report === "object"
      && Array.isArray(report.postLabels)
      && Array.isArray(report.accountLabels)
    ) {
      window.postMessage({ channel, type: "REPORT_CAPTURED", report }, location.origin);
    }
  }

  URL.createObjectURL = function createObjectURL(object) {
    const url = nativeCreateObjectURL.apply(this, arguments);

    if (object instanceof Blob && object.size <= 5_000_000) {
      object
        .text()
        .then(JSON.parse)
        .then(publishReport)
        .catch(() => {});
    }

    return url;
  };

  window.addEventListener("message", async (event) => {
    if (
      event.source !== window
      || event.origin !== location.origin
      || event.data?.channel !== channel
      || event.data?.type !== "FETCH_REPORT"
    ) {
      return;
    }

    try {
      const url = new URL(event.data.url);
      if (url.origin !== "https://jf.x.com" || url.pathname !== "/under_the_hood/download") return;
      const response = await fetch(url, { credentials: "include" });
      if (response.ok) publishReport(await response.json());
    } catch {
      // The isolated content script reports a timeout if capture fails.
    }
  });
})();
