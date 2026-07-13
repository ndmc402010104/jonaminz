/*
檔案位置：jonaminz/pages/admin/theme/assets/js/app.js
用途：Theme 頁自己的業務入口（水庫下游層）。底層資料模型不變：Supabase 的
theme_css_rules（selector + property + value + group_name）。

畫面是分頁式編輯器，仿 SKHPS 的 CssSetting 模式：左側是「分頁清單」
（GROUPS registry），右側只顯示目前選到那一頁的規則。GROUPS 分兩種 kind：

  - "root"：全站基礎 Token（Colors/Spacing/Radius 可編輯，Shadow/Typography/
    Buttons/Cards 唯讀預覽），對應 :root 上的 CSS 變數，任何頁面/元件都會吃到。
  - "fields"：某個元件或某個頁面專屬、Token 管不到的獨立視覺值（例如首頁
    Hero 的字級、按鈕背景色）。每個 field 是 { selector, property, label, type }，
    對應 theme_css_rules 的一列。

要新增一個可調整的元素：在 GROUPS 裡新增一個 group（或在既有 group 的
fields 陣列裡加一筆），不用改渲染邏輯。這跟 SKHPS 每個元件一份
CssSetting.js、慢慢累積登錄表是同一種成長方式。

每個 "fields" group 底下還有一個範圍限定的「自訂規則」區塊，給不在
registry 裡的任意 selector 用（例如臨時想調的東西），存檔時會標記
group_name = 該 group 的 id，方便之後決定要不要正式收進 registry。

只能回報自己的 loading task，不可以自己決定 css/shell ready。CSS Rules 讀寫是背景
操作，不影響 loading gate。

整站後台加登入保護：init() 先過 window.JonaminzIdentity.requireLogin()
這關，沒登入會被導去登入頁。saveThemeCssRules 這個 action 本身在
Worker 端也要求 session（見 worker.js requireSession），所以存檔時
payload 要帶 window.JonaminzIdentity.readToken()。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";

  /* ---------- registry ---------- */

  var ROOT_TOKENS = [
    { type: "color", name: "--color-primary", label: "Primary" },
    { type: "color", name: "--color-primary-2", label: "Primary 2" },
    { type: "color", name: "--color-accent", label: "Accent" },
    { type: "color", name: "--color-bg", label: "Background" },
    { type: "color", name: "--color-text", label: "Text" },
    { type: "color", name: "--color-bg-lobby", label: "Background（大廳）" },
    { type: "color", name: "--color-text-lobby", label: "Text（大廳）" },
    { type: "color", name: "--color-lobby-accent", label: "Accent（大廳）" },
    { type: "color", name: "--color-bg-minz", label: "Background（Minz）" },
    { type: "color", name: "--color-text-minz", label: "Text（Minz）" },
    { type: "color", name: "--color-minz-accent", label: "Accent（Minz）" },
    { type: "color", name: "--color-minz-accent-2", label: "Accent 2（Minz）" },
    { type: "color", name: "--color-minz-highlight", label: "Highlight（Minz）" },
    { type: "length", name: "--space-1", label: "space-1" },
    { type: "length", name: "--space-2", label: "space-2" },
    { type: "length", name: "--space-3", label: "space-3" },
    { type: "length", name: "--space-4", label: "space-4" },
    { type: "length", name: "--space-5", label: "space-5" },
    { type: "length", name: "--space-6", label: "space-6" },
    { type: "length", name: "--space-7", label: "space-7" },
    { type: "length", name: "--radius-sm", label: "radius-sm" },
    { type: "length", name: "--radius-md", label: "radius-md" },
    { type: "length", name: "--radius-lg", label: "radius-lg" },
    { type: "length", name: "--radius-pill", label: "radius-pill" }
  ];
  var ROOT_TOKEN_GROUPS = ["Colors", "Spacing", "Radius"];
  var ROOT_TOKEN_GROUP_OF = {};
  ROOT_TOKENS.forEach(function (token) {
    if (/^--color-/.test(token.name)) ROOT_TOKEN_GROUP_OF[token.name] = "Colors";
    else if (/^--space-/.test(token.name)) ROOT_TOKEN_GROUP_OF[token.name] = "Spacing";
    else ROOT_TOKEN_GROUP_OF[token.name] = "Radius";
  });

  var SHADOW_TOKENS = ["--shadow-sm", "--shadow-md", "--shadow-lg"];
  var TEXT_TOKENS = ["--text-xs", "--text-sm", "--text-md", "--text-lg", "--text-xl", "--text-2xl"];

  var GROUPS = [
    {
      id: "root",
      nav: "全站基礎 Token",
      kind: "root",
      intro: "顏色／間距／圓角這幾個變數改了，全站（含未來外部專案）一起換。"
    },
    {
      id: "components",
      nav: "共用元件 Components",
      kind: "fields",
      intro: "元件本體（.btn／.card）幾乎全部直接吃全站 Token，這裡只列出元件自己獨立、Token 管不到的視覺值。",
      preview: "cards",
      fields: [
        { selector: ".card-glass", property: "--card-glass-blur", label: "毛玻璃卡片模糊度", type: "length", unit: "px", placeholder: "16" },
        { selector: ".jonaminz-project-card--unavailable", property: "opacity", label: "不可用專案卡片透明度", type: "number", step: "0.05", min: "0", max: "1", placeholder: "0.5" }
      ]
    },
    {
      id: "home-nav",
      nav: "首頁 ▸ 導覽列",
      kind: "fields",
      intro: "首頁頂部品牌字與 Jonathan／Minz／Login 導覽膠囊。",
      fields: [
        { selector: ".brand", property: "font-size", label: "品牌字級", type: "length", unit: "px", placeholder: "23" },
        { selector: ".nav-links a", property: "font-size", label: "導覽連結字級", type: "length", unit: "px", placeholder: "13" },
        { selector: ".nav-links a", property: "padding", label: "導覽連結內距", type: "text", placeholder: "9px 13px" }
      ]
    },
    {
      id: "home-headline",
      nav: "首頁 ▸ 主標題",
      kind: "fields",
      intro: "置中的 jonaminz 大字與姓名字級，用 clamp() 做響應式，直接編輯完整值。",
      fields: [
        { selector: ".center h1", property: "font-size", label: "主標題字級（clamp）", type: "text", placeholder: "clamp(64px, 11vw, 156px)" },
        { selector: ".center p", property: "max-width", label: "副標最大寬度", type: "length", unit: "px", placeholder: "520" },
        { selector: ".name-link strong", property: "font-size", label: "姓名字級（clamp）", type: "text", placeholder: "clamp(34px, 4.8vw, 70px)" }
      ]
    },
    {
      id: "home-cta",
      nav: "首頁 ▸ 共用入口按鈕",
      kind: "fields",
      intro: "首頁下方「共用入口」膠囊按鈕（.home-key）。",
      fields: [
        { selector: ".home-key", property: "background", label: "背景色", type: "text", placeholder: "rgba(247,240,229,.90)" },
        { selector: ".home-key", property: "color", label: "文字色", type: "text", placeholder: "#111411" }
      ]
    }
  ];

  var activeGroupId = GROUPS[0].id;
  var rules = [];
  var deletedIds = [];
  var nextTempId = -1;

  /* ---------- helpers ---------- */

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

  function normalizeColorForInput(value) {
    var v = String(value || "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(v) ? v : "#000000";
  }

  function parseLengthNumber(value) {
    var n = parseFloat(String(value || "0"));
    return isNaN(n) ? 0 : n;
  }

  function findRule(selector, property) {
    return rules.filter(function (item) {
      return item.selector === selector && item.property === property;
    })[0] || null;
  }

  function ensureRule(selector, property, groupId) {
    var rule = findRule(selector, property);
    if (!rule) {
      var initial = selector === ":root" ? tokenValue(property) : "";
      rule = { __id: nextTempId--, selector: selector, property: property, value: initial, groupName: groupId };
      rules.push(rule);
    } else if (!rule.groupName) {
      rule.groupName = groupId;
    }
    return rule;
  }

  function applyLivePreview(property, value, selector) {
    if (!selector || selector === ":root") {
      document.documentElement.style.setProperty(property, value);
      return;
    }
    document.querySelectorAll(selector).forEach(function (el) {
      el.style.setProperty(property, value);
    });
  }

  /* ---------- shared preview blocks ---------- */

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
        '<a class="jonaminz-project-card jonaminz-project-card--unavailable" href="#">' +
          '<p class="jonaminz-project-title">.jonaminz-project-card</p>' +
          '<p class="jonaminz-project-description">--unavailable 預覽</p>' +
        '</a>' +
      '</div>'
    );
  }

  var PREVIEW_BLOCKS = { cards: cardsHtml };

  /* ---------- root token editor (kind: "root") ---------- */

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
    var rule = ensureRule(":root", token.name, "root");
    return (
      '<div class="jonaminz-theme-token-row">' +
        '<span class="jonaminz-theme-token-label">' + escapeHtml(token.label) + '</span>' +
        friendlyTokenInputHtml(token, rule) +
      '</div>'
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

  function renderRootGroup() {
    return ROOT_TOKEN_GROUPS.map(function (groupLabel) {
      var tokens = ROOT_TOKENS.filter(function (token) { return ROOT_TOKEN_GROUP_OF[token.name] === groupLabel; });
      return sectionHtml(groupLabel, '<div class="jonaminz-theme-token-grid">' + tokens.map(friendlyTokenRowHtml).join('') + '</div>');
    }).join('') +
      sectionHtml("Shadow", scaleHtml(SHADOW_TOKENS, function (name) {
        return '<span class="jonaminz-theme-scale-box" style="box-shadow:var(' + name + ')"></span>';
      })) +
      sectionHtml("Typography", scaleHtml(TEXT_TOKENS, function (name) {
        return '<span style="font-size:var(' + name + ')">Aa</span>';
      })) +
      sectionHtml("Buttons（唯讀預覽）", buttonsHtml()) +
      sectionHtml("Cards（唯讀預覽）", cardsHtml());
  }

  /* ---------- fields editor (kind: "fields") ---------- */

  function fieldInputHtml(field, rule) {
    var common = 'data-field-selector="' + escapeAttr(field.selector) + '" data-field-property="' + escapeAttr(field.property) + '"';

    if (field.type === "color") {
      return '<input type="color" class="jonaminz-theme-field-input" ' + common + ' value="' + escapeAttr(normalizeColorForInput(rule.value)) + '">';
    }

    if (field.type === "length") {
      return (
        '<span class="jonaminz-theme-token-length">' +
          '<input type="number" class="jonaminz-theme-field-input" ' + common + ' value="' + escapeAttr(rule.value ? parseLengthNumber(rule.value) : "") + '" placeholder="' + escapeAttr(field.placeholder || "") + '"> ' + (field.unit || "") +
        '</span>'
      );
    }

    if (field.type === "number") {
      return (
        '<input type="number" class="jonaminz-theme-field-input" ' + common +
        ' step="' + escapeAttr(field.step || "1") + '" min="' + escapeAttr(field.min || "") + '" max="' + escapeAttr(field.max || "") + '"' +
        ' value="' + escapeAttr(rule.value || "") + '" placeholder="' + escapeAttr(field.placeholder || "") + '">'
      );
    }

    return (
      '<input type="text" class="jonaminz-theme-field-input jonaminz-theme-field-input--text" ' + common +
      ' value="' + escapeAttr(rule.value || "") + '" placeholder="' + escapeAttr(field.placeholder || "") + '">'
    );
  }

  function fieldRowHtml(group, field) {
    var rule = ensureRule(field.selector, field.property, group.id);
    return (
      '<div class="jonaminz-theme-field-row">' +
        '<div class="jonaminz-theme-field-meta">' +
          '<span class="jonaminz-theme-field-label">' + escapeHtml(field.label) + '</span>' +
          '<code class="jonaminz-theme-field-selector">' + escapeHtml(field.selector) + ' → ' + escapeHtml(field.property) + '</code>' +
        '</div>' +
        fieldInputHtml(field, rule) +
      '</div>'
    );
  }

  function isRegisteredField(rule) {
    return GROUPS.some(function (group) {
      return group.fields && group.fields.some(function (field) {
        return field.selector === rule.selector && field.property === rule.property;
      });
    });
  }

  function scopedCustomRules(groupId) {
    return rules.filter(function (rule) {
      return rule.groupName === groupId && !isRegisteredField(rule);
    });
  }

  function customRuleRowHtml(rule) {
    return (
      '<div class="jonaminz-theme-rule-row" data-rule-id="' + escapeAttr(rule.__id) + '">' +
        '<input class="jonaminz-theme-rule-input" data-custom-field="selector" placeholder=".selector" value="' + escapeAttr(rule.selector) + '">' +
        '<input class="jonaminz-theme-rule-input" data-custom-field="property" placeholder="border-radius" value="' + escapeAttr(rule.property) + '">' +
        '<input class="jonaminz-theme-rule-input" data-custom-field="value" placeholder="12px" value="' + escapeAttr(rule.value) + '">' +
        '<button class="jonaminz-theme-rule-delete" type="button" data-rule-delete>刪除</button>' +
      '</div>'
    );
  }

  function renderFieldsGroup(group) {
    var preview = group.preview && PREVIEW_BLOCKS[group.preview] ? sectionHtml("即時預覽", PREVIEW_BLOCKS[group.preview]()) : "";

    return (
      sectionHtml("可調整項目", '<div class="jonaminz-theme-field-list">' + group.fields.map(function (field) { return fieldRowHtml(group, field); }).join('') + '</div>') +
      preview +
      sectionHtml("自訂規則（不在上面清單裡的任意 selector）", (
        '<div class="jonaminz-theme-rules" data-custom-rules="' + escapeAttr(group.id) + '">' +
          scopedCustomRules(group.id).map(customRuleRowHtml).join('') +
        '</div>' +
        '<div class="jonaminz-theme-row">' +
          '<button class="btn btn-ghost" type="button" data-custom-rule-add="' + escapeAttr(group.id) + '">+ 新增規則</button>' +
        '</div>'
      ))
    );
  }

  /* ---------- shell / nav ---------- */

  function currentGroup() {
    return GROUPS.filter(function (g) { return g.id === activeGroupId; })[0] || GROUPS[0];
  }

  function navHtml() {
    return (
      '<nav class="jonaminz-theme-nav">' +
        GROUPS.map(function (group) {
          var active = group.id === activeGroupId ? " is-active" : "";
          return '<button class="jonaminz-theme-nav-item' + active + '" type="button" data-group-id="' + escapeAttr(group.id) + '">' + escapeHtml(group.nav) + '</button>';
        }).join('') +
      '</nav>'
    );
  }

  function panelHtml() {
    var group = currentGroup();
    var body = group.kind === "root" ? renderRootGroup() : renderFieldsGroup(group);

    return (
      '<div class="jonaminz-theme-panel">' +
        '<div class="jonaminz-theme-panel-head">' +
          '<h2 class="jonaminz-theme-panel-title">' + escapeHtml(group.nav) + '</h2>' +
          (group.intro ? '<p class="jonaminz-page-subtitle jonaminz-theme-group-intro">' + escapeHtml(group.intro) + '</p>' : "") +
        '</div>' +
        body +
      '</div>'
    );
  }

  function renderShowcase() {
    var root = document.querySelector("[data-app-root]");
    if (!root) return;

    root.innerHTML = (
      '<div class="jonaminz-theme-toolbar">' +
        '<button class="btn btn-primary" type="button" data-rule-save>儲存並套用</button>' +
        '<p class="jonaminz-page-subtitle" data-rule-status>讀取中...</p>' +
      '</div>' +
      '<div class="jonaminz-theme-layout">' +
        navHtml() +
        '<div class="jonaminz-theme-content" data-theme-content>' + panelHtml() + '</div>' +
      '</div>'
    );
  }

  function rerenderPanel() {
    var content = document.querySelector("[data-theme-content]");
    if (content) content.innerHTML = panelHtml();

    var nav = document.querySelector(".jonaminz-theme-nav");
    if (nav) {
      nav.querySelectorAll("[data-group-id]").forEach(function (btn) {
        btn.classList.toggle("is-active", btn.getAttribute("data-group-id") === activeGroupId);
      });
    }
  }

  /* ---------- events ---------- */

  function setStatus(text) {
    var el = document.querySelector("[data-rule-status]");
    if (el) el.textContent = text || "";
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
        var rootRule = ensureRule(":root", tokenName, "root");

        rootRule.value = value;
        applyLivePreview(tokenName, value, ":root");
        return;
      }

      var fieldInput = event.target.closest(".jonaminz-theme-field-input");
      if (fieldInput) {
        var selector = fieldInput.getAttribute("data-field-selector");
        var property = fieldInput.getAttribute("data-field-property");
        var isLength = fieldInput.closest(".jonaminz-theme-token-length") !== null;
        var value2 = isLength ? (parseLengthNumber(fieldInput.value) + "px") : fieldInput.value;
        var fieldRule = ensureRule(selector, property, activeGroupId);

        fieldRule.value = value2;
        applyLivePreview(property, value2, selector);
        return;
      }

      var ruleInput = event.target.closest(".jonaminz-theme-rule-input");
      if (ruleInput) {
        var row = ruleInput.closest("[data-rule-id]");
        var id = row.getAttribute("data-rule-id");
        var field = ruleInput.getAttribute("data-custom-field");
        var customRule = rules.filter(function (item) { return String(item.__id) === id; })[0];

        if (customRule) customRule[field] = ruleInput.value;
      }
    });

    root.addEventListener("click", function (event) {
      var groupBtn = event.target.closest("[data-group-id]");
      if (groupBtn) {
        activeGroupId = groupBtn.getAttribute("data-group-id");
        rerenderPanel();
        return;
      }

      var addBtn = event.target.closest("[data-custom-rule-add]");
      if (addBtn) {
        rules.push({ __id: nextTempId--, selector: "", property: "", value: "", groupName: addBtn.getAttribute("data-custom-rule-add") });
        rerenderPanel();
        return;
      }

      var deleteBtn = event.target.closest("[data-rule-delete]");
      if (deleteBtn) {
        var row2 = deleteBtn.closest("[data-rule-id]");
        var id2 = row2.getAttribute("data-rule-id");

        if (Number(id2) > 0) deletedIds.push(Number(id2));
        rules = rules.filter(function (item) { return String(item.__id) !== id2; });
        rerenderPanel();
        return;
      }

      if (event.target.closest("[data-rule-save]")) {
        saveRules();
      }
    });
  }

  /* ---------- backend ---------- */

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
            value: row.value || "",
            groupName: row.group_name || ""
          };
        });

        renderShowcase();
        bindEvents();
        setStatus("已讀取 " + rules.length + " 條已存規則。");
      })
      .catch(function (error) {
        setStatus("讀取失敗，畫面先用目前生效的預設值：" + (error && error.message ? error.message : String(error)));
      });
  }

  function saveRules() {
    var upsert = rules
      .filter(function (rule) { return rule.selector.trim() && rule.property.trim(); })
      .map(function (rule) {
        return { selector: rule.selector.trim(), property: rule.property.trim(), value: rule.value.trim(), groupName: rule.groupName || "" };
      });

    setStatus("儲存中...");

    window.JonaminzBackend.call("saveThemeCssRules", { upsert: upsert, deleteIds: deletedIds, token: window.JonaminzIdentity.readToken() })
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
    window.JonaminzIdentity.requireLogin().then(function () {
      try {
        renderShowcase();
        bindEvents();
        window.JonaminzLoading.done(READY_TASK);
        loadRules();
      } catch (error) {
        console.error("[jonaminz] theme app.js init failed", error);
        window.JonaminzLoading.fail(READY_TASK, error);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
