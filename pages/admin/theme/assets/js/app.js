/*
檔案位置：jonaminz/pages/admin/theme/assets/js/app.js
用途：Theme 頁自己的業務入口（水庫下游層）。
渲染 02-tokens.css 的 design token 與 05/06 層的共用元件，當作
CSS 疊加架構的活文件；之後要做拖拉調色盤時，從這裡接手讀寫
document.documentElement.style（覆蓋 :root 的 CSS 變數）即可，
不用回頭改 reservoir 本體。
只能回報自己的 loading task，不可以自己決定 css/shell ready。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";

  var COLOR_TOKENS = [
    "--color-bg", "--color-bg-dark", "--color-text", "--color-text-dark",
    "--color-text-muted", "--color-primary", "--color-primary-2",
    "--color-accent", "--color-border", "--color-surface"
  ];
  var SPACE_TOKENS = ["--space-1", "--space-2", "--space-3", "--space-4", "--space-5", "--space-6", "--space-7"];
  var RADIUS_TOKENS = ["--radius-sm", "--radius-md", "--radius-lg", "--radius-pill"];
  var SHADOW_TOKENS = ["--shadow-sm", "--shadow-md", "--shadow-lg"];
  var TEXT_TOKENS = ["--text-xs", "--text-sm", "--text-md", "--text-lg", "--text-xl", "--text-2xl"];

  function tokenValue(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
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

  function colorSwatchesHtml() {
    return (
      '<div class="jonaminz-theme-swatches">' +
        COLOR_TOKENS.map(function (name) {
          return (
            '<div class="jonaminz-theme-swatch">' +
              '<span class="jonaminz-theme-swatch-color" style="background:var(' + name + ')"></span>' +
              '<code>' + name + '</code>' +
              '<span class="jonaminz-theme-swatch-value">' + tokenValue(name) + '</span>' +
            '</div>'
          );
        }).join('') +
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

  function render() {
    var root = document.querySelector("[data-app-root]");
    if (!root) return;

    root.innerHTML = [
      sectionHtml("Colors", colorSwatchesHtml()),
      sectionHtml("Spacing", scaleHtml(SPACE_TOKENS, function (name) {
        return '<span class="jonaminz-theme-scale-box" style="width:var(' + name + ');height:var(' + name + ')"></span>';
      })),
      sectionHtml("Radius", scaleHtml(RADIUS_TOKENS, function (name) {
        return '<span class="jonaminz-theme-scale-box" style="border-radius:var(' + name + ')"></span>';
      })),
      sectionHtml("Shadow", scaleHtml(SHADOW_TOKENS, function (name) {
        return '<span class="jonaminz-theme-scale-box" style="box-shadow:var(' + name + ')"></span>';
      })),
      sectionHtml("Typography", scaleHtml(TEXT_TOKENS, function (name) {
        return '<span style="font-size:var(' + name + ')">Aa</span>';
      })),
      sectionHtml("Buttons", buttonsHtml()),
      sectionHtml("Cards", cardsHtml())
    ].join('');
  }

  function init() {
    try {
      render();
      window.JonaminzLoading.done(READY_TASK);
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
