/*
檔案位置：jonaminz/assets/js/registry-loader.js
用途：jonaminz 水庫的「外部專案登錄表」載入器。

水庫法則：
- registry.json 是水庫層擁有的登錄表：enabled / position / group / order 全部由這裡
  決定，外部專案自己的 manifest（jonaminz-app.json）只能提供顯示用的
  title / description / href / version，不能決定自己是否啟用或排序。
- 外部專案不需要修改 jonaminz 任何程式碼就能被列出來：只要在 registry.json 新增一筆
  指向它自己 manifestUrl 的登錄，jonaminz 會自動 fetch 該 manifest 顯示卡片。
- 個別外部專案 fetch 失敗（離線 / CORS / 404）不可以擋住其他專案顯示。
- 本檔案屬於水庫 shell 層，由 entry-core.js 與 header.js / footer.js 一起載入；
  fetch 是非同步背景動作，不回報 loading task，也不會擋住 loading gate。
*/
(function () {
  "use strict";

  var REGISTRY_URL = "/registry.json";
  var MANIFEST_TIMEOUT_MS = 6000;

  function withVersion(url) {
    var version = window.JONAMINZ_ENTRY_VERSION || String(Date.now());
    var sep = url.indexOf("?") === -1 ? "?" : "&";
    return url + sep + "v=" + encodeURIComponent(version);
  }

  function fetchJsonWithTimeout(url, timeoutMs) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs);

    return fetch(url, { signal: controller.signal })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .finally(function () { clearTimeout(timer); });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function renderEmpty(container) {
    container.innerHTML = '<p class="jonaminz-projects-empty">目前沒有外部專案。</p>';
  }

  function renderError(container) {
    container.innerHTML = '<p class="jonaminz-projects-empty">外部專案清單載入失敗。</p>';
  }

  function cardHtml(entry, manifest) {
    var title = escapeHtml((manifest && manifest.title) || entry.projectId);
    var description = escapeHtml((manifest && manifest.description) || "");
    var href = escapeHtml((manifest && manifest.href) || "#");
    var version = escapeHtml((manifest && manifest.version) || "");

    return (
      '<a class="jonaminz-project-card" href="' + href + '" target="_blank" rel="noopener">' +
        '<p class="jonaminz-project-title">' + title + '</p>' +
        (description ? '<p class="jonaminz-project-description">' + description + '</p>' : '') +
        (version ? '<p class="jonaminz-project-version">' + version + '</p>' : '') +
      '</a>'
    );
  }

  function unavailableCardHtml(entry) {
    return (
      '<div class="jonaminz-project-card jonaminz-project-card--unavailable">' +
        '<p class="jonaminz-project-title">' + escapeHtml(entry.projectId) + '</p>' +
        '<p class="jonaminz-project-description">目前無法連線。</p>' +
      '</div>'
    );
  }

  function render(container, results) {
    if (results.length === 0) {
      renderEmpty(container);
      return;
    }

    container.innerHTML = results.map(function (item) {
      return item.manifest ? cardHtml(item.entry, item.manifest) : unavailableCardHtml(item.entry);
    }).join("");
  }

  function init() {
    var container = document.querySelector("[data-jonaminz-projects]");
    if (!container) return;

    fetchJsonWithTimeout(withVersion(REGISTRY_URL), MANIFEST_TIMEOUT_MS)
      .then(function (registry) {
        var entries = (registry.externalProjects || [])
          .filter(function (entry) { return entry.enabled !== false; })
          .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

        if (entries.length === 0) {
          renderEmpty(container);
          return;
        }

        return Promise.all(entries.map(function (entry) {
          return fetchJsonWithTimeout(withVersion(entry.manifestUrl), MANIFEST_TIMEOUT_MS)
            .then(function (manifest) { return { entry: entry, manifest: manifest }; })
            .catch(function (error) {
              console.warn("[jonaminz] external project manifest failed:", entry.projectId, error);
              return { entry: entry, manifest: null };
            });
        })).then(function (results) { render(container, results); });
      })
      .catch(function (error) {
        console.error("[jonaminz] registry.json load failed", error);
        renderError(container);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
