/*
檔案位置：jonaminz/pages/admin/connections/assets/js/app.js
用途：後台「連線狀態」頁自己的業務入口（水庫下游層）。只能回報自己的
loading task，不可以自己決定 css/shell ready。

2026-07-15：從 pages/admin/assets/js/app.js 搬過來——原本 OneDrive
連接狀態直接畫在後台首頁，使用者提出這頁不該只服務 OneDrive，之後接
其他外部服務（推播供應商、其他雲端儲存等）的健康檢查也要能放在同一個
地方，不用每次都回頭改後台首頁。目前只有 OneDrive 一個小節；之後要加
新的連線類型，比照 renderOnedriveSection 的寫法各自寫一個
render__Section 函式、在 init() 裡多呼叫一行即可，不需要額外抽象——
只有一種連線類型時，先不做「連線類型清單」這種通用機制。

整站後台加登入保護：init() 先過 window.JonaminzIdentity.requireLogin()
這關（見 assets/js/header.js），沒登入會被導去 /pages/login/?next=...。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";
  var IDENTITY_LABEL = { jonathan: "Jonathan", minz: "Minz" };

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  // 跟 pages/admin/assets/js/app.js 同一支（顯示 Supabase 時間戳一律要
  // 轉當地時間，不能直接印原始 ISO 字串），兩邊各自維護一份小 helper，
  // 跟這個專案「每頁自己完整、不共用元件庫」的既有慣例一致。
  function formatLocalDateTime(value) {
    if (!value) return "";
    try {
      return new Date(value).toLocaleString("zh-TW", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false
      });
    } catch (error) {
      return String(value);
    }
  }

  function render() {
    var root = document.querySelector("[data-app-root]");
    if (!root) return;

    root.innerHTML =
      '<section class="jonaminz-connections-section">' +
        '<p class="jonaminz-admin-section-title">OneDrive（圖片分享／App 發佈用）</p>' +
        '<div class="jonaminz-admin-onedrive-grid">' +
          '<div data-onedrive-status="jonathan">讀取中...</div>' +
          '<div data-onedrive-status="minz">讀取中...</div>' +
        '</div>' +
      '</section>' +
      '<section class="jonaminz-connections-section">' +
        '<p class="jonaminz-admin-section-title">Chat 檔案保留天數</p>' +
        '<div data-retention-status>讀取中...</div>' +
      '</section>';
  }

  // 2026-07-15（OneDrive 線 Phase A，雙帳號模式）：Jonathan／Minz 各自
  // 連自己的 OneDrive（兩人都想從自己帳號查得到聊天圖庫，見
  // AI_CONTEXT/ONEDRIVE_LINE_SPEC.md 的決策記錄）。這裡同時畫兩張卡片
  // ——兩張卡片都可以按「連接」／「測試連線」,不限定只能操作登入者
  // 自己那張(使用者明確要求：兩人共用帳密，這層限制沒有實際安全意義；
  // worker.js 的 /auth/onedrive/start、testOnedriveConnection 都已經
  // 放行指定任一身分，見那邊的註解)。
  function renderOnedriveSection() {
    if (!window.JonaminzBackend || typeof window.JonaminzBackend.getOnedriveStatus !== "function") {
      ["jonathan", "minz"].forEach(function (id) {
        var el = document.querySelector('[data-onedrive-status="' + id + '"]');
        if (el) el.textContent = "後端尚未載入。";
      });
      return;
    }

    var token = (window.JonaminzIdentity && window.JonaminzIdentity.readToken)
      ? window.JonaminzIdentity.readToken() : null;

    window.JonaminzBackend.getOnedriveStatus({ token: token })
      .then(function (response) {
        if (!response || !response.ok) {
          var errorMessage = "狀態讀取失敗：" + ((response && response.error) || "未知錯誤");
          ["jonathan", "minz"].forEach(function (id) {
            var el = document.querySelector('[data-onedrive-status="' + id + '"]');
            if (el) el.textContent = errorMessage;
          });
          return;
        }

        ["jonathan", "minz"].forEach(function (id) {
          renderOnedriveCard(id, response.accounts[id], token);
        });
      })
      .catch(function (error) {
        var errorMessage = "狀態讀取失敗：" + (error && error.message ? error.message : String(error));
        ["jonathan", "minz"].forEach(function (id) {
          var el = document.querySelector('[data-onedrive-status="' + id + '"]');
          if (el) el.textContent = errorMessage;
        });
      });
  }

  function renderOnedriveCard(cardIdentity, account, token) {
    var el = document.querySelector('[data-onedrive-status="' + cardIdentity + '"]');
    if (!el) return;
    var label = IDENTITY_LABEL[cardIdentity] || cardIdentity;

    if (account && account.connected) {
      el.innerHTML =
        '<p><strong>' + escapeHtml(label) + '</strong>：已連接（' + escapeHtml(formatLocalDateTime(account.connectedAt)) + '）</p>' +
        '<button type="button" class="jonaminz-admin-onedrive-test" data-onedrive-test>測試連線</button>' +
        '<a class="jonaminz-admin-onedrive-connect" data-onedrive-reconnect target="_blank" rel="noopener">重新連接</a>' +
        '<span data-onedrive-test-result></span>';
      var testBtn = el.querySelector("[data-onedrive-test]");
      testBtn.addEventListener("click", function () {
        testBtn.disabled = true;
        var resultEl = el.querySelector("[data-onedrive-test-result]");
        resultEl.textContent = " 測試中...";
        window.JonaminzBackend.testOnedriveConnection({ token: token, identity: cardIdentity })
          .then(function (result) {
            testBtn.disabled = false;
            if (result && result.ok) {
              // Files.ReadWrite.AppFolder 這個 scope 會把檔案放進一個
              // 專屬的「應用程式資料夾」，一般人不知道要去哪裡找，直接
              // 給一個可以點的連結比較實際，不用另外文字說明資料夾路徑。
              resultEl.innerHTML = " 成功：App Folder「" + escapeHtml(result.folderName || "") + "」可讀寫" +
                (result.webUrl
                  ? '（<a href="' + escapeHtml(result.webUrl) + '" target="_blank" rel="noopener">在 OneDrive 開啟這個資料夾</a>）'
                  : "");
            } else {
              resultEl.textContent = " 失敗：" + ((result && result.error) || "未知錯誤");
            }
          })
          .catch(function (error) {
            testBtn.disabled = false;
            resultEl.textContent = " 失敗：" + (error && error.message ? error.message : String(error));
          });
      });
      // 「重新連接」用途：Azure 那邊新增 Graph 權限後，舊的 refresh
      // token 不會自動長出新 scope，要重新走一次 /auth/onedrive/start
      // 才能拿到含新權限的授權（見 CHANGELOG「OneDrive 線 Phase B」）。
      var reconnectLink = el.querySelector("[data-onedrive-reconnect]");
      window.JonaminzBackend.getWorkerBaseUrlForRedirect().then(function (baseUrl) {
        reconnectLink.href = baseUrl + "/auth/onedrive/start?token=" + encodeURIComponent(token || "") +
          "&identity=" + encodeURIComponent(cardIdentity);
      });
      return;
    }

    el.innerHTML =
      '<p><strong>' + escapeHtml(label) + '</strong>：尚未連接。</p>' +
      '<a class="jonaminz-admin-onedrive-connect" data-onedrive-connect target="_blank" rel="noopener">連接 OneDrive</a>';
    var connectLink = el.querySelector("[data-onedrive-connect]");
    window.JonaminzBackend.getWorkerBaseUrlForRedirect().then(function (baseUrl) {
      connectLink.href = baseUrl + "/auth/onedrive/start?token=" + encodeURIComponent(token || "") +
        "&identity=" + encodeURIComponent(cardIdentity);
    });
  }

  // 2026-07-16：Chat 傳的圖片/檔案會佔用 OneDrive App Folder 容量，
  // Worker 端會依這個天數自動清除超過保留期限的檔案本體（見 worker.js
  // maybeRunChatFilePurge）——這裡只是讀寫 app_settings 那個數字，不是
  // 這頁自己做清理。存檔用同一顆按鈕，成功後把顯示文字換成新的天數，
  // 不用整頁重新整理。
  function renderChatFileRetentionSection() {
    var el = document.querySelector("[data-retention-status]");
    if (!el) return;
    if (!window.JonaminzBackend || typeof window.JonaminzBackend.getChatFileRetentionSettings !== "function") {
      el.textContent = "後端尚未載入。";
      return;
    }
    var token = (window.JonaminzIdentity && window.JonaminzIdentity.readToken)
      ? window.JonaminzIdentity.readToken() : null;

    window.JonaminzBackend.getChatFileRetentionSettings({ token: token })
      .then(function (response) {
        if (!response || !response.ok) {
          el.textContent = "讀取失敗：" + ((response && response.error) || "未知錯誤");
          return;
        }
        renderRetentionForm(el, response.retentionDays, token);
      })
      .catch(function (error) {
        el.textContent = "讀取失敗：" + (error && error.message ? error.message : String(error));
      });
  }

  function renderRetentionForm(el, retentionDays, token) {
    el.innerHTML =
      '<p>Chat 傳的圖片/檔案超過這個天數後，會自動從 OneDrive 清除（聊天記錄本身不會刪）。目前：<strong data-retention-current>' +
      escapeHtml(retentionDays) + ' 天</strong>（約 ' + escapeHtml(Math.round(retentionDays / 30)) + ' 個月）。</p>' +
      '<input type="number" min="7" max="3650" step="1" value="' + escapeHtml(retentionDays) +
      '" data-retention-input class="jonaminz-admin-retention-input">' +
      '<button type="button" class="jonaminz-admin-onedrive-test" data-retention-save>儲存</button>' +
      '<span data-retention-result></span>';

    var input = el.querySelector("[data-retention-input]");
    var saveBtn = el.querySelector("[data-retention-save]");
    var resultEl = el.querySelector("[data-retention-result]");

    saveBtn.addEventListener("click", function () {
      var days = parseInt(input.value, 10);
      if (!Number.isInteger(days) || days < 7 || days > 3650) {
        resultEl.textContent = " 天數要是 7~3650 之間的整數";
        return;
      }
      saveBtn.disabled = true;
      resultEl.textContent = " 儲存中...";
      window.JonaminzBackend.updateChatFileRetentionDays({ token: token, days: days })
        .then(function (response) {
          saveBtn.disabled = false;
          if (response && response.ok) {
            resultEl.textContent = " 已儲存";
            renderRetentionForm(el, response.retentionDays, token);
          } else {
            resultEl.textContent = " 失敗：" + ((response && response.error) || "未知錯誤");
          }
        })
        .catch(function (error) {
          saveBtn.disabled = false;
          resultEl.textContent = " 失敗：" + (error && error.message ? error.message : String(error));
        });
    });
  }

  function init() {
    window.JonaminzIdentity.requireLogin().then(function () {
      try {
        render();
        window.JonaminzLoading.done(READY_TASK);
        renderOnedriveSection();
        renderChatFileRetentionSection();
      } catch (error) {
        console.error("[jonaminz] admin-connections app.js init failed", error);
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
