chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get([
    "endpointUrl",
    "authToken",
    "fieldMap"
  ]);

  const defaults = {};
  if (!current.endpointUrl) {
    defaults.endpointUrl = "http://localhost:8791/api/talents/upsert";
  } else if (/^http:\/\/(localhost|127\.0\.0\.1):(8787|8790)\b/.test(current.endpointUrl)) {
    defaults.endpointUrl = current.endpointUrl.replace(/:(8787|8790)\b/, ":8791");
  }
  const defaultFieldMap = {
      talent_id: "creator_id",
      creator_type: "达人类型",
      review_status: "审核状态",
      historical_cooperation_result: "历史合作结果",
      creator_category: "达人类别",
      channel_ownership: "渠道归属",
      display_name: "昵称",
      platform: "平台",
      platform_account: "账号",
      follower_count: "粉丝数",
      profile_url: "主页链接",
      nox_profile_url: "Nox达人主页链接",
      country: "国家",
      language: "语言",
      email: "邮箱",
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
      mentioned_brands_top10: "提及前十个品牌",
      fastmoss_sec_uid: "TT原生ID(secUid)",
      fastmoss_profile_url: "Fastmoss达人主页链接",
      shop_window_status: "橱窗状态",
      commerce_intent: "带货倾向",
      mcn_name: "MCN 签约",
      first_video_date: "首条视频时间",
      sales_28d: "带货销量（近 28 天）",
      avg_order_value: "客单价",
      commerce_categories: "带货品类",
      commerce_products: "带货商品",
      audience_female_pct: "粉丝数据，女性占比",
      fastmoss_audience_regions: "国家地区",
      fastmoss_audience_age: "年龄",
      top_hashtags: "前 5 主题标签",
      representative_content: "内容链接",
      representative_likes: "曝光",
      representative_comments: "评论数",
      comment_direction: "评论导向",
      created_by_user_id: "录入人ID",
      created_by_union_id: "录入人unionId",
      created_by_role: "录入人角色",
      captured_at: "录入时间"
  };
  if (!current.fieldMap) {
    defaults.fieldMap = JSON.stringify(defaultFieldMap, null, 2);
  } else {
    try {
      const fieldMap = JSON.parse(current.fieldMap);
      const migrations = {
        mentioned_brands_top10: ["互动率-提及品牌前十个"],
        email: ["联系方式", "联系邮箱", "邮件"],
        fastmoss_profile_url: ["FastMoss链接", "FastMoss 达人主页"],
        mcn_name: ["MCN签约"],
        sales_28d: ["带货销量（近28天）", "带货销量"],
        top_hashtags: ["前5主题标签", "近 28 天前五主题标签"]
      };
      let changed = false;
      for (const [field, oldValues] of Object.entries(migrations)) {
        if (oldValues.includes(fieldMap[field])) {
          fieldMap[field] = defaultFieldMap[field];
          changed = true;
        }
      }
      if (changed) defaults.fieldMap = JSON.stringify(fieldMap, null, 2);
    } catch {
      // Keep user-provided custom text as-is if it is not valid JSON.
    }
  }

  if (Object.keys(defaults).length > 0) {
    await chrome.storage.sync.set(defaults);
  }

  if (chrome.sidePanel?.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!chrome.sidePanel?.open) return;
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "FANY_OPEN_POPUP") return false;

  Promise.resolve().then(() => {
    if (!chrome.sidePanel?.open) throw new Error("当前 Chrome 不支持侧边栏");
    if (sender.tab?.id) return chrome.sidePanel.open({ tabId: sender.tab.id });
    return chrome.sidePanel.open({ windowId: sender.tab?.windowId });
  }).then(() => {
    sendResponse({ ok: true });
  }).catch((error) => {
    sendResponse({ ok: false, error: error.message || String(error) });
  });
  return true;
});
