const MAX_TEXT_LENGTH = 20_000;

function text(value, maxLength = MAX_TEXT_LENGTH) {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function nonNegativeInteger(value) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function normalizeLabel(item, account = false) {
  if (!item || typeof item !== "object") {
    throw new TypeError("标签格式无效");
  }

  const label = text(item.label, 160);
  if (!label) {
    throw new TypeError("标签名称缺失");
  }

  const normalized = {
    label,
    about: text(item.about),
    effect: text(item.effect),
  };

  if (!account) {
    normalized.posts = nonNegativeInteger(item.posts);
    normalized.totalPostsInMonth = nonNegativeInteger(item.totalPostsInMonth);
    normalized.percentageOfPosts = text(item.percentageOfPosts, 32);
  }

  return normalized;
}

export function normalizeReport(report) {
  if (!report || typeof report !== "object") {
    throw new TypeError("报告格式无效");
  }
  if (!Array.isArray(report.postLabels) || !Array.isArray(report.accountLabels)) {
    throw new TypeError("报告缺少标签列表");
  }

  const period = report.period && typeof report.period === "object" ? report.period : {};

  return {
    notes: text(report.notes),
    period: {
      startDate: text(period.startDate, 32),
      endDate: text(period.endDate, 32),
      timezone: text(period.timezone, 64),
    },
    generatedAt: text(report.generatedAt, 64),
    postCount: nonNegativeInteger(report.postCount),
    postLabels: report.postLabels.map((item) => normalizeLabel(item)),
    accountLabels: report.accountLabels.map((item) => normalizeLabel(item, true)),
    totalAccountLabels: nonNegativeInteger(report.totalAccountLabels),
  };
}

export function formatPeriod(period) {
  const start = period?.startDate;
  const end = period?.endDate;
  if (!start) return "最近一期报告";

  const date = new Date(`${start}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return end ? `${start} 至 ${end}` : start;

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

export function getReportSummary(report) {
  const parts = [
    { text: "根据您 " },
    { text: formatPeriod(report.period), highlight: true },
    { text: "的数据，" },
  ];
  const accountCount = report.accountLabels.length;
  const postCount = report.postLabels.length;

  if (accountCount === 0 && postCount === 0) {
    parts.push({ text: "本期报告中未发现已知的限制推荐标签。" });
    return parts;
  }

  if (accountCount > 0) {
    parts.push(
      { text: "您的账户命中了 " },
      { text: String(accountCount), highlight: true },
      { text: " 个标签，请查看下面的详细信息。" },
    );
  }
  if (postCount > 0) {
    parts.push(
      { text: "您在此周期内的推文命中了 " },
      { text: String(postCount), highlight: true },
      { text: " 个标签，请查看下面的详细信息。" },
    );
  }
  return parts;
}
