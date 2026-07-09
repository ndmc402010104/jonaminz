/*
檔案位置：jonaminz/pages/admin/theme/assets/js/app.js
用途：Theme 頁自己的業務入口（水庫下游層），一個像 Bootstrap 客製化面板的
視覺化外觀編輯器。底層資料模型跟之前一樣：Supabase 的 theme_css_rules
（selector + property + value），只是這一頁不再叫人手打 selector/property，
而是針對已知的 design token（顏色/間距/圓角）給對應的輸入元件（色票/數字），
改動即時預覽（直接 setProperty 到 :root，不用等存檔），存檔才會真的寫回
Supabase 並讓 theme-runtime.js 重新套用。

不在「已知 token 白名單」內的規則（例如自訂 selector 的樣式）歸類到下面的
「Advanced」區塊，維持上一版的 selector/property/value 手動編輯能力。

只能回報自己的 loading task，不可以自己決定 css/shell ready。CSS Rules 讀寫是背景
操作，不影響 loading gate。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";

  var FRIENDLY_TOKENS = [
    { group: "Colors", type: "color", name: "--color-primary", label: "Primary" },
    { group: "Colors", type: "color", name: "--color-primary-2", label: "Primary 2" },
    { group: "Colors", type: "color", name: "--color-accent", label: "Accent" },
    { group: "Colors", type: "color", name: "--color-bg", label: "Background（淺色）" },
    { group: "Colors", type: "color", name: "--color-bg-dark", label: "Background（深色）" },
    { group: "Colors", type: "color", name: "--color-text", label: "Text（淺底）" },
    { group: "Colors", type: "color", name: "--color-text-dark", label: "Text（深底）" },
    { group: "Spacing", type: "length", name: "--space-1", label: "space-1" },
    { group: "Spacing", type: "length", name: "--space-2", label: "space-2" },
    { group: "Spacing", type: "length", name: "--space-3", label: "space-3" },
    { group: "Spacing", type: "length", name: "--space-4", label: "space-4" },
    { group: "Spacing", type: "length", name: "--space-5", label: "space-5" },
    { group: "Spacing", type: "length", name: "--space-6", label: "space-6" },
    { group: "Spacing", type: "length", name: "--space-7", label: "space-7" },
    { group: "Radius", type: "length", name: "--radius-sm", label: "radius-sm" },
    { group: "Radius", type: "length", name: "--radius-md", label: "radius-md" },
    { group: "Radius", type: "length", name: "--radius-lg", label: "radius-lg" },
    { group: "Radius", type: "length", name: "--radius-pill", label: "radius-pill" }
  ];
  var FRIENDLY_TOKEN_NAMES = FRIENDLY_TOKENS.reduce(function (set, token) {
    set[token.name] = true;
    return set;
  }, {});
  var FRIENDLY_GROUPS = ["Colors", "Spacing", "Radius"];

  var SHADOW_TOKENS = ["--shadow-sm", "--shadow-md", "--shadow-lg"];
  var TEXT_TOKENS = ["--text-xs", "--text-sm", "--text-md", "--text-lg", "--text-xl", "--text-2xl"];

  var rules = [];
  var deletedIds = [];
  var nextTempId = -1;

  function tokenValue(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function sectionHtml(title, bodyHtml) {
    return (
      '<section class="jonaminz-theme-section">' +
        '<div class="jonaminz-section-head">' +
          '<h2 class="jonaminz-section-title">' + title + '</h2>' +
        '</div>' +
        bodyHtml +
      '</section>'
    );
  }

  function scaleHtml(tokens, renderPreview) {
    return (
      '<div class="jonaminz-theme-scale">' +
        tokens.map(function (name) {
          return (
            '<div class="jonaminz-theme-scale-row">' +
              '<code>' + name + '</code>' +
              '<span class="jonaminz-theme-scale-value">' + tokenValue(name) + '</span>' +
              renderPreview(name) +
            '</div>'
          );
        }).join('') +
      '</div>'
    );
  }

  function buttonsHtml() {
    return (
      '<div class="jonaminz-theme-row">' +
        '<button class="btn btn-primary" type="button">btn-primary</button>' +
        '<button class="btn btn-ghost" type="button">btn-ghost</button>' +
      '</div>'
    );
  }

  function cardsHtml() {
    return (
      '<div class="jonaminz-theme-row">' +
        '<div class="card">.card</div>' +
        '<div class="card card-glass">.card.card-glass</div>' +
        '<a class="jonaminz-project-card" href="#">' +
          '<p class="jonaminz-project-title">.jonaminz-project-card</p>' +
          '<p class="jonaminz-project-description">外部專案卡片樣式</p>' +
        '</a>' +
      '</div>'
    );
  }

  /* ---------- friendly token editor ---------- */

  function findRule(selector, property) {
    return rules.filter(function (item) {
      return item.selector === selector && item.property === property;
    })[0] || null;
  }

  function ensureRootRule(property) {
    var rule = findRule(":root", property);
    if (!rule) {
      rule = { __id: nextTempId--, selector: ":root", property: property, value: tokenValue(property) };
      rules.push(rule);
    }
    return rule;
  }

  function normalizeColorForInput(value) {
    var v = String(value || "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(v) ? v : "#000000";
  }

  function parseLengthNumber(value) {
    var n = parseFloat(String(value || "0"));
    return isNaN(n) ? 0 : n;
  }

  function friendlyTokenInputHtml(token, rule) {
    if (token.type === "color") {
      return (
        '<input type="color" class="jonaminz-theme-token-input" data-token-name="' + escapeAttr(token.name) + '" data-token-type="color" ' +
        'value="' + escapeAttr(normalizeColorForInput(rule.value)) + '">'
      );
    }

    return (
      '<span class="jonaminz-theme-token-length">' +
        '<input type="number" class="jonaminz-theme-token-input" data-token-name="' + escapeAttr(token.name) + '" data-token-type="length" ' +
        'value="' + escapeAttr(parseLengthNumber(rule.value)) + '"> px' +
      '</span>'
    );
  }

  function friendlyTokenRowHtml(token) {
    var rule = ensureRootRule(token.name);

    return (
      '<div class="jonaminz-theme-token-row">' +
        '<span class="jonaminz-theme-token-label">' + escapeHtml(token.label) + '</span>' +
        friendlyTokenInputHtml(token, rule) +
      '</div>'
    );
  }

  function friendlyEditorHtml() {
    return FRIENDLY_GROUPS.map(function (group) {
      var tokens = FRIENDLY_TOKENS.filter(function (token) { return token.group === group; });

      return sectionHtml(group, '<div class="jonaminz-theme-token-grid">' + tokens.map(friendlyTokenRowHtml).join('') + '</div>');
    }).join('');
  }

  /* ---------- advanced (raw) rule editor ---------- */

  function advancedRules() {
    return rules.filter(function (rule) {
      return !(rule.selector === ":root" && FRIENDLY_TOKEN_NAMES[rule.property]);
    });
  }

  function ruleRowHtml(rule) {
    return (
      '<div class="jonaminz-theme-rule-row" data-rule-id="' + escapeAttr(rule.__id) + '">' +
        '<input class="jonaminz-theme-rule-input" data-field="selector" placeholder=":root / .card" value="' + escapeAttr(rule.selector) + '">' +
        '<input class="jonaminz-theme-rule-input" data-field="property" placeholder="--color-primary / border-radius" value="' + escapeAttr(rule.property) + '">' +
        '<input class="jonaminz-theme-rule-input" data-field="value" placeholder="#6366f1 / 12px" value="' + escapeAttr(rule.value) + '">' +
        '<button class="jonaminz-theme-rule-delete" type="button" data-rule-delete>刪除</button>' +
      '</div>'
    );
  }

  function advancedEditorHtml() {
    return (
      '<p class="jonaminz-page-subtitle">給不在上面清單裡的任意 selector 用，例如針對某個共用元件微調。</p>' +
      '<div class="jonaminz-theme-rules" data-theme-rules></div>' +
      '<div class="jonaminz-theme-row">' +
        '<button class="btn btn-ghost" type="button" data-rule-add>+ 新增規則</button>' +
      '</div>'
    );
  }

  /* ---------- render ---------- */

  function renderShowcase() {
    var root = document.querySelector("[data-app-root]");
    if (!root) return;

    root.innerHTML = [
      friendlyEditorHtml(),
      sectionHtml("Shadow", scaleHtml(SHADOW_TOKENS, function (name) {
        return '<span class="jonaminz-theme-scale-box" style="box-shadow:var(' + name + ')"></span>';
      })),
      sectionHtml("Typography", scaleHtml(TEXT_TOKENS, function (name) {
        return '<span style="font-size:var(' + name + ')">Aa</span>';
      })),
      sectionHtml("Buttons（即時預覽）", buttonsHtml()),
      sectionHtml("Cards（即時預覽）", cardsHtml()),
      sectionHtml("Advanced：自訂 CSS 規則", advancedEditorHtml()),
      '<div class="jonaminz-theme-row jonaminz-theme-save-row">' +
        '<button class="btn btn-primary" type="button" data-rule-save>儲存並套用</button>' +
        '<p class="jonaminz-page-subtitle" data-rule-status>讀取中...</p>' +
      '</div>'
    ].join('');
  }

  function renderAdvancedRules() {
    var container = document.querySelector("[data-theme-rules]");
    if (!container) return;
    container.innerHTML = advancedRules().map(ruleRowHtml).join('');
  }

  function setStatus(text) {
    var el = document.querySelector("[data-rule-status]");
    if (el) el.textContent = text || "";
  }

  function applyLivePreview(property, value) {
    document.documentElement.style.setProperty(property, value);
  }

  function bindEvents() {
    var root = document.querySelector("[data-app-root]");
    if (!root || root.getAttribute("data-rules-bound") === "true") return;
    root.setAttribute("data-rules-bound", "true");

    root.addEventListener("input", function (event) {
      var tokenInput = event.target.closest(".jonaminz-theme-token-input");
      if (tokenInput) {
        var tokenName = tokenInput.getAttribute("data-token-name");
        var tokenType = tokenInput.getAttribute("data-token-type");
        var value = tokenType === "length" ? (parseLengthNumber(tokenInput.value) + "px") : tokenInput.value;
        var rule = ensureRootRule(tokenName);

        rule.value = value;
        applyLivePreview(tokenName, value);
        return;
      }

      var ruleInput = event.target.closest(".jonaminz-theme-rule-input");
      if (ruleInput) {
        var row = ruleInput.closest("[data-rule-id]");
        var id = row.getAttribute("data-rule-id");
        var field = ruleInput.getAttribute("data-field");
        var rule2 = rules.filter(function (item) { return String(item.__id) === id; })[0];

        if (rule2) rule2[field] = ruleInput.value;
      }
    });

    root.addEventListener("click", function (event) {
      if (event.target.closest("[data-rule-add]")) {
        rules.push({ __id: nextTempId--, selector: "", property: "", value: "" });
        renderAdvancedRules();
        return;
      }

      var deleteBtn = event.target.closest("[data-rule-delete]");
      if (deleteBtn) {
        var row = deleteBtn.closest("[data-rule-id]");
        var id = row.getAttribute("data-rule-id");

        if (Number(id) > 0) deletedIds.push(Number(id));
        rules = rules.filter(function (item) { return String(item.__id) !== id; });
        renderAdvancedRules();
        return;
      }

      if (event.target.closest("[data-rule-save]")) {
        saveRules();
      }
    });
  }

  function loadRules() {
    if (!window.JonaminzBackend || typeof window.JonaminzBackend.call !== "function") {
      setStatus("後端尚未載入。");
      return;
    }

    setStatus("讀取中...");

    window.JonaminzBackend.call("getThemeCssRules", {})
      .then(function (response) {
        var rows = (response && response.rows) || [];

        rules = rows.map(function (row) {
          return {
            __id: row.id,
            selector: row.selector || "",
            property: row.property || "",
            value: row.value || ""
          };
        });

        renderShowcase();
        bindEvents();
        setStatus("已讀取 " + rules.length + " 條規則。");
      })
      .catch(function (error) {
        setStatus("讀取失敗，畫面先用目前生效的預設值：" + (error && error.message ? error.message : String(error)));
      });
  }

  function saveRules() {
    var upsert = rules
      .filter(function (rule) { return rule.selector.trim() && rule.property.trim(); })
      .map(function (rule) {
        return { selector: rule.selector.trim(), property: rule.property.trim(), value: rule.value.trim() };
      });

    setStatus("儲存中...");

    window.JonaminzBackend.call("saveThemeCssRules", { upsert: upsert, deleteIds: deletedIds })
      .then(function () {
        deletedIds = [];
        setStatus("已儲存，套用新外觀中...");
        return window.JonaminzThemeRuntime && window.JonaminzThemeRuntime.refresh();
      })
      .then(function () {
        setStatus("已儲存並套用。");
        loadRules();
      })
      .catch(function (error) {
        setStatus("儲存失敗：" + (error && error.message ? error.message : String(error)));
      });
  }

  function init() {
    try {
      renderShowcase();
      bindEvents();
      window.JonaminzLoading.done(READY_TASK);
      loadRules();
    } catch (error) {
      console.error("[jonaminz] theme app.js init failed", error);
      window.JonaminzLoading.fail(READY_TASK, error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
