const FIELD_IDS = [
  "talent_id",
  "target_table",
  "creator_type",
  "review_status",
  "historical_cooperation_result",
  "creator_category",
  "channel_ownership",
  "platform",
  "display_name",
  "platform_account",
  "follower_count",
  "profile_url",
  "nox_profile_url",
  "country",
  "language",
  "email",
  "contact",
  "bio",
  "avg_views_30d",
  "engagement_rate",
  "content_count",
  "audience_credibility",
  "audience_top_countries",
  "audience_top_gender",
  "audience_top_age",
  "content_interests",
  "mentioned_brands_top10",
  "fastmoss_sec_uid",
  "fastmoss_profile_url",
  "shop_window_status",
  "commerce_intent",
  "mcn_name",
  "first_video_date",
  "sales_28d",
  "avg_order_value",
  "commerce_categories",
  "commerce_products",
  "audience_female_pct",
  "fastmoss_audience_regions",
  "fastmoss_audience_age",
  "top_hashtags",
  "representative_content",
  "representative_likes",
  "representative_comments",
  "comment_direction"
];

const FIELD_LABELS = {
  talent_id: "creator_id",
  target_table: "目标表",
  creator_type: "达人类型",
  review_status: "审核状态",
  historical_cooperation_result: "历史合作结果",
  creator_category: "达人类别",
  channel_ownership: "渠道归属",
  platform: "平台",
  display_name: "昵称",
  platform_account: "账号",
  follower_count: "粉丝数",
  profile_url: "主页链接",
  nox_profile_url: "Nox 达人主页链接",
  country: "国家",
  language: "语言",
  email: "邮箱",
  contact: "联系方式",
  bio: "简介",
  avg_views_30d: "近10条内容平均观看量",
  engagement_rate: "互动率%",
  content_count: "内容数量",
  audience_credibility: "粉丝可信度",
  audience_top_countries: "Top3受众国家",
  audience_top_gender: "最多受众性别",
  audience_top_age: "最多受众年龄",
  content_interests: "内容分布-兴趣点",
  mentioned_brands_top10: "提及前十个品牌",
  fastmoss_sec_uid: "TT原生ID(secUid)",
  fastmoss_profile_url: "FastMoss 链接",
  shop_window_status: "橱窗状态",
  commerce_intent: "带货倾向",
  mcn_name: "MCN签约",
  first_video_date: "首条视频时间",
  sales_28d: "带货销量（近28天）",
  avg_order_value: "客单价",
  commerce_categories: "带货品类",
  commerce_products: "带货商品",
  audience_female_pct: "粉丝数据，女性占比",
  fastmoss_audience_regions: "国家地区",
  fastmoss_audience_age: "年龄",
  top_hashtags: "前5主题标签",
  representative_content: "内容链接",
  representative_likes: "曝光",
  representative_comments: "评论数",
  comment_direction: "评论导向"
};

const REVIEW_GROUPS = [
  { title: "基础信息", fields: ["talent_id", "target_table", "platform", "display_name", "platform_account", "follower_count", "profile_url", "email", "contact", "bio"] },
  { title: "代表内容", fields: ["representative_content", "representative_likes", "representative_comments", "comment_direction"] },
  { title: "Nox 信息", fields: ["nox_profile_url", "avg_views_30d", "engagement_rate", "content_count", "audience_credibility", "country", "language", "creator_category", "audience_top_countries", "audience_top_gender", "audience_top_age", "content_interests", "mentioned_brands_top10"] },
  { title: "FastMoss 数据", fields: ["fastmoss_sec_uid", "fastmoss_profile_url", "country", "language", "shop_window_status", "commerce_intent", "mcn_name", "first_video_date", "sales_28d", "commerce_categories", "commerce_products", "avg_order_value", "audience_female_pct", "fastmoss_audience_regions", "fastmoss_audience_age", "top_hashtags"] },
  { title: "钉钉字段", fields: ["creator_type", "review_status", "historical_cooperation_result", "channel_ownership"] }
];

const $ = (id) => document.getElementById(id);
const checkboxListFields = new Set(["comment_direction", "channel_ownership"]);
const workflow = globalThis.FanyCaptureWorkflow;
const CURRENT_TALENT_KEY = "currentTalentRecord";
let currentCaptureSource = "Chrome插件";
let currentSourceUrl = "";
let targetTableManuallyChanged = false;

const setStatus = (message, isError = false) => {
  $("status").textContent = message;
  $("status").classList.toggle("error", isError);
};

const setLog = (value) => {
  $("log").hidden = false;
  $("log").textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
};

const setActiveTab = (tabName) => {
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === tabName);
  });
  if (tabName === "confirm") renderReviewSummary();
};

const stageNames = {
  base: "基础信息",
  representative: "代表内容",
  nox: "Nox信息"
};

const targetTableNames = {
  general: "1.1_达人数据库_YT_IG_FB",
  tk: "1.2_达人数据库_TK"
};

const updateCompletionUi = (record = collectForm()) => {
  const targetTable = record.target_table || workflow.inferTargetTable(record);
  const targetTableName = targetTableNames[targetTable] || "未判断";
  const status = workflow.getCompletionStatus(record);
  $("summaryName").textContent = record.display_name || record.platform_account || record.talent_id || "未采集";
  $("targetTableName").textContent = targetTableName;
  $("dotBase").classList.toggle("done", status.stages.base);
  $("dotRepresentative").classList.toggle("done", status.stages.representative);
  $("dotNox").classList.toggle("done", status.stages.nox);
  $("submit").disabled = !status.ready;

  if (status.ready) {
    $("readyTitle").textContent = "信息已完整，可以加入达人库";
    $("readyHint").textContent = `确认无误后写入：${targetTableName}。`;
  } else {
    const missing = status.missingStages.map((stage) => stageNames[stage]).join("、");
    $("readyTitle").textContent = "还不能加入达人库";
    $("readyHint").textContent = `目标表：${targetTableName}。还缺：${missing || "必要信息"}。`;
  }
  renderReviewSummary(record);
  return status;
};

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const formatReviewValue = (value) => {
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined || value === "") return "未填写";
  return String(value);
};

const renderReviewSummary = (record = collectForm()) => {
  const container = $("reviewSummary");
  if (!container) return;
  container.innerHTML = REVIEW_GROUPS.map((group) => {
    const rows = group.fields.map((field) => `
      <div class="review-row">
        <span class="review-label">${escapeHtml(FIELD_LABELS[field] || field)}</span>
        <span class="review-value">${escapeHtml(formatReviewValue(record[field]))}</span>
      </div>
    `).join("");
    return `<section class="review-group"><h3>${escapeHtml(group.title)}</h3>${rows}</section>`;
  }).join("");
};

const getConfig = async () => {
  return chrome.storage.sync.get(["endpointUrl", "authToken", "memberToken", "fieldMap"]);
};

const getApiUrl = (config, pathname) => {
  const raw = (config.endpointUrl || "http://localhost:8791/api/talents/upsert").trim();
  const url = new URL(raw);
  if ((url.hostname === "localhost" || url.hostname === "127.0.0.1") && (url.port === "8787" || url.port === "8790")) {
    url.port = "8791";
  }
  url.pathname = pathname;
  url.search = "";
  url.hash = "";
  return url;
};

const buildHeaders = (config, includeJson = false) => {
  const headers = {};
  if (includeJson) headers["content-type"] = "application/json";
  if (config.authToken) headers.authorization = `Bearer ${config.authToken}`;
  if (config.memberToken) headers["x-fany-member-token"] = config.memberToken;
  return headers;
};

const normalizeHandle = (value) => String(value || "").trim().replace(/^@/, "").toLowerCase();

const normalizeProfileUrl = (value) => {
  try {
    const url = new URL(String(value || "").trim());
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return String(value || "").trim();
  }
};

const isSameProfileContext = (record, tabUrl = "") => {
  const normalizedTabUrl = normalizeProfileUrl(tabUrl).toLowerCase();
  const profileUrl = normalizeProfileUrl(record?.profile_url).toLowerCase();
  const sourceUrl = normalizeProfileUrl(record?.source_url).toLowerCase();
  if (!normalizedTabUrl || (!profileUrl && !sourceUrl)) return true;
  return [profileUrl, sourceUrl].filter(Boolean).some((url) => normalizedTabUrl === url || normalizedTabUrl.startsWith(`${url}/`) || url.startsWith(`${normalizedTabUrl}/`));
};

const buildDedupeKey = (record) => {
  const platform = String(record?.platform || "").trim().toLowerCase();
  const handle = normalizeHandle(record?.platform_account);
  if (platform && handle) return `${platform}:${handle}`;
  return normalizeProfileUrl(record?.profile_url).toLowerCase();
};

const buildNoxSearchUrl = (record) => {
  const platform = String(record?.platform || "").trim();
  const handle = normalizeHandle(record?.platform_account);
  const profileUrl = normalizeProfileUrl(record?.profile_url);
  const query = [platform, handle || profileUrl].filter(Boolean).join(" ");
  return `https://cn.noxinfluencer.com/search?keyword=${encodeURIComponent(query)}`;
};

const buildFastMossSearchUrl = (record) => {
  const handle = normalizeHandle(record?.platform_account);
  const profileUrl = normalizeProfileUrl(record?.profile_url);
  const query = handle || profileUrl;
  return `https://www.fastmoss.com/zh/influencer?keyword=${encodeURIComponent(query)}`;
};

const buildFastMossDetailUrl = (record) => {
  const secUid = String(record?.fastmoss_sec_uid || record?.platform_native_id || "").trim();
  if (secUid && /^\d{8,}$/.test(secUid)) {
    return `https://www.fastmoss.com/zh/influencer/detail/${encodeURIComponent(secUid)}`;
  }
  return "";
};

const isNoxRecord = (record) => /noxinfluencer\.com/i.test(record?.source_url || record?.profile_url || "");

const getCheckboxGroupOptions = (id) => [...document.querySelectorAll(`input[type="checkbox"][data-field="${id}"]`)];

const getCheckboxGroupValues = (id) => getCheckboxGroupOptions(id)
  .filter((input) => input.checked)
  .map((input) => input.value.trim())
  .filter(Boolean);

const syncCheckboxHiddenValue = (id) => {
  const node = $(id);
  if (node) node.value = getCheckboxGroupValues(id).join(", ");
};

const setCheckboxGroupValues = (id, value) => {
  const values = Array.isArray(value)
    ? value.map(String).map((item) => item.trim()).filter(Boolean)
    : String(value || "").split(/[,，、]/).map((item) => item.trim()).filter(Boolean);
  const options = getCheckboxGroupOptions(id);
  const optionValues = new Set(options.map((input) => input.value));
  options.forEach((input) => {
    input.checked = values.includes(input.value);
  });
  const extraNode = $(`${id}_extra`);
  if (extraNode) extraNode.value = values.filter((item) => !optionValues.has(item)).join(", ");
  syncCheckboxHiddenValue(id);
};

const mergeNoxEnrichment = (profileRecord, noxRecord) => {
  return workflow.mergeLayer(profileRecord, noxRecord, "nox");
};

const getActiveTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
};

const canInjectIntoTab = (tab) => {
  return /^https?:\/\//i.test(tab?.url || "");
};

const requestTalentFromTab = async (tab) => {
  return chrome.tabs.sendMessage(tab.id, { type: "FANY_EXTRACT_TALENT" });
};

const injectExtractor = async (tab) => {
  if (!canInjectIntoTab(tab)) {
    throw new Error("当前页面不支持抓取，请打开达人主页后再试");
  }
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content-scripts/extractors.js"]
  });
};

const collectForm = () => {
  const payload = {};
  const numberFields = new Set([
    "avg_views_30d",
    "engagement_rate",
    "content_count",
    "audience_credibility",
    "follower_count",
    "sales_28d",
    "avg_order_value",
    "audience_female_pct",
    "representative_likes",
    "representative_comments"
  ]);
  const listFields = new Set(["audience_top_countries", "content_interests", "mentioned_brands_top10", "commerce_categories", "commerce_products", "fastmoss_audience_regions", "top_hashtags", "channel_ownership", "comment_direction"]);
  for (const id of FIELD_IDS) {
    const node = $(id);
    const value = checkboxListFields.has(id)
      ? getCheckboxGroupValues(id)
      : node.multiple
      ? [...node.selectedOptions].map((option) => option.value.trim()).filter(Boolean)
      : node.value.trim();
    if (numberFields.has(id)) {
      payload[id] = value ? Number(value) : null;
    } else if (listFields.has(id)) {
      payload[id] = Array.isArray(value) ? value : (value ? value.split(/[,，、]/).map((item) => item.trim()).filter(Boolean) : []);
    } else {
      payload[id] = value;
    }
  }
  const mergeExtra = (fieldId, extraId) => {
    const extraValues = String($(extraId)?.value || "")
      .split(/[,，、]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (!extraValues.length) return;
    const values = Array.isArray(payload[fieldId])
      ? payload[fieldId]
      : String(payload[fieldId] || "").split(/[,，、]/).map((item) => item.trim()).filter(Boolean);
    payload[fieldId] = [...new Set([...values, ...extraValues])];
  };
  mergeExtra("comment_direction", "comment_direction_extra");
  mergeExtra("channel_ownership", "channel_ownership_extra");
  if (!payload.talent_id && payload.profile_url) {
    payload.talent_id = payload.profile_url;
  }
  payload.fastmoss_profile_url = workflow.buildFastMossProfileUrl(payload);
  payload.source = currentCaptureSource || "Chrome插件";
  payload.source_url = currentSourceUrl || payload.profile_url;
  payload.captured_at = new Date().toISOString();
  return workflow.prepareRecordForSubmit(payload);
};

const renderAvatar = (url) => {
  const img = $("avatar_preview");
  const placeholder = $("avatar_placeholder");
  if (url) {
    img.src = url;
    img.hidden = false;
    placeholder.hidden = true;
  } else {
    img.hidden = true;
    img.removeAttribute("src");
    placeholder.hidden = false;
  }
};

const fillForm = (data) => {
  const record = workflow.prepareRecordForSubmit(data);
  currentCaptureSource = record.source || "Chrome插件";
  currentSourceUrl = record.source_url || record.profile_url || "";
  for (const id of FIELD_IDS) {
    const node = $(id);
    const value = record[id];
    if (checkboxListFields.has(id)) {
      setCheckboxGroupValues(id, value);
    } else if (node.multiple) {
      const values = Array.isArray(value) ? value.map(String) : String(value || "").split(/[,，、]/).map((item) => item.trim());
      [...node.options].forEach((option) => {
        option.selected = values.includes(option.value);
      });
      const extraNode = $(`${id}_extra`);
      if (extraNode) {
        const optionValues = new Set([...node.options].map((option) => option.value));
        extraNode.value = values.filter((item) => item && !optionValues.has(item)).join(", ");
      }
    } else if (Array.isArray(value)) node.value = value.join(", ");
    else if (value !== undefined && value !== null) node.value = value;
    else node.value = "";
  }
  // 联系方式默认回填邮箱，方便后续补全其他联系渠道。
  if (!$("contact").value && record.email) $("contact").value = record.email;
  updateCompletionUi(record);
};

const getPendingNoxProfile = async () => {
  const { pendingNoxProfile } = await chrome.storage.local.get("pendingNoxProfile");
  return pendingNoxProfile || null;
};

const setPendingNoxProfile = async (record) => {
  await chrome.storage.local.set({ pendingNoxProfile: record });
};

const clearPendingNoxProfile = async () => {
  await chrome.storage.local.remove("pendingNoxProfile");
};

const clearCurrentTalentRecord = async () => {
  currentCaptureSource = "Chrome插件";
  currentSourceUrl = "";
  targetTableManuallyChanged = false;
  await chrome.storage.local.remove([CURRENT_TALENT_KEY, "pendingTalent", "pendingNoxProfile"]);
  fillForm({});
  setStatus("已清空当前达人，请在当前页面重新采集");
};

const getCurrentTalentRecord = async () => {
  const { [CURRENT_TALENT_KEY]: record } = await chrome.storage.local.get(CURRENT_TALENT_KEY);
  return record || null;
};

const setCurrentTalentRecord = async (record) => {
  const nextRecord = workflow.prepareRecordForSubmit(record);
  await chrome.storage.local.set({ [CURRENT_TALENT_KEY]: nextRecord });
  return nextRecord;
};

const loadPendingTalent = async () => {
  const { pendingTalent } = await chrome.storage.local.get("pendingTalent");
  if (!pendingTalent) return false;
  const record = await setCurrentTalentRecord(workflow.mergeLayer({ target_table: "general" }, pendingTalent, "base"));
  fillForm(record);
  await chrome.storage.local.remove("pendingTalent");
  setStatus("已载入基础信息，后续代表内容和 Nox 会更新同一个 creator_id");
  return true;
};

const extractPageData = async () => {
  setStatus("正在读取当前页面...");
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error("没有找到当前标签页");

  let response;
  try {
    response = await requestTalentFromTab(tab);
  } catch (error) {
    if (!String(error?.message || error).includes("Receiving end does not exist")) {
      throw error;
    }
    setStatus("正在初始化当前页面抓取脚本...");
    await injectExtractor(tab);
    response = await requestTalentFromTab(tab);
  }

  if (!response?.ok) {
    throw new Error(response?.error || "当前页面不支持抓取，请确认在达人主页");
  }

  return response.data;
};

const checkIdentityMatch = (current, incoming) => {
  const curHandle = normalizeHandle(current?.platform_account);
  const incHandle = normalizeHandle(incoming?.platform_account);
  if (curHandle && incHandle && curHandle !== incHandle &&
      !curHandle.includes(incHandle) && !incHandle.includes(curHandle)) {
    return {
      ok: false,
      current: current?.display_name || curHandle,
      incoming: incoming?.display_name || incHandle
    };
  }
  return { ok: true };
};

const captureLayer = async (layer) => {
  const data = await extractPageData();
  if (layer === "fastmoss" && !/fastmoss\.com/i.test(data.source_url || data.fastmoss_profile_url || data.profile_url || "")) {
    throw new Error("请先打开 FastMoss 达人详情页，再点击“采集FastMoss”");
  }
  if (layer === "base" || layer === "fastmoss") targetTableManuallyChanged = false;
  let baseRecord = layer === "base" ? { target_table: $("target_table").value || "general" } : await getCurrentTalentRecord();
  if (!baseRecord && layer === "fastmoss") baseRecord = {};
  if (!baseRecord && layer === "nox") baseRecord = await getPendingNoxProfile();
  if (!baseRecord && layer !== "base") {
    throw new Error("请先在达人主页点击“采集基础信息”，再补代表内容或 Nox 信息");
  }

  // Guard against stapling a new creator's layer onto the previous creator's record,
  // which would silently keep the previous creator_id / 用户id.
  if (layer !== "base") {
    const identity = checkIdentityMatch(baseRecord, data);
    if (!identity.ok) {
      throw new Error(`身份不一致：当前面板是「${identity.current}」，但此页是「${identity.incoming}」。请先到该达人原生主页重新点「采集基础信息」，再补这一层，避免写到上一个 creator_id。`);
    }
  }

  const merged = workflow.mergeLayer(baseRecord || {}, data, layer);
  const saved = await setCurrentTalentRecord(merged);
  if (layer === "nox") await setPendingNoxProfile(saved);
  fillForm(saved);

  const statusText = {
    base: "基础信息已采集，当前 creator_id 将用于后续代表内容和 Nox 信息",
    representative: "代表内容已合并，将更新同一位达人",
    nox: "Nox 信息已合并，将更新同一位达人",
    fastmoss: "FastMoss 带货数据已合并，将更新同一位达人"
  }[layer] || "已采集";
  const completion = updateCompletionUi(saved);
  setStatus(completion.ready ? "信息已完整，可以加入达人库" : statusText);
  return saved;
};

const toCsv = (record) => {
  const headers = Object.keys(record);
  const escape = (value) => {
    const text = Array.isArray(value) ? value.join(",") : String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };
  return `${headers.join(",")}\n${headers.map((key) => escape(record[key])).join(",")}\n`;
};

const downloadCsv = () => {
  const record = collectForm();
  const blob = new Blob([toCsv(record)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${record.talent_id || "fany-talent"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus("CSV 已导出");
};

const openNox = async () => {
  const record = await setCurrentTalentRecord(collectForm());
  const directUrl = normalizeProfileUrl(record.nox_profile_url);
  const dedupeKey = buildDedupeKey(record);
  await setPendingNoxProfile({ ...record, dedupe_key: dedupeKey });
  if (directUrl && /noxinfluencer\.com/i.test(directUrl)) {
    await chrome.tabs.create({ url: directUrl, active: false });
    setStatus("已在后台打开 Nox 达人主页，当前弹窗会继续保留");
    return;
  }

  if (!dedupeKey) {
    setStatus("还没有可用的 Nox 直链，也缺少平台账号或主页链接", true);
    return;
  }
  const tab = await getActiveTab();
  const url = buildNoxSearchUrl(record);
  await chrome.tabs.create({ url, active: false, index: tab?.index ? tab.index + 1 : undefined });
  setStatus("暂未生成 Nox 直链，已在后台打开 Nox 搜索页");
};

const openFastMoss = async () => {
  const record = await setCurrentTalentRecord(collectForm());
  const directUrl = buildFastMossDetailUrl(record);
  if (directUrl) {
    await chrome.tabs.create({ url: directUrl, active: false });
    setStatus("已在后台打开 FastMoss 达人详情页");
    return;
  }

  const handle = normalizeHandle(record.platform_account);
  const profileUrl = normalizeProfileUrl(record.profile_url);
  if (!handle && !profileUrl) {
    setStatus("缺少 TikTok 账号或主页链接，无法打开 FastMoss 搜索", true);
    return;
  }

  const tab = await getActiveTab();
  await chrome.tabs.create({ url: buildFastMossSearchUrl(record), active: false, index: tab?.index ? tab.index + 1 : undefined });
  setStatus("已在后台打开 FastMoss 搜索页，请进入正确的达人详情页后再采集");
};

const checkExists = async (record, config) => {
  const endpoint = getApiUrl(config, "/api/talents/exists");
  endpoint.search = `?key=${encodeURIComponent(record.talent_id || record.profile_url)}&target_table=${encodeURIComponent(record.target_table || "")}`;

  const headers = buildHeaders(config);
  const response = await fetch(endpoint.toString(), { headers });
  if (!response.ok) return null;
  return response.json();
};

const loadMember = async () => {
  const config = await getConfig();
  if (!config.endpointUrl) return;
  const endpoint = getApiUrl(config, "/api/me");
  try {
    const response = await fetch(endpoint.toString(), { headers: buildHeaders(config) });
    const body = await response.json();
    if (response.ok && body.member?.name) {
      setStatus(`当前录入人：${body.member.name}`);
    }
  } catch {
    // Member display is helpful but not required for capture.
  }
};

const submit = async () => {
  const config = await getConfig();
  if (!config.endpointUrl) config.endpointUrl = "http://localhost:8791/api/talents/upsert";

  const record = collectForm();
  const completion = updateCompletionUi(record);
  if (!completion.ready) {
    const missing = completion.missingStages.map((stage) => stageNames[stage]).join("、");
    setStatus(`请先补齐：${missing}`, true);
    return;
  }

  const existing = await checkExists(record, config);
  if (existing?.exists) {
    const summary = existing.summary || {};
    const owner = summary.createdByName ? `，已被 ${summary.createdByName} 录入` : "";
    const at = summary.createdAt ? `（${summary.createdAt}）` : "";
    if (!confirm(`该达人可能已存在${owner}${at}，是否仅更新数据？`)) {
      setStatus("已取消提交");
      return;
    }
  }

  const payload = {
    record,
    fieldMap: config.fieldMap ? JSON.parse(config.fieldMap) : {}
  };

  const headers = buildHeaders(config, true);

  const response = await fetch(getApiUrl(config, "/api/talents/upsert").toString(), {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new Error(typeof body === "string" ? body : body.error || `提交失败：${response.status}`);
  }

  await setCurrentTalentRecord(record);
  if (record.source === "Chrome插件-Nox信息") {
    await clearPendingNoxProfile();
  }
  const submittedTarget = body?.targetTable || record.target_table;
  const submittedTableName = targetTableNames[submittedTarget] || submittedTarget || "达人库";
  const submittedSheet = body?.table?.sheetId ? `（sheetId: ${body.table.sheetId}）` : "";
  setStatus(`已提交到达人库：${submittedTableName}${submittedSheet}`);
  setLog(body);
};

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => setActiveTab(button.dataset.tab));
});

FIELD_IDS.forEach((id) => {
  $(id)?.addEventListener("input", () => {
    if (id === "target_table") targetTableManuallyChanged = true;
    else if (!targetTableManuallyChanged) $("target_table").value = workflow.inferTargetTable(collectForm());
    updateCompletionUi();
  });
  $(id)?.addEventListener("change", () => {
    if (id === "target_table") targetTableManuallyChanged = true;
    else if (!targetTableManuallyChanged) $("target_table").value = workflow.inferTargetTable(collectForm());
    updateCompletionUi();
  });
});

document.querySelectorAll('input[type="checkbox"][data-field]').forEach((input) => {
  input.addEventListener("change", () => {
    syncCheckboxHiddenValue(input.dataset.field);
    if (!targetTableManuallyChanged) $("target_table").value = workflow.inferTargetTable(collectForm());
    updateCompletionUi();
  });
});

["comment_direction_extra", "channel_ownership_extra"].forEach((id) => {
  $(id)?.addEventListener("input", () => updateCompletionUi());
  $(id)?.addEventListener("change", () => updateCompletionUi());
});

$("captureBase").addEventListener("click", async () => {
  try {
    await captureLayer("base");
  } catch (error) {
    setStatus(error.message, true);
  }
});

$("clearCurrent").addEventListener("click", async () => {
  try {
    await clearCurrentTalentRecord();
  } catch (error) {
    setStatus(error.message, true);
  }
});

$("captureRepresentative").addEventListener("click", async () => {
  try {
    await captureLayer("representative");
  } catch (error) {
    setStatus(error.message, true);
  }
});

$("captureNox").addEventListener("click", async () => {
  try {
    await captureLayer("nox");
  } catch (error) {
    setStatus(error.message, true);
  }
});

$("captureFastMoss").addEventListener("click", async () => {
  try {
    await captureLayer("fastmoss");
  } catch (error) {
    setStatus(error.message, true);
  }
});

$("openNox").addEventListener("click", async () => {
  try {
    await openNox();
  } catch (error) {
    setStatus(error.message, true);
    setLog(error.stack || error.message);
  }
});

$("openFastMoss").addEventListener("click", async () => {
  try {
    await openFastMoss();
  } catch (error) {
    setStatus(error.message, true);
    setLog(error.stack || error.message);
  }
});

$("exportCsv").addEventListener("click", downloadCsv);

$("submit").addEventListener("click", async () => {
  try {
    setStatus("正在提交...");
    await submit();
  } catch (error) {
    const message = /Failed to fetch/i.test(error.message)
      ? "连接后端失败：请确认设置接口为 http://localhost:8791/api/talents/upsert，且本地后端已启动"
      : error.message;
    setStatus(message, true);
    setLog(error.stack || error.message);
  }
});

$("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

loadPendingTalent().then((loaded) => {
  loadMember();
  if (loaded) return null;
  return getCurrentTalentRecord().then(async (record) => {
    if (record) {
      fillForm(record);
      const tab = await getActiveTab().catch(() => null);
      if (tab?.url && !isSameProfileContext(record, tab.url)) {
        setStatus("当前页面和已载入达人不一致，请点击“采集当前主页”覆盖为当前页面", true);
      } else {
        setStatus("已载入当前达人，可继续补代表内容或 Nox 信息");
      }
    } else {
      setStatus("请先在达人主页点击“采集基础信息”");
      updateCompletionUi({});
    }
    return null;
  });
}).catch((error) => {
  setStatus(error.message, true);
});
