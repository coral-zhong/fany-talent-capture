(() => {
  const PLATFORM_CODES = {
    tiktok: "TT",
    instagram: "IG",
    youtube: "YT",
    facebook: "FB",
    nox: "NOX"
  };

  const readMeta = (...selectors) => {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const value = node?.getAttribute("content") || node?.getAttribute("href");
      if (value) return value.trim();
    }
    return "";
  };

  const cleanTitle = (value) => {
    return (value || "")
      // Strip "(@handle)" and everything after it — covers TikTok "name (@h)" and
      // localized IG "name (@h) · Instagram 照片和视频".
      .replace(/\s*\(@[^)]*\).*$/i, "")
      // Strip a trailing platform suffix joined by | · • - (English + localized),
      // without touching a "|" that is part of the creator's own name.
      .replace(/\s*[|·•]\s*(?:TikTok|Instagram|YouTube|Facebook|NoxInfluencer)\b.*$/i, "")
      .replace(/\s*-\s*(?:Instagram|YouTube)\b.*$/i, "")
      .replace(/\s*\|\s*TikTok\b.*$/i, "")
      .trim();
  };

  const parseCompactNumber = (raw) => {
    if (!raw) return null;
    const match = String(raw).replace(/,/g, "").match(/([\d.]+)\s*([KMB万亿]?)/i);
    if (!match) return null;
    const value = Number(match[1]);
    if (!Number.isFinite(value)) return null;
    const unit = match[2]?.toLowerCase();
    const multiplier = {
      k: 1_000,
      m: 1_000_000,
      b: 1_000_000_000,
      "万": 10_000,
      "亿": 100_000_000
    }[unit] || 1;
    return Math.round(value * multiplier);
  };

  // Platform / system domains whose emails are never the creator's contact.
  const EMAIL_DOMAIN_BLOCK = /@(?:tiktok|tiktokv|instagram|facebook|fb|youtube|google|googlemail|gmail-noreply|fastmoss|noxinfluencer|noxgroup|sentry|wixpress|cloudflare|example|email-protection)\b/i;
  const isJunkEmail = (email) => {
    const value = String(email || "").toLowerCase();
    if (!value) return true;
    if (EMAIL_DOMAIN_BLOCK.test(value)) return true;
    if (/\.(png|jpe?g|gif|svg|webp|bmp)$/i.test(value)) return true;
    if (/@(?:2x|3x)\b/i.test(value)) return true;
    if (/^(?:noreply|no-reply|donotreply|do-not-reply|mailer-daemon|postmaster)@/i.test(value)) return true;
    return false;
  };
  const pickEmail = (text) => {
    const matches = String(text || "").match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    return matches.find((email) => !isJunkEmail(email)) || "";
  };
  const findEmail = () => {
    // Creators put their contact email in the bio / description; prefer that region.
    const bio = readMeta('meta[name="description"]', 'meta[property="og:description"]');
    return pickEmail(bio) || pickEmail(document.body?.innerText || "");
  };

  const detectLanguage = () => {
    const htmlLang = document.documentElement?.getAttribute("lang");
    if (htmlLang) return htmlLang.trim();
    const locale = readMeta('meta[property="og:locale"]');
    return locale ? locale.replace(/_/g, "-").trim() : "";
  };

  const LOCALE_COUNTRY = {
    US: "美国", GB: "英国", UK: "英国", CA: "加拿大", AU: "澳大利亚",
    DE: "德国", FR: "法国", ES: "西班牙", IT: "意大利", NL: "荷兰",
    JP: "日本", KR: "韩国", CN: "中国", TW: "中国台湾", HK: "中国香港",
    SG: "新加坡", MY: "马来西亚", TH: "泰国", VN: "越南", ID: "印度尼西亚",
    PH: "菲律宾", IN: "印度", BR: "巴西", MX: "墨西哥", RU: "俄罗斯"
  };

  const detectCountry = () => {
    const locale = readMeta('meta[property="og:locale"]', 'meta[name="geo.region"]');
    const region = locale?.split(/[-_]/)?.[1]?.toUpperCase();
    return region && LOCALE_COUNTRY[region] ? LOCALE_COUNTRY[region] : "";
  };

  const normalizeUrl = (url) => {
    try {
      const parsed = new URL(url);
      parsed.hash = "";
      parsed.search = "";
      if (parsed.pathname !== "/") parsed.pathname = parsed.pathname.replace(/\/+$/, "");
      return parsed.toString();
    } catch {
      return url;
    }
  };

  const getPlatform = () => {
    const host = location.hostname.toLowerCase();
    if (host.includes("noxinfluencer.com")) return "nox";
    if (host.includes("fastmoss.com")) return "fastmoss";
    if (host.includes("tiktok.com")) return "tiktok";
    if (host.includes("instagram.com")) return "instagram";
    if (host.includes("youtube.com")) return "youtube";
    if (host.includes("facebook.com")) return "facebook";
    return "unknown";
  };

  const findFirstUrl = (patterns) => {
    const anchors = [...document.querySelectorAll("a[href]")];
    for (const pattern of patterns) {
      const anchor = anchors.find((item) => pattern.test(item.href));
      if (anchor) return normalizeUrl(anchor.href);
    }
    return "";
  };

  const getNoxPlatformKeyFromPath = () => {
    const match = location.pathname.match(/\/(tiktok|instagram|youtube|facebook)\//i);
    return match?.[1]?.toLowerCase() || "";
  };

  const getNoxNativeIdFromPath = () => {
    const match = location.pathname.match(/\/(?:tiktok|instagram|youtube|facebook)\/channel\/([^/?#]+)/i);
    return match?.[1] ? decodeURIComponent(match[1]) : "";
  };

  const extractAccountFromProfileUrl = (url, platform) => {
    if (!url) return "";
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
      if (/TikTok/i.test(platform)) {
        const handle = parts.find((part) => part.startsWith("@")) || parts[0] || "";
        return handle ? `@${handle.replace(/^@/, "")}` : "";
      }
      if (/Instagram/i.test(platform)) return parts[0] ? `@${parts[0].replace(/^@/, "")}` : "";
      if (/YouTube/i.test(platform)) {
        if (parts[0]?.startsWith("@")) return parts[0];
        if (parts[0] === "channel" && parts[1]) return `channel/${parts[1]}`;
        if ((parts[0] === "c" || parts[0] === "user") && parts[1]) return `${parts[0]}/${parts[1]}`;
        return parts[0] || "";
      }
      if (/Facebook/i.test(platform)) return parts[0] || "";
    } catch {
      return "";
    }
    return "";
  };

  const findInHtml = (patterns) => {
    const html = document.documentElement?.innerHTML || "";
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return match[1];
    }
    return "";
  };

  const extractNativeId = (platformKey, handle = "") => {
    const escapedHandle = handle.replace(/^@/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (platformKey === "instagram") {
      return findInHtml([
        /"profile_id"\s*:\s*"(\d+)"/,
        /"profilePage_(\d+)"/,
        escapedHandle ? new RegExp(`"id"\\s*:\\s*"(\\d+)"[^{}]{0,200}"username"\\s*:\\s*"${escapedHandle}"`, "i") : null
      ].filter(Boolean));
    }
    if (platformKey === "youtube") {
      const canonical = readMeta('link[rel="canonical"]') || location.href;
      return canonical.match(/youtube\.com\/channel\/([^/?#]+)/i)?.[1] || "";
    }
    if (platformKey === "tiktok") {
      const user = findTikTokUser(handle);
      if (user?.id) return user.id;
      return findInHtml([
        /"authorId"\s*:\s*"(\d+)"/,
        /"userId"\s*:\s*"(\d+)"/,
        /"id"\s*:\s*"(\d+)"[^{}]{0,240}"uniqueId"/
      ]);
    }
    if (platformKey === "facebook") {
      return findInHtml([
        /"pageID"\s*:\s*"(\d+)"/,
        /"page_id"\s*:\s*"(\d+)"/,
        /"profile_id"\s*:\s*"(\d+)"/
      ]);
    }
    return "";
  };

  const buildNoxProfileUrl = (platformKey, nativeId) => {
    const slug = {
      instagram: "instagram",
      youtube: "youtube",
      tiktok: "tiktok",
      facebook: "facebook"
    }[platformKey];
    if (!slug || !nativeId) return "";
    return `https://cn.noxinfluencer.com/${slug}/channel/${encodeURIComponent(nativeId)}`;
  };

  const buildFastMossProfileUrl = (nativeId) => {
    if (!nativeId || !/^\d{8,}$/.test(String(nativeId))) return "";
    return `https://www.fastmoss.com/zh/influencer/detail/${encodeURIComponent(nativeId)}`;
  };

  const findMetricAfterLabel = (labels) => {
    const labeledValue = findLabeledValue(labels, 120);
    if (labeledValue) {
      const labeledMatch = labeledValue.match(/([\d.,]+)\s*([KMB万亿%]?)/i);
      if (labeledMatch) return `${labeledMatch[1]}${labeledMatch[2] || ""}`;
    }

    const text = document.body?.innerText || "";
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`${escaped}\\s*[:：]?\\s*([\\d.,]+\\s*[KMB万亿%]?)`, "i");
      const match = text.match(pattern);
      if (match) return match[1];
      const around = findTextAroundLabel([label], 180);
      const nearby = around.match(/([\d.,]+)\s*([KMB万亿%]?)/i);
      if (nearby?.[1]) return `${nearby[1]}${nearby[2] || ""}`;
    }
    return "";
  };

  const findPercentAfterLabel = (labels) => {
    const raw = findMetricAfterLabel(labels);
    const match = raw.match(/[\d.]+/);
    return match ? Number(match[0]) : null;
  };

  const findTextAroundLabel = (labels, maxLength = 180) => {
    const text = (document.body?.innerText || "").replace(/\s+/g, " ");
    for (const label of labels) {
      const index = text.toLowerCase().indexOf(label.toLowerCase());
      if (index >= 0) return text.slice(index, index + maxLength).trim();
    }
    return "";
  };

  const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();

  const isVisible = (node) => {
    const style = window.getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
  };

  const findLabeledValue = (labels, maxLength = 220) => {
    const escapedLabels = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const labelPattern = new RegExp(`^(${escapedLabels.join("|")})\\s*[:：]?\\s*`, "i");
    const nodes = [...document.body.querySelectorAll("dt, dd, li, tr, th, td, div, span, p")]
      .filter(isVisible)
      .slice(0, 3000);

    for (const node of nodes) {
      const text = normalizeText(node.innerText || node.textContent);
      if (!text || text.length > 500) continue;
      const match = text.match(labelPattern);
      if (match) {
        const inlineValue = normalizeText(text.replace(labelPattern, ""));
        if (inlineValue) return inlineValue.slice(0, maxLength);
        const next = node.nextElementSibling;
        const nextText = normalizeText(next?.innerText || next?.textContent);
        if (nextText) return nextText.slice(0, maxLength);
      }

      for (const label of labels) {
        if (text.toLowerCase() !== label.toLowerCase()) continue;
        const parentText = normalizeText(node.parentElement?.innerText || "");
        const value = normalizeText(parentText.replace(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), ""));
        if (value) return value.slice(0, maxLength);
      }
    }

    return "";
  };

  const parseTopCountries = (raw) => {
    const pairs = [];
    const source = String(raw || "");
    const normalized = source
      .replace(/(受众地区|粉丝地区|Audience Geography|Top Countries|国家|地区)/gi, " ")
      .replace(/\s+/g, " ");
    const percentFirst = /([\d.]+)%\s*([A-Za-z\u4e00-\u9fa5\s]{1,24}?)(?=\s+[\d.]+%|$)/g;
    const countryFirst = /([A-Za-z\u4e00-\u9fa5]{2,24})\s*([\d.]+)%/g;
    const badCountry = /^(and|or|more|view|all|top|其他|其它|更多|全部|国家|地区)$/i;
    let match;
    while ((match = percentFirst.exec(normalized))) {
      const country = match[2].trim();
      if (country && !badCountry.test(country)) pairs.push(`${country} ${match[1]}%`);
      if (pairs.length >= 3) break;
    }
    while (pairs.length < 3 && (match = countryFirst.exec(normalized))) {
      const country = match[1].trim();
      const pair = `${country} ${match[2]}%`;
      if (country && !badCountry.test(country) && !pairs.includes(pair)) pairs.push(pair);
    }
    if (!pairs.length) {
      const topRegion = source.match(/(?:最多受众区域|最多受众地区|最多受众国家)\s*[:：]?\s*([A-Za-z\u4e00-\u9fa5]{2,24})/i)?.[1]?.trim();
      if (topRegion && !badCountry.test(topRegion)) pairs.push(topRegion);
    }
    return pairs;
  };

  const NOX_COUNTRIES = [
    "美国", "加拿大", "英国", "澳大利亚", "印度", "德国", "法国", "西班牙", "意大利",
    "巴西", "墨西哥", "日本", "韩国", "中国", "中国台湾", "中国香港", "新加坡",
    "马来西亚", "泰国", "菲律宾", "印度尼西亚", "越南", "俄罗斯", "荷兰", "其他",
    "United States", "Canada", "United Kingdom", "Australia", "India", "Germany",
    "France", "Spain", "Italy", "Brazil", "Mexico", "Japan", "Korea", "Singapore"
  ];

  const isCleanNoxLabel = (value) => {
    const text = normalizeText(value)
      .replace(/^#+/, "")
      .replace(/[，,：:。.;；]+$/g, "");
    if (!text || text.length > 28) return false;
    if (/^\d+(\.\d+)?%?$/.test(text)) return false;
    if (/^(com|www|http|https|net|org|\d+|数据|分析|百分|描述|兴趣点|类别|更多|查看|暂无|其他)$/i.test(text)) return false;
    if (/(数据总览|受众数据|内容数据|品牌数据|受众特征|受众区域|受众语言|内容与兴趣|内容分布|品牌)/.test(text)) return false;
    if (/[，,。；;、]/.test(text) || /视频|内容|主要|包括|出现|聚焦|涉及|包含/.test(text)) return false;
    return true;
  };

  const parseNoxAudienceRegions = (raw, limit = 3) => {
    const pairs = [];
    const text = String(raw || "").replace(/\s+/g, " ");
    const countryPattern = NOX_COUNTRIES
      .map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    const percentCountry = new RegExp(`([\\d.]+)%\\s*(${countryPattern})`, "gi");
    const countryPercent = new RegExp(`(${countryPattern})\\s*([\\d.]+)%`, "gi");
    let match;
    while ((match = percentCountry.exec(text)) && pairs.length < limit) {
      pairs.push(`${match[2].trim()} ${match[1]}%`);
    }
    while ((match = countryPercent.exec(text)) && pairs.length < limit) {
      const pair = `${match[1].trim()} ${match[2]}%`;
      if (!pairs.includes(pair)) pairs.push(pair);
    }
    if (!pairs.length) return parseTopCountries(raw).slice(0, limit);
    return [...new Set(pairs)].slice(0, limit);
  };

  const parseNoxTopGender = (raw) => {
    const text = String(raw || "").replace(/\s+/g, " ");
    const match = text.match(/(女性|女|Female|男性|男|Male)\s*([\d.]+)%/i) ||
      text.match(/([\d.]+)%\s*(女性|女|Female|男性|男|Male)/i);
    if (!match) return "";
    if (/^\d/.test(match[1])) return `${match[2]} ${match[1]}%`;
    const label = /^(女|Female)$/i.test(match[1]) ? "女性" : /^(男|Male)$/i.test(match[1]) ? "男性" : match[1];
    return `${label} ${match[2]}%`;
  };

  const parseNoxTopAge = (raw) => {
    const text = String(raw || "").replace(/\s+/g, " ");
    const match = text.match(/(\d{1,2}\s*-\s*\d{1,2}|\d{2}\+)\s*([\d.]+)%/);
    return match ? `${match[1].replace(/\s+/g, "")} ${match[2]}%` : "";
  };

  const extractNoxPercentRows = (raw, options = {}) => {
    const limit = options.limit || 5;
    const lines = toTextLines(raw)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const pairs = [];

    for (let i = 0; i < lines.length && pairs.length < limit; i += 1) {
      const current = lines[i];
      const labelFirst = current.match(/^(.{1,40}?)\s+([\d.]+)%$/);
      if (labelFirst && isCleanNoxLabel(labelFirst[1])) {
        pairs.push(`${labelFirst[1].trim()} ${labelFirst[2]}%`);
        continue;
      }

      const percentFirst = current.match(/^([\d.]+)%\s*(.{1,28})$/);
      if (percentFirst && isCleanNoxLabel(percentFirst[2])) {
        pairs.push(`${percentFirst[2].trim()} ${percentFirst[1]}%`);
        continue;
      }

      if (!isCleanNoxLabel(current)) continue;
      for (let offset = 1; offset <= 4 && i + offset < lines.length; offset += 1) {
        const percent = lines[i + offset].match(/^([\d.]+)%$/);
        if (percent) {
          pairs.push(`${current} ${percent[1]}%`);
          break;
        }
      }
    }

    return [...new Set(pairs)].slice(0, limit);
  };

  const extractNoxCreatorCategory = (raw, interests = []) => {
    const categoryBlock = textBlockAfter(raw, ["网红类别", "达人类别", "频道分类", "内容类别", "分类", "Creator Category", "Influencer Category"], 900);
    const categoryPairs = extractNoxPercentRows(categoryBlock, { limit: 1 });
    const category = categoryPairs[0]?.replace(/\s+[\d.]+%$/, "").replace(/[，,、]+$/g, "").trim();
    if (category) return category;
    const inferred = inferCreatorCategory(interests);
    return inferred.replace(/[，,、]+$/g, "").trim();
  };

  const parseListAfterLabel = (labels, limit = 10) => {
    const raw = findLabeledValue(labels, 600) || findTextAroundLabel(labels, 600);
    const labelPattern = new RegExp(labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "ig");
    const stopWords = /^(更多|查看|全部|数据|暂无|排名|rank|more|view|all|data|brand|brands|category|categories)$/i;
    return [...new Set(raw
      .replace(labelPattern, "")
      .replace(/(Top\s*\d+|前\s*\d+\s*个?)/gi, "")
      .split(/[\n,，、|]/)
      .map((item) => item.trim())
      .filter((item) => item && !/^\d+(\.\d+)?%?$/.test(item) && !stopWords.test(item)))]
      .slice(0, limit);
  };

  const parseJsonNumber = (value) => {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
    return parseCompactNumber(value);
  };

  const readEmbeddedJson = () => {
    const values = [];
    const scripts = [...document.querySelectorAll('script[type*="json"], script[id*="SIGI"], script[id*="UNIVERSAL"], script[id*="NEXT"]')];
    for (const script of scripts) {
      const text = script.textContent?.trim();
      if (!text || text.length < 2) continue;
      try {
        values.push(JSON.parse(text));
      } catch {
        // Some platforms hydrate with non-JSON scripts. The visible DOM fallback handles those.
      }
    }
    return values;
  };

  const walkJson = (value, visitor, seen = new Set()) => {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    visitor(value);
    if (Array.isArray(value)) {
      value.forEach((item) => walkJson(item, visitor, seen));
      return;
    }
    Object.values(value).forEach((item) => walkJson(item, visitor, seen));
  };

  // TikTok hydrates the profile into __UNIVERSAL_DATA_FOR_REHYDRATION__ (and older SIGI_STATE).
  // The numeric user id + secUid live on a user object keyed by uniqueId, not on a flat authorId.
  const findTikTokUser = (handle = "") => {
    const target = String(handle || "").replace(/^@/, "").toLowerCase();
    let exact = null;
    let fallback = null;
    for (const root of readEmbeddedJson()) {
      walkJson(root, (object) => {
        const uniqueId = object.uniqueId || object.unique_id;
        const id = object.id || object.userId || object.uid;
        if (!uniqueId || !id) return;
        if (!/^\d{6,}$/.test(String(id))) return;
        const user = {
          id: String(id),
          secUid: String(object.secUid || object.sec_uid || ""),
          uniqueId: String(uniqueId)
        };
        if (target && String(uniqueId).toLowerCase() === target) {
          if (!exact || (!exact.secUid && user.secUid)) exact = user;
        } else if (!fallback) {
          fallback = user;
        }
      });
      if (exact?.secUid) break;
    }
    return exact || (target ? null : fallback);
  };

  const getContentIdFromUrl = (url = location.href) => {
    const text = String(url || "");
    return text.match(/\/video\/(\d+)/i)?.[1] ||
      text.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/i)?.[1] ||
      text.match(/[?&]v=([^&#]+)/i)?.[1] ||
      text.match(/youtu\.be\/([^/?#]+)/i)?.[1] ||
      text.match(/\/(?:videos|reel)\/(\d+)/i)?.[1] ||
      "";
  };

  const objectContainsContentId = (object, contentId) => {
    if (!contentId || !object || typeof object !== "object") return false;
    const fields = [
      object.id,
      object.itemId,
      object.aweme_id,
      object.videoId,
      object.shortcode,
      object.code,
      object.url,
      object.shareUrl,
      object.webVideoUrl,
      object.canonicalUrl,
      object.permalink
    ];
    return fields.some((value) => String(value || "").includes(contentId));
  };

  const findRepresentativeStatsInJson = (contentId = getContentIdFromUrl()) => {
    const jsonRoots = readEmbeddedJson();
    const candidates = [];
    const viewKeys = ["playCount", "viewCount", "views", "play_count", "view_count", "video_view_count"];
    const likeKeys = ["diggCount", "likeCount", "likes", "like_count", "favoriteCount"];
    const commentKeys = ["commentCount", "comments", "comment_count"];

    const pick = (object, keys) => {
      for (const key of keys) {
        const parsed = parseJsonNumber(object[key]);
        if (parsed !== null) return parsed;
      }
      return null;
    };

    for (const root of jsonRoots) {
      walkJson(root, (object) => {
        const views = pick(object, viewKeys);
        const likes = pick(object, likeKeys);
        const comments = pick(object, commentKeys);
        if (views !== null || likes !== null || comments !== null) {
          candidates.push({
            views,
            likes,
            comments,
            title: normalizeText(object.desc || object.description || object.title || ""),
            isCurrentContent: objectContainsContentId(object, contentId)
          });
        }
      });
    }

    // When we know which content this page is, only trust stats from THAT object.
    // Otherwise we risk picking a recommended/most-viewed unrelated video.
    if (contentId) {
      const matched = candidates.filter((candidate) => candidate.isCurrentContent);
      if (matched.length) {
        matched.sort((a, b) => Number(b.views || b.likes || 0) - Number(a.views || a.likes || 0));
        return matched[0];
      }
      return {};
    }

    candidates.sort((a, b) => {
      if (a.isCurrentContent !== b.isCurrentContent) return a.isCurrentContent ? -1 : 1;
      return Number(b.views || b.likes || 0) - Number(a.views || a.likes || 0);
    });
    return candidates[0] || {};
  };

  const findMetricInText = (raw, labels) => {
    const text = String(raw || "").replace(/\s+/g, " ");
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const after = text.match(new RegExp(`${escaped}\\s*[:：]?\\s*([\\d.,]+\\s*[KMB万亿]?)`, "i"));
      if (after) return parseCompactNumber(after[1]);
      const before = text.match(new RegExp(`([\\d.,]+\\s*[KMB万亿]?)\\s*(?:个|条|次)?\\s*${escaped}`, "i"));
      if (before) return parseCompactNumber(before[1]);
    }
    return null;
  };

  const inferCreatorCategory = (...sources) => {
    const text = sources.flat().filter(Boolean).join(" ").toLowerCase();
    const rules = [
      ["美妆", /(beauty|makeup|skin|skincare|cosmetic|美妆|护肤|彩妆|妆容)/i],
      ["家居", /(home|decor|furniture|interior|家居|装修|收纳|家具)/i],
      ["3C", /(tech|gadget|phone|camera|3c|数码|手机|相机|电脑|耳机)/i],
      ["母婴", /(baby|mom|mother|kids|toy|母婴|宝宝|育儿|儿童)/i],
      ["食品", /(food|recipe|cook|snack|食品|美食|食谱|零食|烘焙)/i],
      ["宠物", /(pet|dog|cat|宠物|猫|狗|养宠)/i],
      ["健身", /(fitness|workout|gym|yoga|健身|运动|瑜伽)/i],
      ["时尚", /(fashion|outfit|style|wear|时尚|穿搭|服饰)/i],
      ["生活方式", /(lifestyle|life|daily|生活|日常)/i]
    ];
    const found = rules.find(([, pattern]) => pattern.test(text));
    return found?.[0] || "";
  };

  const findRepresentativeContent = () => {
    const contentPatterns = [
      /tiktok\.com\/@[^/]+\/video\/\d+/i,
      /instagram\.com\/(p|reel|tv)\//i,
      /youtube\.com\/watch\?v=|youtu\.be\//i,
      /facebook\.com\/.*\/(videos|posts|reel)\//i
    ];
    const currentUrl = normalizeUrl(location.href);
    const bodyText = document.body?.innerText || "";
    if (contentPatterns.some((pattern) => pattern.test(currentUrl))) {
      const title = cleanTitle(readMeta('meta[property="og:title"]') || document.title);
      const jsonStats = findRepresentativeStatsInJson();
      return {
        fromCurrentContentPage: true,
        content: currentUrl,
        likes: jsonStats.views || jsonStats.likes ||
          findMetricInText(bodyText, ["播放", "播放量", "观看", "观看次数", "Views", "View"]) ||
          findMetricInText(bodyText, ["点赞", "喜欢", "Likes", "Like"]),
        comments: jsonStats.comments || findMetricInText(bodyText, ["评论", "Comments", "Comment"]),
        title: jsonStats.title || title
      };
    }

    const anchors = [...document.querySelectorAll("a[href]")];
    const anchor = anchors.find((item) => contentPatterns.some((pattern) => pattern.test(item.href)));
    if (anchor) {
      const container = anchor.closest("article, li, tr, section, div") || anchor;
      const nearbyText = container.innerText || anchor.innerText || "";
      const label = [
        anchor.getAttribute("aria-label"),
        anchor.getAttribute("title"),
        anchor.innerText,
        anchor.href
      ].find((item) => String(item || "").trim());
      return {
        fromCurrentContentPage: false,
        content: normalizeUrl(anchor.href),
        likes: findMetricInText(nearbyText, ["播放", "播放量", "观看", "观看次数", "Views", "View"]) ||
          findMetricInText(nearbyText, ["点赞", "喜欢", "Likes", "Like"]),
        comments: findMetricInText(nearbyText, ["评论", "Comments", "Comment"]),
        title: cleanTitle(anchor.getAttribute("title") || anchor.getAttribute("aria-label") || anchor.innerText)
      };
    }

    const fallback = findTextAroundLabel(["代表内容", "热门内容", "Top content", "Popular posts", "Videos"], 800);
    return {
      fromCurrentContentPage: false,
      content: fallback.replace(/\s+/g, " ").trim().slice(0, 500),
      likes: findMetricInText(fallback, ["播放", "播放量", "观看", "观看次数", "Views", "View"]) ||
        findMetricInText(fallback, ["点赞", "喜欢", "Likes", "Like"]),
      comments: findMetricInText(fallback, ["评论", "Comments", "Comment"]),
      title: ""
    };
  };

  const inferCommentDirection = () => {
    const raw = findTextAroundLabel(["评论导向", "评论", "Comments", "互动质量"], 900) || (document.body?.innerText || "").slice(0, 3000);
    const text = raw.toLowerCase();
    if (/(链接|link|where|bio|shop link)/i.test(text)) return "问链接";
    if (/(价格|多少钱|price|cost|how much)/i.test(text)) return "问价格";
    if (/(购买|怎么买|下单|buy|shop|order)/i.test(text)) return "购买意向";
    if (/(怎么用|功能|尺寸|材质|型号|feature|size|material|work|use)/i.test(text)) return "问产品功能";
    if (/(好看|喜欢|种草|love|nice|great|amazing|beautiful)/i.test(text)) return "空泛夸赞";
    if (/(fake|scam|差|不好|负面|避雷|失望|bad|terrible)/i.test(text)) return "负面";
    return "";
  };

  const inferPlatformName = (platformKey = getPlatform()) => {
    return {
      tiktok: "TikTok",
      instagram: "Instagram",
      youtube: "YouTube",
      facebook: "Facebook",
      fastmoss: "FastMoss",
      nox: "Nox",
      unknown: "Web"
    }[platformKey] || "Web";
  };

  const inferPlatformCode = (platformKey = getPlatform()) => {
    return PLATFORM_CODES[platformKey] || "WEB";
  };

  const inferAccountFromUrl = () => {
    const platformKey = getPlatform();
    const parts = location.pathname.split("/").filter(Boolean);
    if (platformKey === "tiktok") return (parts.find((part) => part.startsWith("@")) || parts[0] || "");
    if (platformKey === "instagram") return parts[0] ? `@${parts[0].replace(/^@/, "")}` : "";
    if (platformKey === "youtube") return parts[0]?.startsWith("@") ? parts[0] : parts.slice(0, 2).join("/");
    if (platformKey === "facebook") return parts[0] || "";
    return "";
  };

  const toTextLines = (text) => String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const getTextLines = () => toTextLines(document.body?.innerText || "");

  const parseMetricValue = (raw) => {
    const text = String(raw || "").replace(/[$￥¥,]/g, "").trim();
    if (!text || /^[-–—]+$/.test(text) || /暂无数据|无数据/i.test(text)) return null;
    if (/(环比|粉丝|视频|直播|GMV|Gmv|销量|销售额|播放|互动|指数|排名|数据|分析|带货|商品)/i.test(text) && !/^\s*-?[\d.,]+\s*[KMB万亿]?\s*%?\s*$/i.test(text)) {
      return null;
    }
    const match = text.match(/-?[\d.]+\s*[KMB万亿]?/i);
    return match ? parseCompactNumber(match[0]) : null;
  };

  const readLineValueAfter = (labels, lookahead = 4, lines = getTextLines()) => {
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const label = labels.find((item) => line.toLowerCase().includes(item.toLowerCase()));
      if (!label) continue;
      const inline = line.replace(new RegExp(`^.*?${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:：]?\\s*`, "i"), "").trim();
      if (inline && inline !== line && !/^[-–—]+$/.test(inline)) return inline;
      for (let offset = 1; offset <= lookahead; offset += 1) {
        const candidate = lines[i + offset];
        if (candidate && !/^[-–—]+$/.test(candidate) && !/^\*+$/.test(candidate)) return candidate;
      }
    }
    return "";
  };

  const readNumberAfter = (labels, lookahead = 4, lines = getTextLines()) => parseMetricValue(readLineValueAfter(labels, lookahead, lines));

  // Nox overview now embeds an AI 内容总结 paragraph that contains words like 粉丝/互动率.
  // These readers only trust SHORT, standalone label lines (a data row), ignoring prose.
  const matchNoxLabel = (line, labels) => {
    const text = String(line || "").trim();
    if (text.length > 16) return null;
    return labels.find((label) => text === label || text === `${label}：` ||
      text.startsWith(`${label} `) || text.startsWith(`${label}：`)) || null;
  };
  const readNoxLabeledNumber = (lines, labels) => {
    for (let i = 0; i < lines.length; i += 1) {
      const label = matchNoxLabel(lines[i], labels);
      if (!label) continue;
      const rest = String(lines[i]).trim().slice(label.length).replace(/^[：:\s]+/, "");
      const inline = rest ? parseMetricValue(rest) : null;
      if (inline !== null) return inline;
      for (let offset = 1; offset <= 3 && i + offset < lines.length; offset += 1) {
        const value = parseMetricValue(lines[i + offset]);
        if (value !== null) return value;
      }
    }
    return null;
  };
  const readNoxLabeledPercent = (lines, labels) => {
    for (let i = 0; i < lines.length; i += 1) {
      const label = matchNoxLabel(lines[i], labels);
      if (!label) continue;
      const rest = String(lines[i]).trim().slice(label.length);
      const inline = rest.match(/([\d.]+)\s*%/);
      if (inline) return Number(inline[1]);
      for (let offset = 1; offset <= 3 && i + offset < lines.length; offset += 1) {
        const match = String(lines[i + offset]).match(/^([\d.]+)\s*%$/);
        if (match) return Number(match[1]);
      }
    }
    return null;
  };

  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const clickTabByLabel = async (label, { settle = 900 } = {}) => {
    const candidates = [...document.querySelectorAll("a, button, [role='tab'], li, div, span")]
      .filter(isVisible)
      .map((node) => ({ node, text: normalizeText(node.innerText || node.textContent) }))
      .filter((item) => item.text && (item.text === label || (item.text.length <= label.length + 4 && item.text.includes(label))));
    // Prefer the most specific (shortest) match so we click the tab, not a wrapping container.
    candidates.sort((a, b) => a.text.length - b.text.length);
    const target = candidates[0]?.node;
    if (!target) return false;
    try { target.scrollIntoView({ block: "center" }); } catch { /* ignore */ }
    target.click();
    try {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    } catch { /* ignore */ }
    await wait(settle);
    return true;
  };

  const clickFastMossTab = (label) => clickTabByLabel(label, { settle: 900 });

  const collectFastMossSnapshots = async () => {
    const snapshots = {
      当前: document.body?.innerText || ""
    };
    for (const tab of ["核心数据", "粉丝分析", "视频分析", "带货分析", "带货商品列表"]) {
      await clickFastMossTab(tab);
      snapshots[tab] = document.body?.innerText || "";
    }
    return snapshots;
  };

  const collectNoxSnapshots = async () => {
    const snapshots = {
      当前: document.body?.innerText || ""
    };
    const tabs = [
      { name: "数据总览", expect: ["内容数量", "平均观看量", "互动率"] },
      { name: "受众数据", expect: ["受众", "粉丝可信度", "性别", "年龄"] },
      { name: "内容数据", expect: ["内容分布", "兴趣点", "网红类别", "类别"] },
      { name: "品牌数据", expect: ["提及品牌", "品牌"] }
    ];
    for (const tab of tabs) {
      await clickTabByLabel(tab.name, { settle: 600 });
      // SPA panels hydrate asynchronously; poll until the expected text shows up.
      let text = document.body?.innerText || "";
      for (let attempt = 0; attempt < 6 && !tab.expect.some((kw) => text.includes(kw)); attempt += 1) {
        await wait(500);
        text = document.body?.innerText || "";
      }
      snapshots[tab.name] = text;
    }
    return snapshots;
  };

  const textBlockAfter = (text, labels, maxLength = 700) => {
    const normalized = String(text || "").replace(/\r/g, "");
    for (const label of labels) {
      const index = normalized.toLowerCase().indexOf(label.toLowerCase());
      if (index >= 0) return normalized.slice(index, index + maxLength);
    }
    return "";
  };

  const firstNumberInBlock = (text, labels, maxLength = 180) => {
    const block = textBlockAfter(text, labels, maxLength);
    const match = block.match(/-?[\d.]+\s*[KMB万亿]?/i);
    return match ? parseCompactNumber(match[0]) : null;
  };

  const firstPercentInBlock = (text, labels, maxLength = 220) => {
    const block = textBlockAfter(text, labels, maxLength);
    const match = block.match(/([\d.]+)%/);
    return match ? Number(match[1]) : null;
  };

  const extractMetricFromText = (text, labels) => {
    const normalized = String(text || "").replace(/\r/g, "");
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const inline = normalized.match(new RegExp(`${escaped}\\s*[：:]\\s*([$￥¥]?[\\d.,]+\\s*[KMB万亿]?)`, "i"));
      if (inline?.[1]) return parseMetricValue(inline[1]);
      const paren = normalized.match(new RegExp(`${escaped}\\s*[（(]\\s*([$￥¥]?[\\d.,]+\\s*[KMB万亿]?)\\s*[）)]`, "i"));
      if (paren?.[1]) return parseMetricValue(paren[1]);
    }
    return null;
  };

  const extractPercentPairs = (text, options = {}) => {
    const limit = options.limit || 5;
    const pairs = [];
    const normalized = String(text || "").replace(/\s+/g, " ");
    const pattern = /(#?[\w\u4e00-\u9fa5][\w\u4e00-\u9fa5\s&/-]{1,40}?)\s+([\d.]+)%/g;
    let match;
    while ((match = pattern.exec(normalized)) && pairs.length < limit) {
      const label = match[1].trim();
      if (!label || /^(近|占|比例|直播|视频|短视频|商品|销量|国家|地区|年龄|性别)$/i.test(label)) continue;
      pairs.push(`${label} ${match[2]}%`);
    }
    return [...new Set(pairs)].slice(0, limit);
  };

  const extractHashtagPairs = (text, limit = 5) => {
    const pairs = [];
    const pattern = /(#[-\w\u4e00-\u9fa5]+)\s+([\d.]+)%/g;
    let match;
    while ((match = pattern.exec(String(text || ""))) && pairs.length < limit) {
      pairs.push(`${match[1]} ${match[2]}%`);
    }
    return [...new Set(pairs)].slice(0, limit);
  };

  const extractRegionPairs = (text, limit = 5) => {
    const pairs = [];
    const normalized = String(text || "").replace(/\s+/g, " ");
    const pattern = /([A-Z][A-Z\s]{2,40})\s+([\d.]+)%/g;
    let match;
    while ((match = pattern.exec(normalized)) && pairs.length < limit) {
      const region = match[1].trim();
      if (!/^(COUNTRY|REGION)$/i.test(region)) pairs.push(`${region} ${match[2]}%`);
    }
    return [...new Set(pairs)].slice(0, limit);
  };

  const extractProductNames = (text, limit = 10) => {
    const lines = toTextLines(text);
    const start = Math.max(
      lines.findIndex((line) => /商品\s+商品价格/.test(line)),
      lines.findIndex((line) => line === "商品")
    );
    const candidates = (start >= 0 ? lines.slice(start + 1) : lines)
      .map((line) => line.trim())
      .filter((line) => line && !/^(商品价格|带货销量|带货销售额|上架时间|佣金比例|所属店铺|操作|数据导出|近7天|近14天|近28天|近90天|全部|no|暂无数据)$/i.test(line))
      .filter((line) => !/^[$￥¥]?\d/.test(line))
      .filter((line) => !/^\d+$/.test(line))
      .filter((line) => line.length >= 3 && line.length <= 120);
    return [...new Set(candidates)].slice(0, limit);
  };

  const parseFastMossSecUid = () => {
    const match = location.pathname.match(/\/influencer\/detail\/([^/?#]+)/i);
    return match?.[1] || "";
  };

  const detectFastMossCountry = () => {
    const countryAlt = [...document.querySelectorAll("img[alt]")]
      .map((img) => img.getAttribute("alt")?.trim())
      .find((alt) => alt && LOCALE_COUNTRY[alt.toUpperCase()] || /united states|usa|美国/i.test(alt || ""));
    if (/united states|usa/i.test(countryAlt || "")) return "美国";
    return countryAlt || "";
  };

  const extractFastMoss = (snapshots = {}) => {
    const currentText = snapshots.当前 || document.body?.innerText || "";
    const coreText = snapshots["核心数据"] || currentText;
    const fanText = snapshots["粉丝分析"] || currentText;
    const videoText = snapshots["视频分析"] || currentText;
    const commerceText = snapshots["带货分析"] || currentText;
    const productText = snapshots["带货商品列表"] || currentText;
    const lines = toTextLines([currentText, coreText, fanText, videoText, commerceText, productText].join("\n"));
    const coreLines = toTextLines(coreText);
    const secUid = parseFastMossSecUid();
    const idIndex = lines.findIndex((line) => /^ID[:：]?$/i.test(line) || /^ID[:：]/i.test(line));
    const handle = readLineValueAfter(["ID"], 2, lines) || (idIndex >= 0 ? lines[idIndex + 1] : "");
    const name = cleanTitle(readMeta('meta[property="og:title"]') || document.title).replace(/（.*$/, "").trim() || lines.find((line, index) => index > 50 && index < 90 && !/^#|ID[:：]?$/i.test(line)) || "";
    const category = lines[idIndex + 2] && !/橱窗|带货|MCN|首条/i.test(lines[idIndex + 2]) ? lines[idIndex + 2] : "";
    const commerceCategories = readLineValueAfter(["带货倾向"], 3, lines)
      .split(/[、,，/]/)
      .map((item) => item.trim())
      .filter(Boolean);
    const profileUrl = findFirstUrl([/tiktok\.com\/@/i]) || (handle ? `https://www.tiktok.com/@${handle.replace(/^@/, "")}` : "");
    const gmv28d = extractMetricFromText(commerceText, ["总 Gmv", "总 GMV"]) || readNumberAfter(["总 Gmv", "总 GMV"], 5, toTextLines(commerceText));
    const sales28d = extractMetricFromText(coreText, ["带货销量"]) ||
      extractMetricFromText(commerceText, ["带货总销量"]) ||
      readNumberAfter(["带货销量", "带货总销量"], 5, [...coreLines, ...toTextLines(commerceText)]);
    const avgOrderValue = gmv28d && sales28d ? Number((gmv28d / sales28d).toFixed(2)) : null;
    const genderBlock = fanText.match(/性别[\s\S]{0,500}/)?.[0] || findTextAroundLabel(["性别", "Gender"], 500);
    const ageBlock = fanText.match(/年龄[\s\S]{0,700}/)?.[0] || findTextAroundLabel(["年龄", "Age"], 700);
    const femalePct = (genderBlock.match(/(?:女性|Female)[^\d]{0,24}([\d.]+)%/i) || genderBlock.match(/([\d.]+)%[^\n]{0,24}(?:女性|Female)/i) || [])[1];
    const ageTop = (ageBlock.match(/(\d{1,2}\s*-\s*\d{1,2})\s+([\d.]+)%/) || [])[0] || (ageBlock.match(/\d{1,2}\s*-\s*\d{1,2}|\d{2}\+/) || [""])[0];
    const regionBlock = fanText.match(/国家\s*\/\s*地区[\s\S]{0,800}/)?.[0] || "";
    const hashtagBlock = videoText.match(/前5的主题标签[\s\S]{0,800}/)?.[0] || videoText.match(/视频标签分析[\s\S]{0,1200}/)?.[0] || "";
    const categoryBlock = commerceText.match(/销量最高品类[\s\S]{0,700}/)?.[0] || commerceText.match(/推广最多品类[\s\S]{0,700}/)?.[0] || "";
    const productBlock = productText.match(/商品\s+商品价格[\s\S]{0,1200}/)?.[0] || productText.match(/带货商品列表[\s\S]{0,1200}/)?.[0] || "";

    return {
      platform: "TikTok",
      platform_code: PLATFORM_CODES.tiktok,
      platform_account: handle ? `@${handle.replace(/^@/, "")}` : "",
      platform_native_id: secUid,
      fastmoss_sec_uid: secUid,
      fastmoss_profile_url: normalizeUrl(location.href),
      profile_url: normalizeUrl(profileUrl || location.href),
      display_name: name,
      creator_category: category,
      country: detectFastMossCountry(),
      language: readLineValueAfter(["语言", "Language"], 2, lines),
      shop_window_status: readLineValueAfter(["橱窗状态"], 3, lines).replace(/^[:：]/, "").trim(),
      commerce_intent: commerceCategories.join(", "),
      commerce_categories: extractPercentPairs(categoryBlock, { limit: 5 }).map((item) => item.replace(/^销量最高品类\s*/i, "")),
      mcn_name: readLineValueAfter(["MCN 签约", "MCN签约"], 3, lines),
      first_video_date: readLineValueAfter(["首条视频时间"], 3, lines),
      follower_count: readNumberAfter(["粉丝数"], 3, lines),
      avg_views_30d: readNumberAfter(["平均播放量"], 4, lines),
      engagement_rate: findPercentAfterLabel(["平均互动率", "互动率"]),
      sales_28d: sales28d,
      avg_order_value: avgOrderValue,
      commerce_products: extractProductNames(productBlock, 10),
      audience_female_pct: femalePct ? Number(femalePct) : null,
      fastmoss_audience_regions: extractRegionPairs(regionBlock, 5),
      fastmoss_audience_age: ageTop,
      top_hashtags: extractHashtagPairs(hashtagBlock, 5),
      source: "Chrome插件-FastMoss",
      source_url: normalizeUrl(location.href)
    };
  };

  const minimalProfile = (reason = "") => {
    const platformKey = getPlatform();
    const platformCode = inferPlatformCode(platformKey);
    const account = inferAccountFromUrl();
    const stablePart = account || normalizeUrl(location.href);
    const talentId = `${platformCode}_${String(stablePart)
      .replace(/^@/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80)}`;

    const nativeId = extractNativeId(platformKey, account);
    return {
      captured_at: new Date().toISOString(),
      source: "Chrome插件-基础抓取",
      source_url: normalizeUrl(location.href),
      profile_url: normalizeUrl(location.href),
      platform: inferPlatformName(platformKey),
      platform_code: platformCode,
      platform_account: account,
      platform_native_id: nativeId,
      display_name: cleanTitle(readMeta('meta[property="og:title"]') || document.title) || account,
      avatar_url: readMeta('meta[property="og:image"]'),
      email: findEmail(),
      contact: findEmail(),
      country: detectCountry(),
      language: detectLanguage(),
      creator_type: "",
      creator_category: inferCreatorCategory(readMeta('meta[name="description"]', 'meta[property="og:description"]'), document.title),
      nox_profile_url: buildNoxProfileUrl(platformKey, nativeId),
      entity_id: "",
      talent_id: talentId,
      extraction_warning: reason
    };
  };

  const extractTikTok = () => {
    const path = location.pathname.split("/").filter(Boolean);
    const handle = (path.find((part) => part.startsWith("@")) || path[0] || "").replace(/^@/, "");
    const description = readMeta('meta[name="description"]', 'meta[property="og:description"]');
    const title = readMeta('meta[property="og:title"]') || document.title;
    const followerMatch = description.match(/([\d.,]+\s*[KMB万亿]?)\s*(?:位|名)?\s*(?:Followers?|粉丝|粉絲|fans)/i);

    const account = handle ? `@${handle}` : "";
    const user = findTikTokUser(handle);
    const nativeId = user?.id || extractNativeId("tiktok", account);
    return {
      platform: "TikTok",
      platform_code: PLATFORM_CODES.tiktok,
      platform_account: account,
      platform_native_id: nativeId,
      fastmoss_sec_uid: nativeId,
      fastmoss_profile_url: buildFastMossProfileUrl(nativeId),
      sec_uid: user?.secUid || "",
      display_name: cleanTitle(title) || (handle ? `@${handle}` : ""),
      bio: description,
      creator_category: inferCreatorCategory(description, title),
      follower_count: parseCompactNumber(followerMatch?.[1]),
      avatar_url: readMeta('meta[property="og:image"]'),
      nox_profile_url: buildNoxProfileUrl("tiktok", nativeId)
    };
  };

  const extractInstagram = () => {
    const handle = (location.pathname.split("/").filter(Boolean)[0] || "").replace(/^@/, "");
    const description = readMeta('meta[name="description"]', 'meta[property="og:description"]');
    const title = readMeta('meta[property="og:title"]') || document.title;
    const followerMatch = description.match(/([\d.,]+\s*[KMB万亿]?)\s*(?:位|名)?\s*(?:Followers?|粉丝|粉絲|fans)/i);

    const account = handle ? `@${handle}` : "";
    const nativeId = extractNativeId("instagram", account);
    return {
      platform: "Instagram",
      platform_code: PLATFORM_CODES.instagram,
      platform_account: account,
      platform_native_id: nativeId,
      display_name: cleanTitle(title) || (handle ? `@${handle}` : ""),
      bio: description,
      creator_category: inferCreatorCategory(description, title),
      follower_count: parseCompactNumber(followerMatch?.[1]),
      avatar_url: readMeta('meta[property="og:image"]'),
      nox_profile_url: buildNoxProfileUrl("instagram", nativeId)
    };
  };

  const extractYouTube = () => {
    const path = location.pathname.split("/").filter(Boolean);
    const handle = path[0]?.startsWith("@") ? path[0] : "";
    const channelId = path[0] === "channel" ? path[1] : "";
    const canonical = readMeta('link[rel="canonical"]');
    const title = readMeta('meta[property="og:title"]') || document.title;
    const description = readMeta('meta[name="description"]', 'meta[property="og:description"]');
    const body = document.body?.innerText || "";
    const subscriberMatch = body.match(/([\d.,]+\s*[KMB万亿]?)\s*(?:位|名)?\s*(?:subscribers?|订阅者|訂閱者|订阅|訂閱)/i);

    return {
      platform: "YouTube",
      platform_code: PLATFORM_CODES.youtube,
      platform_account: handle || (channelId ? `channel/${channelId}` : ""),
      platform_native_id: channelId || "",
      display_name: cleanTitle(title),
      bio: description,
      creator_category: inferCreatorCategory(description, title),
      follower_count: parseCompactNumber(subscriberMatch?.[1]),
      avatar_url: readMeta('meta[property="og:image"]'),
      canonical_url: canonical,
      nox_profile_url: buildNoxProfileUrl("youtube", channelId)
    };
  };

  const extractFacebook = () => {
    const account = inferAccountFromUrl();
    const nativeId = extractNativeId("facebook", account);
    const title = readMeta('meta[property="og:title"]') || document.title;
    const description = readMeta('meta[name="description"]', 'meta[property="og:description"]');

    return {
      platform: "Facebook",
      platform_code: PLATFORM_CODES.facebook,
      platform_account: account,
      platform_native_id: nativeId,
      display_name: cleanTitle(title) || account,
      bio: description,
      creator_category: inferCreatorCategory(description, title),
      avatar_url: readMeta('meta[property="og:image"]'),
      nox_profile_url: buildNoxProfileUrl("facebook", nativeId)
    };
  };

  const extractNox = (snapshots = {}) => {
    const text = snapshots.当前 || document.body?.innerText || "";
    const overviewText = snapshots["数据总览"] || text;
    const audienceText = snapshots["受众数据"] || text;
    const contentText = snapshots["内容数据"] || text;
    const brandText = snapshots["品牌数据"] || text;
    const overviewLines = toTextLines(overviewText);
    const brandLines = toTextLines(brandText);
    const noxPlatformKey = getNoxPlatformKeyFromPath();
    const noxNativeId = getNoxNativeIdFromPath();
    const noxPlatformPatterns = {
      tiktok: [/tiktok\.com\/@/i],
      instagram: [/instagram\.com\/[^/?#]+/i],
      youtube: [/youtube\.com\/(channel|@|c\/|user\/)/i],
      facebook: [/facebook\.com\/[^/?#]+/i]
    };
    const fallbackPatterns = [
      /tiktok\.com\/@/i,
      /instagram\.com\/[^/?#]+/i,
      /youtube\.com\/(channel|@|c\/|user\/)/i,
      /facebook\.com\/[^/?#]+/i
    ];
    const profileUrl = findFirstUrl(noxPlatformPatterns[noxPlatformKey] || []) ||
      (noxPlatformKey ? "" : findFirstUrl(fallbackPatterns));
    const platformFromPath = {
      tiktok: "TikTok",
      instagram: "Instagram",
      youtube: "YouTube",
      facebook: "Facebook"
    }[noxPlatformKey] || "";
    const detectedPlatform = platformFromPath || (profileUrl.includes("tiktok.com")
      ? "TikTok"
      : profileUrl.includes("instagram.com")
        ? "Instagram"
        : profileUrl.includes("youtube.com")
          ? "YouTube"
          : profileUrl.includes("facebook.com")
            ? "Facebook"
            : "Nox");
    const platformCode = detectedPlatform === "TikTok"
      ? "TT"
      : detectedPlatform === "Instagram"
        ? "IG"
        : detectedPlatform === "YouTube"
          ? "YT"
          : detectedPlatform === "Facebook"
          ? "FB"
          : PLATFORM_CODES.nox;
    const platformAccount = extractAccountFromProfileUrl(profileUrl, detectedPlatform) ||
      (detectedPlatform === "YouTube" && noxNativeId ? `channel/${noxNativeId}` : "");
    const title = readMeta('meta[property="og:title"]') || document.title;
    const geoBlock = textBlockAfter(audienceText, ["受众地区", "受众区域", "最多受众区域", "粉丝地区", "Audience Geography", "Top Countries"], 1200);
    const genderBlock = textBlockAfter(audienceText, ["最多受众性别", "受众性别", "Audience Gender", "Gender"], 450);
    const ageBlock = textBlockAfter(audienceText, ["最多受众年龄", "受众年龄", "Audience Age", "Age"], 700);
    const representative = findRepresentativeContent();
    const categoryBlock = textBlockAfter(contentText, ["网红类别", "达人类别", "频道分类", "内容类别", "分类", "Creator Category", "Influencer Category"], 900);
    const interestBlock = textBlockAfter(contentText, ["内容分布", "兴趣点", "内容与兴趣", "Interests", "Content Distribution", "Categories"], 1600)
      .split(/品牌数据|提及品牌|Mentioned Brands|Brands/i)[0];
    const brandBlock = textBlockAfter(brandText, ["提及品牌", "提及的品牌", "品牌排名", "品牌", "Mentioned Brands", "Brands"], 1600);
    const interests = extractNoxPercentRows(interestBlock, { limit: 12 });
    // 达人类别 is rendered as DOM tags near the creator name (e.g. 生活家居 / 生活方式),
    // not inside the 内容数据 tab text — read them directly.
    const categoryTags = [...document.querySelectorAll(".tag-container .tag-item, .tag-list .tag-item")]
      .map((node) => normalizeText(node.innerText || node.textContent))
      .filter((tag) => tag && tag.length <= 12 && !/^(美国|中国|英国|英语|中文|日本|韩国)$/.test(tag))
      .slice(0, 3);
    const country = findLabeledValue(["国家", "地区", "Country"], 80)
      .replace(/^(国家|地区|Country)\s*[:：]?/i, "")
      .trim();
    const language = findLabeledValue(["语言", "Language"], 80)
      .replace(/^(语言|Language)\s*[:：]?/i, "")
      .trim();
    const cooperationPrice = readNoxLabeledNumber(brandLines, ["平均合作价格", "合作价格", "Avg. Sponsored Price", "Average Collaboration Price"]);
    const cooperationDetails = [
      readLineValueAfter(["价格范围", "Price Range"], 3, brandLines) ? `价格范围：${readLineValueAfter(["价格范围", "Price Range"], 3, brandLines)}` : "",
      readNoxLabeledNumber(brandLines, ["广告平均观看量", "Sponsored Avg. Views", "Ad Avg. Views"]) !== null ? `广告平均观看量：${readNoxLabeledNumber(brandLines, ["广告平均观看量", "Sponsored Avg. Views", "Ad Avg. Views"])}` : "",
      readNoxLabeledPercent(brandLines, ["广告平均互动率", "Sponsored Engagement Rate", "Ad Engagement Rate"]) !== null ? `广告平均互动率：${readNoxLabeledPercent(brandLines, ["广告平均互动率", "Sponsored Engagement Rate", "Ad Engagement Rate"])}%` : "",
      readLineValueAfter(["广告发布数量", "Sponsored Posts", "Ad Posts"], 3, brandLines) ? `广告发布数量：${readLineValueAfter(["广告发布数量", "Sponsored Posts", "Ad Posts"], 3, brandLines)}` : ""
    ].filter(Boolean).join("；");

    return {
      platform: detectedPlatform,
      platform_code: platformCode,
      platform_account: platformAccount,
      platform_native_id: noxNativeId,
      profile_url: profileUrl || normalizeUrl(location.href),
      display_name: cleanTitle(title),
      follower_count: readNoxLabeledNumber(overviewLines, ["粉丝量", "粉丝数", "Followers", "Subscribers", "订阅者"]) ||
        readNumberAfter(["粉丝量", "粉丝数", "Followers", "Subscribers", "订阅者"], 4, overviewLines),
      country,
      language,
      avg_views_30d: readNoxLabeledNumber(overviewLines, ["近10条内容平均观看量", "平均观看量", "平均观看"]) ||
        readNumberAfter(["近10条内容平均观看量", "平均观看量", "平均观看", "Avg. Views", "Average Views"], 5, overviewLines),
      engagement_rate: readNoxLabeledPercent(overviewLines, ["互动率", "平均互动率", "Engagement Rate"]) ||
        firstPercentInBlock(overviewText, ["互动率", "Engagement Rate", "Engagement", "ER"], 180),
      content_count: readNoxLabeledNumber(overviewLines, ["内容数量", "视频数量", "作品数", "发布数", "帖子数"]) ||
        readNumberAfter(["内容数量", "视频数量", "作品数", "Posts", "Videos", "Uploads"], 4, overviewLines),
      // 粉丝可信度 lives under 频道质量 on 数据总览 on newer Nox, under 受众数据 on older — check both.
      audience_credibility: Number(([overviewText, audienceText].join("\n").match(/粉丝可信度[\s\S]{0,120}?([\d.]+)\s*\/\s*5/i) || [])[1] || "") || firstNumberInBlock(overviewText, ["粉丝可信度", "Audience Credibility", "Credibility"], 160) || firstNumberInBlock(audienceText, ["粉丝可信度", "Audience Credibility", "Credibility"], 160),
      audience_top_countries: parseNoxAudienceRegions(geoBlock, 3),
      audience_top_gender: parseNoxTopGender(genderBlock),
      audience_top_age: parseNoxTopAge(ageBlock),
      content_interests: interests,
      creator_category: categoryTags.length ? categoryTags.join(" / ") : extractNoxCreatorCategory(categoryBlock, interests),
      mentioned_brands_top10: extractNoxPercentRows(brandBlock, { limit: 10 }),
      cooperation_price: cooperationPrice,
      cooperation_details: cooperationDetails,
      representative_content: representative.content,
      representative_likes: representative.likes,
      representative_comments: representative.comments,
      comment_direction: inferCommentDirection(),
      nox_profile_url: normalizeUrl(location.href),
      source: "Chrome插件-Nox",
      raw_page_hint: text.slice(0, 500)
    };
  };

  const buildTalentId = (data) => {
    const stablePart = data.platform_native_id || data.platform_account || normalizeUrl(location.href);
    return `${data.platform_code || inferPlatformCode()}_${String(stablePart)
      .replace(/^@/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80)}`;
  };

  const extractProfile = async () => {
    const platformKey = getPlatform();
    const base = {
      captured_at: new Date().toISOString(),
      source: "Chrome插件",
      source_url: normalizeUrl(location.href),
      profile_url: normalizeUrl(location.href),
      avatar_url: readMeta('meta[property="og:image"]'),
      email: findEmail(),
      contact: findEmail(),
      country: detectCountry(),
      language: detectLanguage(),
      creator_type: "",
      entity_id: ""
    };

    let data;
    if (platformKey === "nox") data = extractNox(await collectNoxSnapshots());
    else if (platformKey === "fastmoss") data = extractFastMoss(await collectFastMossSnapshots());
    else if (platformKey === "tiktok") data = extractTikTok();
    else if (platformKey === "instagram") data = extractInstagram();
    else if (platformKey === "youtube") data = extractYouTube();
    else if (platformKey === "facebook") data = extractFacebook();
    else data = { platform: "Unknown", platform_code: "WEB" };

    const merged = {
      ...base,
      ...data
    };
    const representative = findRepresentativeContent();
    if (representative.fromCurrentContentPage) {
      merged.content_url = representative.content;
      merged.representative_content = representative.content;
      merged.representative_title = representative.title;
      merged.representative_likes = representative.likes;
      merged.representative_comments = representative.comments;
      merged.comment_direction = inferCommentDirection();
    }
    merged.profile_url = normalizeUrl(merged.canonical_url || merged.profile_url);
    merged.talent_id = buildTalentId(merged);
    return merged;
  };

  const safeExtractProfile = async () => {
    try {
      return await extractProfile();
    } catch (error) {
      return minimalProfile(error.message || String(error));
    }
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "FANY_EXTRACT_TALENT") return false;
    safeExtractProfile()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
    return true;
  });

  const injectCaptureButton = () => {
    if (document.getElementById("fany-capture-button")) return;
    const showToast = (message, isError = false) => {
      document.getElementById("fany-capture-toast")?.remove();
      const toast = document.createElement("div");
      toast.id = "fany-capture-toast";
      toast.textContent = message;
      toast.style.cssText = [
        "position:fixed",
        "right:18px",
        "bottom:66px",
        "z-index:2147483647",
        "max-width:280px",
        "padding:10px 12px",
        "border-radius:6px",
        `background:${isError ? "#b42318" : "#111827"}`,
        "color:#fff",
        "font:500 13px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        "box-shadow:0 8px 24px rgba(17,24,39,.24)",
        "white-space:normal"
      ].join(";");
      document.documentElement.appendChild(toast);
      window.setTimeout(() => toast.remove(), isError ? 6000 : 4000);
    };

    const button = document.createElement("button");
    button.id = "fany-capture-button";
    button.textContent = "采集达人信息";
    button.type = "button";
    button.style.cssText = [
      "position:fixed",
      "right:18px",
      "bottom:18px",
      "z-index:2147483647",
      "height:40px",
      "padding:0 14px",
      "border:0",
      "border-radius:6px",
      "background:#1463ff",
      "color:#fff",
      "font:600 14px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "box-shadow:0 8px 24px rgba(20,99,255,.28)",
      "cursor:pointer",
      "pointer-events:auto"
    ].join(";");

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.disabled = true;
      button.textContent = "正在抓取...";
      button.style.opacity = ".86";
      try {
        const data = await safeExtractProfile();
        await chrome.storage.local.set({ pendingTalent: data });
        button.textContent = "已抓取";
        showToast("已抓取当前达人，正在打开右侧采集面板。");
        chrome.runtime.sendMessage({ type: "FANY_OPEN_POPUP" }, (response) => {
          if (chrome.runtime.lastError || !response?.ok) {
            button.textContent = "已抓取，点插件打开";
            return;
          }
          button.textContent = "面板已打开";
        });
      } catch (error) {
        const message = error.message || String(error);
        const isInvalidated = /Extension context invalidated|context invalidated/i.test(message);
        button.textContent = "抓取失败";
        button.title = message;
        showToast(isInvalidated ? "插件刚更新过，请刷新当前达人页面后再点一次。" : `抓取失败：${message}`, true);
      } finally {
        window.setTimeout(() => {
          button.disabled = false;
          button.style.opacity = "1";
          if (button.textContent !== "采集达人信息") button.textContent = "采集达人信息";
        }, 5000);
      }
    });

    document.documentElement.appendChild(button);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectCaptureButton, { once: true });
  } else {
    injectCaptureButton();
  }
})();
