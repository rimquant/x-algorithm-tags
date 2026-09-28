import { normalizeLanguage, t } from "./i18n.mjs";

const POST_LABELS = {
  NSFW_HIGH_RECALL: ["可能包含成人内容", "不推荐给未关注者；未成年人、未填写年龄和未登录用户不可见。", "Possible adult content"],
  NSFW_HIGH_PRECISION: ["疑似成人内容", "显示内容警告；限制非关注者推荐及未成年人、未填写年龄和未登录用户查看。", "Likely adult content"],
  NSFW_TEXT: ["成人露骨语言", "不推荐给未关注者；未成年人、未填写年龄和未登录用户不可见。", "Explicit adult language"],
  NSFW_CARD_IMAGE: ["疑似成人图片", "显示内容警告；限制非关注者推荐及未成年人、未填写年龄和未登录用户查看。", "Possible adult image"],
  GORE_AND_VIOLENCE_HIGH_PRECISION: ["血腥或暴力内容", "显示内容警告；限制非关注者推荐及未成年人、未填写年龄和未登录用户查看。", "Graphic or violent content"],
  SPAM_HIGH_RECALL: ["垃圾内容风险", "不推荐给未关注者。", "Spam risk"],
  SPAM: ["垃圾或违规内容", "不会在 X 上显示。", "Spam or policy-violating content"],
  MALICIOUS_URL: ["恶意链接", "不推荐给未关注者。", "Malicious link"],
  DO_NOT_AMPLIFY: ["限制放大", "不推荐给未关注者。", "Limited amplification"],
  PDNA: ["等待审核", "进一步审核完成前不会在 X 上显示。", "Pending review"],
  BOUNCE: ["等待作者删除", "作者删除前不会在 X 上显示。", "Pending author deletion"],
  FOR_EMERGENCY_USE_ONLY: ["紧急事件限制", "显示提示，并且不进入主页时间线。", "Emergency-use restriction"],
  FOSNR_ABUSE: ["辱骂或骚扰", "只能从作者主页发现，并显示可见性受限提示。", "Abuse or harassment"],
  FOSNR_HATEFUL_CONDUCT: ["仇恨行为", "只能从作者主页发现，并显示可见性受限提示。", "Hateful conduct"],
  FOSNR_VIOLENT_SPEECH: ["暴力言论", "只能从作者主页发现，并显示可见性受限提示。", "Violent speech"],
  FOSNR_CIVIC_INTEGRITY: ["公民诚信限制", "只能从作者主页发现，并显示可见性受限提示。", "Civic integrity restriction"],
  FOSNR_ABUSE_INSULTS: ["辱骂或侮辱", "不推荐给未关注者，并显示可见性受限提示。", "Abuse or insults"],
  NSFW_ADMIN: ["成人/暴力账号发帖", "显示内容警告；限制非关注者推荐及未成年人、未填写年龄和未登录用户查看。", "Adult/violent account post"],
};

const ACCOUNT_LABELS = {
  ReadOnly: ["账号只读", "删除违规帖子前只能浏览；账号帖子不推荐给未关注者。", "Read-only account"],
  Compromised: ["账号可能被入侵", "账号帖子不推荐给未关注者，并且需要重置密码。", "Possibly compromised account"],
  SpamHighRecall: ["账号疑似发布垃圾内容", "账号帖子不推荐给未关注者。", "Account may post spam"],
  NsfwHighRecall: ["账号可能发布成人内容", "账号帖子不推荐给未关注者。", "Account may post adult content"],
  NsfwHighPrecision: ["账号疑似发布成人内容", "账号帖子不推荐给未关注者。", "Account likely posts adult content"],
  NsfwAvatarImage: ["头像可能包含成人内容", "账号帖子不推荐给未关注者。", "Avatar may contain adult content"],
  NsfwNearPerfect: ["账号可能发布成人内容", "账号帖子不推荐给未关注者。", "Account may post adult content"],
  NsfwBannerImage: ["横幅可能包含成人内容", "账号帖子不推荐给未关注者。", "Banner may contain adult content"],
  NsfwAdmin: ["成人/暴力内容账号", "显示内容警告，并限制推荐和部分用户查看。", "Adult/violent content account"],
  ImpersonationHighPrecision: ["账号疑似冒充", "账号帖子不推荐给未关注者。", "Possible impersonation"],
  AbusiveHighRecall: ["账号疑似自动化滥用", "账号帖子不推荐给未关注者，并且需要完成安全验证。", "Possible automated abuse"],
  DoNotAmplify: ["账号限制放大", "进一步审核完成前，账号帖子不推荐给未关注者。", "Limited amplification account"],
};

export function knownLabelTitles(kind, language = "zh") {
  const map = kind === "account" ? ACCOUNT_LABELS : POST_LABELS;
  const dynamic = kind === "account"
    ? [["当地法律限制", "Local legal restriction"], ["法律要求限制", "Legal request restriction"]]
    : [["当地法律限制", "Local legal restriction"], ["法律要求限制", "Legal request restriction"], ["版权限制", "Copyright restriction"]];
  const english = normalizeLanguage(language) === "en";
  const entries = [...Object.values(map).map(([title, , englishTitle]) => [title, englishTitle]), ...dynamic];
  const unique = new Map();
  entries.forEach(([title, englishTitle]) => {
    if (!unique.has(title)) unique.set(title, english ? englishTitle : title);
  });
  return [...unique.values()];
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
    return ["当地法律限制", `${subject}在相关国家或地区不显示。`, "Local legal restriction"];
  }
  if (base === "LegalRequest" || base === "UnspecifiedReason") {
    return ["法律要求限制", code.includes("(") && !/\((xx|xy)\)$/i.test(code) ? `${subject}在相关国家或地区不显示。` : `${subject}不会在 X 上显示。`, "Legal request restriction"];
  }
  if (base === "Dmca") {
    return ["版权限制", "帖子不会在 X 上显示。", "Copyright restriction"];
  }
  if (base === "is_dmca") {
    return ["版权限制", "不推荐给未关注者；帖子可见时，其中的媒体不可用。", "Copyright restriction"];
  }
  return null;
}

export function translateLabel(kind, item, language = "zh") {
  const code = item?.label;
  const fallbackAbout = item?.about || "";
  const fallbackEffect = item?.effect || "";
  const entry = findStatic(kind === "account" ? ACCOUNT_LABELS : POST_LABELS, code) || takedown(kind, code);
  if (normalizeLanguage(language) === "en") {
    return {
      title: entry?.[2] || code || t("unknownLabel", "en"),
      effect: [fallbackAbout, fallbackEffect].filter(Boolean).join(" ") || t("unknownEffect", "en"),
    };
  }

  return {
    title: entry?.[0] || code || t("unknownLabel", "zh"),
    effect: entry?.[1] || fallbackEffect || t("unknownEffect", "zh"),
  };
}
