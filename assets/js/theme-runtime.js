/*
檔案位置：jonaminz/assets/js/theme-runtime.js
用途：CSS 疊加第 8 層 - Theme（動態外觀），水庫層唯一的外觀來源。

這份檔案刻意寫成「獨立可攜」，不依賴 jonaminz 的 config.json / entry-core.js：
任何專案（jonaminz 自己的頁面，或外部專案）只要加一個 <script> 標籤就能拿到
一樣的外觀，達成「功能 CSS 留在各專案自己身邊，外觀統一從 Supabase 來」的水庫精神。

資料模型（Supabase theme_css_rules）：一列 = 一條 CSS 宣告（selector + property + value）。
selector 是 ":root" 的列會輸出成 CSS 變數（例如 --jm-color-primary），這是跨專案共用的
主要介面：外部專案不需要認得 jonaminz 的 class 名稱，只要在自己 CSS 裡引用同樣的
變數名稱就能跟著 Theme 換外觀。其他 selector（例如 ".card"）主要給 jonaminz 自己的
共用元件微調用。

快取策略（避免每次連 Supabase 造成閃爍/變慢）：
1. 有 localStorage 快取就先套用（同步、立即生效）。
2. 背景重新抓最新規則，套用後更新快取（下次更快）。
3. 沒有快取（第一次造訪）才同步等待這次 fetch。
4. Worker 連不到就保留現有樣式（通常是各專案自己的預設 CSS），不會讓頁面壞掉。
*/
(function () {
  "use strict";

  var DEFAULT_WORKER_URL = "https://jonaminz-backend.ndmc402010104.workers.dev";
  var STYLE_ID = "jonaminz-theme-runtime";
  var CACHE_KEY = "jonaminz.themeCssCache.v1";
  var FETCH_TIMEOUT_MS = 8000;

  var loadPromise = null;

  function getWorkerUrl() {
    return String(window.JONAMINZ_THEME_WORKER_URL || DEFAULT_WORKER_URL).replace(/\/+$/, "");
  }

  function hashText(text) {
    var hash = 2166136261;
    var input = String(text || "");

    for (var i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }

    return ("00000000" + (hash >>> 0).toString(16)).slice(-8);
  }

  function fetchThemeRules() {
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller
      ? setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT_MS)
      : null;

    return fetch(getWorkerUrl() + "/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getThemeCssRules", payload: {} }),
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      if (timer) clearTimeout(timer);
      return response.text().then(function (text) {
        var data;
        try {
          data = text ? JSON.parse(text) : {};
        } catch (error) {
          throw new Error("Theme Worker 回傳不是合法 JSON");
        }
        if (!response.ok || data.ok === false) {
          throw new Error((data && data.error) || "getThemeCssRules failed: HTTP " + response.status);
        }
        return data.rows || [];
      });
    }).catch(function (error) {
      if (timer) clearTimeout(timer);
      throw error;
    });
  }

  function groupRows(rows) {
    var plain = {};
    var media = {};

    rows.forEach(function (row) {
      var selector = String(row.selector || "").trim();
      var property = String(row.property || "").trim();
      var value = String(row.value || "").trim();

      if (!selector || !property || !value) return;

      if (selector.indexOf("@media") === 0) {
        var match = selector.match(/^(@media[^{]+)\s+(.+)$/);
        if (!match) return;

        var mediaQuery = match[1].trim();
        var innerSelector = match[2].trim();

        media[mediaQuery] = media[mediaQuery] || {};
        media[mediaQuery][innerSelector] = media[mediaQuery][innerSelector] || [];
        media[mediaQuery][innerSelector].push({ property: property, value: value });
        return;
      }

      plain[selector] = plain[selector] || [];
      plain[selector].push({ property: property, value: value });
    });

    return { plain: plain, media: media };
  }

  function buildCss(rows) {
    var grouped = groupRows(rows);
    var css = ["/* jonaminz theme runtime generated */"];

    Object.keys(grouped.plain).forEach(function (selector) {
      css.push("", selector + " {");
      grouped.plain[selector].forEach(function (decl) {
        css.push("  " + decl.property + ": " + decl.value + ";");
      });
      css.push("}");
    });

    Object.keys(grouped.media).forEach(function (mediaQuery) {
      css.push("", mediaQuery + " {");
      Object.keys(grouped.media[mediaQuery]).forEach(function (selector) {
        css.push("  " + selector + " {");
        grouped.media[mediaQuery][selector].forEach(function (decl) {
          css.push("    " + decl.property + ": " + decl.value + ";");
        });
        css.push("  }");
      });
      css.push("}");
    });

    return css.join("\n");
  }

  function applyCss(cssText) {
    var style = document.getElementById(STYLE_ID);

    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      style.setAttribute("data-jonaminz-theme-runtime", "true");
      document.head.appendChild(style);
    }

    style.textContent = cssText || "";
    style.setAttribute("data-hash", hashText(cssText));
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var cache = JSON.parse(raw);
      if (!cache || typeof cache.cssText !== "string") return null;
      return cache;
    } catch (error) {
      return null;
    }
  }

  function writeCache(cssText) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        cssText: cssText,
        hash: hashText(cssText),
        savedAt: Date.now()
      }));
    } catch (error) {
      console.warn("[jonaminz] theme runtime cache write failed:", error);
    }
  }

  function refreshInBackground() {
    return fetchThemeRules().then(function (rows) {
      var cssText = buildCss(rows);
      var cache = readCache();

      if (!cache || cache.hash !== hashText(cssText)) {
        applyCss(cssText);
        writeCache(cssText);
      }

      return cssText;
    }).catch(function (error) {
      console.warn("[jonaminz] theme runtime background refresh failed:", error);
    });
  }

  function load() {
    if (loadPromise) return loadPromise;

    var cache = readCache();

    if (cache) {
      applyCss(cache.cssText);
      refreshInBackground();
      loadPromise = Promise.resolve(cache.cssText);
      return loadPromise;
    }

    loadPromise = fetchThemeRules().then(function (rows) {
      var cssText = buildCss(rows);
      applyCss(cssText);
      writeCache(cssText);
      return cssText;
    }).catch(function (error) {
      console.warn("[jonaminz] theme runtime initial load failed, keeping local defaults:", error);
      return "";
    });

    return loadPromise;
  }

  function refresh() {
    loadPromise = fetchThemeRules().then(function (rows) {
      var cssText = buildCss(rows);
      applyCss(cssText);
      writeCache(cssText);
      return cssText;
    });

    return loadPromise;
  }

  window.JonaminzThemeRuntime = {
    load: load,
    refresh: refresh,
    getWorkerUrl: getWorkerUrl
  };

  load();
})();
