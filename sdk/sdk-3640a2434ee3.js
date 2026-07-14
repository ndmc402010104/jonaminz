/*
 * 自動產生，不要手動編輯。
 * 來源：sdk/sdk-src/sdk.js（內容的 sha256 前 12 碼）
 * 產生方式：node sdk/generate-sdk-release.mjs
 * immutable：這個檔名就是這份內容的身分，內容不會變、也不該被覆寫。
 * sdk-src/sdk.js 改了要重跑這支腳本產生新檔名，並自行決定要不要把
 * backend/cloudflare-worker/sdk-versions.json 的某個 channel 指過來。
 */
/*
檔案位置：jonaminz/sdk/sdk-src/sdk.js
用途：implementation plan 第 6 項——SDK Kernel。取代第 5 項的 placeholder，
真的去讀合約、推送給平台、查 Effective Settings，正確 settle S21 官方
snippet 的 `ready` Promise。對應規格 S18-S23（contract discovery、snippet
協定）、S26（lifecycle 狀態機）、S27-S29（錯誤模型）。

implementation plan 第 7 項新增：`effectiveCss === "tokens"` 時呼叫
`applyTokens()`，收編 `assets/js/theme-runtime.js` 現有的「讀
`theme_css_rules`、組 CSS、注入 `<style>`」邏輯，但走 gated 路徑
（原本 theme-runtime.js 是任何人貼一行 script 就拿得到，不經過
Contract／Settings 審核，v0 舊機制，這次不動它）。只收編 `:root` 那些
列（S35：跨專案共用介面），不收編其他 selector（jonaminz 自己共用元件
的微調，對外部專案沒有意義）。命名機械式轉換成 `--jz-*`（S36：
`--color-primary` → `--jz-primary`），舊名保留當別名一起輸出，不是
只換不留。CSS 套用不 await、不擋 `ready` settle——S23 沒有把它列進
`ready` 的必要條件，套用失敗只是不顯示外觀，不影響核心 lifecycle
（跟 theme-runtime.js 一樣的容錯哲學）。

implementation plan 第 9 項階段 B 新增：第一個正式發布的 service——
`window.Jonaminz.identity.currentUser()`（`identity.current-user@1`，
S30-33）。S32 規定一經發布，這個 function 永遠掛在 API 物件上，不論
呼叫端的專案有沒有被授權都不能變成 undefined；未授權時呼叫要 reject
`CAPABILITY_NOT_GRANTED`，不能同步 throw。實際取得身分的方式是動態建立
一個隱藏 iframe 指到 `pages/identity-relay/`（同源於 jonaminz.com，能
讀到 jonaminz 自己的登入 session；這裡跟 jonaminz.com 不同源，讀不到），
用 postMessage 收結果——**SDK 端的 capabilities 陣列只是提示，S33 規定
真正的授權判斷要由 Worker 逐請求重算**，所以 relay 頁面背後打的是新
action `getGrantedIdentity`，不是隨便信任這裡快取的值。identity 授權
與否是獨立的能力，不影響 tokens／`ready`／`degraded` 這條既有 lifecycle。

2026-07-14 改名：capability ID 原本是 `identity.currentUser@1`
（camelCase），撞上 contract schema 的 kebab-case capabilityId
pattern，外部專案永遠無法在合約裡合法宣告它（見 KNOWN_ISSUES.md
#12）。趁零消費者（沒有任何專案真的被授權過）改成這裡的
`identity.current-user@1`，成本最低。**函式名
`window.Jonaminz.identity.currentUser()` 不受影響**——S30 的
capability ID 命名規則跟 S32 的 API 物件函式命名是兩個獨立維度，
改其中一個不需要動另一個。

2026-07-14 新增：`chat.launcher@1` capability——外部專案被授權後，SDK
自動在右下角掛一個浮動 Chat 入口。**刻意比照 applyTokens() 的自動套用
模式，不是比照 identity.currentUser() 的公開 service 模式**：S32 規定
service 一經發布永遠不能拿掉，而這個入口沒有任何呼叫端需要程式化控制
它（有授權就出現、沒授權就不出現），不值得為它背一個永久 API 承諾。

2026-07-14（同日第三次修正，教訓見 CHANGELOG）：一開始是單一 iframe
同時管大頭貼跟展開後的面板（靠內部視圖切換 + 對 iframe 元素套
border-radius 解決 Android 上 iframe 內部透明不可靠的問題），但一個
iframe 只能裁一種形狀，逼得展開時要把大頭貼縮成面板內部的「迷你版」，
使用者在真實裝置上連續兩輪回報「還是被蓋住」——大頭貼本質上該是
面板外面一個永遠存在的獨立元素。改成**兩個完全獨立的 iframe**：
`pages/chat-launcher/`（大頭貼，永遠存在、固定圓形）跟
`pages/chat-panel/`（面板，只有點過大頭貼才建立、圓角矩形，尺寸依
半版/全版狀態決定），各自對應到宿主這裡建立的兩個 `<iframe>` 元素，
各自套 `border-radius`／`box-shadow`（技巧不變，只是不再擠在同一個
裡面）。大頭貼 iframe postMessage `toggle` 通知這裡建立/移除面板
iframe；面板 iframe postMessage `setSize` 通知這裡調整它自己的尺寸。
掛載失敗只 console.warn，不影響 ready/degraded。

改這個檔案後要重跑 sdk/generate-sdk-release.mjs 產生新的
sdk/sdk-<hash>.js，並且要人工決定要不要把某個 channel 的指標指過去
（不自動發生）。
*/
(function () {
  "use strict";

  var WORKER_URL = "https://jonaminz-backend.ndmc402010104.workers.dev/api/action";
  var DEFAULT_CONTRACT_PATH = "/jonaminz.contract.json";
  var FETCH_TIMEOUT_MS = 8000;

  var IDENTITY_CAPABILITY = "identity.current-user@1";
  var IDENTITY_RELAY_URL = "https://www.jonaminz.com/pages/identity-relay/";
  var IDENTITY_RELAY_ORIGIN = "https://www.jonaminz.com";
  var IDENTITY_TIMEOUT_MS = 5000;
  var IDENTITY_LABEL = { jonathan: "Jonathan", minz: "Minz" };

  var CHAT_LAUNCHER_CAPABILITY = "chat.launcher@1";
  var CHAT_LAUNCHER_EMBED_URL = "https://www.jonaminz.com/pages/chat-launcher/";
  var CHAT_PANEL_EMBED_URL = "https://www.jonaminz.com/pages/chat-panel/";
  var CHAT_LAUNCHER_ORIGIN = "https://www.jonaminz.com";

  // S31 的 effective capabilities（getEffectiveSettings 回應算出來的
  // 交集），在 settings 這輪流程跑完之前一律是空陣列——currentUser() 會
  // 先等 whenSettingsSettled() 才讀這個變數，不會讀到中途的暫時值。
  var effectiveCapabilities = [];
  var settingsSettled = false;
  var settingsWaiters = [];

  function whenSettingsSettled() {
    if (settingsSettled) return Promise.resolve();
    return new Promise(function (resolve) { settingsWaiters.push(resolve); });
  }

  // report() 是既有 lifecycle 唯一寫入 status 的地方，這裡搭便車在每次
  // report() 呼叫時一併 settle，涵蓋所有既有的 ready/degraded 路徑，不用
  // 另外在每個 .then()/.catch() 分支各自加一次 settle 呼叫。
  function settleSettings() {
    if (settingsSettled) return;
    settingsSettled = true;
    var waiters = settingsWaiters;
    settingsWaiters = [];
    waiters.forEach(function (resolve) { resolve(); });
  }

  function timeoutFetch(url, options) {
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT_MS) : null;

    return fetch(url, {
      method: (options && options.method) || "GET",
      headers: options && options.headers,
      body: options && options.body,
      signal: controller ? controller.signal : undefined
    })
      .then(function (response) {
        if (timer) clearTimeout(timer);
        return response;
      })
      .catch(function (error) {
        if (timer) clearTimeout(timer);
        throw error;
      });
  }

  function callWorker(action, payload) {
    return timeoutFetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: action, payload: payload || {} })
    }).then(function (response) {
      return response.json();
    });
  }

  // S19：Contract URL 限跟目前頁面同源。data-contract 若指到別的 origin
  // （或根本不是合法 URL），視為 discovery 失敗，不接受跨源合約——絕對
  // URL 覆寫同源限制是規格明確否決的行為（S20）。
  function resolveContractUrl(overridePath) {
    try {
      var resolved = new URL(overridePath || DEFAULT_CONTRACT_PATH, window.location.origin);
      if (resolved.origin !== window.location.origin) return null;
      return resolved.href;
    } catch (error) {
      return null;
    }
  }

  // F5/S8 最小必填集合的客戶端粗篩——不是 Worker 那份完整 JSON Schema
  // 驗證（那份在 submitContract 裡跑），這裡只擋明顯壞掉的合約，
  // 不用重工整份驗證邏輯。
  function hasMinimalFields(contract) {
    return !!(
      contract &&
      typeof contract === "object" &&
      typeof contract.contractVersion === "number" &&
      contract.app &&
      typeof contract.app.projectId === "string" &&
      contract.app.projectId &&
      typeof contract.app.title === "string" &&
      contract.app.title
    );
  }

  // S22：有 __snippetVersion 標記才是官方 snippet 建立的物件，在上面
  // 初始化；沒有標記（window.Jonaminz 不存在，或被其他程式佔用）一律
  // 不覆寫、不建立，靜默退場——這是規格明文規定的行為，不是防禦性巧合。
  function findSnippetTarget() {
    var jz = window.Jonaminz;
    if (!jz || !jz.__snippetVersion) return null;
    return jz;
  }

  // S21：__bootstrap 存在就呼叫它的 settle()（該函式自己保證只生效一次）；
  // __bootstrap 已經被刪除（15 秒逾時已經 settle 成 degraded，Kernel 才
  // 姍姍來遲）就不重播 Promise，直接就地更新同一個物件的 status/reason/
  // diagnostics——宿主下次讀 jz.status 就會看到恢復。
  function report(jz, status, reason, diagnostics) {
    jz.diagnostics = diagnostics;
    if (jz.__bootstrap) {
      jz.__bootstrap.settle(status, reason);
    } else {
      jz.status = status;
      jz.reason = reason || null;
    }
    settleSettings();
  }

  // S36：機械式轉換，不引入新的命名意見——拿掉舊前綴（目前只有
  // "--color-" 這一種）、換成 "--jz-"，其餘語意名稱不變。
  function jzTokenName(property) {
    if (property.indexOf("--color-") === 0) return "--jz-" + property.slice(8);
    if (property.indexOf("--") === 0) return "--jz-" + property.slice(2);
    return property;
  }

  // 收編 theme-runtime.js 的「讀 theme_css_rules、組 CSS、注入
  // <style>」邏輯，但只挑 :root 那些列（S35：這才是跨專案共用介面，
  // 其他 selector 是 jonaminz 自己共用元件的微調，對外部專案沒有意義）。
  // 舊名／--jz-* 新名都輸出（S36 別名過渡），值一樣。失敗就放棄，不影響
  // ready/degraded（跟 theme-runtime.js 一樣的容錯哲學，S24）。
  function applyTokens() {
    callWorker("getThemeCssRules", {})
      .then(function (response) {
        var rows = (response && response.rows) || [];
        var rootRows = rows.filter(function (row) { return row.selector === ":root"; });
        if (!rootRows.length) return;

        var lines = [":root {"];
        rootRows.forEach(function (row) {
          lines.push("  " + row.property + ": " + row.value + ";");
          lines.push("  " + jzTokenName(row.property) + ": " + row.value + ";");
        });
        lines.push("}");

        var style = document.getElementById("jonaminz-sdk-tokens");
        if (!style) {
          style = document.createElement("style");
          style.id = "jonaminz-sdk-tokens";
          document.head.appendChild(style);
        }
        style.textContent = lines.join("\n");
      })
      .catch(function (error) {
        console.warn("[jonaminz] tokens 套用失敗，維持宿主頁面原本樣式：", error);
      });
  }

  // chat.launcher@1 的自動掛載（跟 applyTokens 同一類：授權了就套用，
  // 不發布任何 window.Jonaminz.* API）。按鈕/面板本體/未讀 polling 都在
  // jonaminz.com 網域裡的頁面跑——外部專案這裡讀不到 jonaminz 的
  // session token，也不需要讀。event.origin 驗證在這裡做（embed 頁
  // 自己刻意不驗，跟 identity-relay 同一個分工）。
  //
  // 2026-07-14（幾輪修正後的最終架構，教訓見 CHANGELOG）：一開始是單一
  // iframe 同時管大頭貼跟展開後的面板（靠內部視圖切換 + 對 iframe 元素
  // 套 border-radius 解決 Android 上 iframe 內部透明不可靠的問題），
  // 但一個 iframe 只能裁一種形狀，逼得展開時要把大頭貼縮成面板內部的
  // 「迷你版」，使用者在真實裝置上連續兩輪回報「還是被蓋住」——大頭貼
  // 本質上該是面板外面一個永遠存在的獨立元素，不是塞進面板內部的裝飾。
  // 改成**兩個完全獨立的 iframe**，各自對 `<iframe>` 元素本身套
  // `border-radius`／`box-shadow`（技巧不變，只是不再擠在同一個裡面）：
  // - Iframe A（`pages/chat-launcher/`）：永遠存在，固定小尺寸圓形，
  //   只負責大頭貼＋通知這裡「使用者點了它」（`toggle` 訊息）。
  // - Iframe B（`pages/chat-panel/`）：只有點過 Iframe A 才建立，圓角
  //   矩形，尺寸依半版/全版狀態決定（`setSize` 訊息），再點一次
  //   Iframe A 就整個移除。
  //
  // 2026-07-14（第七次修正，跟 assets/js/chat-launcher.js 同步）：
  // 1. 面板 iframe 現在跟大頭貼同時建立、一直掛著在背景 poll，開關只是
  //    切換可見度（`jcl-panel-hidden`），不再每次都整個 create/remove
  //    ——使用者要的是「隨時 realtime 都是最新的，點擊只是展示」，不要
  //    每次點開都重新 mount/fetch 閃一下載入中。
  // 2. 大頭貼可以自由拖動，點一下（非拖動）才回彈固定角落＋開關面板。
  //    第一版曾把拖動判斷放在 pages/chat-launcher/ 自己的 iframe 文件
  //    裡，靠 postMessage 回報位移——Playwright 實測發現拖動距離一旦
  //    超出 iframe 原本 64x64 的範圍，`setPointerCapture` 對後續
  //    pointermove 的位移回報就開始失準（只剩實際位移的一半左右），這是
  //    真的碰到「pointer capture 能不能可靠跨 iframe 邊界持續轉發」的
  //    瀏覽器行為邊界，不能冒險上真機。**現在改成**：拖動/點擊判斷整個
  //    移到這裡（宿主自己的 document），在大頭貼 iframe 正上方蓋一個
  //    透明、z-index 更高、位置永遠同步的覆蓋層 `<div>`，pointer 事件
  //    全程只在宿主自己的文件裡發生，沒有跨 frame 邊界。
  // 尺寸數字跟 assets/js/chat-launcher.js 是刻意重複的兩份（同一個
  // 理由：這批 shell script/SDK 注入器彼此獨立，不互相依賴）。
  function mountChatLauncher() {
    try {
      var LAUNCHER_CLASS = "jonaminz-chat-launcher-frame";
      var OVERLAY_CLASS = "jonaminz-chat-launcher-overlay";
      var PANEL_CLASS = "jonaminz-chat-panel-frame";
      var ANCHOR_RIGHT = 14;
      var ANCHOR_BOTTOM = 14;
      var DRAG_THRESHOLD = 8;
      if (document.querySelector("." + LAUNCHER_CLASS)) return;

      var style = document.createElement("style");
      style.textContent =
        "." + LAUNCHER_CLASS + "{position:fixed;right:" + ANCHOR_RIGHT + "px;bottom:" + ANCHOR_BOTTOM + "px;" +
        "width:64px;height:64px;border:0;border-radius:50%;z-index:9999;" +
        "box-shadow:0 8px 24px rgba(38,34,32,0.28);pointer-events:none;}" +
        "." + OVERLAY_CLASS + "{position:fixed;right:" + ANCHOR_RIGHT + "px;bottom:" + ANCHOR_BOTTOM + "px;" +
        "width:64px;height:64px;border-radius:50%;z-index:10000;background:transparent;" +
        "touch-action:none;cursor:pointer;}" +
        "." + PANEL_CLASS + "{position:fixed;right:14px;bottom:92px;border:0;border-radius:20px;" +
        "z-index:9998;box-shadow:0 8px 24px rgba(38,34,32,0.28);" +
        "transition:width .22s ease,height .22s ease;}" +
        "." + PANEL_CLASS + ".size-half{width:min(430px,calc(100vw - 28px));height:min(720px,calc(100dvh - 140px));}" +
        "." + PANEL_CLASS + ".size-full{width:min(760px,calc(100vw - 28px));height:calc(100dvh - 110px);}" +
        "." + PANEL_CLASS + ".jcl-panel-hidden{visibility:hidden;pointer-events:none;}";
      document.head.appendChild(style);

      // 2026-07-14（第四次修正）：iframe src 一定要帶 cache-buster，不然
      // 瀏覽器/WebView 可能把今天稍早幾輪修正過程中的舊版
      // pages/chat-launcher/、pages/chat-panel/ HTML 當快取命中，即使
      // 這支 sdk.js 本身已經正確更新也沒用（跟 assets/js/chat-launcher.js
      // 同一個修法/同一個理由）。
      var cacheBuster = "v=" + Date.now();

      var launcherFrame = document.createElement("iframe");
      launcherFrame.className = LAUNCHER_CLASS;
      launcherFrame.src = CHAT_LAUNCHER_EMBED_URL + "?" + cacheBuster;
      launcherFrame.title = "Jonaminz Chat";

      var overlay = document.createElement("div");
      overlay.className = OVERLAY_CLASS;

      var lastSize = "half";
      var panelOpen = false;
      var panelFrame = document.createElement("iframe");
      panelFrame.className = PANEL_CLASS + " size-" + lastSize + " jcl-panel-hidden";
      panelFrame.src = CHAT_PANEL_EMBED_URL + "?" + cacheBuster;
      panelFrame.title = "Jonaminz Chat 對話面板";

      // 拖動後「休息位置」；null 代表從沒拖過，維持在預設錨點。開啟面板
      // 時鎖到固定角落（不能拖動），關閉時還原回這個休息位置——見
      // assets/js/chat-launcher.js 第八次修正的完整說明。
      var freeLeft = null;
      var freeTop = null;

      function setTransitionEnabled(on) {
        var value = on ? "left .22s ease, top .22s ease, right .22s ease, bottom .22s ease" : "";
        launcherFrame.style.transition = value;
        overlay.style.transition = value;
      }

      function applyPosition(left, top) {
        [launcherFrame, overlay].forEach(function (el) {
          el.style.right = "";
          el.style.bottom = "";
          el.style.left = left + "px";
          el.style.top = top + "px";
        });
      }

      function applyAnchor() {
        [launcherFrame, overlay].forEach(function (el) {
          el.style.left = "";
          el.style.top = "";
          el.style.right = ANCHOR_RIGHT + "px";
          el.style.bottom = ANCHOR_BOTTOM + "px";
        });
      }

      function animateTo(applyFn) {
        setTransitionEnabled(true);
        applyFn();
        window.setTimeout(function () { setTransitionEnabled(false); }, 240);
      }

      function lockToOpenAnchor() {
        animateTo(applyAnchor);
      }

      function restoreRestingPosition() {
        animateTo(function () {
          if (freeLeft === null) applyAnchor();
          else applyPosition(freeLeft, freeTop);
        });
      }

      function snapToNearestEdge(left, top) {
        var width = launcherFrame.offsetWidth;
        var height = launcherFrame.offsetHeight;
        var clampedTop = Math.min(Math.max(0, top), window.innerHeight - height);
        var midX = left + width / 2;
        var snappedLeft = midX < window.innerWidth / 2
          ? ANCHOR_RIGHT
          : window.innerWidth - width - ANCHOR_RIGHT;
        freeLeft = snappedLeft;
        freeTop = clampedTop;
        animateTo(function () { applyPosition(snappedLeft, clampedTop); });
      }

      function setPanelOpen(open) {
        panelOpen = open;
        panelFrame.classList.toggle("jcl-panel-hidden", !open);
        if (open) lockToOpenAnchor();
        else restoreRestingPosition();
      }

      var dragStart = null;

      overlay.addEventListener("pointerdown", function (event) {
        var rect = overlay.getBoundingClientRect();
        dragStart = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          originLeft: rect.left,
          originTop: rect.top,
          moved: false
        };
        try { overlay.setPointerCapture(event.pointerId); } catch (error) {}
      });

      overlay.addEventListener("pointermove", function (event) {
        if (!dragStart || dragStart.pointerId !== event.pointerId) return;
        if (panelOpen) return; // 面板開著時鎖定位置，不接受拖動
        var dx = event.clientX - dragStart.x;
        var dy = event.clientY - dragStart.y;
        if (!dragStart.moved && Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
        dragStart.moved = true;
        var width = launcherFrame.offsetWidth;
        var height = launcherFrame.offsetHeight;
        var left = Math.min(Math.max(0, dragStart.originLeft + dx), window.innerWidth - width);
        var top = Math.min(Math.max(0, dragStart.originTop + dy), window.innerHeight - height);
        applyPosition(left, top);
      });

      function endDrag(event) {
        if (!dragStart || dragStart.pointerId !== event.pointerId) return;
        var moved = dragStart.moved;
        dragStart = null;
        try { overlay.releasePointerCapture(event.pointerId); } catch (error) {}

        if (panelOpen) {
          setPanelOpen(false);
          return;
        }
        if (!moved) {
          setPanelOpen(true);
          return;
        }
        var rect = launcherFrame.getBoundingClientRect();
        snapToNearestEdge(rect.left, rect.top);
      }

      overlay.addEventListener("pointerup", endDrag);
      overlay.addEventListener("pointercancel", endDrag);

      window.addEventListener("message", function (event) {
        if (event.origin !== CHAT_LAUNCHER_ORIGIN) return;
        var data = event.data;
        if (!data) return;

        if (data.source === "jonaminz-chat-panel" && data.action === "setSize") {
          var size = data.size === "full" ? "full" : "half";
          lastSize = size;
          panelFrame.className = PANEL_CLASS + " size-" + size + (panelOpen ? "" : " jcl-panel-hidden");
          return;
        }

        // Shared 分享內容模組：面板不知道自己被嵌在哪個外部專案頁面，跟
        // 這裡（外部專案自己的宿主頁面）要目前頁面的 title/url。回覆
        // targetOrigin 用 CHAT_LAUNCHER_ORIGIN（jonaminz.com，面板 iframe
        // 自己的來源），不是這個外部專案自己的 origin。
        if (data.source === "jonaminz-chat-panel" && data.action === "requestContext") {
          try {
            panelFrame.contentWindow.postMessage({
              source: "jonaminz-chat-panel-host",
              action: "contextReply",
              title: document.title,
              url: window.location.href
            }, CHAT_LAUNCHER_ORIGIN);
          } catch (error) {}
        }
      });

      var append = function () {
        document.body.appendChild(launcherFrame);
        document.body.appendChild(panelFrame);
        document.body.appendChild(overlay);
      };
      if (document.body) append();
      else document.addEventListener("DOMContentLoaded", append, { once: true });
    } catch (error) {
      console.warn("[jonaminz] chat launcher 掛載失敗，不影響其他功能：", error);
    }
  }

  function makeCapabilityError(code, message, retryable) {
    return {
      code: code,
      message: message,
      service: "identity",
      capability: IDENTITY_CAPABILITY,
      retryable: !!retryable
    };
  }

  function mapIdentity(identity) {
    if (!identity) return null;
    return { id: identity, displayName: IDENTITY_LABEL[identity] || identity };
  }

  // 動態建立隱藏 iframe 指到 pages/identity-relay/（帶上 projectId query
  // string），監聽 postMessage 拿回「granted＋identity」。event.origin
  // 驗證在這裡做——relay 頁面本身刻意不驗證來源（見該檔案註解，往外送的
  // 內容不含 token），真正該驗證的是接收端，也就是這裡。5 秒逾時視為
  // relay 沒回應（多半是網路問題，reject 標 retryable:true，跟
  // CAPABILITY_NOT_GRANTED 那種「問到答案是不准」明確分開）。
  function fetchIdentityViaRelay(projectId) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = IDENTITY_RELAY_URL + "?projectId=" + encodeURIComponent(projectId);

      function cleanup() {
        window.removeEventListener("message", onMessage);
        clearTimeout(timer);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }

      function finish(fn, value) {
        if (settled) return;
        settled = true;
        cleanup();
        fn(value);
      }

      function onMessage(event) {
        if (event.origin !== IDENTITY_RELAY_ORIGIN) return;
        var data = event.data;
        if (!data || data.source !== "jonaminz-identity-relay") return;
        if (!data.granted) {
          finish(reject, makeCapabilityError(
            "CAPABILITY_NOT_GRANTED",
            "identity.current-user@1 is not granted to this project",
            false
          ));
          return;
        }
        finish(resolve, { currentUser: mapIdentity(data.identity) });
      }

      var timer = setTimeout(function () {
        finish(reject, makeCapabilityError(
          "IDENTITY_TIMEOUT",
          "identity relay did not respond in time",
          true
        ));
      }, IDENTITY_TIMEOUT_MS);

      window.addEventListener("message", onMessage);
      document.body.appendChild(iframe);
    });
  }

  function init() {
    var jz = findSnippetTarget();
    if (!jz) {
      console.warn("[jonaminz] window.Jonaminz 沒有 __snippetVersion 標記，SDK Kernel 不初始化。");
      return;
    }

    // document.currentScript 只在同步階段可靠，這裡是唯一讀取點——
    // 之後全部走非同步 fetch，不能再依賴它（跟 jonaminz-entry.js 同樣
    // 的教訓）。
    var script = document.currentScript;
    var contractOverride = (script && script.dataset && script.dataset.contract) || "";
    var release = (script && script.dataset && script.dataset.release) || "";
    var staleCache = !!(script && script.dataset && script.dataset.stale === "1");

    var diagnostics = {
      release: release,
      settingsRevision: null,
      rejectedCapabilities: [],
      lastErrorCode: null,
      staleCache: staleCache,
      // v1 沒有任何機制知道「這是不是一次回滾」（需要額外追蹤上一個
      // 已知穩定版本，現在沒有 caller 需要這個資訊），刻意留 false。
      rollback: false
    };

    var projectId = null;

    // S32：一經發布，這個 function 永遠掛在 window.Jonaminz.identity 上，
    // 不論這個專案的合約有沒有宣告、有沒有被 Settings 授權都不能變成
    // undefined——所以在這裡（contract discovery 完成前）就先掛上去，
    // 不是等 getEffectiveSettings 回來才決定要不要建立這個 namespace。
    // 呼叫時才去看 effectiveCapabilities（等 whenSettingsSettled() 之後
    // 的最終值），沒授權就 reject，不同步 throw。
    function currentUser() {
      return whenSettingsSettled().then(function () {
        if (effectiveCapabilities.indexOf(IDENTITY_CAPABILITY) === -1) {
          return Promise.reject(makeCapabilityError(
            "CAPABILITY_NOT_GRANTED",
            "identity.current-user@1 is not granted to this project",
            false
          ));
        }
        return fetchIdentityViaRelay(projectId);
      });
    }
    jz.identity = { currentUser: currentUser };

    var contractUrl = resolveContractUrl(contractOverride);
    if (!contractUrl) {
      diagnostics.lastErrorCode = "CONTRACT_NOT_FOUND";
      report(jz, "degraded", "CONTRACT_NOT_FOUND", diagnostics);
      return;
    }

    timeoutFetch(contractUrl, { headers: { Accept: "application/json" } })
      .then(function (response) {
        if (!response.ok) {
          var err = new Error("contract fetch failed");
          err.code = "CONTRACT_NOT_FOUND";
          throw err;
        }
        return response.json().catch(function () {
          var err = new Error("contract is not valid JSON");
          err.code = "CONTRACT_INVALID";
          throw err;
        });
      })
      .then(function (contract) {
        if (!hasMinimalFields(contract)) {
          var err = new Error("contract missing minimal required fields");
          err.code = "CONTRACT_INVALID";
          throw err;
        }

        projectId = contract.app.projectId;

        // S13/S16：推送 ≠ 採信，推送本身失敗不是致命錯誤——只要這個
        // projectId 之前有 approved 過的版本，平台整合仍應正常運作。
        // 用 catch 吞掉推送失敗，只記錄 reason，繼續往下查 Effective
        // Settings（那才是真正決定 ready/degraded 的依據）。
        return callWorker("submitContract", { projectId: projectId, contract: contract }).catch(function () {
          diagnostics.lastErrorCode = "SUBMIT_FAILED";
          return null;
        });
      })
      .then(function () {
        return callWorker("getEffectiveSettings", { projectId: projectId });
      })
      .then(function (settings) {
        if (!settings || settings.ok !== true) {
          // Worker 有給明確的 code（例如 PROJECT_NOT_REGISTERED）就用那個，
          // 比泛用的 SETTINGS_UNAVAILABLE 有意義得多——真正的「Worker 打不
          // 通」才會走到後面 .catch() 裡的 NETWORK_ERROR。
          var code = (settings && settings.code) || "SETTINGS_UNAVAILABLE";
          diagnostics.lastErrorCode = code;
          report(jz, "degraded", code, diagnostics);
          return;
        }

        diagnostics.settingsRevision = settings.revision;
        // S31 effective capabilities：不論 approved 與否都先存下來
        // （未 approved 時 Worker 本來就回 []），currentUser() 靠
        // whenSettingsSettled() 保證讀到的是這裡設定完的最終值。
        effectiveCapabilities = (settings.capabilities || []).filter(function (c) {
          return typeof c === "string";
        });

        // S23/S31：沒有 active approved snapshot → resolve degraded
        // （reason 標明 unapproved），不是 reject——這不是操作失敗，
        // 是操作完成但沒有授權，S27-29 規定 reject 只留給沒完成的操作。
        if (settings.approved) {
          // 不 await：tokens／chat launcher 都是 best-effort 視覺套用，
          // 不擋 ready settle、失敗不影響 lifecycle。
          if (settings.css === "tokens") applyTokens();
          if (effectiveCapabilities.indexOf(CHAT_LAUNCHER_CAPABILITY) !== -1) mountChatLauncher();
          report(jz, "ready", null, diagnostics);
        } else {
          diagnostics.lastErrorCode = "NOT_APPROVED";
          report(jz, "degraded", "NOT_APPROVED", diagnostics);
        }
      })
      .catch(function (error) {
        var code = (error && error.code) || "NETWORK_ERROR";
        diagnostics.lastErrorCode = code;
        report(jz, "degraded", code, diagnostics);
      });
  }

  try {
    init();
  } catch (error) {
    // S23 唯一的 reject 情況：SDK 自身不可恢復錯誤（不是查無合約、未核准
    // 這類正常降級路徑，那些都在 init() 內部的 .catch() 被吞成 degraded）。
    settleSettings();
    try {
      var jz = window.Jonaminz;
      if (jz && jz.__bootstrap) {
        jz.__bootstrap.settle("reject", {
          code: "SDK_INIT_FAILED",
          message: String((error && error.message) || error),
          service: null,
          capability: null,
          retryable: false
        });
      }
    } catch (innerError) {
      // 不燒房子：連這個都失敗就真的放棄，不再往外拋。
    }
  }
})();
