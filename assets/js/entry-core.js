/*
檔案位置：jonaminz/assets/js/entry-core.js
用途：jonaminz 自己的水庫本體。

因為 jonaminz 沒有外部水庫（skhpsv2）可以依附，這個檔案同時扮演 SKHPS 架構裡
app-entry.js + entry-core.js 的角色，統一管理：
- 讀 version.js / config.json
- loading gate（css / shell / main 三段，語意與 SKHPS 一致：一個 gate 過了就過了）
- CSS 疊加：reservoir 六層（reset -> tokens -> base -> layout -> components ->
  variants）+ 目前頁面 config.json 裡 entry.styles 宣告的 Page Layer CSS，
  最後套用 theme-runtime.js（第 8 層 - Theme，動態外觀，來源是 Supabase，
  見 backend/）。疊加順序（DOM 順序）＝哪個先 append，跟哪個先下載完成
  無關——並行載入不會打亂 cascade，見下方「並行策略」。
- 載入 header.js / footer.js / registry-loader.js（shell）
- 依目前 pageId 從 config.json 找出 entry.afterScripts，載入頁面自己的 app.js

頁面（例如 assets/js/app.js）只能透過 window.JonaminzLoading.done/fail 回報自己的
task，不可以自己 release all-ready，不可以自己決定 css/shell ready。

水庫共用資源一律用「網站根目錄絕對路徑」（開頭 `/`），不用頁面相對路徑：
因為頁面可能放在 `pages/xxx/` 這種巢狀資料夾，若用相對路徑會依頁面所在深度跑掉。
新頁面只要複製根目錄 index.html 的 bootstrap script 原樣貼上即可，不用改路徑。

2026-07-12 效能重建（docs/frontend-quality-plan-202607.md 階段①）：
- **快取修復（最大元凶）**：舊版每次載入都用 `Date.now()` 當所有資源網址的
  cache buster，等於瀏覽器快取永遠 0% 命中率。改成：這個檔案本身＋
  jonaminz-loading.css 這兩個「bootstrap 前置檔」完全不帶 buster（吃
  GitHub Pages 原生 ETag/Cache-Control，最壞下一次部署後 10 分鐘內看到
  舊版，可接受）；version.js 本身也不帶 buster（同理）；version.js 讀到
  之後，其餘所有資源（config.json、reservoir/page CSS、theme-runtime.js、
  header/footer/registry-loader、頁面 app.js）改用 version.js 的版本字串
  當 buster——這樣同一版本内重複造訪全部命中快取，只有 push 前 bump 版本
  （RULES.md 既有規則）才會讓資源網址改變、強制拿新的。`window.JONAMINZ_
  ENTRY_VERSION` 仍然保留、指派成同一個版本字串（不是 Date.now()），維持
  registry-loader.js 既有讀法不用改那個檔案。
- **並行化**：原本 6 層 reservoir CSS 用 `.reduce()` 逐一序列載入，現在
  `Promise.all` 一次全部送出（`<link>` 的 append 順序仍是同步、依序發生，
  cascade 順序不受影響，只有下載本身平行）；config.json 抓取跟 reservoir
  CSS、theme-runtime.js 的 script 標籤載入三者同時開始（互不依賴）；
  config 解析完後，page CSS 與 header/footer/registry-loader 三支 shell
  script 同時開始（header.js 的 render() 依賴 window.JONAMINZ_SITE_CONFIG
  已經設定，所以這批要等 config 解析完才能開始，不能更早）。
- **Theme 不再無上限擋 gate**：首次造訪（無 localStorage 快取）原本要等
  Worker/Supabase 回應（最長 8 秒）才放行 gate。現在用 loadThemeWithCap()
  跟 800ms 賽跑，逾時就先放行、theme 資料到了背景照套（theme-runtime.js
  本身完全沒改，只是 entry-core 不再無條件等它）。回訪（有快取）theme.load()
  本來就同步套用完立刻 resolve，不受影響。

2026-07-12 待辦總表順序②（docs/roadmap-202607.md）：讀條演算法拉高層級。
原本的 setProgress() 是在每個里程碑硬寫死一個百分比，數字會用「跳格」的
方式前進，卡在慢速資源時看起來像卡住。改成從 SKHPSV2 的 loading-gate.js
「Runway Chase」模型搬過來、重寫成 jonaminz 版本（不是複製檔案，命名跟
架構都配合這個檔案原有的結構調整）：
- `setProgressTarget(percent)` 取代原本的 `setProgress(percent)`——只設定
  「下一個要追到的目標」，target 只會前進不會後退，實際顯示的
  `current` 值由下面的 ticker 每 16ms 平滑追趕，追趕速度依「距離 ÷
  剩餘時間預算」動態計算，越接近時間預算終點追得越快，不會讓使用者覺得
  卡住不動。
- 新增 `GATE_TIMEOUT_MS`（8 秒）逾時保底：舊版沒有任何逾時機制，如果
  `loadScript`/`loadStyle` 因為網路問題真的卡住（`onload`/`onerror`
  都不觸發），布幕會永遠不消失。這是搬讀條演算法時順便補上的既有缺口，
  不是本次額外加的新功能——runway chase 的節奏本來就需要一個時間預算
  才有意義，8 秒逾時是這個預算的另一半。
- all-ready 之後不是立刻拿掉布幕，是先讓 `current` 用 260ms 衝刺補滿到
  100（`finishProgress()`），衝刺完（或最多等 520ms 保底）才真的呼叫
  `hideCurtainNow()` 拿掉 loading class——讓使用者看到讀條真的走完再
  掀幕，比「讀條停在 80% 畫面突然跳出來」更有完成感。
- **刻意簡化、沒有搬的部分**：SKHPS 版本在逾時/失敗時會有一個「WARN
  hold」——停在目前進度 1 秒再放行，搭配 footer 的五盞診斷燈號讓使用者
  知道「這不是正常結束」。jonaminz 沒有對應的診斷 UI，單純停頓沒有燈號
  說明反而只會讓人覺得卡住，所以逾時/失敗這裡一樣走衝刺到 100 再掀幕，
  不做 WARN hold 那段停頓。

2026-07-12 待辦總表順序③：shell 載入清單新增 `assets/js/layout-metrics.js`
（RWD/viewport 量測層，搬自 SKHPSV2 同名檔案、重寫成 jonaminz 版本，見
該檔案自己的檔頭說明）。純廣播不改畫面，跟 header/footer/registry-loader
同一批平行載入，不影響現有的載入順序或依賴關係。

2026-07-12 待辦總表順序④：`assets/js/runtime.js`（可插拔診斷核心，見該
檔案檔頭說明）跟 version.js 同批載入、同樣不帶版本 buster（核心啟動檔，
理由跟 version.js 一致）。這裡登記自己（entry-core.js）為 `loading-gate`
模組，把 gate 生命週期的關鍵時間點（開始/version 載入/config 解析完/css
ready/shell ready/all-ready/逾時保底/init 失敗）發成 log、更新模組狀態。
`runtimeLog()`/`runtimeSetStatus()` 兩個 helper 都先檢查
`window.JonaminzRuntime` 存不存在才呼叫——runtime.js 是 best-effort 診斷，
它自己載入失敗或還沒載完，不能反過來卡住或弄壞真正的 loading gate 邏輯。
*/
(function () {
  "use strict";

  var docEl = document.documentElement;
  var pageId = docEl.getAttribute("data-jonaminz-page-id") || "home";
  var configUrl = window.JONAMINZ_SITE_CONFIG_URL || "/config.json";

  var pendingTasks = {};
  var allReady = false;
  var curtainHidden = false;
  var resourceVersion = null;
  var gateTimeoutId = null;

  // ---- Runway Chase 讀條引擎（2026-07-12，搬自 SKHPSV2 loading-gate.js，
  // 重寫成 jonaminz 版本，見上方檔頭說明）----
  var GATE_TIMEOUT_MS = 8000;
  var progressState = {
    current: 0,
    target: 0,
    timer: null,
    startedAt: 0,
    lastTickAt: 0,
    visualBudgetMs: GATE_TIMEOUT_MS,
    finishRequested: false,
    finishStartedAt: 0,
    finishBudgetMs: 260
  };

  function setProgressValue(value) {
    var next = Math.max(0, Math.min(100, value));
    progressState.current = next;
    docEl.style.setProperty("--jonaminz-loading-progress", String(Math.round(next * 10) / 10));
  }

  function chaseTowardTarget(target, now, dt, budgetEndAt) {
    var distance = target - progressState.current;
    if (distance <= 0) return;

    var remainingMs = Math.max(16, budgetEndAt - now);
    var speed = distance / (remainingMs / 1000);
    var step = speed * (dt / 1000);
    var next = progressState.current + step;
    if (next > target) next = target;
    setProgressValue(next);
  }

  function tickProgress() {
    var now = Date.now();
    var dt = Math.max(16, now - progressState.lastTickAt);
    progressState.lastTickAt = now;

    if (progressState.finishRequested) {
      chaseTowardTarget(100, now, dt, progressState.finishStartedAt + progressState.finishBudgetMs);
      if (progressState.current >= 99.7) {
        setProgressValue(100);
        hideCurtainNow();
        stopProgressTicker();
      }
      return;
    }

    chaseTowardTarget(progressState.target, now, dt, progressState.startedAt + progressState.visualBudgetMs);
  }

  function startProgressTicker() {
    if (progressState.timer) return;
    progressState.lastTickAt = Date.now();
    window.requestAnimationFrame(tickProgress);
    progressState.timer = window.setInterval(tickProgress, 16);
  }

  function stopProgressTicker() {
    if (!progressState.timer) return;
    window.clearInterval(progressState.timer);
    progressState.timer = null;
  }

  // target 只會前進、不會後退——task 只能推進度往前衝，不能讓它倒退。
  function setProgressTarget(percent) {
    var next = Math.max(0, Math.min(100, percent));
    if (next > progressState.target) {
      progressState.target = next;
    }
    startProgressTicker();
  }

  function finishProgress() {
    if (progressState.finishRequested) return;
    progressState.finishRequested = true;
    progressState.finishStartedAt = Date.now();
    startProgressTicker();
    // 保底：萬一分頁切到背景之類的原因讓 rAF/setInterval 被瀏覽器節流，
    // 沒有準時追到 100，最多再等 520ms（260ms 衝刺 + 260ms 餘裕）就強制
    // 掀幕，不讓布幕卡住不消失。
    window.setTimeout(function () {
      setProgressValue(100);
      hideCurtainNow();
      stopProgressTicker();
    }, 520);
  }
  // ---- Runway Chase 讀條引擎結束 ----

  // best-effort 診斷輸出：runtime.js 還沒載完/載入失敗都只是靜默跳過，
  // 不能反過來影響真正的 loading gate 邏輯（見上方檔頭說明）。
  function runtimeLog(level, module, message, data) {
    if (window.JonaminzRuntime) {
      window.JonaminzRuntime.log({ level: level, module: module, message: message, data: data });
    }
  }

  function runtimeSetStatus(module, status, detail) {
    if (window.JonaminzRuntime) {
      window.JonaminzRuntime.setModuleStatus(module, status, detail);
    }
  }

  function withVersion(url) {
    if (!resourceVersion) return url;
    var sep = url.indexOf("?") === -1 ? "?" : "&";
    return url + sep + "v=" + encodeURIComponent(resourceVersion);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = withVersion(src);
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error("load failed: " + src)); };
      document.head.appendChild(script);
    });
  }

  function loadStyle(href) {
    return new Promise(function (resolve, reject) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = withVersion(href);
      link.onload = function () { resolve(); };
      link.onerror = function () { reject(new Error("load failed: " + href)); };
      document.head.appendChild(link);
    });
  }

  function markCssReady() {
    docEl.classList.remove("jonaminz-css-loading");
  }

  function markShellReady() {
    docEl.classList.remove("jonaminz-shell-loading");
    docEl.setAttribute("data-jonaminz-shell-ready", "true");
  }

  // 真的把布幕拿掉的地方——跟「邏輯上 all-ready」分開，因為現在
  // all-ready 後還要等讀條衝刺補滿到 100 才會呼叫這個。
  function hideCurtainNow() {
    if (curtainHidden) return;
    curtainHidden = true;
    docEl.classList.remove("jonaminz-loading");
    docEl.classList.remove("jonaminz-main-loading");
    docEl.setAttribute("data-jonaminz-page-ready", "true");
  }

  function releaseAllReady() {
    if (allReady) return;
    allReady = true;
    if (gateTimeoutId) {
      window.clearTimeout(gateTimeoutId);
      gateTimeoutId = null;
    }
    finishProgress();
  }

  function checkAllReady() {
    var tasks = Object.keys(pendingTasks);
    var done = tasks.length > 0 && tasks.every(function (task) { return pendingTasks[task] === true; });
    // !allReady 避免逾時保底已經放行過 gate 之後，剩餘的 task 陸續回報
    // 完成時把 timeout 那邊寫的 "warn" 狀態覆蓋成 "ok"——那次放行本來
    // 就不是正常結束，狀態要保留逾時的紀錄，不能被事後補到的 task 蓋掉。
    if (done && !allReady) {
      runtimeSetStatus("loading-gate", "ok", "全部 task 完成，gate 正常放行");
      runtimeLog("info", "loading-gate", "all-ready");
      releaseAllReady();
    }
  }

  function registerTasks(taskNames) {
    taskNames.forEach(function (task) { pendingTasks[task] = false; });
  }

  window.JonaminzLoading = {
    done: function (task) {
      pendingTasks[task] = true;
      docEl.setAttribute("data-jonaminz-" + task + "-ready", "true");
      runtimeLog("info", "loading-gate", "task done: " + task);
      checkAllReady();
    },
    fail: function (task, error) {
      pendingTasks[task] = true;
      docEl.setAttribute("data-jonaminz-" + task + "-ready", "false");
      console.error("[jonaminz] loading task failed:", task, error);
      runtimeLog("error", "loading-gate", "task failed: " + task, { error: String(error) });
      checkAllReady();
    }
  };

  // 首訪（無快取）theme fetch 最長等 800ms，逾時就不擋 gate，theme-runtime
  // 自己的 promise 繼續在背景跑，資料到了會自己呼叫 applyCss() 補套上去
  // （theme-runtime.js 本身沒有修改，純粹是這裡不再無條件 await 它）。
  // 回訪（有 localStorage 快取）theme.load() 本來就同步套用完立刻
  // resolve，不會被 800ms 卡住，這個 race 對它幾乎是 no-op。
  function loadThemeWithCap(capMs) {
    return new Promise(function (resolve) {
      var settled = false;
      function finish() {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      }
      var timer = setTimeout(finish, capMs);
      window.JonaminzThemeRuntime.load().then(finish).catch(finish);
    });
  }

  function init() {
    progressState.startedAt = Date.now();
    progressState.lastTickAt = progressState.startedAt;

    // runtime.js 跟 version.js 同批載入、不帶版本 buster（核心啟動檔）。
    // 載入完成才登記 loading-gate 模組——登記前發生的事件就不記錄了，
    // 這是 best-effort 診斷合理的取捨，不值得為了搶那零點幾秒再插一層。
    loadScript("/assets/js/runtime.js").then(function () {
      window.JonaminzRuntime.registerModule("loading-gate", { label: "Loading Gate" });
      runtimeSetStatus("loading-gate", "pending", "init 開始");
      runtimeLog("info", "loading-gate", "entry-core init 開始");
    }).catch(function (error) {
      console.error("[jonaminz] runtime.js load failed", error);
    });

    // 逾時保底：8 秒內沒有走到 all-ready 就強制放行，避免真的卡住的
    // 資源（例如 loadScript/loadStyle 的 onload/onerror 都沒觸發）讓
    // 布幕永遠不消失。舊版完全沒有這層保護，這次搬讀條演算法順便補上。
    gateTimeoutId = window.setTimeout(function () {
      console.warn("[jonaminz] entry-core init timed out after " + GATE_TIMEOUT_MS + "ms, releasing gate anyway");
      runtimeSetStatus("loading-gate", "warn", GATE_TIMEOUT_MS + "ms 逾時，強制放行 gate");
      runtimeLog("warn", "loading-gate", "逾時保底觸發，強制放行");
      markCssReady();
      markShellReady();
      releaseAllReady();
    }, GATE_TIMEOUT_MS);

    setProgressTarget(5);

    loadScript("/version.js")
      .then(function () {
        resourceVersion = (window.JONAMINZ_APP_VERSION && window.JONAMINZ_APP_VERSION.version) || null;
        // 保留給 registry-loader.js 讀（它自己的 cache buster 邏輯沒有改），
        // 從「每次都是新的 Date.now()」變成「跟著版本號走，同版本會命中快取」。
        window.JONAMINZ_ENTRY_VERSION = resourceVersion || String(Date.now());
        runtimeLog("info", "loading-gate", "version.js 載入完成", { version: resourceVersion });
        setProgressTarget(15);

        var reservoirStyles = [
          "/assets/css/reservoir/01-reset.css",
          "/assets/css/reservoir/02-tokens.css",
          "/assets/css/reservoir/03-base.css",
          "/assets/css/reservoir/04-layout.css",
          "/assets/css/reservoir/05-components.css",
          "/assets/css/reservoir/06-variants.css"
        ];

        // 三件事互不依賴，同時開始：抓 config、載 reservoir CSS、
        // 預載 theme-runtime.js 的 script 本體（還不呼叫 .load()）。
        var configPromise = fetch(withVersion(configUrl)).then(function (res) { return res.json(); });
        var reservoirPromise = Promise.all(reservoirStyles.map(loadStyle));
        var themeScriptPromise = loadScript("/assets/js/theme-runtime.js");

        return configPromise.then(function (siteConfig) {
          setProgressTarget(30);
          runtimeLog("info", "loading-gate", "config.json 解析完成", { pageId: pageId });

          window.JONAMINZ_SITE_CONFIG = siteConfig;

          var pageConfig = (siteConfig.pages && siteConfig.pages[pageId]) || {};
          window.JONAMINZ_PAGE_CONFIG = pageConfig;
          window.JONAMINZ_APP_ENV = {
            appVersion: (window.JONAMINZ_APP_VERSION && window.JONAMINZ_APP_VERSION.version) || "v.unknown"
          };

          var loadingTasks = (pageConfig.entry && pageConfig.entry.loadingTasks) || ["app-ready"];
          registerTasks(loadingTasks);

          var pageStyles = (pageConfig.entry && pageConfig.entry.styles) || [];
          var pageStylePromise = Promise.all(pageStyles.map(loadStyle));

          // header.js 的 render() 讀 window.JONAMINZ_SITE_CONFIG，必須等
          // config 解析完才能開始載——跟 CSS 那條互相獨立，兩邊平行跑。
          var shellPromise = Promise.all([
            loadScript("/assets/js/header.js"),
            loadScript("/assets/js/footer.js"),
            loadScript("/assets/js/registry-loader.js"),
            // 待辦總表順序③（docs/roadmap-202607.md）：RWD/viewport 量測層，
            // 純廣播不改畫面，跟 header/footer 同一批平行載入即可，不用
            // 特別提早或延後。
            loadScript("/assets/js/layout-metrics.js"),
            // 2026-07-14：全站浮動 Chat 入口（iframe 注入器），從 header.js
            // 拆出來的獨立 shell script——「品牌列/身分」跟「Chat 入口」是
            // 兩個職責，不該糾在同一個檔案。按鈕本體見 pages/chat-launcher/。
            loadScript("/assets/js/chat-launcher.js")
          ]).then(function () {
            markShellReady();
            runtimeLog("info", "loading-gate", "shell ready（header/footer/registry-loader/layout-metrics/chat-launcher）");
            setProgressTarget(85);
          });

          var cssPromise = Promise.all([reservoirPromise, pageStylePromise, themeScriptPromise])
            .then(function () {
              setProgressTarget(55);
              return loadThemeWithCap(800);
            })
            .then(function () {
              markCssReady();
              runtimeLog("info", "loading-gate", "css ready（reservoir/page/theme）");
              setProgressTarget(65);
            });

          return Promise.all([cssPromise, shellPromise]);
        });
      })
      .then(function () {
        var pageConfig = window.JONAMINZ_PAGE_CONFIG || {};
        var afterScripts = (pageConfig.entry && pageConfig.entry.afterScripts) || ["/assets/js/app.js"];

        return afterScripts.reduce(function (chain, src) {
          return chain.then(function () { return loadScript(src); });
        }, Promise.resolve());
      })
      .catch(function (error) {
        console.error("[jonaminz] entry-core init failed", error);
        runtimeSetStatus("loading-gate", "error", String((error && error.message) || error));
        runtimeLog("error", "loading-gate", "init 失敗，強制放行", { error: String((error && error.message) || error) });
        markCssReady();
        markShellReady();
        releaseAllReady();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
