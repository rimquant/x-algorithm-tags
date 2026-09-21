const POST_LABELS = {
  NSFW_HIGH_RECALL: ["可能包含成人内容", "不推荐给未关注者；未成年人、未填写年龄和未登录用户不可见。"],
  NSFW_HIGH_PRECISION: ["疑似成人内容", "显示内容警告；限制非关注者推荐及未成年人、未填写年龄和未登录用户查看。"],
  NSFW_TEXT: ["成人露骨语言", "不推荐给未关注者；未成年人、未填写年龄和未登录用户不可见。"],
  NSFW_CARD_IMAGE: ["疑似成人图片", "显示内容警告；限制非关注者推荐及未成年人、未填写年龄和未登录用户查看。"],
  GORE_AND_VIOLENCE_HIGH_PRECISION: ["血腥或暴力内容", "显示内容警告；限制非关注者推荐及未成年人、未填写年龄和未登录用户查看。"],
  SPAM_HIGH_RECALL: ["垃圾内容风险", "不推荐给未关注者。"],
  SPAM: ["垃圾或违规内容", "不会在 X 上显示。"],
  MALICIOUS_URL: ["恶意链接", "不推荐给未关注者。"],
  DO_NOT_AMPLIFY: ["限制放大", "不推荐给未关注者。"],
  PDNA: ["等待审核", "进一步审核完成前不会在 X 上显示。"],
  BOUNCE: ["等待作者删除", "作者删除前不会在 X 上显示。"],
  FOR_EMERGENCY_USE_ONLY: ["紧急事件限制", "显示提示，并且不进入主页时间线。"],
  FOSNR_ABUSE: ["辱骂或骚扰", "只能从作者主页发现，并显示可见性受限提示。"],
  FOSNR_HATEFUL_CONDUCT: ["仇恨行为", "只能从作者主页发现，并显示可见性受限提示。"],
  FOSNR_VIOLENT_SPEECH: ["暴力言论", "只能从作者主页发现，并显示可见性受限提示。"],
  FOSNR_CIVIC_INTEGRITY: ["公民诚信限制", "只能从作者主页发现，并显示可见性受限提示。"],
  FOSNR_ABUSE_INSULTS: ["辱骂或侮辱", "不推荐给未关注者，并显示可见性受限提示。"],
  NSFW_ADMIN: ["成人/暴力账号发帖", "显示内容警告；限制非关注者推荐及未成年人、未填写年龄和未登录用户查看。"],
};

const ACCOUNT_LABELS = {
  ReadOnly: ["账号只读", "删除违规帖子前只能浏览；账号帖子不推荐给未关注者。"],
  Compromised: ["账号可能被入侵", "账号帖子不推荐给未关注者，并且需要重置密码。"],
  SpamHighRecall: ["账号疑似发布垃圾内容", "账号帖子不推荐给未关注者。"],
  NsfwHighRecall: ["账号可能发布成人内容", "账号帖子不推荐给未关注者。"],
  NsfwHighPrecision: ["账号疑似发布成人内容", "账号帖子不推荐给未关注者。"],
  NsfwAvatarImage: ["头像可能包含成人内容", "账号帖子不推荐给未关注者。"],
  NsfwNearPerfect: ["账号可能发布成人内容", "账号帖子不推荐给未关注者。"],
  NsfwBannerImage: ["横幅可能包含成人内容", "账号帖子不推荐给未关注者。"],
  NsfwAdmin: ["成人/暴力内容账号", "显示内容警告，并限制推荐和部分用户查看。"],
  ImpersonationHighPrecision: ["账号疑似冒充", "账号帖子不推荐给未关注者。"],
  AbusiveHighRecall: ["账号疑似自动化滥用", "账号帖子不推荐给未关注者，并且需要完成安全验证。"],
  DoNotAmplify: ["账号限制放大", "进一步审核完成前，账号帖子不推荐给未关注者。"],
};

export function knownLabelTitles(kind) {
  const map = kind === "account" ? ACCOUNT_LABELS : POST_LABELS;
  const dynamic = kind === "account"
    ? ["当地法律限制", "法律要求限制"]
    : ["当地法律限制", "法律要求限制", "版权限制"];
  return [...new Set([...Object.values(map).map(([title]) => title), ...dynamic])];
}

function normalize(code) {
  return String(code || "").replaceAll("_", "").toUpperCase();
}

function findStatic(map, code) {
  const wanted = normalize(code === "NSFW_ADMIN_STAMPED" ? "NSFW_ADMIN" : code);
  const entry = Object.entries(map).find(([key]) => normalize(key) === wanted);
  return entry?.[1] || null;
}

function takedown(kind, code) {
  const base = String(code || "").split("(")[0];
  const account = kind === "account";
  const subject = account ? "账号帖子" : "帖子";

  if (base === "BystanderReport") {
    return ["当地法律限制", `${subject}在相关国家或地区不显示。`];
  }
  if (base === "LegalRequest" || base === "UnspecifiedReason") {
    return ["法律要求限制", code.includes("(") && !/\((xx|xy)\)$/i.test(code) ? `${subject}在相关国家或地区不显示。` : `${subject}不会在 X 上显示。`];
  }
  if (base === "Dmca") {
    return ["版权限制", "帖子不会在 X 上显示。"];
  }
  if (base === "is_dmca") {
    return ["版权限制", "不推荐给未关注者；帖子可见时，其中的媒体不可用。"];
  }
  return null;
}

export function translateLabel(kind, code, fallbackEffect = "") {
  const entry = findStatic(kind === "account" ? ACCOUNT_LABELS : POST_LABELS, code) || takedown(kind, code);
  return {
    title: entry?.[0] || code || "未知标签",
    effect: entry?.[1] || fallbackEffect || "X 未提供可见性影响说明。",
  };
}
