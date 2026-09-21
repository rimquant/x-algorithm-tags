(() => {
  const marker = "__xVisibilityCaptureInstalled";
  const channel = "x-visibility-report-v1";
  if (window[marker]) return;
  window[marker] = true;

  const nativeCreateObjectURL = URL.createObjectURL;

  URL.createObjectURL = function createObjectURL(object) {
    const url = nativeCreateObjectURL.apply(this, arguments);

    if (object instanceof Blob && object.size <= 5_000_000) {
      object
        .text()
        .then((raw) => {
          const report = JSON.parse(raw);
          if (
            report &&
            typeof report === "object" &&
            Array.isArray(report.postLabels) &&
            Array.isArray(report.accountLabels)
          ) {
            window.postMessage({ channel, report }, location.origin);
          }
        })
        .catch(() => {});
    }

    return url;
  };
})();
