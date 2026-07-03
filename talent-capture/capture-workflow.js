((root) => {
  const compact = (value) => String(value || "").trim();

  const first = (...values) => {
    for (const value of values) {
      if (Array.isArray(value) && value.length) return value;
      if (value !== undefined && value !== null && compact(value) !== "") return value;
    }
    return "";
  };

  const normalizeUrl = (value) => {
    try {
      const url = new URL(compact(value));
      url.hash = "";
      url.search = "";
      url.pathname = url.pathname.replace(/\/+$/, "");
      return url.toString();
    } catch {
      return compact(value);
    }
  };

  const ensureCreatorId = (record) => {
    const id = first(record.creator_id, record.talent_id, record.platform_native_id, record.platform_account, record.profile_url);
    return {
      ...record,
      talent_id: id,
      creator_id: id
    };
  };

  const firstAudienceCountry = (countries) => {
    const firstValue = Array.isArray(countries) ? countries[0] : String(countries || "").split(/[,，、]/)[0];
    return compact(firstValue)
      .replace(/\d+(\.\d+)?%/g, "")
      .trim();
  };

  const inferTargetTable = (record = {}) => {
    const platform = compact(record.platform).toLowerCase();
    const source = compact(record.source).toLowerCase();
    const url = compact(record.source_url || record.profile_url || record.fastmoss_profile_url).toLowerCase();
    if (platform === "tiktok" || source.includes("fastmoss") || url.includes("fastmoss.com") || record.fastmoss_sec_uid) {
      return "tk";
    }
    return "general";
  };

  const buildFastMossProfileUrl = (record = {}) => {
    const secUid = compact(record.fastmoss_sec_uid || record.platform_native_id);
    if (/^\d{8,}$/.test(secUid)) {
      return `https://www.fastmoss.com/zh/influencer/detail/${encodeURIComponent(secUid)}`;
    }
    return "";
  };

  const applyManualDefaults = (record = {}) => {
    return {
      ...record,
      review_status: first(record.review_status, "待审核"),
      channel_ownership: first(record.channel_ownership, ["品牌"])
    };
  };

  const mergeLayer = (baseRecord = {}, incomingRecord = {}, layer = "base") => {
    const base = ensureCreatorId(baseRecord);
    const incoming = ensureCreatorId(incomingRecord);
    const layerSource = {
      base: "Chrome插件-基础信息",
      representative: "Chrome插件-代表内容",
      nox: "Chrome插件-Nox信息",
      fastmoss: "Chrome插件-FastMoss带货数据"
    }[layer] || "Chrome插件";

    if (layer === "base") {
      return ensureCreatorId(applyManualDefaults({
        ...base,
        ...incoming,
        profile_url: normalizeUrl(first(incoming.profile_url, base.profile_url)),
        nox_profile_url: normalizeUrl(first(incoming.nox_profile_url, base.nox_profile_url)),
        source: layerSource,
        source_url: normalizeUrl(first(incoming.source_url, incoming.profile_url, base.source_url))
      }));
    }

    if (layer === "representative") {
      return ensureCreatorId({
        ...base,
        representative_content: first(incoming.representative_content, incoming.content_url, incoming.profile_url, base.representative_content),
        comment_direction: first(incoming.comment_direction, base.comment_direction),
        source: layerSource,
        source_url: normalizeUrl(first(incoming.source_url, incoming.profile_url, base.source_url))
      });
    }

    if (layer === "nox") {
      return ensureCreatorId({
        ...base,
        country: first(incoming.country, firstAudienceCountry(incoming.audience_top_countries), base.country),
        creator_category: first(incoming.creator_category, base.creator_category),
        avg_views_30d: first(incoming.avg_views_30d, base.avg_views_30d),
        engagement_rate: first(incoming.engagement_rate, base.engagement_rate),
        content_count: first(incoming.content_count, base.content_count),
        audience_credibility: first(incoming.audience_credibility, base.audience_credibility),
        audience_top_countries: first(incoming.audience_top_countries, base.audience_top_countries),
        audience_top_gender: first(incoming.audience_top_gender, base.audience_top_gender),
        audience_top_age: first(incoming.audience_top_age, base.audience_top_age),
        content_interests: first(incoming.content_interests, base.content_interests),
        mentioned_brands_top10: first(incoming.mentioned_brands_top10, base.mentioned_brands_top10),
        nox_profile_url: normalizeUrl(first(incoming.nox_profile_url, incoming.source_url, base.nox_profile_url)),
        source: layerSource,
        source_url: normalizeUrl(first(incoming.source_url, incoming.nox_profile_url, base.source_url))
      });
    }

    if (layer === "fastmoss") {
      const mergedSecUid = first(incoming.fastmoss_sec_uid, incoming.platform_native_id, base.fastmoss_sec_uid, base.platform_native_id);
      return ensureCreatorId(applyManualDefaults({
        ...base,
        ...incoming,
        platform: first(incoming.platform, base.platform, "TikTok"),
        platform_account: first(incoming.platform_account, base.platform_account),
        platform_native_id: mergedSecUid,
        fastmoss_sec_uid: mergedSecUid,
        fastmoss_profile_url: buildFastMossProfileUrl({ fastmoss_sec_uid: mergedSecUid }),
        profile_url: normalizeUrl(first(incoming.profile_url, base.profile_url)),
        creator_category: first(incoming.creator_category, base.creator_category),
        source: layerSource,
        source_url: normalizeUrl(first(incoming.source_url, incoming.fastmoss_profile_url, base.source_url))
      }));
    }

    return ensureCreatorId({ ...base, ...incoming, source: layerSource });
  };

  const prepareRecordForSubmit = (record = {}) => {
    const fastmossProfileUrl = buildFastMossProfileUrl(record);
    const prepared = ensureCreatorId({
      ...record,
      fastmoss_sec_uid: first(record.fastmoss_sec_uid, record.platform_native_id),
      profile_url: normalizeUrl(record.profile_url),
      nox_profile_url: normalizeUrl(record.nox_profile_url),
      fastmoss_profile_url: fastmossProfileUrl,
      captured_at: record.captured_at || new Date().toISOString()
    });
    return {
      ...prepared,
      target_table: record.target_table || inferTargetTable(prepared)
    };
  };

  const getCompletionStatus = (record = {}) => {
    const hasAny = (...keys) => keys.some((key) => {
      const value = record[key];
      return Array.isArray(value) ? value.length > 0 : compact(value) !== "";
    });
    const stages = {
      base: hasAny("creator_id", "talent_id") && hasAny("platform") && hasAny("platform_account", "profile_url"),
      representative: hasAny("representative_content"),
      nox: hasAny("avg_views_30d", "engagement_rate", "audience_top_countries", "audience_credibility")
    };
    const missingStages = Object.entries(stages)
      .filter(([, ready]) => !ready)
      .map(([stage]) => stage);
    return {
      ready: missingStages.length === 0,
      stages,
      missingStages
    };
  };

  root.FanyCaptureWorkflow = {
    applyManualDefaults,
    buildFastMossProfileUrl,
    ensureCreatorId,
    inferTargetTable,
    mergeLayer,
    prepareRecordForSubmit,
    getCompletionStatus
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
