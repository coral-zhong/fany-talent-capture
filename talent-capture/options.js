const DEFAULT_FIELD_MAP = {
  talent_id: "creator_id",
  creator_type: "达人类型",
  review_status: "审核状态",
  historical_cooperation_result: "历史合作结果",
  creator_category: "达人类别",
  channel_ownership: "渠道归属",
  display_name: "昵称",
  platform: "平台",
  platform_account: "账号",
  profile_url: "主页链接",
  nox_profile_url: "Nox达人主页链接",
  country: "国家",
  language: "语言",
  email: "联系方式",
  contact: "联系方式",
  bio: "达人简介",
  avg_views_30d: "近10条内容平均观看量",
  engagement_rate: "互动率%",
  content_count: "内容数量",
  audience_credibility: "粉丝可信度",
  audience_top_countries: "Top3受众国家",
  audience_top_gender: "最多受众性别",
  audience_top_age: "最多受众年龄",
  content_interests: "内容分布-兴趣点",
  mentioned_brands_top10: "互动率-提及品牌前十个",
  representative_content: "内容链接",
  representative_likes: "曝光",
  representative_comments: "评论数",
  comment_direction: "评论导向",
  created_by_user_id: "录入人ID",
  created_by_union_id: "录入人unionId",
  created_by_role: "录入人角色",
  captured_at: "录入时间"
};

const $ = (id) => document.getElementById(id);

const setStatus = (message, isError = false) => {
  $("status").textContent = message;
  $("status").classList.toggle("error", isError);
};

const normalizeEndpointUrl = (value) => {
  const raw = value.trim() || "http://localhost:8791/api/talents/upsert";
  const url = new URL(raw);
  if ((url.hostname === "localhost" || url.hostname === "127.0.0.1") && (url.port === "8787" || url.port === "8790")) {
    url.port = "8791";
  }
  if (url.pathname === "/" || url.pathname === "") {
    url.pathname = "/api/talents/upsert";
  }
  return url.toString();
};

const getHealthUrl = (endpointUrl) => {
  const healthUrl = new URL(endpointUrl);
  healthUrl.pathname = "/api/health";
  healthUrl.search = "";
  healthUrl.hash = "";
  return healthUrl;
};

const getLoopbackFallbackUrl = (url) => {
  if (url.hostname !== "localhost") return null;
  const fallback = new URL(url.toString());
  fallback.hostname = "127.0.0.1";
  return fallback;
};

const load = async () => {
  const config = await chrome.storage.sync.get(["endpointUrl", "authToken", "memberToken", "fieldMap"]);
  $("endpointUrl").value = config.endpointUrl || "http://localhost:8791/api/talents/upsert";
  $("authToken").value = config.authToken || "";
  $("memberToken").value = config.memberToken || "";
  $("fieldMap").value = config.fieldMap || JSON.stringify(DEFAULT_FIELD_MAP, null, 2);
};

const save = async () => {
  let fieldMap;
  try {
    fieldMap = JSON.parse($("fieldMap").value);
  } catch (error) {
    setStatus(`字段映射不是合法 JSON：${error.message}`, true);
    return;
  }

  await chrome.storage.sync.set({
    endpointUrl: normalizeEndpointUrl($("endpointUrl").value),
    authToken: $("authToken").value.trim(),
    memberToken: $("memberToken").value.trim(),
    fieldMap: JSON.stringify(fieldMap, null, 2)
  });
  setStatus("已保存");
};

const testConnection = async () => {
  let endpointUrl;
  try {
    endpointUrl = normalizeEndpointUrl($("endpointUrl").value);
  } catch (error) {
    setStatus(`提交接口不是合法 URL：${error.message}`, true);
    return;
  }

  const healthUrl = getHealthUrl(endpointUrl);
  const urlsToTry = [healthUrl, getLoopbackFallbackUrl(healthUrl)].filter(Boolean);

  try {
    let lastError = null;
    for (const url of urlsToTry) {
      try {
        const response = await fetch(url.toString());
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.ok) {
          lastError = new Error(body.error || response.status);
          continue;
        }
        if (url.hostname === "127.0.0.1" && healthUrl.hostname === "localhost") {
          const fixedEndpoint = new URL(endpointUrl);
          fixedEndpoint.hostname = "127.0.0.1";
          $("endpointUrl").value = fixedEndpoint.toString();
          await save();
        }
        setStatus(`连接成功：${body.table?.sheetId || "unknown"} / ${body.table?.viewId || "unknown"}`);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("未知错误");
  } catch (error) {
    setStatus(`连接失败：${error.message}。请确认本地后端已启动。`, true);
  }
};

$("save").addEventListener("click", save);
$("testConnection").addEventListener("click", testConnection);
$("reset").addEventListener("click", () => {
  $("fieldMap").value = JSON.stringify(DEFAULT_FIELD_MAP, null, 2);
  setStatus("已恢复默认映射，记得保存");
});

load();
