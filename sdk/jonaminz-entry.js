/*
檔案位置：jonaminz/sdk/jonaminz-entry.js
用途：implementation plan 第 5 項（S37）常青 SDK loader，網址
https://jonaminz.com/sdk/jonaminz-entry.js 永遠指向這份檔案，但內容刻意
極小、幾乎永不改動——它唯一的工作是「去 Worker 問現在該載哪個版本 → 動態
插入 <script> 載入那個 immutable 檔案」，不做 Contract discovery、不建
window.Jonaminz.* 骨架、不做 S21-23 的 Promise/ready 語意（那些是第 6 項
SDK Kernel 的事，會寫進被載入的那個 sdk-<hash>.js 裡）。

全程 try/catch、絕不 throw 出去（S24 不燒房子）：抓不到版本指標時用
localStorage 裡的舊快取（不管多舊）當 last-known-good 繼續用；兩者都沒有
就靜默退場，不影響宿主頁面。localStorage key 依 S25 規定用 "jonaminz."
前綴。

Worker 網址寫死在這裡而不是像 backend-client.js 那樣讀 config.json——
這支 loader 會被外部專案的頁面載入，那些頁面不會、也不該載入 jonaminz
自己的 config.json。

第 6 項新增：S18 規定 `data-contract` 屬性寫在載入這支 loader 的
`<script>` 標籤上，但 Contract Discovery 的邏輯屬於 Kernel（被這支
loader 動態插入的「另一個」`<script>` 標籤），Kernel 自己的
`document.currentScript` 讀不到原始那個標籤的屬性——所以這支 loader
要在自己的同步階段先讀出 `data-contract`，動態插入 Kernel 的
`<script>` 時原樣轉貼過去（`dataset.contract`），Kernel 才讀得到。
同理轉貼 `dataset.stale`（這次版本指標是不是從 localStorage 快取來的，
只有 loader 自己知道）與 `dataset.release`（Kernel 自己的 hash，Kernel
讀不到自己的檔名）。
*/
(function () {
  "use strict";

  // sdk-<hash>.js 放在 jonaminz 自己的網域，不是載入這支 loader 的宿主
  // 頁面的網域——用 document.currentScript 反推「這支 loader 自己是從
  // 哪裡載的」，而不是誤用 window.location.origin（那是宿主頁面的
  // origin，本機測試/正式站網域不一樣時會直接拿錯）。document.currentScript
  // 只在同步執行階段可靠，所以要在最上面先存起來，不能等到非同步的
  // fetch callback 才讀。
  var SDK_ORIGIN = (function () {
    try {
      var src = document.currentScript && document.currentScript.src;
      return src ? new URL(src).origin : window.location.origin;
    } catch (error) {
      return window.location.origin;
    }
  })();

  // S18：data-contract 只在這個標籤上讀得到，同步階段先存起來，轉貼給
  // Kernel（見檔頭註解）。
  var CONTRACT_OVERRIDE = (function () {
    try {
      return (document.currentScript && document.currentScript.getAttribute("data-contract")) || "";
    } catch (error) {
      return "";
    }
  })();

  var WORKER_URL = "https://jonaminz-backend.ndmc402010104.workers.dev/api/action";
  var CACHE_KEY = "jonaminz.sdkVersionCache";
  var CACHE_TTL_MS = 5 * 60 * 1000;
  var FETCH_TIMEOUT_MS = 5000;

  function readCache() {
    try {
      var raw = window.localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeCache(entry) {
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    } catch (error) {
      // localStorage 不可用（隱私模式／被封鎖）就不快取，不影響本次載入。
    }
  }

  function loadScript(url, hash, isStale) {
    var script = document.createElement("script");
    script.src = url;
    script.async = true;
    // 轉貼給 Kernel 用（見檔頭註解）：data-contract 原樣轉貼；
    // release/stale 是 loader 自己才知道的資訊。
    if (CONTRACT_OVERRIDE) script.dataset.contract = CONTRACT_OVERRIDE;
    script.dataset.release = hash || "";
    script.dataset.stale = isStale ? "1" : "0";
    document.head.appendChild(script);
  }

  function fetchVersionPointer() {
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT_MS) : null;

    return fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getSdkVersion", payload: {} }),
      signal: controller ? controller.signal : undefined
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (timer) clearTimeout(timer);
        if (!data || data.ok !== true || !data.url) {
          throw new Error("getSdkVersion returned no usable pointer");
        }
        return data;
      })
      .catch(function (error) {
        if (timer) clearTimeout(timer);
        throw error;
      });
  }

  function init() {
    var cached = readCache();
    var isFresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;

    if (isFresh) {
      // 5 分鐘內的快取，沒有重打 Worker，這次載入用的是「稍早已經確認過
      // 一次的指標」，不是這次現查的——diagnostics.staleCache 給 true。
      loadScript(SDK_ORIGIN + cached.url, cached.hash, true);
      return;
    }

    fetchVersionPointer()
      .then(function (data) {
        writeCache({ url: data.url, hash: data.hash, fetchedAt: Date.now() });
        loadScript(SDK_ORIGIN + data.url, data.hash, false);
      })
      .catch(function () {
        // S37：指標取得失敗 → last-known-good release（不論多舊）；
        // 兩者都沒有 → 靜默退場，不影響宿主頁面（S24）。這條路徑上用的
        // 一定是舊快取，staleCache 給 true。
        if (cached && cached.url) {
          loadScript(SDK_ORIGIN + cached.url, cached.hash, true);
        }
      });
  }

  try {
    init();
  } catch (error) {
    // 不燒房子：loader 本身出錯也絕不讓例外冒出去影響宿主頁面。
  }
})();
