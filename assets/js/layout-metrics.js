/*
檔案位置：jonaminz/assets/js/layout-metrics.js
用途：全站共用 RWD/viewport 量測層（水庫 shell 層）。只負責偵測
viewport／orientation／RWD mode／RWD group／header-footer 邊界，
廣播出去，不負責改畫面——跟 SKHPSV2 的 layout-metrics.js 同一個
水庫法則，這裡是重寫成 jonaminz 版本（不是複製檔案）：命名空間、
HTML 屬性字首、header/footer 選擇器都改成 jonaminz 自己的，config
來源改讀 window.JONAMINZ_SITE_CONFIG.layout.rwd（config.json 已經
宣告 layout.rwd.groups，這個檔案是第一個真的去讀它、算出目前是哪個
RWD group 的地方——implementation plan `docs/roadmap-202607.md` 順序
③，補上這個已宣告但沒有 JS 在用的洞）。

- 本檔只量測、更新 state、廣播事件（CustomEvent + subscribe() API）。
- 本檔不改 footer、不改 loading gate、不主動縮字/換行/改版面。
- 目前 jonaminz 頁面還沒有任何 CSS/JS 真的去讀
  data-jonaminz-rwd-group／window.JonaminzLayoutMetrics——這次只是把
  機制蓋好、開始廣播，跟 identity capability 當初「機制先上線、沒有
  專案被授權」是同樣的做法，等真的有頁面需要（例如較深的巢狀頁面、
  或麵包屑要看 header 高度）才會有東西真的去訂閱。
*/
(function () {
  "use strict";

  var UPDATE_EVENT = "jonaminz-layout-metrics-updated";
  var scheduled = false;
  var subscribers = [];
  var resizeObservers = [];
  var mutationObserver = null;
  var inputMediaQueries = [];

  var DEFAULT_BREAKPOINTS = [
    { max: 480, mode: "phone-compact", label: "手機窄版 phone-compact", reason: "layoutWidth <= 480" },
    { max: 720, mode: "phone", label: "手機版 phone", reason: "481 <= layoutWidth <= 720" },
    { max: 960, mode: "tablet", label: "平板 / 窄版 tablet", reason: "721 <= layoutWidth <= 960" },
    { max: 1200, mode: "desktop", label: "桌機版 desktop", reason: "961 <= layoutWidth <= 1200" },
    { max: Infinity, mode: "wide", label: "寬版 wide", reason: "layoutWidth > 1200" }
  ];

  var DEFAULT_GROUPS = {
    small: ["phone-compact", "phone", "tablet"],
    large: ["desktop", "wide"]
  };

  var DEFAULT_GROUP_LABELS = {
    small: "小版 small",
    large: "大版 large"
  };

  var state = {
    orientation: "",
    rwdMode: "",
    rwdLabel: "",
    rwdReason: "",
    rwdGroup: "",
    rwdGroupLabel: "",
    rwdConfigSource: "",
    primaryPointer: "none",
    hoverCapable: false,
    coarsePointerPresent: false,
    interactionProfile: "hybrid",
    requiresTouchGuard: true,
    layoutWidth: 0,
    layoutHeight: 0,
    visualWidth: 0,
    visualHeight: 0,
    visualOffsetLeft: 0,
    visualOffsetTop: 0,
    keyboardGap: 0,
    header: rectInfo(null),
    footer: rectInfo(null),
    usableTop: 0,
    usableBottom: 0,
    usableHeight: 0,
    updatedAtIso: ""
  };

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return value;
    }
  }

  function rectInfo(element) {
    var rect;

    if (!element || !element.getBoundingClientRect) {
      return { exists: false, top: null, bottom: null, left: null, right: null, width: 0, height: 0 };
    }

    rect = element.getBoundingClientRect();

    return {
      exists: true,
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  }

  function findHeader() {
    return document.querySelector("[data-jonaminz-header]") ||
      document.querySelector(".jonaminz-header") ||
      document.getElementById("header");
  }

  function findFooter() {
    return document.querySelector("[data-jonaminz-footer]") ||
      document.querySelector(".jonaminz-footer") ||
      document.querySelector("footer");
  }

  function isPlainObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function configRwdSource() {
    var siteConfig = window.JONAMINZ_SITE_CONFIG || {};
    return isPlainObject(siteConfig.layout && siteConfig.layout.rwd) ? siteConfig.layout.rwd : null;
  }

  function normalizeBreakpoints(input) {
    var items = Array.isArray(input) ? input : DEFAULT_BREAKPOINTS;

    return items.map(function (item) {
      return {
        max: item.max === "Infinity" ? Infinity : Number(item.max),
        mode: String(item.mode || "").trim(),
        label: String(item.label || item.mode || "").trim(),
        reason: String(item.reason || "").trim()
      };
    }).filter(function (item) {
      return item.mode && !isNaN(item.max);
    }).sort(function (a, b) {
      return a.max - b.max;
    });
  }

  function normalizeGroups(input) {
    var source = isPlainObject(input) ? input : DEFAULT_GROUPS;
    var out = {};

    Object.keys(source).forEach(function (key) {
      var list = source[key];
      if (!Array.isArray(list)) return;
      out[key] = list.map(function (item) { return String(item || "").trim(); }).filter(Boolean);
    });

    if (!out.small || !out.small.length) out.small = DEFAULT_GROUPS.small.slice();
    if (!out.large || !out.large.length) out.large = DEFAULT_GROUPS.large.slice();

    return out;
  }

  function normalizeGroupLabels(input) {
    return Object.assign({}, DEFAULT_GROUP_LABELS, isPlainObject(input) ? input : {});
  }

  function currentRwdConfig() {
    // jonaminz 的 config.json 目前只宣告 layout.rwd.groups（見 §layout），
    // breakpoints/groupLabels 都還沒用到，這裡照樣支援讀取，未來要細調
    // 斷點或群組標籤時 config.json 加欄位就好，不用改這個檔案。
    var source = configRwdSource();
    return {
      source: source ? "JONAMINZ_SITE_CONFIG.layout.rwd" : "default",
      breakpoints: normalizeBreakpoints(source && source.breakpoints),
      groups: normalizeGroups(source && source.groups),
      groupLabels: normalizeGroupLabels(source && source.groupLabels)
    };
  }

  function rwdModeForWidth(width) {
    var config = currentRwdConfig();
    var breakpoints = config.breakpoints;
    var i;
    var item;

    width = Math.round(Number(width || 0));

    for (i = 0; i < breakpoints.length; i += 1) {
      if (width <= breakpoints[i].max) {
        item = breakpoints[i];
        return {
          mode: item.mode,
          label: item.label || item.mode,
          reason: item.reason || ("layoutWidth <= " + item.max),
          configSource: config.source,
          config: config
        };
      }
    }

    item = breakpoints[breakpoints.length - 1] || DEFAULT_BREAKPOINTS[DEFAULT_BREAKPOINTS.length - 1];
    return {
      mode: item.mode,
      label: item.label || item.mode,
      reason: item.reason || "last breakpoint",
      configSource: config.source,
      config: config
    };
  }

  function rwdGroupForMode(mode, config) {
    var groups = (config && config.groups) || DEFAULT_GROUPS;
    var labels = (config && config.groupLabels) || DEFAULT_GROUP_LABELS;
    var found = "";
    var keys = Object.keys(groups);

    keys.some(function (key) {
      if ((groups[key] || []).indexOf(mode) >= 0) {
        found = key;
        return true;
      }
      return false;
    });

    if (!found) found = "unknown";

    return { group: found, label: labels[found] || found };
  }


  function mediaMatches(query) {
    try {
      return Boolean(window.matchMedia && window.matchMedia(query).matches);
    } catch (error) {
      return false;
    }
  }

  function detectInputCapabilities() {
    var finePointer = mediaMatches("(pointer: fine)");
    var coarsePointer = mediaMatches("(pointer: coarse)");
    var hoverCapable = mediaMatches("(hover: hover)");
    var coarsePointerPresent = mediaMatches("(any-pointer: coarse)");
    var primaryPointer = finePointer ? "fine" : (coarsePointer ? "coarse" : "none");
    var interactionProfile = "hybrid";

    if (finePointer && hoverCapable && !coarsePointerPresent) {
      interactionProfile = "desktop-pointer";
    } else if (coarsePointer && !hoverCapable) {
      interactionProfile = "touch";
    }

    return {
      primaryPointer: primaryPointer,
      hoverCapable: hoverCapable,
      coarsePointerPresent: coarsePointerPresent,
      interactionProfile: interactionProfile,
      requiresTouchGuard: coarsePointerPresent || primaryPointer === "coarse"
    };
  }

  function plainRect(rect) {
    return {
      x: Number(rect.x),
      y: Number(rect.y),
      top: Number(rect.top),
      right: Number(rect.right),
      bottom: Number(rect.bottom),
      left: Number(rect.left),
      width: Number(rect.width),
      height: Number(rect.height)
    };
  }

  function measureElement(element, container) {
    var rect;
    var containerRect;

    if (!element || typeof element.getBoundingClientRect !== "function") return null;
    rect = plainRect(element.getBoundingClientRect());

    if (container && typeof container.getBoundingClientRect === "function") {
      containerRect = plainRect(container.getBoundingClientRect());
    } else {
      containerRect = {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: Number(window.innerWidth || document.documentElement.clientWidth || 0),
        bottom: Number(window.innerHeight || document.documentElement.clientHeight || 0),
        width: Number(window.innerWidth || document.documentElement.clientWidth || 0),
        height: Number(window.innerHeight || document.documentElement.clientHeight || 0)
      };
    }

    return {
      rect: rect,
      offsets: {
        top: rect.top - containerRect.top,
        right: containerRect.right - rect.right,
        bottom: containerRect.bottom - rect.bottom,
        left: rect.left - containerRect.left
      }
    };
  }

  function measure() {
    var viewport = window.visualViewport || null;
    var layoutWidth = Math.round(window.innerWidth || document.documentElement.clientWidth || 0);
    var layoutHeight = Math.round(window.innerHeight || document.documentElement.clientHeight || 0);
    var visualWidth = Math.round(viewport && viewport.width ? viewport.width : layoutWidth);
    var visualHeight = Math.round(viewport && viewport.height ? viewport.height : layoutHeight);
    var visualOffsetLeft = Math.round(viewport && viewport.offsetLeft ? viewport.offsetLeft : 0);
    var visualOffsetTop = Math.round(viewport && viewport.offsetTop ? viewport.offsetTop : 0);
    var header = rectInfo(findHeader());
    var footer = rectInfo(findFooter());
    var orientation = layoutHeight >= layoutWidth ? "portrait" : "landscape";
    var rwd = rwdModeForWidth(layoutWidth);
    var group = rwdGroupForMode(rwd.mode, rwd.config);
    var usableTop = header.exists ? Math.max(0, header.bottom) : 0;
    var usableBottom = footer.exists ? Math.max(0, Math.min(layoutHeight, footer.top)) : layoutHeight;
    var usableHeight = Math.max(0, usableBottom - usableTop);
    var keyboardGap = Math.max(0, Math.round(layoutHeight - visualHeight - visualOffsetTop));
    var input = detectInputCapabilities();

    return {
      orientation: orientation,
      rwdMode: rwd.mode,
      rwdLabel: rwd.label,
      rwdReason: rwd.reason,
      rwdGroup: group.group,
      rwdGroupLabel: group.label,
      rwdConfigSource: rwd.configSource,
      primaryPointer: input.primaryPointer,
      hoverCapable: input.hoverCapable,
      coarsePointerPresent: input.coarsePointerPresent,
      interactionProfile: input.interactionProfile,
      requiresTouchGuard: input.requiresTouchGuard,
      layoutWidth: layoutWidth,
      layoutHeight: layoutHeight,
      visualWidth: visualWidth,
      visualHeight: visualHeight,
      visualOffsetLeft: visualOffsetLeft,
      visualOffsetTop: visualOffsetTop,
      keyboardGap: keyboardGap,
      header: header,
      footer: footer,
      usableTop: Math.round(usableTop),
      usableBottom: Math.round(usableBottom),
      usableHeight: Math.round(usableHeight),
      updatedAtIso: new Date().toISOString()
    };
  }

  function applyHtmlAttributes(next) {
    var html = document.documentElement;
    if (!html) return;

    html.setAttribute("data-jonaminz-orientation", next.orientation || "");
    html.setAttribute("data-jonaminz-rwd-mode", next.rwdMode || "");
    html.setAttribute("data-jonaminz-rwd-group", next.rwdGroup || "");
    html.setAttribute("data-jonaminz-layout-width", String(next.layoutWidth || 0));
    html.setAttribute("data-jonaminz-layout-height", String(next.layoutHeight || 0));
  }

  function notify(next) {
    var i;

    applyHtmlAttributes(next);

    try {
      document.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: clone(next) }));
    } catch (error) {}

    for (i = 0; i < subscribers.length; i += 1) {
      try {
        subscribers[i](clone(next));
      } catch (error) {}
    }
  }

  function updateNow() {
    state = measure();
    notify(state);
    return state;
  }

  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;

    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(function () {
        scheduled = false;
        updateNow();
      });
      return;
    }

    window.setTimeout(function () {
      scheduled = false;
      updateNow();
    }, 80);
  }

  function observeElementSize(element) {
    var observer;
    if (!element || typeof ResizeObserver !== "function") return;

    try {
      observer = new ResizeObserver(scheduleUpdate);
      observer.observe(element);
      resizeObservers.push(observer);
    } catch (error) {}
  }

  function installObservers() {
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    window.addEventListener("orientationchange", scheduleUpdate, { passive: true });

    ["(pointer: fine)", "(pointer: coarse)", "(hover: hover)", "(any-pointer: coarse)"].forEach(function (query) {
      if (!window.matchMedia) return;
      try {
        var media = window.matchMedia(query);
        if (media.addEventListener) media.addEventListener("change", scheduleUpdate);
        else if (media.addListener) media.addListener(scheduleUpdate);
        inputMediaQueries.push(media);
      } catch (error) {}
    });

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", scheduleUpdate, { passive: true });
      window.visualViewport.addEventListener("scroll", scheduleUpdate, { passive: true });
    }

    if (document.body) observeElementSize(document.body);
    observeElementSize(findHeader());
    observeElementSize(findFooter());

    // header/footer 是非同步載入的（entry-core.js 的 shell chain），
    // 剛量測完的時候它們可能還沒渲染出真正的高度，補幾個延遲重算，
    // 跟 SKHPS 版本同樣的手法——這裡不是憑空多寫，是真的會發生的情境。
    if (typeof MutationObserver === "function" && document.documentElement) {
      try {
        mutationObserver = new MutationObserver(scheduleUpdate);
        mutationObserver.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "style"]
        });
      } catch (error) {}
    }

    [80, 250, 800, 1600].forEach(function (delay) {
      window.setTimeout(scheduleUpdate, delay);
    });
  }

  function subscribe(handler) {
    if (typeof handler !== "function") return function () {};

    subscribers.push(handler);
    try {
      handler(clone(state));
    } catch (error) {}

    return function () {
      subscribers = subscribers.filter(function (item) { return item !== handler; });
    };
  }

  function destroy() {
    var i;

    window.removeEventListener("resize", scheduleUpdate);
    window.removeEventListener("orientationchange", scheduleUpdate);

    if (window.visualViewport) {
      window.visualViewport.removeEventListener("resize", scheduleUpdate);
      window.visualViewport.removeEventListener("scroll", scheduleUpdate);
    }

    for (i = 0; i < inputMediaQueries.length; i += 1) {
      try {
        if (inputMediaQueries[i].removeEventListener) inputMediaQueries[i].removeEventListener("change", scheduleUpdate);
        else if (inputMediaQueries[i].removeListener) inputMediaQueries[i].removeListener(scheduleUpdate);
      } catch (error) {}
    }
    inputMediaQueries = [];

    for (i = 0; i < resizeObservers.length; i += 1) {
      try { resizeObservers[i].disconnect(); } catch (error) {}
    }
    resizeObservers = [];

    if (mutationObserver) {
      try { mutationObserver.disconnect(); } catch (error) {}
      mutationObserver = null;
    }
  }

  window.JonaminzLayoutMetrics = {
    version: "v1.1.0-20260723",
    eventName: UPDATE_EVENT,
    getState: function () { return clone(state); },
    measure: function () { return clone(updateNow()); },
    measureElement: measureElement,
    detectInputCapabilities: function () { return clone(detectInputCapabilities()); },
    schedule: scheduleUpdate,
    subscribe: subscribe,
    rwdModeForWidth: function (width) { return clone(rwdModeForWidth(width)); },
    rwdGroupForMode: function (mode) { return clone(rwdGroupForMode(mode, currentRwdConfig())); },
    getConfig: function () { return clone(currentRwdConfig()); },
    destroy: destroy
  };

  installObservers();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleUpdate, { once: true });
  }

  updateNow();
})();
