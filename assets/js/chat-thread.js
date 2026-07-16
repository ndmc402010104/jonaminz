/*
檔案位置：jonaminz/assets/js/chat-thread.js
用途：Chat 訊息串／composer 的共用渲染邏輯——`pages/chat/`（整頁「主頁」）
與 `pages/chat-launcher/`（浮動大頭貼的面板，主頁的「攜帶版」）共用同一份
實作，避免同一功能長出兩套會互相 drift 的程式碼（同一天稍早才因為
「Chat launcher 的按鈕外觀」重複兩份而修過一次類似問題，這裡從一開始就
不要重蹈覆轍）。

2026-07-14：從 `pages/chat/assets/js/app.js` 抽出來。整段邏輯原樣搬過來
（未讀分隔線／已讀回條／大頭貼分組／防閃爍競態修正都原封不動），只改了
呼叫介面：

- 不再要求呼叫端先解析好 `identity` 才能 mount——改成從第一次
  `listChatMessages` 回應的 `data.identity` 內部解析（`pages/chat-launcher/`
  本來就是這樣做，這次統一成這個模式）。呼叫端只需要給一個有效的
  `token`，不需要自己先呼叫 `getCurrentIdentity`。
- `mount(root, options)` 回傳 `{ destroy() }`，呼叫端自己決定何時清掉
  `setInterval`（`pages/chat/` 目前的 `beforeunload` 才清的邏輯搬到
  呼叫端，不進這個模組）。
- 新增 `options.onUpdate({ peer, peerLabel, isOnline, unreadCount,
  lastMessage })`，每次 poll 後呼叫一次（選填）——`pages/chat-launcher/`
  的浮動大頭貼跟展開後的面板頭部是「同一組資料算出來的兩個 DOM」，
  靠這個 callback 同步，不是各自重算一次未讀數（那又是新的 drift 風險）。

2026-07-14（Shared 分享內容模組，Phase 1 唯一垂直流程）：composer 的
「+」按鈕從純視覺佔位改成功能選單（目前只有一項：「分享目前內容」）。
這個選項只在**面板情境**（`window.parent !== window`，也就是跑在
`pages/chat-panel/` 裡）才啟用——`/pages/chat/` 整頁版是使用者自己主動
離開別的內容跑來的頁面，沒有「宿主頁面目前內容」這回事，「+」在那裡
維持原本的 disabled 佔位。點「分享目前內容」會跟宿主要目前頁面的
title/url（見 `requestHostContext()`，宿主端實作在
`assets/js/chat-launcher.js`／`sdk-src/sdk.js` 的 `requestContext`/
`contextReply` 訊息），再呼叫 Worker 的 `shareCurrentContent`。
`kind==='shared_item'` 的訊息不畫文字泡泡，改畫內容卡（靠
`listChatMessages` 回應多出來的 `sharedItems` map 查標題/來源/已讀
狀態）；點卡片＝明確標記已讀＋開新分頁；點「討論」把該 Shared item
綁到 composer（`activeSharedItemId`），之後的文字訊息會帶著
`sharedItemId` 一起送出，composer 上方出現可關閉的橫幅提示目前在討論
哪一則。
*/
(function () {
  "use strict";

  // 2026-07-14（第十四輪）：對照成熟聊天 App 慣例做系統性審查，把 3000
  // 調快到 1500——2 個人的私人聊天室這個頻率的成本完全可以忽略，換來
  // 接收速度快一倍。
  var POLL_INTERVAL_MS = 1500;
  // 2026-07-15（第二十七輪）：在線＝2 分鐘內有「面板真的可見」的心跳
  // （poll 帶 visible:true 時 Worker 每 30 秒記一次 last_seen_at）。
  // 舊判定（最後訊息/已讀在 5 分鐘內）只要有在聊就永遠在線、從沒出現
  // 過離線，作廢。
  var PRESENCE_WINDOW_MS = 2 * 60 * 1000;
  // 2026-07-14：時間分隔線原本只要「格式化後的 HH:MM 字串」跟上一則不同
  // 就插一次，等於只要跨過一分鐘就會冒出時間，訊息密集時滿版都是時間，
  // 使用者要的是像 FB 那樣——真的隔了一段時間才顯示。改成看「距離上一條
  // 分隔線」的實際毫秒差，超過這個門檻才插新的分隔線。
  var TIME_DIVIDER_GAP_MS = 15 * 60 * 1000;
  var LONG_PRESS_MS = 480;
  var HISTORY_PAGE_SIZE = 50;
  var IDENTITY_LABEL = { jonathan: "Jonathan", minz: "Minz" };
  var QUICK_REACTION = "👍";
  // 2026-07-14（第十五輪）：輸入中心跳——使用者打字時最多每 2.5 秒呼叫一次
  // setTypingState，不是每個按鍵都送；Worker 端只看「最後一次回報時間」
  // 是不是在 4 秒內，兩邊搭配起來就是一個不需要 WebSocket 也能動的輸入中
  // 指示器，跟已讀/送達同一種「用 polling 頻率換取簡單架構」的取捨。
  var TYPING_HEARTBEAT_MS = 2500;
  var REACTION_SET = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
  var EMOJI_SET = [
    "😀", "😂", "😍", "😘",
    "😢", "😭", "😎", "🥰",
    "👍", "👌", "🙏", "👏",
    "❤️", "🔥", "🎉", "😱"
  ];
  // 2026-07-16：貼圖/常用回覆面板（決策圖候選畢業，task 9b2157f2）。
  // 貼圖＝點了「直接送出」的大 emoji（emoji-only 訊息，會自動放大顯示）；
  // 常用回覆＝點了直接送的預設短句。兩人自用，先寫死一組；之後要可
  // 編輯再說（不寫進 metadata 那種設定面板，避免現在過度設計）。
  var STICKER_SET = ["❤️", "😂", "👍", "🥰", "😘", "🤣", "😭", "😱", "🙏", "👏", "🎉", "😴", "🥺", "😎", "🔥", "💯"];
  var CANNED_REPLIES = ["收到 👌", "好喔", "在忙，等等回你", "到家了", "在路上了", "吃飽沒？", "想你 🥰", "愛你 ❤️", "晚點聊", "哈哈哈"];
  // 一般文字訊息如果整則「就只是一個網址」，直接當成分享內容處理（跟
  // Discord/Slack/iMessage 一樣：貼一個純網址會變成預覽卡，不是純文字）
  // ——訊息裡「還有其他文字」的情況不觸發，避免正常聊天句子裡帶到連結
  // 就被硬轉成卡片。
  var BARE_URL_RE = /^https?:\/\/\S+$/i;

  // 2026-07-15（第二十七輪）：整則訊息只有 1~3 個 emoji 時不畫泡泡框、
  // 直接放大顯示（FB/LINE 慣例）——原本塞在小方框裡不置中很阿雜。
  // 涵蓋 ZWJ 組合（👨‍👩‍👧）、變體選擇子、膚色修飾符；不支援
  // unicode property escapes 的舊瀏覽器直接當一般訊息，不炸。
  function isEmojiOnly(text) {
    var t = String(text || "").trim();
    if (!t || t.length > 16) return false;
    try {
      return new RegExp(
        "^(?:\\p{Extended_Pictographic}[\\uFE0F\\u{1F3FB}-\\u{1F3FF}]?" +
        "(?:\\u200D\\p{Extended_Pictographic}[\\uFE0F\\u{1F3FB}-\\u{1F3FF}]?)*){1,3}$",
        "u"
      ).test(t);
    } catch (error) {
      return false;
    }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function formatTime(value) {
    if (!value) return "";
    try {
      return new Date(value).toLocaleTimeString("zh-TW", { hour12: false, hour: "2-digit", minute: "2-digit" });
    } catch (error) {
      return "";
    }
  }

  // 點訊息顯示的完整時間：今天的只顯示時刻，更早的補上日期。
  function formatPeekTime(value) {
    if (!value) return "";
    try {
      var dt = new Date(value);
      var today = new Date();
      var sameDay = dt.getFullYear() === today.getFullYear() &&
        dt.getMonth() === today.getMonth() && dt.getDate() === today.getDate();
      var time = dt.toLocaleTimeString("zh-TW", { hour12: false, hour: "2-digit", minute: "2-digit" });
      if (sameDay) return "今天 " + time;
      return (dt.getMonth() + 1) + "/" + dt.getDate() + " " + time;
    } catch (error) {
      return "";
    }
  }

  // Chat 檔案附件用：把 bytes 換成 KB/MB 這種人看得懂的字串。
  function formatFileSize(bytes) {
    var n = Number(bytes) || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  }

  function initialOf(id) {
    var label = IDENTITY_LABEL[id] || id || "?";
    return label.charAt(0).toUpperCase();
  }

  // 純網址訊息沒有「目前頁面 title」可以借用（不像「分享目前內容」那樣
  // 有宿主頁面可以問），照抄交接包原型的 titleFromUrl() 猜法：網域＋
  // 最後一段路徑，猜不到就用網域本身。
  function titleFromUrl(url) {
    try {
      var u = new URL(url);
      var host = u.hostname.replace(/^www\./, "");
      var segments = u.pathname.split("/").filter(Boolean);
      var last = segments.length ? segments[segments.length - 1].replace(/[-_]/g, " ") : "";
      return last ? host + " " + last : host;
    } catch (error) {
      return url;
    }
  }

  // 新訊息音效——用 Web Audio API 現場合成一個短「叮」聲，不用另外準備
  // 音檔（也不用煩惱音檔要放哪裡/CSP）。使用者自己送出的訊息不會觸發，
  // 只有真的收到對方訊息才響。
  function playNotificationTone() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.24);
      osc.onended = function () { ctx.close(); };
    } catch (error) {
      // 音效播不出來不影響訊息本身，靜靜失敗就好。
    }
    try {
      if (navigator.vibrate) navigator.vibrate(60);
    } catch (error) {}
  }

  // Shared 分享內容模組：面板（這支跑在 pages/chat-panel/ iframe 裡時）
  // 不知道自己被嵌在哪個宿主頁面，跟宿主要「目前頁面」的 title/url。
  // 宿主端實作見 assets/js/chat-launcher.js／sdk-src/sdk.js 的
  // requestContext/contextReply 訊息處理。單一 in-flight 假設就夠用
  // （使用者一次只會點一次「分享目前內容」），逾時就退回
  // document.referrer 當 fallback，不讓使用者卡住。
  function requestHostContext(timeoutMs) {
    return new Promise(function (resolve) {
      var done = false;
      function finish(value) {
        if (done) return;
        done = true;
        window.removeEventListener("message", onMessage);
        resolve(value);
      }
      function onMessage(event) {
        var data = event.data;
        if (!data || data.source !== "jonaminz-chat-panel-host" || data.action !== "contextReply") return;
        finish({ title: data.title || document.title, url: data.url || "" });
      }
      window.addEventListener("message", onMessage);
      try {
        window.parent.postMessage({ source: "jonaminz-chat-panel", action: "requestContext" }, "*");
      } catch (error) {}
      setTimeout(function () {
        finish({ title: document.title, url: document.referrer || "" });
      }, timeoutMs || 1500);
    });
  }

  function mount(root, options) {
    options = options || {};
    var token = options.token;
    var onUpdate = typeof options.onUpdate === "function" ? options.onUpdate : function () {};

    var inPanel = false;
    try { inPanel = Boolean(window.parent) && window.parent !== window; } catch (error) { inPanel = false; }

    var identity = null;
    var lastMessageId = null;
    var lastReadMarkedId = null;
    // 面板一開始就建立、背景持續 poll（第七次修正），「掛著」不等於
    // 「使用者看得到」——只有整頁版 /pages/chat/（沒有宿主可以告知
    // 可見度，本來就等於使用者正在看）預設可見；面板情境預設不可見，
    // 等宿主真的把面板打開才會收到 visibility 訊息改成 true（見下方
    // message 監聽跟 pages/chat-panel/ 的 mount 呼叫）。
    var isVisible = options.startVisible !== false;
    var pollTimer = null;
    var sending = false;
    var destroyed = false;
    var sharedItems = {};
    var sharedListFilter = "all";
    var activeSharedItemId = null;
    var editingMessageId = null;
    var replyingToMessageId = null;
    var lastTypingSentAt = 0;
    var myPhoneNumber = "";
    var peerPhoneNumber = "";
    var pushSubscribed = false;
    var els = {};
    // 2026-07-14（第十四輪）：歷史分頁——往上捲動載入更早的訊息，
    // 累加在 olderMessages 裡，每次 render() 都跟最新一次 poll 回應
    // merge 起來畫（poll 本身只回傳最近一個時間窗，不會自己累積歷史）。
    var olderMessages = [];
    var hasMoreHistory = true;
    var loadingOlder = false;
    var lastPollData = null;
    var hasRenderedOnce = false;
    var readObserver = null;
    var contextMenuOpenedAt = 0;
    var timePeekMessageId = null;
    // 上一次真的寫進 DOM 的訊息串 HTML——內容沒變就跳過 innerHTML，
    // 避免 1.5 秒 poll 一次的重繪把 hover 工具列砍掉重建造成規律閃爍。
    var lastRenderedThreadHtml = null;
    // 樂觀 UI：已送出但 poll 回應還沒收錄的訊息（{client_message_id, body}
    // 或圖片訊息 {client_message_id, kind:'image', previewUrl, w, h}）
    var pendingMessages = [];
    // OneDrive 線 Phase B（2026-07-15）：downloadUrl 短效（約1小時），
    // 記憶體快取，itemId → downloadUrl（null 代表查過但沒有，例如分享
    // 還沒生效）；inFlight 避免同一個 itemId 短時間內重複發請求。
    var imageUrlCache = {};
    // 2026-07-16：泡泡顯示用 Graph 縮圖（≈800px、幾十 KB），不載全尺寸
    // ——「選檔案」路徑上傳的原檔照片動輒幾 MB，冷載入慢在位元組本身。
    // 全尺寸 URL 仍在 imageUrlCache（點開放大／下載用）。
    var imageThumbCache = {};
    var imageUrlFetchInFlight = {};
    var imageUrlErrorRetried = {};
    // 2026-07-16（使用者回饋「一進聊天室不要看到細細的一條沒載入」）：
    // downloadUrl 快取加一層 localStorage 持久化——URL 本身約 1 小時
    // 有效，記憶體快取每次進頁面都是空的，等於每次都要重新跟 Worker
    // ／Graph 換一輪 URL 才開始載圖。改成換到的 URL 存進 localStorage
    // （帶時間戳，只信 50 分鐘內的），下次進頁面直接命中：<img> 立刻
    // 有 src，而且同一個 URL 瀏覽器自己的 HTTP 快取多半也還留著圖片
    // 位元組，幾乎是秒開。URL 過期載入失敗時走既有的 error-retry 路徑
    // 清掉重換，不會卡死在舊 URL。
    var IMAGE_URL_STORE_KEY = "jonaminz.chatImageUrlCache";
    var IMAGE_URL_STORE_TTL_MS = 50 * 60 * 1000;

    function readImageUrlStore() {
      try {
        var raw = window.localStorage.getItem(IMAGE_URL_STORE_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch (error) { return {}; }
    }

    function loadPersistedImageUrls() {
      var store = readImageUrlStore();
      var now = Date.now();
      Object.keys(store).forEach(function (itemId) {
        var entry = store[itemId];
        if (entry && entry.u && now - entry.t < IMAGE_URL_STORE_TTL_MS) {
          imageUrlCache[itemId] = entry.u;
          if (entry.tu) imageThumbCache[itemId] = entry.tu;
        }
      });
    }

    function persistImageUrls(urls, thumbs) {
      try {
        var store = readImageUrlStore();
        var now = Date.now();
        Object.keys(store).forEach(function (itemId) {
          if (!store[itemId] || now - store[itemId].t >= IMAGE_URL_STORE_TTL_MS) delete store[itemId];
        });
        Object.keys(urls).forEach(function (itemId) {
          if (urls[itemId]) {
            store[itemId] = { u: urls[itemId], t: now };
            if (thumbs && thumbs[itemId]) store[itemId].tu = thumbs[itemId];
          }
        });
        window.localStorage.setItem(IMAGE_URL_STORE_KEY, JSON.stringify(store));
      } catch (error) {}
    }

    function dropPersistedImageUrl(itemId) {
      try {
        var store = readImageUrlStore();
        delete store[itemId];
        window.localStorage.setItem(IMAGE_URL_STORE_KEY, JSON.stringify(store));
      } catch (error) {}
    }

    loadPersistedImageUrls();
    // Messenger 式附件列：一次一個附件（{kind:'image'|'file', file,
    // thumbDataUrl}），選了先掛在輸入列上方的縮圖列，按主送出鍵才送。
    var pendingAttachment = null;

    function maybeMarkRead() {
      if (!isVisible) return;
      if (!lastMessageId || lastMessageId === lastReadMarkedId) return;
      lastReadMarkedId = lastMessageId;
      window.JonaminzBackend.markChatRead({ token: token, messageId: lastMessageId }).catch(function () {});
    }

    // 2026-07-14（第十四輪）：已讀原本是「render() 跑過＋isVisible 為真」
    // 就整批標記已讀，現在改成「最新那一則訊息真的捲進畫面裡」才算——
    // 用 IntersectionObserver 盯著訊息串裡最後一個 .jonaminz-chat-message
    // 元素，它真的進入可視範圍時才呼叫 maybeMarkRead()。使用者捲上去看
    // 舊訊息、最新一則不在畫面裡時，不會被錯誤標記已讀。不支援
    // IntersectionObserver 的環境（極舊瀏覽器）退回舊的「可見就標記」
    // 行為，不讓已讀功能整個失效。
    function setupReadObserver() {
      if (typeof IntersectionObserver !== "function") {
        maybeMarkRead();
        return;
      }
      if (readObserver) readObserver.disconnect();
      var messageEls = els.thread.querySelectorAll(".jonaminz-chat-message");
      var lastEl = messageEls[messageEls.length - 1];
      if (!lastEl) return;
      readObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) maybeMarkRead();
        });
      }, { root: els.thread, threshold: 0.6 });
      readObserver.observe(lastEl);
    }

    window.addEventListener("message", function (event) {
      var data = event.data;
      if (!data || data.source !== "jonaminz-chat-panel-host" || data.action !== "visibility") return;
      isVisible = Boolean(data.visible);
      if (isVisible) maybeMarkRead();
    });

    function otherIdentity() {
      return identity === "jonathan" ? "minz" : "jonathan";
    }

    function renderHead(data) {
      var peer = otherIdentity();
      var peerLabel = IDENTITY_LABEL[peer] || peer;
      var messages = data.messages || [];
      var readState = data.readState || {};
      var peerRead = readState[peer] || {};

      els.avatar.textContent = initialOf(peer);
      els.peerName.textContent = peerLabel;

      var lastMessage = messages[messages.length - 1];
      var peerTyping = Boolean(data.typing && data.typing[peer]);
      if (peerTyping) {
        els.peerStatus.textContent = "正在輸入...";
      } else {
        els.peerStatus.textContent = lastMessage ? "最後訊息 " + formatTime(lastMessage.created_at) : "還沒有訊息";
      }

      // 在線＝對方的可見心跳在 2 分鐘內（見檔頭 PRESENCE_WINDOW_MS 註解）。
      var peerSeenAt = data.presence && data.presence[peer] ? new Date(data.presence[peer]).getTime() : 0;
      var isOnline = peerSeenAt > 0 && (Date.now() - peerSeenAt) < PRESENCE_WINDOW_MS;
      els.avatar.classList.toggle("is-online", isOnline);
      els.avatar.classList.toggle("no-presence", !isOnline);

      var myRead = readState[identity] || {};
      var myReadIndex = -1;
      if (myRead.lastReadMessageId) {
        for (var i = 0; i < messages.length; i += 1) {
          if (messages[i].id === myRead.lastReadMessageId) { myReadIndex = i; break; }
        }
      }
      var unreadCount = 0;
      if (myReadIndex >= 0) {
        for (var j = myReadIndex + 1; j < messages.length; j += 1) {
          if (messages[j].sender_identity === peer) unreadCount += 1;
        }
      }

      onUpdate({
        peer: peer,
        peerLabel: peerLabel,
        isOnline: isOnline,
        unreadCount: unreadCount,
        lastMessage: lastMessage || null
      });

      return unreadCount;
    }

    // 2026-07-16（使用者回報「表情按了等好久」→做了optimistic→又回報
    // 「換太快會彈回去」）：optimistic 不能直接改本機資料——1.5秒的
    // poll 一來就用「後端還沒處理完」的舊資料蓋掉，造成彈回去。改用
    // 一層「覆蓋」狀態 reactionOverride（messageId → 我想要的 emoji，
    // "" 代表移除）：render 時把覆蓋層套在後端資料上（後端是一人一個
    // 反應，套法＝拿掉我在後端的反應、換成覆蓋值），poll 進來也照套，
    // 直到後端資料真的追上覆蓋值才自動清掉這個覆蓋（在 render 裡比對、
    // 相符就 delete）。這樣不管 poll 多快都不會彈。
    var reactionOverride = {};

    function myServerReaction(reactionRows) {
      for (var i = 0; i < reactionRows.length; i += 1) {
        if (reactionRows[i].identity === identity) return reactionRows[i].emoji;
      }
      return "";
    }

    function optimisticToggleReaction(messageId, emoji) {
      var pools = [olderMessages, (lastPollData && lastPollData.messages) || []];
      var current = null;
      for (var p = 0; p < pools.length && current === null; p += 1) {
        for (var i = 0; i < pools[p].length; i += 1) {
          if (pools[p][i].id === messageId) {
            current = reactionOverride.hasOwnProperty(messageId)
              ? reactionOverride[messageId]
              : myServerReaction(pools[p][i].chat_message_reactions || []);
            break;
          }
        }
      }
      if (current === null) current = reactionOverride[messageId] || "";
      // 點我目前這個＝移除；點別的＝換成那個。
      reactionOverride[messageId] = (current === emoji) ? "" : emoji;
      if (lastPollData) render(lastPollData);
    }

    // 把覆蓋層套在某則訊息的後端反應陣列上，回傳套用後的陣列；順便
    // 在後端已追上覆蓋值時清掉覆蓋（自我收斂，不會永久卡著）。
    function reactionsWithOverride(messageId, reactionRows) {
      if (!reactionOverride.hasOwnProperty(messageId)) return reactionRows;
      var want = reactionOverride[messageId];
      if (myServerReaction(reactionRows) === want) {
        delete reactionOverride[messageId];
        return reactionRows;
      }
      var kept = [];
      for (var i = 0; i < reactionRows.length; i += 1) {
        if (reactionRows[i].identity !== identity) kept.push(reactionRows[i]);
      }
      if (want) kept.push({ identity: identity, emoji: want });
      return kept;
    }

    function render(data) {
      identity = data.identity;
      lastPollData = data;
      var unreadCount = renderHead(data);

      // 跟已經往上捲動載入的歷史訊息 merge 起來——poll() 本身只回傳最近
      // 一個時間窗，不會自己累積歷史，靠這裡把 olderMessages 接在前面。
      var messages = olderMessages.concat(data.messages || []);
      var readState = data.readState || {};
      var deliveryState = data.deliveryState || {};
      sharedItems = data.sharedItems || {};
      var myRead = readState[identity] || {};
      var otherRead = readState[otherIdentity()] || {};
      var otherDelivery = deliveryState[otherIdentity()] || {};
      var messagesById = {};
      messages.forEach(function (mm) { messagesById[mm.id] = mm; });
      ensureImageUrls(messages);

      renderNotifPanel(unreadCount);
      updateSharedListDot();
      if (els.sharedListPanel && !els.sharedListPanel.hidden) renderSharedListPanel();

      // 樂觀 UI（2026-07-15）：poll 回應已經收錄的送出中訊息從 pending
      // 清單移除（比對 client_message_id，這欄位本來就是為重送冪等而生，
      // 剛好也是樂觀泡泡跟真實訊息之間唯一穩定的對應鍵）。
      if (pendingMessages.length) {
        var confirmedCmids = {};
        (data.messages || []).forEach(function (mm) { confirmedCmids[mm.client_message_id] = true; });
        pendingMessages = pendingMessages.filter(function (p) { return !confirmedCmids[p.client_message_id]; });
      }

      if (!messages.length && !pendingMessages.length) {
        els.thread.innerHTML = '<p class="jonaminz-chat-empty">還沒有訊息，說句話開始吧。</p>';
        lastRenderedThreadHtml = null; // 這個分支直接動了 DOM，快取作廢
        return;
      }

      // 2026-07-14：真的有「對方送來的新訊息」才播提示音——排除自己剛
      // 送出的訊息、也排除第一次載入時把既有訊息全部當成「新的」誤觸發。
      // 2026-07-15：加上 isVisible——面板收合在背景時不播（那種情境交給
      // 系統推播通知，不然通知音跟這個提示音會重疊各響一次）。
      var newestMessage = messages[messages.length - 1];
      if (hasRenderedOnce && isVisible && newestMessage && newestMessage.id !== lastMessageId && newestMessage.sender_identity !== identity) {
        playNotificationTone();
      }
      hasRenderedOnce = true;

      // 找出「我方已讀到哪一則」的 index，之後才知道未讀分隔線要插在哪。
      var myReadIndex = -1;
      if (myRead.lastReadMessageId) {
        for (var i = 0; i < messages.length; i += 1) {
          if (messages[i].id === myRead.lastReadMessageId) { myReadIndex = i; break; }
        }
      }

      // 分隔線要插在「第一則對方傳來的未讀訊息」前面，不能只看 index 差一位——
      // 我方已讀到 myReadIndex 之後，如果緊接著是自己送出的新訊息（poll() 送出
      // 後、markChatRead 生效前那個當下的畫面），這則不該被當成「未讀」，不然
      // 會有一瞬間在自己剛送出的訊息上面冒出「未讀訊息」分隔線。
      var firstUnreadIndex = -1;
      if (myReadIndex >= 0) {
        for (var u = myReadIndex + 1; u < messages.length; u += 1) {
          if (messages[u].sender_identity !== identity) { firstUnreadIndex = u; break; }
        }
      }

      var html = "";
      var lastDividerAt = -Infinity; // 上一條時間分隔線代表的時間點（ms），跟這則訊息差夠久才再插一次
      var dividerInserted = firstUnreadIndex < 0; // 沒有已讀紀錄或沒有對方的未讀訊息就不畫分隔線

      messages.forEach(function (m, index) {
        var mine = m.sender_identity === identity;
        var messageAt = new Date(m.created_at).getTime();
        if (messageAt - lastDividerAt >= TIME_DIVIDER_GAP_MS) {
          var timeLabel = formatTime(m.created_at);
          if (timeLabel) {
            html += '<div class="jonaminz-chat-time-divider">' + escapeHtml(timeLabel) + "</div>";
            lastDividerAt = messageAt;
          }
        }

        if (!dividerInserted && index === firstUnreadIndex) {
          html += '<div class="jonaminz-chat-unread-divider"><span>未讀訊息</span></div>';
          dividerInserted = true;
        }

        // 大頭貼只出現在「對方那一串連續訊息的最後一則」，避免每則都重複貼一次。
        var nextIsSameSender = messages[index + 1] && messages[index + 1].sender_identity === m.sender_identity;
        var showAvatar = !mine && !nextIsSameSender;

        var avatarHtml = !mine
          ? ('<div class="jonaminz-chat-message-avatar' + (showAvatar ? "" : " is-placeholder") + '">' +
              (showAvatar ? escapeHtml(initialOf(m.sender_identity)) : "") + "</div>")
          : "";

        var readByOther = mine && otherRead.lastReadMessageId === m.id;
        var deleted = Boolean(m.deleted_at);
        // 圖片/檔案訊息比照 shared_item：不能編輯（沒有文字內容可編輯），
        // 這一版也先不開放刪除，跟既有行為一致，不節外生枝。
        var canEditOrDelete = mine && !deleted && m.kind !== "shared_item" && m.kind !== "image" && m.kind !== "file";
        // 2026-07-16（使用者回饋「圖片也要可以刪除阿」）：圖片/檔案原本
        // 比照 shared_item 完全不給刪（當時註解寫「不節外生枝」），但
        // 傳錯的照片刪不掉是真實痛點。後端 deleteChatMessage 本來就只
        // 驗「是不是自己傳的」沒有限制種類，這裡開放自己的圖片/檔案
        // 可刪（編輯仍然不開放——沒有文字內容可編輯）。
        // （同晚追加：使用者截圖分享卡片也沒有刪除選項——擴大成
        // 「自己傳的任何未刪除訊息都可刪」，不再列舉種類；後端本來
        // 就只驗 sender_identity，沒有種類限制。）
        var canDeleteMedia = mine && !deleted && !canEditOrDelete;
        var canReplyOrReact = !deleted;
        // 圖片/檔案訊息（未過期）帶下載參數在 message 元素上，給 ⋮ 選單
        // 的「下載」讀（openActionSheet）——不管圖片還是一般檔案都能下載。
        var downloadMeta = (!deleted && (m.kind === "image" || m.kind === "file") &&
          m.metadata && m.metadata.itemId && !m.metadata.expired) ? m.metadata : null;

        // 2026-07-14（第十五輪）：回覆／引用——reply_to_message_id 指到的
        // 那則訊息如果還在目前已載入的範圍內（olderMessages/data.messages
        // merge 起來的 messagesById），畫出小小的引用預覽；不在範圍內
        // （例如引用了很久以前還沒往上捲到的訊息）就退回通用的「回覆訊息」
        // 提示，不強求一定要找得到。
        var replyQuoteHtml = "";
        if (!deleted && m.reply_to_message_id) {
          var quoted = messagesById[m.reply_to_message_id];
          if (quoted) {
            var quotedLabel = quoted.sender_identity === identity ? "我" : (IDENTITY_LABEL[quoted.sender_identity] || quoted.sender_identity);
            var quotedSnippet = quoted.kind === "shared_item" ? "[分享的內容]" :
              (quoted.kind === "image" ? "[圖片]" :
              (quoted.kind === "file" ? "[檔案]" : (quoted.deleted_at ? "此訊息已刪除" : quoted.body)));
            replyQuoteHtml = '<div class="jonaminz-chat-reply-quote">' + escapeHtml(quotedLabel) + "：" +
              escapeHtml(String(quotedSnippet || "").slice(0, 60)) + "</div>";
          } else {
            replyQuoteHtml = '<div class="jonaminz-chat-reply-quote is-unknown">回覆訊息</div>';
          }
        }

        // 表情反應：chat_message_reactions 是 listChatMessages／
        // loadOlderChatMessages 用 PostgREST resource embedding 一起帶出來
        // 的陣列，這裡按 emoji 分組計數，順便記住「我自己是不是也點過這個」
        // 好加上 is-mine 樣式。
        var reactionsHtml = "";
        var reactionRows = reactionsWithOverride(m.id, m.chat_message_reactions || []);
        if (reactionRows.length) {
          var reactionGroups = {};
          reactionRows.forEach(function (r) {
            reactionGroups[r.emoji] = reactionGroups[r.emoji] || { count: 0, mine: false };
            reactionGroups[r.emoji].count += 1;
            if (r.identity === identity) reactionGroups[r.emoji].mine = true;
          });
          reactionsHtml = '<div class="jonaminz-chat-reactions">' +
            Object.keys(reactionGroups).map(function (emoji) {
              var g = reactionGroups[emoji];
              return '<button type="button" class="jonaminz-chat-reaction-pill' + (g.mine ? " is-mine" : "") + '" ' +
                'data-react-toggle data-message-id="' + escapeHtml(m.id) + '" data-emoji="' + emoji + '">' +
                emoji + " " + g.count + "</button>";
            }).join("") +
            "</div>";
        }

        var bodyHtml;
        if (deleted) {
          bodyHtml = '<div class="jonaminz-chat-bubble is-deleted">此訊息已刪除</div>';
        } else if ((m.kind === "image" || m.kind === "file") && m.metadata && m.metadata.expired) {
          // 超過聊天檔案保留天數，Worker 端已經把 OneDrive 上的檔案本體
          // 刪掉並標記 metadata.expired（見 worker.js maybeRunChatFilePurge）
          // ——不再嘗試 ensureImageUrls，直接顯示明確的過期說明，跟
          // 「此訊息已刪除」同一種視覺語言，避免使用者誤以為是下載失敗。
          bodyHtml = '<div class="jonaminz-chat-bubble is-deleted">' +
            (m.kind === "image" ? "圖片" : "檔案") + '已超過保留天數，已自動從 OneDrive 清除</div>';
        } else if (m.kind === "image" && m.metadata && m.metadata.itemId) {
          // OneDrive 線 Phase B：先畫 metadata 裡的模糊縮圖（不用等
          // Graph），imageUrlCache 有真正的 downloadUrl 才換成真圖。
          // 真圖載入失敗（downloadUrl 過期、分享被撤銷）就清快取，
          // 下一次 render 會重新去要一次，最多重試一輪不無限循環。
          var imgMeta = m.metadata;
          var realUrl = imageUrlCache[imgMeta.itemId];
          // 泡泡優先用 Graph 縮圖（小很多、載得快），沒有縮圖才退回
          // 全尺寸；點開放大用 data-full-url 的全尺寸（lightbox 讀它）。
          var thumbUrl = imageThumbCache[imgMeta.itemId];
          var imgSrc = thumbUrl || realUrl || imgMeta.thumbDataUri || "";
          var aspect = imgMeta.w && imgMeta.h ? (imgMeta.w + "/" + imgMeta.h) : "1/1";
          var showUnsharedHint = mine && imgMeta.sharedOk === false;
          bodyHtml = '<div class="jonaminz-chat-bubble-col">' + replyQuoteHtml +
            '<div class="jonaminz-chat-image-bubble" data-image-bubble data-item-id="' + escapeHtml(imgMeta.itemId) +
            '" data-full-url="' + escapeHtml(realUrl || "") + '">' +
            '<img src="' + escapeHtml(imgSrc) + '" alt="圖片" style="aspect-ratio:' + aspect + '"' +
            (thumbUrl || realUrl ? "" : ' class="is-loading"') + '>' +
            "</div>" +
            (showUnsharedHint ? '<p class="jonaminz-chat-image-unshared">對方尚未能看到這張圖</p>' : "") +
            reactionsHtml + "</div>";
        } else if (m.kind === "file" && m.metadata && m.metadata.itemId &&
                   m.metadata.mimeType && m.metadata.mimeType.indexOf("image/") === 0) {
          // 2026-07-16：使用者回報用「選檔案」（不是「選圖片」）按鈕挑到
          // 圖片時，被當成一般檔案畫成下載卡片，只能下載看不到內容——
          // 手機上「選檔案」的系統選擇器常常直接秀相簿，很容易選錯按鈕。
          // requestFileUpload 上傳當下就有存 `file.type`（見
          // sendFile() 的 mimeType），只是原本沒有拿來畫面。這裡不用
          // 改上傳流程本身把它硬塞回 kind:'image'（那樣會少了 w/h／
          // 模糊縮圖等圖片專屬欄位），純粹改渲染邏輯：mimeType 是
          // image/* 就沿用圖片泡泡的畫法（含點擊放大），不用引導使用者
          // 重傳一次。
          var fileAsImageMeta = m.metadata;
          var fileAsImageUrl = imageUrlCache[fileAsImageMeta.itemId];
          var fileAsImageThumb = imageThumbCache[fileAsImageMeta.itemId];
          bodyHtml = '<div class="jonaminz-chat-bubble-col">' + replyQuoteHtml +
            '<div class="jonaminz-chat-image-bubble" data-image-bubble data-item-id="' + escapeHtml(fileAsImageMeta.itemId) +
            '" data-full-url="' + escapeHtml(fileAsImageUrl || "") + '">' +
            '<img src="' + escapeHtml(fileAsImageThumb || fileAsImageUrl || "") + '" alt="' + escapeHtml(fileAsImageMeta.fileName || "圖片") + '"' +
            (fileAsImageThumb || fileAsImageUrl ? "" : ' class="is-loading"') + '>' +
            "</div>" + reactionsHtml + "</div>";
        } else if (m.kind === "file" && m.metadata && m.metadata.itemId) {
          // 跟圖片訊息共用同一套 OneDrive 上傳/分享/換 downloadUrl 管道
          // （見 ensureImageUrls），差別只在這裡畫「檔名＋大小」卡片，
          // 不是縮圖——一般檔案沒有縮圖可以先顯示。
          var fileMeta = m.metadata;
          var fileUnshared = mine && fileMeta.sharedOk === false;
          bodyHtml = '<div class="jonaminz-chat-bubble-col">' + replyQuoteHtml +
            '<div class="jonaminz-chat-file-bubble" data-file-bubble data-item-id="' + escapeHtml(fileMeta.itemId) +
            '" data-owner-identity="' + escapeHtml(fileMeta.ownerIdentity || "") +
            '" data-file-name="' + escapeHtml(fileMeta.fileName || "檔案") + '">' +
            '<span class="jonaminz-chat-file-icon">📄</span>' +
            '<div class="jonaminz-chat-file-info">' +
            '<div class="jonaminz-chat-file-name">' + escapeHtml(fileMeta.fileName || "檔案") + '</div>' +
            '<div class="jonaminz-chat-file-size">' + escapeHtml(formatFileSize(fileMeta.fileSize)) + '</div>' +
            "</div></div>" +
            // Messenger/LINE 慣例：卡片下方一行小字當下載提示（使用者
            // 指定的樣式），點卡片本身就會下載，小字純提示不攔截點擊。
            '<span class="jonaminz-chat-file-hint">點擊下載</span>' +
            (fileUnshared ? '<p class="jonaminz-chat-image-unshared">對方尚未能看到這個檔案</p>' : "") +
            reactionsHtml + "</div>";
        } else if (m.kind === "shared_item" && m.shared_item_id && sharedItems[m.shared_item_id]) {
          var item = sharedItems[m.shared_item_id];
          var viewerSeen = Boolean(item.seenState && item.seenState[identity]);
          bodyHtml =
            '<div class="jonaminz-chat-bubble-col">' +
            '<div class="jonaminz-chat-shared-card' + (viewerSeen ? "" : " is-unseen") + '" ' +
            'data-shared-card data-item-id="' + escapeHtml(item.id) + '" ' +
            'data-item-url="' + escapeHtml(item.url) + '">' +
            '<div class="jonaminz-chat-shared-card-source">' + escapeHtml(item.source) + "</div>" +
            '<div class="jonaminz-chat-shared-card-title">' + escapeHtml(item.title) + "</div>" +
            (viewerSeen ? "" : '<div class="jonaminz-chat-shared-card-unseen">尚未查看</div>') +
            '<button type="button" class="jonaminz-chat-shared-card-discuss" data-discuss-btn ' +
            'data-item-id="' + escapeHtml(item.id) + '" data-item-title="' + escapeHtml(item.title) + '">討論</button>' +
            "</div>" + reactionsHtml + "</div>";
        } else {
          // 2026-07-14（第十五輪修正）：.jonaminz-chat-message 是 flex row
          // （大頭貼跟內容並排），回覆引用／泡泡／表情反應如果各自是直接
          // 子元素會被當成三個並排的 flex item 疊在一起，不是想要的「引用
          // 在上、泡泡在中、反應在下」直向堆疊。用一個 column 容器包起來，
          // 對 flex row 來說這個容器才是唯一的 flex item，內部照一般 block
          // 排版直向堆疊。
          var emojiOnly = isEmojiOnly(m.body);
          bodyHtml = '<div class="jonaminz-chat-bubble-col">' + replyQuoteHtml +
            '<div class="jonaminz-chat-bubble' + (emojiOnly ? " is-emoji-only" : "") + '">' + escapeHtml(m.body) +
            (m.edited_at ? '<span class="jonaminz-chat-edited-tag">已編輯</span>' : "") + "</div>" +
            reactionsHtml + "</div>";
        }

        // ⋮（更多）按到會開底部操作列，操作列裡有沒有東西取決於
        // copyText/editable/deletable——一個都沒有（例如對方傳的圖片）
        // 就不畫這顆按鈕，免得按了沒反應像壞掉。
        var hasCopyText = !deleted && m.kind !== "shared_item" && m.kind !== "image" && m.kind !== "file";
        var hasMoreActions = hasCopyText || canEditOrDelete || canDeleteMedia || Boolean(downloadMeta);
        html +=
          '<div class="jonaminz-chat-message" data-mine="' + mine + '" data-message-id="' + escapeHtml(m.id) + '"' +
          (canEditOrDelete ? " data-editable=\"true\"" : "") +
          (canDeleteMedia ? " data-deletable=\"true\"" : "") +
          (downloadMeta ? ' data-download-item-id="' + escapeHtml(downloadMeta.itemId) +
            '" data-download-owner="' + escapeHtml(downloadMeta.ownerIdentity || "") +
            '" data-download-name="' + escapeHtml(downloadMeta.fileName || "檔案") + '"' : "") +
          (deleted ? ' data-deleted="true"' : "") +
          (hasCopyText ? ' data-copy-text="' + escapeHtml(m.body) + '"' : "") + ">" +
          avatarHtml +
          bodyHtml +
          // 2026-07-16：電腦版滑鼠 hover 專用工具列（⋮更多／↩回覆／
          // 🙂回應表情），CSS 用 :hover 控制顯示（.jonaminz-chat-hover-
          // toolbar，只在 hover-capable 裝置生效，觸控裝置看不到也
          // 點不到，長按走 openContextMenu() 不受影響）。已刪除的訊息
          // 不給任何互動。
          (deleted ? "" :
            '<div class="jonaminz-chat-hover-toolbar">' +
            (hasMoreActions ? '<button type="button" data-hover-more aria-label="更多">⋮</button>' : "") +
            (hasCopyText
              ? '<button type="button" data-hover-reply aria-label="回覆">↩</button>' : "") +
            '<button type="button" data-hover-react aria-label="回應表情">🙂</button>' +
            "</div>") +
          "</div>";

        // 2026-07-15：點一下訊息顯示這則的確切時間（LINE/FB 慣例）——
        // 時間分隔線 15 分鐘才一條，中間的訊息看不出各自幾點送的。
        // timePeekMessageId 是 state，render 每 1.5 秒重畫也不會消失，
        // 再點同一則收起來。
        if (timePeekMessageId === m.id) {
          html += '<div class="jonaminz-chat-time-peek" data-mine="' + mine + '">' +
            escapeHtml(formatPeekTime(m.created_at)) + "</div>";
        }

        if (readByOther) {
          html +=
            '<div class="jonaminz-chat-read-receipt"><div class="jonaminz-chat-message-avatar is-tiny">' +
            escapeHtml(initialOf(otherIdentity())) + "</div></div>";
        }

        // 送達／已讀三態：只在「整串對話裡我自己送出的最後一則」下面顯示
        // 一個狀態字（已送出／已送達／已讀），不是每則訊息都顯示——避免
        // 畫面太吵，也符合這個功能最常被在意的情境（我剛剛送出的這則，
        // 對方到底收到了沒）。用時間戳比大小，不用訊息 id 比對，天生就
        // 不受分頁/排序影響。
        if (mine && !deleted && index === messages.length - 1) {
          var msgTime = new Date(m.created_at).getTime();
          var otherReadAt = otherRead.lastReadAt ? new Date(otherRead.lastReadAt).getTime() : 0;
          var otherDeliveredAt = otherDelivery.lastDeliveredAt ? new Date(otherDelivery.lastDeliveredAt).getTime() : 0;
          var tickLabel = otherReadAt >= msgTime ? "已讀" : (otherDeliveredAt >= msgTime ? "已送達" : "已送出");
          html += '<div class="jonaminz-chat-delivery-tick">' + tickLabel + "</div>";
        }
      });

      var loadMoreHtml = hasMoreHistory
        ? '<button type="button" class="jonaminz-chat-load-more" data-load-more>' +
          (loadingOlder ? "載入中..." : "載入更早的訊息") + "</button>"
        : "";

      // 樂觀 UI（2026-07-15）：還沒被 poll 回應收錄的送出中訊息，畫在
      // 所有真實訊息後面，半透明＋「傳送中...」——使用者按送出的瞬間
      // 就看到自己的訊息，不用等 API 往返＋下一次 poll（原本 1~2 秒的
      // 空窗就是這樣來的）。
      pendingMessages.forEach(function (p) {
        if (p.kind === "image") {
          html +=
            '<div class="jonaminz-chat-message is-pending" data-mine="true">' +
            '<div class="jonaminz-chat-bubble-col">' +
            '<div class="jonaminz-chat-image-bubble">' +
            '<img src="' + escapeHtml(p.previewUrl) + '" alt="圖片" style="aspect-ratio:' +
            (p.w || 1) + "/" + (p.h || 1) + '"></div></div></div>' +
            '<div class="jonaminz-chat-delivery-tick">傳送中...</div>';
          return;
        }
        if (p.kind === "file") {
          html +=
            '<div class="jonaminz-chat-message is-pending" data-mine="true">' +
            '<div class="jonaminz-chat-bubble-col">' +
            '<div class="jonaminz-chat-file-bubble">' +
            '<span class="jonaminz-chat-file-icon">📄</span>' +
            '<div class="jonaminz-chat-file-info">' +
            '<div class="jonaminz-chat-file-name">' + escapeHtml(p.fileName || "檔案") + '</div>' +
            '<div class="jonaminz-chat-file-size">' + escapeHtml(formatFileSize(p.fileSize)) + '</div>' +
            "</div></div></div></div>" +
            '<div class="jonaminz-chat-delivery-tick">傳送中...</div>';
          return;
        }
        html +=
          '<div class="jonaminz-chat-message is-pending" data-mine="true">' +
          '<div class="jonaminz-chat-bubble-col">' +
          '<div class="jonaminz-chat-bubble">' + escapeHtml(p.body) + "</div></div></div>" +
          '<div class="jonaminz-chat-delivery-tick">傳送中...</div>';
      });

      // 2026-07-15：輸入中原本只換頭部那行小字（「正在輸入...」取代
      // 「最後訊息 HH:MM」），真機上太隱晦、使用者根本沒發現這個功能
      // 存在——補上聊天 App 慣見的「•••」跳動泡泡，畫在訊息串最底部，
      // 跟對方訊息同一種泡泡樣式。頭部小字保留（兩個位置一起顯示）。
      if (data.typing && data.typing[otherIdentity()]) {
        html +=
          '<div class="jonaminz-chat-message" data-mine="false">' +
          '<div class="jonaminz-chat-message-avatar">' + escapeHtml(initialOf(otherIdentity())) + "</div>" +
          '<div class="jonaminz-chat-bubble jonaminz-chat-typing-bubble" aria-label="對方正在輸入">' +
          "<span></span><span></span><span></span></div></div>";
      }

      // 2026-07-16（使用者回報 hover 工具列每隔固定時間閃一下）：閃爍
      // 週期＝1.5 秒的 poll——每次 poll 完不管內容有沒有變都整個重設
      // innerHTML，滑鼠下的工具列被砍掉重建，opacity 又從 0 淡入一次。
      // 內容跟上一次完全一樣就不要動 DOM（比對我們自己組出來的 html
      // 字串，不比 innerHTML——瀏覽器會正規化屬性順序，直接比對
      // innerHTML 永遠不相等）。
      var fullHtml = loadMoreHtml + html;
      if (fullHtml === lastRenderedThreadHtml) return;
      lastRenderedThreadHtml = fullHtml;
      var wasNearBottom = els.thread.scrollHeight - els.thread.scrollTop - els.thread.clientHeight < 80;
      els.thread.innerHTML = fullHtml;
      if (wasNearBottom || !lastMessageId) els.thread.scrollTop = els.thread.scrollHeight;

      if (messages.length) {
        var newestId = messages[messages.length - 1].id;
        if (newestId !== lastMessageId) {
          lastMessageId = newestId;
        }
      }
      // 2026-07-14：面板 iframe 現在跟大頭貼同時建立、background 一直在
      // poll（見第七次修正），所以「render() 被呼叫過」不再等於「使用者
      // 真的有看到」——面板收合在背景時一樣會 poll/render，不能在這時候
      // 就標記已讀。已讀只在 isVisible 為真（面板真的展開，或整頁版一律
      // 視為可見）時才觸發；且要等「最新那則訊息真的捲進畫面」才算，見
      // setupReadObserver()。
      setupReadObserver();
    }

    // 2026-07-14（第十四輪）：往上捲動載入更早的訊息，累加進
    // olderMessages，再用最後一次 poll 的資料重新 render()（不用整個
    // 重新打一次 listChatMessages）。往上插內容會讓瀏覽器把使用者原本
    // 看的位置往下推，補償 scrollTop 讓畫面看起來沒有跳動。
    function loadOlder() {
      if (loadingOlder || !hasMoreHistory) return Promise.resolve();
      var anchor = (olderMessages[0] || (lastPollData && lastPollData.messages && lastPollData.messages[0]));
      if (!anchor) return Promise.resolve();
      loadingOlder = true;
      if (lastPollData) render(lastPollData); // 先畫「載入中...」的 load-more 按鈕
      // 回傳 promise 讓呼叫端能等這一頁載完（搜尋結果跳轉要連續載入歷史
      // 直到找到目標訊息，見 scrollToMessage()）。
      return window.JonaminzBackend.loadOlderChatMessages({ token: token, beforeMessageId: anchor.id })
        .then(function (data) {
          if (destroyed) return;
          var prevScrollHeight = els.thread.scrollHeight;
          olderMessages = (data.messages || []).concat(olderMessages);
          hasMoreHistory = Boolean(data.hasMore);
          loadingOlder = false;
          if (lastPollData) render(lastPollData);
          els.thread.scrollTop = els.thread.scrollHeight - prevScrollHeight;
        })
        .catch(function () {
          loadingOlder = false;
          if (lastPollData) render(lastPollData);
        });
    }

    // 2026-07-14（真機回饋）：搜尋結果點了要真的跳到那則訊息。目標訊息
    // 可能還在「沒載入的更早歷史」裡——找不到就往上多載一頁再找，最多
    // 20 頁（1000 則）當保險絲，避免極端情況下無限迴圈。
    function scrollToMessage(messageId, attempt) {
      attempt = attempt || 0;
      var el = els.thread.querySelector('[data-message-id="' + messageId + '"]');
      if (el) {
        el.scrollIntoView({ block: "center" });
        el.classList.add("is-highlighted");
        setTimeout(function () { el.classList.remove("is-highlighted"); }, 1800);
        return;
      }
      if (attempt >= 20 || !hasMoreHistory) return;
      loadOlder().then(function () {
        scrollToMessage(messageId, attempt + 1);
      });
    }

    function poll() {
      // visible:true＝面板真的展開、使用者正在看——Worker 拿它記在線心跳。
      return window.JonaminzBackend.listChatMessages({ token: token, visible: isVisible === true })
        .then(function (data) {
          if (destroyed) return;
          render(data);
          els.status.textContent = "";
        })
        .catch(function (error) {
          if (destroyed) return;
          els.status.textContent = "更新失敗：" + (error.message || String(error));
        });
    }

    function updateComposerAction() {
      var hasPayload = Boolean(els.input.value.trim()) || Boolean(pendingAttachment);
      els.action.textContent = hasPayload ? "➤" : QUICK_REACTION;
      els.action.classList.toggle("is-send-mode", hasPayload);
      els.action.setAttribute("aria-label", hasPayload ? "送出訊息" : "快速送出 " + QUICK_REACTION);
    }

    // Messenger 式附件列的畫面同步：有附件畫縮圖 chip（圖片）或檔名
    // chip（一般檔案），右上角 ✕ 移除；沒附件就整列收起來。
    function renderAttachTray() {
      if (!els.attachTray) return;
      if (!pendingAttachment) {
        els.attachTray.hidden = true;
        els.attachTray.innerHTML = "";
        updateComposerAction();
        return;
      }
      var inner;
      if (pendingAttachment.kind === "image" && pendingAttachment.thumbDataUrl) {
        inner = '<div class="jonaminz-chat-attach-chip is-image">' +
          '<img src="' + pendingAttachment.thumbDataUrl + '" alt="附件預覽">' +
          '<button type="button" data-attach-remove aria-label="移除附件">✕</button>' +
          "</div>";
      } else {
        inner = '<div class="jonaminz-chat-attach-chip is-file">' +
          '<span class="jonaminz-chat-attach-chip-icon">📄</span>' +
          '<span class="jonaminz-chat-attach-chip-name">' + escapeHtml(pendingAttachment.file.name || "檔案") + "</span>" +
          '<button type="button" data-attach-remove aria-label="移除附件">✕</button>' +
          "</div>";
      }
      els.attachTray.innerHTML = inner;
      els.attachTray.hidden = false;
      updateComposerAction();
    }

    // 2026-07-14：輸入框原本是固定高度，多行文字只能在裡面自己捲動——
    // 標準聊天 App（iMessage/WhatsApp/Messenger）都是隨內容長高，長到
    // CSS 的 max-height 才開始內部捲動。textarea 本身不會自動長高，要
    // 手動量 scrollHeight 才能做到。
    function autoGrowInput() {
      els.input.style.height = "auto";
      els.input.style.height = els.input.scrollHeight + "px";
    }

    function doSendText(body) {
      if (!body || sending) return;
      sending = true;
      els.action.disabled = true;

      var request;
      var pendingCmid = null;
      if (editingMessageId) {
        // 編輯模式：改叫 editChatMessage，不是送一則新訊息。
        var messageIdBeingEdited = editingMessageId;
        request = window.JonaminzBackend.editChatMessage({ token: token, messageId: messageIdBeingEdited, body: body })
          .then(function () { setEditTarget(null); });
      } else if (BARE_URL_RE.test(body)) {
        // 整則訊息就是一個網址：當成分享內容處理，跟 Discord/Slack/
        // iMessage 一樣貼純網址會變成預覽卡，不是純文字泡泡。
        request = window.JonaminzBackend.shareCurrentContent({ token: token, url: body, title: titleFromUrl(body) });
      } else {
        var clientMessageId = identity + "-" + Date.now() + "-" + Math.random().toString(36).slice(2);
        var sendPayload = { token: token, body: body, clientMessageId: clientMessageId };
        if (activeSharedItemId) sendPayload.sharedItemId = activeSharedItemId;
        if (replyingToMessageId) sendPayload.replyToMessageId = replyingToMessageId;
        // 樂觀 UI（2026-07-15）：按下送出的瞬間就把訊息畫上畫面（半透明
        // ＋「傳送中...」），不等 API 往返＋下一次 poll——原本送出後要
        // 1~2 秒才看得到自己的訊息，體感很 lag。用 client_message_id
        // 對帳：poll 回應收錄同一個 id 時，樂觀泡泡自動被真實訊息取代。
        pendingCmid = clientMessageId;
        pendingMessages.push({ client_message_id: clientMessageId, body: body });
        if (lastPollData) render(lastPollData);
        request = window.JonaminzBackend.sendChatMessage(sendPayload).then(function (result) {
          setReplyTarget(null);
          return result;
        });
      }

      request
        .then(function () {
          return poll();
        })
        .catch(function (error) {
          els.status.textContent = "送出失敗：" + (error.message || String(error));
          // 樂觀泡泡回滾：送出失敗就把「傳送中」那顆收掉，不要留下一顆
          // 永遠傳不出去的殘影（訊息文字還在錯誤提示裡，使用者可以重打）。
          if (pendingCmid) {
            pendingMessages = pendingMessages.filter(function (p) { return p.client_message_id !== pendingCmid; });
            if (lastPollData) render(lastPollData);
          }
        })
        .then(function () {
          sending = false;
          els.action.disabled = false;
          els.input.focus();
          // 送出後重置輸入中節流計時——下一段輸入的第一個字就立刻回報，
          // 不用等上一輪心跳的 2.5 秒冷卻。
          lastTypingSentAt = 0;
        });
    }

    // ---------- OneDrive 線 Phase B：圖片訊息（2026-07-15） ----------
    // 見 AI_CONTEXT/ONEDRIVE_LINE_SPEC.md §2.1。前一輪（第十五輪）已經
    // 做完「選圖＋本機預覽」，這裡接上真正的壓縮／上傳／送出。

    // 只解碼一次原始圖片，同時產出「要上傳的壓縮版」（最長邊 1600px，
    // JPEG q0.8）跟「blur-up 縮圖」（最長邊 24px，直接存進訊息
    // metadata，歷史訊息不用等 Graph 就能先顯示模糊版）。
    function prepareImageForUpload(file) {
      return new Promise(function (resolve, reject) {
        var objectUrl = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
          var longest = Math.max(img.width, img.height) || 1;

          var fullScale = Math.min(1, 1600 / longest);
          var fullW = Math.max(1, Math.round(img.width * fullScale));
          var fullH = Math.max(1, Math.round(img.height * fullScale));
          var fullCanvas = document.createElement("canvas");
          fullCanvas.width = fullW;
          fullCanvas.height = fullH;
          fullCanvas.getContext("2d").drawImage(img, 0, 0, fullW, fullH);

          var thumbScale = Math.min(1, 24 / longest);
          var thumbW = Math.max(1, Math.round(img.width * thumbScale));
          var thumbH = Math.max(1, Math.round(img.height * thumbScale));
          var thumbCanvas = document.createElement("canvas");
          thumbCanvas.width = thumbW;
          thumbCanvas.height = thumbH;
          thumbCanvas.getContext("2d").drawImage(img, 0, 0, thumbW, thumbH);
          var thumbDataUri = thumbCanvas.toDataURL("image/jpeg", 0.5);

          fullCanvas.toBlob(function (blob) {
            URL.revokeObjectURL(objectUrl);
            if (!blob) { reject(new Error("圖片壓縮失敗")); return; }
            resolve({
              blob: blob,
              w: fullW,
              h: fullH,
              thumbDataUri: thumbDataUri,
              previewUrl: URL.createObjectURL(blob)
            });
          }, "image/jpeg", 0.8);
        };
        img.onerror = function () {
          URL.revokeObjectURL(objectUrl);
          reject(new Error("圖片讀取失敗"));
        };
        img.src = objectUrl;
      });
    }

    // 壓縮 → 樂觀上泡泡（本機 blob URL，立即可見）→ 跟 Worker 要上傳
    // 位址 → 位元組直傳 Graph（不經過 Worker）→ 上傳完成後叫
    // sendImageMessage（Worker 端會嘗試分享給對方帳號＋寫進聊天訊息）。
    // 失敗照文字訊息同一套回滾方式。
    function sendImage(file) {
      if (sending) return Promise.resolve();
      sending = true;
      els.action.disabled = true;

      var pendingCmid = identity + "-img-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      var previewUrlToRevoke = null;

      return prepareImageForUpload(file)
        .then(function (prepared) {
          previewUrlToRevoke = prepared.previewUrl;
          pendingMessages.push({
            client_message_id: pendingCmid,
            kind: "image",
            previewUrl: prepared.previewUrl,
            w: prepared.w,
            h: prepared.h
          });
          if (lastPollData) render(lastPollData);

          return window.JonaminzBackend.requestImageUpload({ token: token })
            .then(function (uploadTarget) {
              if (!uploadTarget || !uploadTarget.ok) {
                throw new Error((uploadTarget && uploadTarget.error) || "無法取得上傳位址");
              }
              return fetch(uploadTarget.uploadUrl, {
                method: "PUT",
                headers: {
                  "Content-Range": "bytes 0-" + (prepared.blob.size - 1) + "/" + prepared.blob.size
                },
                body: prepared.blob
              });
            })
            .then(function (putResponse) {
              if (!putResponse.ok) {
                throw new Error("上傳到 OneDrive 失敗（HTTP " + putResponse.status + "）");
              }
              return putResponse.json();
            })
            .then(function (driveItem) {
              return window.JonaminzBackend.sendImageMessage({
                token: token,
                itemId: driveItem.id,
                w: prepared.w,
                h: prepared.h,
                thumbDataUri: prepared.thumbDataUri,
                clientMessageId: pendingCmid
              });
            });
        })
        .then(function () {
          return poll();
        })
        .catch(function (error) {
          els.status.textContent = "傳送圖片失敗：" + (error.message || String(error));
          pendingMessages = pendingMessages.filter(function (p) { return p.client_message_id !== pendingCmid; });
          if (lastPollData) render(lastPollData);
        })
        .then(function () {
          sending = false;
          els.action.disabled = false;
          if (previewUrlToRevoke) URL.revokeObjectURL(previewUrlToRevoke);
        });
    }

    // Chat 檔案附件：跟 sendImage 同一套上傳流程，但不用
    // prepareImageForUpload 那層解碼/壓縮/縮圖——一般檔案沒有「畫面」
    // 可以先畫縮圖，直接把原始 File 物件當 Blob PUT 給 Graph。
    function sendFile(file) {
      if (sending) return Promise.resolve();
      sending = true;
      els.action.disabled = true;

      var pendingCmid = identity + "-file-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      var fileName = file.name || "檔案";
      var fileSize = file.size || 0;
      var mimeType = file.type || "";

      pendingMessages.push({
        client_message_id: pendingCmid,
        kind: "file",
        fileName: fileName,
        fileSize: fileSize
      });
      if (lastPollData) render(lastPollData);

      return window.JonaminzBackend.requestFileUpload({ token: token, fileName: fileName })
        .then(function (uploadTarget) {
          if (!uploadTarget || !uploadTarget.ok) {
            throw new Error((uploadTarget && uploadTarget.error) || "無法取得上傳位址");
          }
          return fetch(uploadTarget.uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Range": "bytes 0-" + (file.size - 1) + "/" + file.size
            },
            body: file
          });
        })
        .then(function (putResponse) {
          if (!putResponse.ok) {
            throw new Error("上傳到 OneDrive 失敗（HTTP " + putResponse.status + "）");
          }
          return putResponse.json();
        })
        .then(function (driveItem) {
          return window.JonaminzBackend.sendFileMessage({
            token: token,
            itemId: driveItem.id,
            fileName: fileName,
            fileSize: fileSize,
            mimeType: mimeType,
            clientMessageId: pendingCmid
          });
        })
        .then(function () {
          return poll();
        })
        .catch(function (error) {
          els.status.textContent = "傳送檔案失敗：" + (error.message || String(error));
          pendingMessages = pendingMessages.filter(function (p) { return p.client_message_id !== pendingCmid; });
          if (lastPollData) render(lastPollData);
        })
        .then(function () {
          sending = false;
          els.action.disabled = false;
        });
    }

    // downloadUrl 短效（約1小時），批次跟 Worker 要——只問還沒快取、
    // 沒有 in-flight 請求的 itemId，回來後整批塞進快取再重畫一次。
    function ensureImageUrls(messages) {
      var need = [];
      messages.forEach(function (m) {
        if ((m.kind !== "image" && m.kind !== "file") || !m.metadata || !m.metadata.itemId) return;
        if (m.metadata.expired) return;
        if (m.deleted_at) return; // 已刪除的畫「此訊息已刪除」，不用要連結
        var itemId = m.metadata.itemId;
        if (imageUrlCache[itemId] !== undefined || imageUrlFetchInFlight[itemId]) return;
        need.push({ itemId: itemId, ownerIdentity: m.metadata.ownerIdentity });
        imageUrlFetchInFlight[itemId] = true;
      });
      if (!need.length) return;
      window.JonaminzBackend.getImageUrls({ token: token, items: need })
        .then(function (result) {
          need.forEach(function (item) { delete imageUrlFetchInFlight[item.itemId]; });
          if (result && result.ok && result.urls) {
            Object.keys(result.urls).forEach(function (itemId) {
              imageUrlCache[itemId] = result.urls[itemId];
            });
            if (result.thumbs) {
              Object.keys(result.thumbs).forEach(function (itemId) {
                if (result.thumbs[itemId]) imageThumbCache[itemId] = result.thumbs[itemId];
              });
            }
            persistImageUrls(result.urls, result.thumbs);
          } else {
            // 2026-07-15：使用者回報「下載連結一直顯示還在準備中」——
            // 真正根因：這支 action 是整批查詢，`getOnedriveAccessToken`
            // 只要對呼叫者自己那個身分失敗一次（例如還沒重新連接、token
            // 有問題），整支 action 直接回 `{ok:false}`，不是每個 itemId
            // 各自標記失敗。原本這裡完全沒處理這個分支，`imageUrlCache`
            // 永遠停在 undefined，下一次 poll 又當成「還沒查過」重試，
            // 每 1.5 秒重試一次卻永遠拿不到結果，畫面上就卡在「還在
            // 準備中」的假象，使用者看不出這其實是確定失敗、不是還在
            // 等。統一標記這批 itemId 為 null（確定拿不到），跟單一
            // item 失敗時的處理一致，畫面才會顯示明確的錯誤訊息。
            need.forEach(function (item) {
              if (imageUrlCache[item.itemId] === undefined) imageUrlCache[item.itemId] = null;
            });
          }
          if (lastPollData) render(lastPollData);
        })
        .catch(function () {
          need.forEach(function (item) {
            delete imageUrlFetchInFlight[item.itemId];
            if (imageUrlCache[item.itemId] === undefined) imageUrlCache[item.itemId] = null;
          });
          if (lastPollData) render(lastPollData);
        });
    }

    function closeQuickPanel() {
      if (els.quickPanel) els.quickPanel.hidden = true;
    }

    function closePlusPanel() {
      if (els.plusPanel) els.plusPanel.hidden = true;
    }

    function setDiscussTarget(itemId, title) {
      activeSharedItemId = itemId;
      if (!els.discussBanner) return;
      if (itemId) {
        els.discussTitle.textContent = "討論：" + title;
        els.discussBanner.hidden = false;
      } else {
        els.discussBanner.hidden = true;
      }
    }

    // 2026-07-14（第十四輪）：編輯訊息——跟討論橫幅同一種寫法，composer
    // 上方出現可關閉的提示，輸入框先填回原本的文字，送出時 doSendText()
    // 會改叫 editChatMessage 而不是 sendChatMessage。
    function setEditTarget(messageId, bodyText) {
      editingMessageId = messageId;
      if (!els.editBanner) return;
      if (messageId) {
        els.editBanner.hidden = false;
        els.input.value = bodyText || "";
        updateComposerAction();
        autoGrowInput();
        els.input.focus();
      } else {
        els.editBanner.hidden = true;
      }
    }

    // 2026-07-14（第十五輪）：回覆／引用——跟討論/編輯橫幅同一種寫法，
    // composer 上方出現可關閉的提示，doSendText() 送出時把 replyingToMessageId
    // 一併帶給 sendChatMessage，送完自動清掉（見 doSendText 內的 .then）。
    function setReplyTarget(messageId, previewText) {
      replyingToMessageId = messageId;
      if (!els.replyBanner) return;
      if (messageId) {
        els.replyTitle.textContent = "回覆：" + (previewText || "");
        els.replyBanner.hidden = false;
      } else {
        els.replyBanner.hidden = true;
      }
    }

    // ---- 長按訊息跳出選單（複製／編輯／刪除／回覆／表情反應）----
    // 2026-07-16：使用者拿真的 Messenger 截圖說明想要的操作模式——長按
    // 跳出來的東西分成兩塊：表情反應貼在被按的訊息附近（浮動），其餘
    // 動作（回覆/複製/編輯/刪除）收在畫面底部一整排的操作列，不是全部
    // 擠在同一個貼著手指位置的小選單裡（原本的做法，在手機小螢幕上
    // 常常需要的按鈕位置很尷尬、要精準點到小小一顆）。拆成兩個各自
    // 獨立顯示/隱藏的元件，共用同一組 data-menu-* 按鈕（點擊行為完全
    // 沒變，只是換了容器跟排版）。
    // 2026-07-16：頁內 toast——瀏覽器 alert 會被「不要再顯示對話方塊」
    // 壓掉、塞按鈕裡又醜到被使用者罵（原話「哪有人用這個鬼東西」），
    // 錯誤/提示一律用這個自己畫的浮動提示條。
    var toastTimer = null;
    function showToast(text) {
      var toast = root.querySelector(".jonaminz-chat-toast");
      if (!toast) {
        toast = document.createElement("div");
        toast.className = "jonaminz-chat-toast";
        root.appendChild(toast);
      }
      toast.textContent = text;
      toast.hidden = false;
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.hidden = true; }, 4000);
    }

    function closeContextMenu() {
      if (els.contextMenu) els.contextMenu.hidden = true;
      if (els.actionSheet) els.actionSheet.hidden = true;
      clearTouchActive();
      // closeContextMenu 保留這行當安全網：把任何殘留的 overflow 鎖解掉
      // （openActionSheet 已經不再設鎖，見那邊說明）。
      if (els.thread) els.thread.style.overflow = "";
    }

    // 2026-07-16（三輪回饋收斂）：表情反應（浮動小選單）跟底部操作列
    // （回覆/複製/編輯/刪除）拆成兩個各自獨立的函式——openReactionPicker
    // 只管表情、openActionSheet 只管底部列，兩個都不管「誰觸發我」。
    // 手機長按用 openContextMenu()（下面）把兩個一起叫出來，跟原本的
    // 設計一致；電腦版 hover 工具列（.jonaminz-chat-hover-toolbar）可以
    // 各自單獨呼叫——按「更多」開 openActionSheet，按表情圖示開
    // openReactionPicker，按回覆圖示直接 setReplyTarget 不開選單。
    // 表情選單原本會跟底部操作列位置卡在一起（使用者回報「打架」），
    // 這次修好根因：maxTop 現在會扣掉底部操作列的實際高度（用
    // els.actionSheetMenu.offsetHeight 量，量不到就用 64px 估計值），
    // 表情選單不會再被操作列蓋住或蓋住操作列。
    function openReactionPicker(messageEl, x, y) {
      if (!els.contextMenu) return;
      var messageId = messageEl.dataset.messageId;
      els.contextMenu.innerHTML = '<div class="jonaminz-chat-context-reactions">' +
        REACTION_SET.map(function (emoji) {
          return '<button type="button" data-menu-react data-message-id="' + escapeHtml(messageId) +
            '" data-emoji="' + emoji + '">' + emoji + "</button>";
        }).join("") + "</div>";
      els.contextMenu.hidden = false;
      var menuWidth = els.contextMenu.offsetWidth || 120;
      var menuHeight = els.contextMenu.offsetHeight || 40;
      var actionSheetHeight = (els.actionSheetMenu && els.actionSheetMenu.offsetHeight) || 64;
      var maxLeft = (root.clientWidth || window.innerWidth) - menuWidth - 6;
      var maxTop = (root.clientHeight || window.innerHeight) - menuHeight - actionSheetHeight - 6;
      els.contextMenu.style.left = Math.max(6, Math.min(x, maxLeft)) + "px";
      els.contextMenu.style.top = Math.max(6, Math.min(y - menuHeight - 8, maxTop)) + "px";
      contextMenuOpenedAt = Date.now();
    }

    // 2026-07-16（使用者回報「下載一樣會跳轉」+「手機無法下載」的最終
    // 修法）：導覽到 Worker 的 /downloadChatFile——Worker 用自己的 token
    // 向 Graph 解析＋把位元組串流回來，帶 Content-Disposition:attachment
    // 觸發下載，全程不經過 fetch()，沒有跨來源問題（跟 /appDownload 同一
    // 套已驗證做法）。抽成 helper 給檔案泡泡點擊跟 ⋮ 選單的「下載」共用。
    function triggerChatFileDownload(itemId, ownerIdentity, fileName) {
      if (!itemId) return;
      window.JonaminzBackend.getWorkerBaseUrlForRedirect().then(function (baseUrl) {
        var href = baseUrl + "/downloadChatFile?token=" + encodeURIComponent(token || "") +
          "&itemId=" + encodeURIComponent(itemId) +
          "&ownerIdentity=" + encodeURIComponent(ownerIdentity || "") +
          "&fileName=" + encodeURIComponent(fileName || "檔案");
        var a = document.createElement("a");
        a.href = href;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
    }

    function openActionSheet(messageEl) {
      if (!els.actionSheet) return;
      var messageId = messageEl.dataset.messageId;
      var editable = messageEl.dataset.editable === "true";
      var deletable = messageEl.dataset.deletable === "true";
      var copyText = messageEl.dataset.copyText;
      // 圖片/檔案訊息帶下載參數（render 時寫在 message 元素上）——⋮ 選單
      // 多一顆「下載」。使用者原話「下載是不是加載更多裡面的功能就好了，
      // 現在好像沒有地方做下載的功能」（點泡泡下載不夠明顯）。
      var downloadItemId = messageEl.dataset.downloadItemId;

      if (els.actionSheet) els.actionSheet.hidden = true;

      // 固定貼在畫面底部的一整排，圖示＋文字，跟 Messenger 截圖裡
      // 「回覆／儲存圖像／刪除／更多」那排同一個版型。
      var actionItems = [];
      if (copyText) {
        actionItems.push('<button type="button" data-menu-reply data-message-id="' + escapeHtml(messageId) +
          '" data-text="' + escapeHtml(copyText) + '"><span>↩️</span>回覆</button>');
        actionItems.push('<button type="button" data-menu-copy data-text="' + escapeHtml(copyText) + '"><span>📋</span>複製</button>');
      }
      if (downloadItemId) {
        actionItems.push('<button type="button" data-menu-download' +
          ' data-item-id="' + escapeHtml(downloadItemId) + '"' +
          ' data-owner-identity="' + escapeHtml(messageEl.dataset.downloadOwner || "") + '"' +
          ' data-file-name="' + escapeHtml(messageEl.dataset.downloadName || "檔案") + '"><span>⬇️</span>下載</button>');
      }
      if (editable) {
        actionItems.push('<button type="button" data-menu-edit data-message-id="' + escapeHtml(messageId) +
          '" data-text="' + escapeHtml(copyText || "") + '"><span>✏️</span>編輯</button>');
      }
      // 編輯得動的（自己的文字訊息）跟只可刪的（自己的圖片/檔案）
      // 共用同一顆刪除按鈕，走同一個 data-menu-delete 處理器。
      if (editable || deletable) {
        actionItems.push('<button type="button" data-menu-delete data-message-id="' + escapeHtml(messageId) + '"><span>🗑️</span>刪除</button>');
      }
      if (actionItems.length && els.actionSheet && els.actionSheetMenu) {
        els.actionSheetMenu.innerHTML = actionItems.join("");
        els.actionSheet.hidden = false;
        // 2026-07-16（使用者回報「chat 頁面不能 scroll」）：原本這裡設
        // els.thread.style.overflow="hidden" 鎖捲動，但某些關閉路徑沒
        // 還原就卡死整個訊息串不能捲。底部操作列本來就有全螢幕
        // backdrop（els.actionSheetBackdrop）用 preventDefault 擋捲動，
        // 這個 overflow 鎖是多餘的，移除避免 leak。closeContextMenu
        // 還是保留一行 overflow="" 當安全網，把任何殘留的鎖解掉。
      }

      contextMenuOpenedAt = Date.now();
    }

    // 2026-07-16（使用者：手機長按要跟電腦版同一個 inline 位置，不要
    // 浮動蓋在訊息上）：長按不再開浮動 popup，改成對那則訊息加
    // `.is-touch-active`——顯示「訊息自己那條 inline 工具列」，跟電腦版
    // hover 顯示的是同一個 DOM（.jonaminz-chat-hover-toolbar），位置、
    // 按鈕（data-hover-more/reply/react，既有的 click 處理器就吃得到）
    // 全部共用。⋮ 開底部操作列、↩ 直接回覆、🙂 開表情選單。
    function clearTouchActive() {
      var actives = els.thread ? els.thread.querySelectorAll(".jonaminz-chat-message.is-touch-active") : [];
      for (var i = 0; i < actives.length; i += 1) actives[i].classList.remove("is-touch-active");
    }

    function openContextMenu(messageEl, x, y) {
      if (messageEl.dataset.deleted === "true") return;
      clearTouchActive();
      messageEl.classList.add("is-touch-active");
      contextMenuOpenedAt = Date.now();
    }

    // ---- 搜尋 ----
    var searchDebounceTimer = null;
    function performSearch(query) {
      if (!els.searchResults) return;
      if (!query) {
        els.searchResults.hidden = true;
        els.searchResults.innerHTML = "";
        return;
      }
      window.JonaminzBackend.searchChatMessages({ token: token, query: query })
        .then(function (data) {
          var results = data.messages || [];
          if (!results.length) {
            els.searchResults.innerHTML = '<p class="jonaminz-chat-empty">沒有符合的訊息</p>';
          } else {
            els.searchResults.innerHTML = results.map(function (m) {
              var mine = m.sender_identity === identity;
              var label = mine ? "我" : (IDENTITY_LABEL[otherIdentity()] || otherIdentity());
              var snippet = m.kind === "shared_item" ? "[分享的內容]" :
                (m.kind === "image" ? "[圖片]" : (m.kind === "file" ? "[檔案]" : m.body));
              return '<div class="jonaminz-chat-search-result" data-search-result data-message-id="' + escapeHtml(m.id) + '">' +
                '<span class="jonaminz-chat-search-result-meta">' + escapeHtml(label) + " · " +
                escapeHtml(formatTime(m.created_at)) + "</span>" +
                '<span class="jonaminz-chat-search-result-body">' + escapeHtml(snippet) + "</span>" +
                "</div>";
            }).join("");
          }
          els.searchResults.hidden = false;
        })
        .catch(function () {});
    }

    // ---- 輕量級通知面板：未讀數＋還沒看過的分享內容，都是既有資料
    // 直接算出來，不用另外開一支 Worker action。----
    function renderNotifPanel(unreadCount) {
      if (!els.notifPanel) return;
      var unseenShared = Object.keys(sharedItems)
        .map(function (id) { return sharedItems[id]; })
        .filter(function (item) { return !(item.seenState && item.seenState[identity]); });
      var hasActivity = unreadCount > 0 || unseenShared.length > 0;
      if (els.notifDot) els.notifDot.hidden = !hasActivity;

      var html = "";
      if (unreadCount > 0) {
        html += '<div class="jonaminz-chat-notif-item">' + unreadCount + " 則未讀訊息</div>";
      }
      unseenShared.forEach(function (item) {
        html += '<div class="jonaminz-chat-notif-item" data-notif-shared data-item-id="' +
          escapeHtml(item.id) + '">📎 ' + escapeHtml(item.title) + "</div>";
      });
      els.notifPanel.innerHTML = html || '<div class="jonaminz-chat-notif-item is-empty">沒有新動態</div>';
    }

    // ---- Shared 獨立瀏覽完整版（2026-07-15）：列出這個房間全部分享過
    // 的內容，不只未讀的——比 App 內通知面板更完整。原型設計裁決
    // （jonaminz-chat交接包 CHAT_SHARED_ARCHITECTURE.md §15「Shared
    // 數量卡不是純資訊，必須直接作為內容篩選器」）落地成「全部／未讀」
    // 篩選 tab；每筆多一顆「討論」直接綁 composer，不用先開原文再回來
    // 找這個 icon 才能討論。這兩支函式要跟 renderNotifPanel 同一層
    // （mount() 層級），render() 才呼叫得到——曾經誤放進 buildUI() 內部
    // 的巢狀作用域，導致 render() 每次 poll 都拋 ReferenceError 整個
    // 中斷、訊息串完全停止更新，靠真的載入頁面才抓到，記取教訓。----
    function updateSharedListDot() {
      if (!els.sharedListDot) return;
      var hasUnseen = Object.keys(sharedItems).some(function (id) {
        var item = sharedItems[id];
        return !(item.seenState && item.seenState[identity]);
      });
      els.sharedListDot.hidden = !hasUnseen;
    }

    function renderSharedListPanel() {
      if (!els.sharedListPanel) return;
      var allItems = Object.keys(sharedItems).map(function (id) { return sharedItems[id]; })
        .sort(function (a, b) { return new Date(b.lastSharedAt) - new Date(a.lastSharedAt); });
      var unseenCount = allItems.filter(function (item) {
        return !(item.seenState && item.seenState[identity]);
      }).length;
      var items = sharedListFilter === "unseen"
        ? allItems.filter(function (item) { return !(item.seenState && item.seenState[identity]); })
        : allItems;

      var tabsHtml =
        '<div class="jonaminz-chat-shared-list-tabs">' +
        '<button type="button" class="jonaminz-chat-shared-list-tab' +
        (sharedListFilter === "all" ? " is-active" : "") + '" data-shared-filter="all">全部</button>' +
        '<button type="button" class="jonaminz-chat-shared-list-tab' +
        (sharedListFilter === "unseen" ? " is-active" : "") + '" data-shared-filter="unseen">未讀' +
        (unseenCount > 0 ? " (" + unseenCount + ")" : "") + "</button>" +
        "</div>";

      if (!items.length) {
        els.sharedListPanel.innerHTML = tabsHtml +
          '<div class="jonaminz-chat-notif-item is-empty">' +
          (sharedListFilter === "unseen" ? "沒有未讀的分享內容" : "還沒有分享過的內容") +
          "</div>";
        return;
      }
      els.sharedListPanel.innerHTML = tabsHtml + items.map(function (item) {
        var seen = Boolean(item.seenState && item.seenState[identity]);
        return '<div class="jonaminz-chat-notif-item jonaminz-chat-shared-list-item" data-shared-list-item data-item-id="' +
          escapeHtml(item.id) + '" data-item-url="' + escapeHtml(item.url) + '">' +
          '<div class="jonaminz-chat-shared-list-row">' +
          (seen ? "" : "🔴 ") + escapeHtml(item.source) + " · " + escapeHtml(item.title) +
          (item.shareCount > 1 ? ' <span class="jonaminz-chat-notif-item-meta">(分享 ' + item.shareCount + ' 次)</span>' : "") +
          "</div>" +
          '<button type="button" class="jonaminz-chat-shared-list-discuss" data-shared-list-discuss ' +
          'data-item-id="' + escapeHtml(item.id) + '" data-item-title="' + escapeHtml(item.title) + '">討論</button>' +
          "</div>";
      }).join("");
    }

    function buildUI() {
      // 2026-07-16（使用者真機回報「手機無法加入照片，那個加不能按」）：
      // 原本這整個 + 面板（含選圖片/選檔案）都被 inPanel 擋住，只有
      // 「分享目前內容」真的需要面板情境（要跟父層 iframe 要
      // requestHostContext()），選圖片/選檔案是單純的檔案挑選器＋上傳，
      // 跟是不是嵌在面板裡完全無關，不該被一起擋掉——這是早期開發
      // 留下的過度保守限制（按鈕文字自己都寫「之後開放」），使用者在
      // 獨立頁面（/pages/chat/）測試時整個附件功能因此完全按不動。
      // 改成一律顯示完整 + 面板，只有「分享目前內容」這個選項本身
      // 才依 inPanel 決定要不要出現。
      var plusButtonHtml =
        '<button type="button" class="jonaminz-chat-plus-btn" data-plus ' +
        'aria-label="更多功能" aria-haspopup="true">+</button>' +
        '<div class="jonaminz-chat-plus-panel" data-plus-panel hidden>' +
        (inPanel ? '<button type="button" data-share-current>分享目前內容</button>' : "") +
        '<button type="button" data-pick-image>分享圖片（相機／相簿）</button>' +
        '<input type="file" accept="image/*" data-image-input hidden>' +
        '<button type="button" data-pick-file>分享檔案</button>' +
        '<input type="file" data-file-input hidden>' +
        "</div>";

      root.innerHTML =
        '<section class="jonaminz-chat-head">' +
        '<div class="jonaminz-chat-avatar no-presence" data-avatar>?</div>' +
        '<div class="jonaminz-chat-head-meta">' +
        '<h1 data-peer-name>Jonaminz Chat</h1>' +
        '<p class="jonaminz-chat-status" data-status>載入中...</p>' +
        '<span class="jonaminz-chat-instance-badge">Chat Library &middot; couple-chat</span>' +
        "</div>" +
        '<div class="jonaminz-chat-head-actions">' +
        '<button type="button" class="jonaminz-chat-head-icon-btn" data-search-toggle aria-label="搜尋訊息">🔍</button>' +
        '<div class="jonaminz-chat-notif-wrap">' +
        '<button type="button" class="jonaminz-chat-head-icon-btn" data-notif-toggle aria-label="最近動態">' +
        '🔔<span class="jonaminz-chat-notif-dot" data-notif-dot hidden></span></button>' +
        '<div class="jonaminz-chat-notif-panel" data-notif-panel hidden></div>' +
        "</div>" +
        '<div class="jonaminz-chat-notif-wrap">' +
        '<button type="button" class="jonaminz-chat-head-icon-btn" data-shared-list-toggle aria-label="所有分享內容">' +
        '🗂<span class="jonaminz-chat-notif-dot" data-shared-list-dot hidden></span></button>' +
        '<div class="jonaminz-chat-notif-panel" data-shared-list-panel hidden></div>' +
        "</div>" +
        '<div class="jonaminz-chat-notif-wrap">' +
        '<button type="button" class="jonaminz-chat-head-icon-btn" data-settings-toggle aria-label="設定">⚙️</button>' +
        '<div class="jonaminz-chat-notif-panel jonaminz-chat-settings-panel" data-settings-panel hidden>' +
        '<button type="button" class="jonaminz-chat-settings-call-btn" data-call-btn>📞 撥打給對方</button>' +
        '<p class="jonaminz-chat-settings-note" data-call-status></p>' +
        '<button type="button" class="jonaminz-chat-settings-push-btn" data-push-toggle>開啟推播通知</button>' +
        '<p class="jonaminz-chat-settings-note" data-push-status></p>' +
        '<button type="button" class="jonaminz-chat-settings-push-btn" data-bubble-btn>🫧 系統泡泡</button>' +
        '<button type="button" class="jonaminz-chat-settings-push-btn" data-overlay-btn>💬 懸浮泡泡（蓋在所有 App 上）</button>' +
        '<p class="jonaminz-chat-settings-note" data-bubble-status></p>' +
        "</div>" +
        "</div>" +
        "</div>" +
        "</section>" +
        '<div class="jonaminz-chat-search-bar" data-search-bar hidden>' +
        '<input type="search" data-search-input placeholder="搜尋訊息...">' +
        '<button type="button" data-search-close aria-label="關閉搜尋">✕</button>' +
        "</div>" +
        '<div class="jonaminz-chat-search-results" data-search-results hidden></div>' +
        '<div class="jonaminz-chat-thread" data-thread role="log" aria-live="polite" aria-label="訊息串">' +
        '<p class="jonaminz-chat-empty">載入中...</p></div>' +
        '<div class="jonaminz-chat-discuss-banner" data-discuss-banner hidden>' +
        '<span data-discuss-title></span>' +
        '<button type="button" data-discuss-clear aria-label="取消討論">✕</button>' +
        "</div>" +
        '<div class="jonaminz-chat-discuss-banner jonaminz-chat-edit-banner" data-edit-banner hidden>' +
        '<span data-edit-title>編輯訊息</span>' +
        '<button type="button" data-edit-cancel aria-label="取消編輯">✕</button>' +
        "</div>" +
        '<div class="jonaminz-chat-discuss-banner jonaminz-chat-reply-banner" data-reply-banner hidden>' +
        '<span data-reply-title></span>' +
        '<button type="button" data-reply-cancel aria-label="取消回覆">✕</button>' +
        "</div>" +
        '<div class="jonaminz-chat-context-menu" data-context-menu hidden></div>' +
        '<div class="jonaminz-chat-action-sheet" data-action-sheet hidden>' +
        '<div class="jonaminz-chat-action-sheet-backdrop" data-action-sheet-backdrop></div>' +
        '<div class="jonaminz-chat-action-sheet-menu" data-action-sheet-menu></div>' +
        "</div>" +
        '<span class="jonaminz-chat-swipe-reply-icon" data-swipe-reply-icon hidden>↩️</span>' +
        '<div class="jonaminz-chat-image-lightbox" data-image-lightbox hidden>' +
        '<img data-image-lightbox-img alt="圖片">' +
        '<button type="button" class="jonaminz-chat-image-lightbox-close" data-image-lightbox-close aria-label="關閉">✕</button>' +
        "</div>" +
        // 2026-07-16（使用者要求照 Messenger 模板重做）：選好的圖片/檔案
        // 不再用獨立的預覽橫幅＋自己的「傳送」按鈕（使用者原話「很早期
        // 系統用的模式」），改成貼在輸入列正上方的附件縮圖列——縮圖
        // 角落有 ✕ 可移除，按主送出鍵 ➤ 直接送出附件（有打字就接著送
        // 文字），跟 Messenger 的附件互動一致。
        '<div class="jonaminz-chat-composer">' +
        '<div class="jonaminz-chat-attach-tray" data-attach-tray hidden></div>' +
        '<div class="jonaminz-chat-composer-row">' +
        '<div class="jonaminz-chat-plus-wrap">' + plusButtonHtml + "</div>" +
        '<div class="jonaminz-chat-input-shell">' +
        '<textarea data-input placeholder="輸入訊息..." rows="1"></textarea>' +
        // 2026-07-16（使用者回報 💬 跟 🙂 兩顆重複）：合併成一顆 🙂，開
        // 一個面板分三區——常用回覆＋貼圖（點了直接送）＋插入表情（點了
        // 插進輸入框）。
        '<button type="button" class="jonaminz-chat-emoji-toggle" data-quick-toggle ' +
        'aria-label="表情、貼圖與常用回覆">🙂</button>' +
        '<div class="jonaminz-chat-quick-panel" data-quick-panel hidden></div>' +
        "</div>" +
        '<button type="button" class="jonaminz-chat-action-btn" data-action ' +
        'aria-label="快速送出 ' + QUICK_REACTION + '">' + QUICK_REACTION + "</button>" +
        "</div>" +
        "</div>" +
        '<p class="jonaminz-chat-status-line" data-page-status aria-live="polite"></p>';

      els.avatar = root.querySelector("[data-avatar]");
      els.peerName = root.querySelector("[data-peer-name]");
      els.peerStatus = root.querySelector("[data-status]");
      els.thread = root.querySelector("[data-thread]");
      els.input = root.querySelector("[data-input]");
      els.action = root.querySelector("[data-action]");
      els.status = root.querySelector("[data-page-status]");
      els.quickToggle = root.querySelector("[data-quick-toggle]");
      els.quickPanel = root.querySelector("[data-quick-panel]");
      els.plus = root.querySelector("[data-plus]");
      els.plusPanel = root.querySelector("[data-plus-panel]");
      els.discussBanner = root.querySelector("[data-discuss-banner]");
      els.discussTitle = root.querySelector("[data-discuss-title]");
      els.editBanner = root.querySelector("[data-edit-banner]");
      els.searchToggle = root.querySelector("[data-search-toggle]");
      els.searchBar = root.querySelector("[data-search-bar]");
      els.searchInput = root.querySelector("[data-search-input]");
      els.searchClose = root.querySelector("[data-search-close]");
      els.searchResults = root.querySelector("[data-search-results]");
      els.notifToggle = root.querySelector("[data-notif-toggle]");
      els.notifDot = root.querySelector("[data-notif-dot]");
      els.notifPanel = root.querySelector("[data-notif-panel]");
      els.contextMenu = root.querySelector("[data-context-menu]");
      els.actionSheet = root.querySelector("[data-action-sheet]");
      els.actionSheetMenu = root.querySelector("[data-action-sheet-menu]");
      els.actionSheetBackdrop = root.querySelector("[data-action-sheet-backdrop]");
      els.swipeReplyIcon = root.querySelector("[data-swipe-reply-icon]");
      els.replyBanner = root.querySelector("[data-reply-banner]");
      els.replyTitle = root.querySelector("[data-reply-title]");
      els.imageInput = root.querySelector("[data-image-input]");
      els.attachTray = root.querySelector("[data-attach-tray]");
      els.fileInput = root.querySelector("[data-file-input]");
      els.imageLightbox = root.querySelector("[data-image-lightbox]");
      els.imageLightboxImg = root.querySelector("[data-image-lightbox-img]");
      els.sharedListToggle = root.querySelector("[data-shared-list-toggle]");
      els.sharedListPanel = root.querySelector("[data-shared-list-panel]");
      els.sharedListDot = root.querySelector("[data-shared-list-dot]");
      els.settingsToggle = root.querySelector("[data-settings-toggle]");
      els.settingsPanel = root.querySelector("[data-settings-panel]");
      els.callBtn = root.querySelector("[data-call-btn]");
      els.callStatus = root.querySelector("[data-call-status]");
      els.pushToggleBtn = root.querySelector("[data-push-toggle]");
      els.pushStatus = root.querySelector("[data-push-status]");
      els.bubbleBtn = root.querySelector("[data-bubble-btn]");
      els.overlayBtn = root.querySelector("[data-overlay-btn]");
      els.bubbleStatus = root.querySelector("[data-bubble-status]");

      // 一顆 🙂 面板分三區：常用回覆（點了直接送短句）＋貼圖（點了直接
      // 送 emoji-only 訊息、會自動放大）＋插入表情（點了插進輸入框，
      // 給想在文字裡夾 emoji 用，桌機沒有 emoji 鍵盤時特別有用）。
      if (els.quickPanel) {
        els.quickPanel.innerHTML =
          '<div class="jonaminz-chat-quick-section-title">常用回覆</div>' +
          '<div class="jonaminz-chat-quick-replies">' +
          CANNED_REPLIES.map(function (t) {
            return '<button type="button" data-quick-reply="' + escapeHtml(t) + '">' + escapeHtml(t) + "</button>";
          }).join("") +
          "</div>" +
          '<div class="jonaminz-chat-quick-section-title">貼圖</div>' +
          '<div class="jonaminz-chat-quick-stickers">' +
          STICKER_SET.map(function (s) {
            return '<button type="button" data-quick-sticker="' + escapeHtml(s) + '">' + s + "</button>";
          }).join("") +
          "</div>" +
          '<div class="jonaminz-chat-quick-section-title">插入表情</div>' +
          '<div class="jonaminz-chat-quick-emojis">' +
          EMOJI_SET.map(function (emoji) {
            return '<button type="button" data-emoji="' + emoji + '">' + emoji + "</button>";
          }).join("") +
          "</div>";
      }

      if (els.plusPanel) {
        els.plus.addEventListener("click", function (event) {
          event.stopPropagation();
          closeQuickPanel();
          els.plusPanel.hidden = !els.plusPanel.hidden;
        });
        els.plusPanel.addEventListener("click", function (event) {
          if (event.target.closest("[data-pick-image]")) {
            closePlusPanel();
            if (els.imageInput) els.imageInput.click();
            return;
          }
          if (event.target.closest("[data-pick-file]")) {
            closePlusPanel();
            if (els.fileInput) els.fileInput.click();
            return;
          }
          if (!event.target.closest("[data-share-current]")) return;
          closePlusPanel();
          els.status.textContent = "正在取得目前內容...";
          requestHostContext()
            .then(function (context) {
              return window.JonaminzBackend.shareCurrentContent({
                token: token,
                title: context.title,
                url: context.url
              });
            })
            .then(function () {
              els.status.textContent = "";
              return poll();
            })
            .catch(function (error) {
              els.status.textContent = "分享失敗：" + (error.message || String(error));
            });
        });
        // 2026-07-16（Messenger 模板重做）：選好的圖片/檔案掛進輸入列
        // 上方的附件縮圖列（renderAttachTray），不再有獨立的預覽橫幅跟
        // 自己的「傳送」按鈕——送出走主送出鍵 ➤（見 els.action 的
        // click 處理），✕ 移除附件。
        if (els.imageInput) {
          els.imageInput.addEventListener("change", function () {
            var file = els.imageInput.files && els.imageInput.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function () {
              pendingAttachment = { kind: "image", file: file, thumbDataUrl: String(reader.result || "") };
              renderAttachTray();
            };
            reader.readAsDataURL(file);
            els.imageInput.value = "";
          });
        }
        if (els.fileInput) {
          els.fileInput.addEventListener("change", function () {
            var file = els.fileInput.files && els.fileInput.files[0];
            if (!file) return;
            pendingAttachment = { kind: "file", file: file };
            renderAttachTray();
            els.fileInput.value = "";
          });
        }
        if (els.attachTray) {
          els.attachTray.addEventListener("click", function (event) {
            if (!event.target.closest("[data-attach-remove]")) return;
            pendingAttachment = null;
            renderAttachTray();
          });
        }
        document.addEventListener("click", function (event) {
          if (!els.plusPanel.hidden && !event.target.closest(".jonaminz-chat-plus-wrap")) {
            closePlusPanel();
          }
        });
      }

      // 圖片 lightbox：點圖片本身或背景任何地方都關閉，跟關閉按鈕一致——
      // 全螢幕預覽不需要精準點在✕上才能收起來。
      if (els.imageLightbox) {
        els.imageLightbox.addEventListener("click", function () {
          els.imageLightbox.hidden = true;
          if (els.imageLightboxImg) els.imageLightboxImg.src = "";
        });
      }

      // downloadUrl 短效（約1小時），真的載入失敗時清快取重新要一次——
      // error 事件不 bubble，用 capture 在外層攔截。重試狀態要記在
      // itemId 上（不是 DOM 元素的 dataset）：render() 每次都整個重建
      // <img>，舊元素上做的標記留不住，會變成一直失敗就一直觸發、
      // 一直 render() 的無窮迴圈。
      els.thread.addEventListener("error", function (event) {
        var img = event.target;
        if (!img || img.tagName !== "IMG") return;
        var bubble = img.closest("[data-image-bubble]");
        if (!bubble) return;
        var itemId = bubble.dataset.itemId;
        if (!itemId || imageUrlErrorRetried[itemId]) return;
        imageUrlErrorRetried[itemId] = true;
        delete imageUrlCache[itemId];
        delete imageThumbCache[itemId];
        dropPersistedImageUrl(itemId);
        // render() 內部本來就會呼叫 ensureImageUrls()（涵蓋 olderMessages
        // 合併後的完整訊息清單，不是只有最近一次 poll 的那一批）。
        if (lastPollData) render(lastPollData);
      }, true);

      // 2026-07-16（最終版，使用者拿 Messenger 截圖定案）：hover 工具列
      // 不再浮在泡泡上方/下方（先前四輪的「智慧翻轉」定位全數作廢），
      // 改成 Messenger 的做法——工具列是訊息列裡的一個普通 flex item，
      // 跟泡泡並排在同一行（自己的訊息在泡泡左邊、對方的在右邊，靠
      // data-mine 的 row-reverse 自然排出），垂直置中。訊息列本身已經
      // 撐滿整行寬，滑鼠在同一行內移動 hover 永遠不會斷，也永遠不會
      // 蓋到任何東西——不需要任何 JS 定位判斷，純 CSS 搞定。
      els.thread.addEventListener("click", function (event) {
        var loadMoreBtn = event.target.closest("[data-load-more]");
        if (loadMoreBtn) {
          loadOlder();
          return;
        }
        // 2026-07-16（電腦版 hover 工具列，跟手機長按分開的兩套觸發
        // 方式）：滑鼠移到訊息上才浮出 ⋮／↩／🙂 三顆圖示（CSS
        // :hover 控制顯示，見 .jonaminz-chat-hover-toolbar；觸控裝置
        // 沒有 hover 狀態，不會誤觸發，長按仍走 openContextMenu()）。
        // 座標用 getBoundingClientRect()，.jonaminz-chat-context-menu
        // 是 position:fixed，直接是視窗座標不用再扣 root 偏移量。
        var hoverMoreBtn = event.target.closest("[data-hover-more]");
        if (hoverMoreBtn) {
          event.stopPropagation();
          var moreMessageEl = hoverMoreBtn.closest(".jonaminz-chat-message");
          clearTouchActive(); // 手機：⋮ 開底部操作列後收掉 inline 工具列
          if (moreMessageEl) openActionSheet(moreMessageEl);
          return;
        }
        var hoverReplyBtn = event.target.closest("[data-hover-reply]");
        if (hoverReplyBtn) {
          event.stopPropagation();
          var replyMessageEl = hoverReplyBtn.closest(".jonaminz-chat-message");
          if (replyMessageEl && replyMessageEl.dataset.copyText !== undefined) {
            setReplyTarget(replyMessageEl.dataset.messageId, replyMessageEl.dataset.copyText);
            els.input.focus();
          }
          clearTouchActive();
          return;
        }
        var hoverReactBtn = event.target.closest("[data-hover-react]");
        if (hoverReactBtn) {
          event.stopPropagation();
          var reactMessageEl = hoverReactBtn.closest(".jonaminz-chat-message");
          if (reactMessageEl) {
            var btnRect = hoverReactBtn.getBoundingClientRect();
            openReactionPicker(reactMessageEl, btnRect.left, btnRect.top);
          }
          return;
        }
        var discussBtn = event.target.closest("[data-discuss-btn]");
        if (discussBtn) {
          setDiscussTarget(discussBtn.dataset.itemId, discussBtn.dataset.itemTitle);
          els.input.focus();
          return;
        }
        var imageBubble = event.target.closest("[data-image-bubble]");
        if (imageBubble) {
          var bubbleImg = imageBubble.querySelector("img");
          // 泡泡顯示的是縮圖，點開放大要用全尺寸（data-full-url）；
          // 全尺寸還沒拿到就先放縮圖頂著，總比開不起來好。
          var lightboxSrc = imageBubble.dataset.fullUrl || (bubbleImg && bubbleImg.src) || "";
          if (lightboxSrc && els.imageLightbox && els.imageLightboxImg) {
            els.imageLightboxImg.src = lightboxSrc;
            els.imageLightbox.hidden = false;
          }
          return;
        }
        var fileBubble = event.target.closest("[data-file-bubble]");
        if (fileBubble) {
          triggerChatFileDownload(fileBubble.dataset.itemId, fileBubble.dataset.ownerIdentity, fileBubble.dataset.fileName || "檔案");
          return;
        }
        var card = event.target.closest("[data-shared-card]");
        if (card) {
          window.JonaminzBackend.markSharedItemSeen({ token: token, itemId: card.dataset.itemId }).catch(function () {});
          card.classList.remove("is-unseen");
          var unseenLabel = card.querySelector(".jonaminz-chat-shared-card-unseen");
          if (unseenLabel) unseenLabel.remove();
          window.open(card.dataset.itemUrl, "_blank", "noopener");
          return;
        }
        // 點已經存在的表情反應 pill 也能直接 toggle（不用特地長按開選單），
        // 跟大部分聊天 App 一樣「點自己已經點過的反應」是最常見的取消方式。
        var pill = event.target.closest("[data-react-toggle]");
        if (pill) {
          optimisticToggleReaction(pill.dataset.messageId, pill.dataset.emoji);
          window.JonaminzBackend.toggleMessageReaction({ token: token, messageId: pill.dataset.messageId, emoji: pill.dataset.emoji })
            .then(function () { return poll(); })
            .catch(function () {});
          return;
        }
        // 點一下訊息本身：顯示/收起這則的確切時間。長按放開的合成 click
        // 要擋掉（跟點外關閉選單同一個坑），選單開著時的點擊也不觸發。
        var messageEl = event.target.closest(".jonaminz-chat-message");
        if (messageEl && messageEl.dataset.messageId) {
          if (els.contextMenu && !els.contextMenu.hidden) return;
          if (Date.now() - contextMenuOpenedAt < 400) return;
          // 2026-07-16（使用者回報「不能反白選取」的真根因之一）：
          // 反白拖曳放開滑鼠那一刻會產生一次 click，走到這裡切換時間
          // 顯示 → render() 重建 DOM → 剛選好的反白瞬間被清掉，看
          // 起來就是「完全不能反白」。有未收合的選取範圍就代表這次
          // click 是選取動作的收尾，不當作「點訊息看時間」。
          var selection = window.getSelection && window.getSelection();
          if (selection && !selection.isCollapsed) return;
          timePeekMessageId = timePeekMessageId === messageEl.dataset.messageId ? null : messageEl.dataset.messageId;
          if (lastPollData) render(lastPollData);
        }
      });

      // 2026-07-14（第十四輪）：往上捲到接近頂端就自動載入更早的訊息
      // （標準的「無限捲動往上」慣例），load-more 按鈕留著給不想靠捲動
      // 觸發的人手動點。
      els.thread.addEventListener("scroll", function () {
        closeContextMenu();
        if (els.thread.scrollTop < 60) loadOlder();
      });

      // ---- 長按訊息跳出複製／編輯／刪除選單／左滑快速回覆 ----
      // 2026-07-16：使用者拿 Messenger 截圖要求「左滑有回覆功能」，跟
      // 長按選單的「回覆」按鈕共用同一支 setReplyTarget，只是多一個
      // 手勢捷徑。滑動追蹤用獨立的 swipeStart（不是 longPressStart，
      // 那個一超過 10px 就被 cancelLongPress() 清空，滑動要撐到
      // pointerup 才算完）。方向判定「鎖定」一次：先看前幾個 px 是
      // 水平還是垂直位移比較大，垂直就整個放棄（不擋畫面本身的上下
      // 捲動），水平才繼續、才 preventDefault 擋掉瀏覽器原生的橫向
      // 手勢。只有 copyText 存在（跟長按選單「回覆」按鈕同一個限制，
      // 圖片/檔案/分享卡目前都不支援回覆）的訊息才會啟動滑動。
      var SWIPE_REPLY_THRESHOLD = 56;
      var SWIPE_REPLY_MAX = 72;
      var longPressTimer = null;
      var longPressStart = null;
      var swipeStart = null;
      var swipeMessageEl = null;
      var swipeBubbleEl = null;
      var swipeDirectionLocked = null; // null | "horizontal" | "vertical"

      function cancelLongPress() {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        longPressStart = null;
      }

      function resetSwipe(animate) {
        if (swipeBubbleEl) {
          swipeBubbleEl.style.transition = animate ? "transform 0.15s ease" : "";
          swipeBubbleEl.style.transform = "";
        }
        if (els.swipeReplyIcon) els.swipeReplyIcon.hidden = true;
        swipeStart = null;
        swipeMessageEl = null;
        swipeBubbleEl = null;
        swipeDirectionLocked = null;
      }

      els.thread.addEventListener("pointerdown", function (event) {
        // 2026-07-16（使用者回報「對話框沒辦法反白選取」）：滑鼠按住
        // 拖曳想反白文字時，被左滑回覆手勢劫持（往左拖 preventDefault
        // ＋拖著泡泡跑）、按住不動 480ms 還會誤觸長按選單。長按＋滑動
        // 是給觸控的手勢，桌機滑鼠有自己的 hover 工具列——滑鼠事件
        // 完全不進這套手勢，原生反白/拖曳行為全部還給瀏覽器。
        if (event.pointerType === "mouse") return;
        if (event.target.closest("[data-discuss-btn], [data-shared-card], [data-load-more]")) return;
        var messageEl = event.target.closest(".jonaminz-chat-message");
        if (!messageEl) return;
        longPressStart = { x: event.clientX, y: event.clientY };
        longPressTimer = setTimeout(function () {
          openContextMenu(messageEl, longPressStart.x, longPressStart.y);
          longPressTimer = null;
        }, LONG_PRESS_MS);
        if (messageEl.dataset.copyText) {
          swipeStart = { x: event.clientX, y: event.clientY };
          swipeMessageEl = messageEl;
          swipeBubbleEl = messageEl.querySelector(".jonaminz-chat-bubble-col");
        }
      });
      els.thread.addEventListener("pointermove", function (event) {
        if (longPressStart) {
          var ldx = event.clientX - longPressStart.x;
          var ldy = event.clientY - longPressStart.y;
          if (Math.sqrt(ldx * ldx + ldy * ldy) > 10) cancelLongPress();
        }
        if (!swipeStart || !swipeBubbleEl) return;
        var dx = event.clientX - swipeStart.x;
        var dy = event.clientY - swipeStart.y;
        if (!swipeDirectionLocked) {
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
          swipeDirectionLocked = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
          if (swipeDirectionLocked === "vertical") return; // 垂直捲動：放棄滑動追蹤，不擋畫面捲動
        }
        if (swipeDirectionLocked !== "horizontal") return;
        if (dx >= 0) {
          swipeBubbleEl.style.transition = "";
          swipeBubbleEl.style.transform = "";
          if (els.swipeReplyIcon) els.swipeReplyIcon.hidden = true;
          return;
        }
        event.preventDefault();
        var clamped = Math.max(dx, -SWIPE_REPLY_MAX);
        swipeBubbleEl.style.transition = "";
        swipeBubbleEl.style.transform = "translateX(" + clamped + "px)";
        if (els.swipeReplyIcon) {
          var rect = swipeMessageEl.getBoundingClientRect();
          els.swipeReplyIcon.hidden = false;
          els.swipeReplyIcon.style.opacity = String(Math.min(1, Math.abs(clamped) / SWIPE_REPLY_THRESHOLD));
          els.swipeReplyIcon.style.top = (rect.top + rect.height / 2 - 12) + "px";
          els.swipeReplyIcon.style.left = (rect.right - 28) + "px";
        }
      });
      els.thread.addEventListener("pointerup", function (event) {
        cancelLongPress();
        if (swipeDirectionLocked === "horizontal" && swipeMessageEl && swipeStart) {
          var dx = event.clientX - swipeStart.x;
          if (dx <= -SWIPE_REPLY_THRESHOLD) {
            setReplyTarget(swipeMessageEl.dataset.messageId, swipeMessageEl.dataset.copyText);
            els.input.focus();
          }
        }
        resetSwipe(true);
      });
      els.thread.addEventListener("pointercancel", function () {
        cancelLongPress();
        resetSwipe(true);
      });

      // 手機長按顯示的 inline 工具列（.is-touch-active）：點工具列以外的
      // 任何地方就收掉。點在工具列自己身上不收（讓按鈕的 click 正常
      // 觸發）；長按剛開始的那個 pointerdown 此時還沒有 active，清了也
      // 沒差，480ms 後 openContextMenu 才加上。
      document.addEventListener("pointerdown", function (event) {
        if (event.target.closest(".jonaminz-chat-hover-toolbar")) return;
        clearTouchActive();
      });

      // 表情反應（浮動選單）跟其他動作（底部操作列）是兩個獨立容器，
      // 但按鈕種類（data-menu-*）跟點擊行為完全共用，同一支函式掛在
      // 兩個容器上，不要維護兩份一樣的邏輯。
      function handleContextMenuClick(event) {
        var reactBtn = event.target.closest("[data-menu-react]");
        if (reactBtn) {
          closeContextMenu();
          optimisticToggleReaction(reactBtn.dataset.messageId, reactBtn.dataset.emoji);
          window.JonaminzBackend.toggleMessageReaction({ token: token, messageId: reactBtn.dataset.messageId, emoji: reactBtn.dataset.emoji })
            .then(function () { return poll(); })
            .catch(function () {});
          return;
        }
        var replyBtn = event.target.closest("[data-menu-reply]");
        if (replyBtn) {
          setReplyTarget(replyBtn.dataset.messageId, replyBtn.dataset.text);
          closeContextMenu();
          els.input.focus();
          return;
        }
        var copyBtn = event.target.closest("[data-menu-copy]");
        if (copyBtn) {
          try { navigator.clipboard.writeText(copyBtn.dataset.text || ""); } catch (error) {}
          closeContextMenu();
          return;
        }
        var downloadBtn = event.target.closest("[data-menu-download]");
        if (downloadBtn) {
          triggerChatFileDownload(downloadBtn.dataset.itemId, downloadBtn.dataset.ownerIdentity, downloadBtn.dataset.fileName);
          closeContextMenu();
          return;
        }
        var editBtn = event.target.closest("[data-menu-edit]");
        if (editBtn) {
          setEditTarget(editBtn.dataset.messageId, editBtn.dataset.text);
          closeContextMenu();
          return;
        }
        var deleteBtn = event.target.closest("[data-menu-delete]");
        if (deleteBtn) {
          // 2026-07-16（「刪除是假的」真根因排查）：harness 驗證前端
          // 流程完全正常，但資料庫裡從來沒有一筆刪除成功過——唯一的
          // 嫌疑是 window.confirm() 在使用者的瀏覽器被「不要再顯示
          // 對話方塊」壓掉，直接回傳 false、刪除無聲中止。改成完全
          // 不用瀏覽器對話框：第一下按鈕變成「確定刪除？」（3 秒內
          // 沒按第二下就復原），第二下才真的刪。錯誤顯示同理不用
          // alert（一樣會被壓掉），寫進操作列按鈕本身＋console。
          if (deleteBtn.dataset.confirming !== "true") {
            deleteBtn.dataset.confirming = "true";
            deleteBtn.innerHTML = "<span>⚠️</span>確定刪除？";
            setTimeout(function () {
              if (deleteBtn.isConnected && deleteBtn.dataset.confirming === "true") {
                deleteBtn.dataset.confirming = "";
                deleteBtn.innerHTML = "<span>🗑️</span>刪除";
              }
            }, 3000);
            return;
          }
          deleteBtn.innerHTML = "<span>⏳</span>刪除中…";
          window.JonaminzBackend.deleteChatMessage({ token: token, messageId: deleteBtn.dataset.messageId })
            .then(function (result) {
              if (!result || result.ok === false) {
                var reason = (result && (result.error || result.code)) || "未知原因";
                console.error("[jonaminz] deleteChatMessage failed:", reason, result);
                closeContextMenu();
                showToast("刪除失敗：" + reason.slice(0, 120));
                return;
              }
              closeContextMenu();
              return poll();
            })
            .catch(function (error) {
              var message = error.message || String(error);
              console.error("[jonaminz] deleteChatMessage threw:", error);
              closeContextMenu();
              showToast("刪除失敗：" + message.slice(0, 120));
            });
        }
      }

      if (els.contextMenu) els.contextMenu.addEventListener("click", handleContextMenuClick);
      if (els.actionSheetMenu) els.actionSheetMenu.addEventListener("click", handleContextMenuClick);
      if (els.actionSheetBackdrop) els.actionSheetBackdrop.addEventListener("click", closeContextMenu);
      // 2026-07-16（使用者實測捲動鎖無效）：鎖住訊息串的 overflow 只
      // 擋得住訊息串自己，滾輪/觸控捲動落在遮罩上時會「捲動鏈」穿透
      // 到外層（尤其面板是 iframe 時會捲到宿主頁面），要在遮罩上直接
      // 把事件擋下來（passive:false 才允許 preventDefault）。
      if (els.actionSheetBackdrop) {
        els.actionSheetBackdrop.addEventListener("wheel", function (event) { event.preventDefault(); }, { passive: false });
        els.actionSheetBackdrop.addEventListener("touchmove", function (event) { event.preventDefault(); }, { passive: false });
      }

      if (els.contextMenu || els.actionSheet) {
        document.addEventListener("click", function (event) {
          var contextMenuOpen = els.contextMenu && !els.contextMenu.hidden;
          var actionSheetOpen = els.actionSheet && !els.actionSheet.hidden;
          if (!contextMenuOpen && !actionSheetOpen) return;
          if (event.target.closest(".jonaminz-chat-context-menu, .jonaminz-chat-action-sheet-menu")) return;
          // 防呆：長按放開的那個手勢，同一時間也會在底下的訊息元素上
          // 冒出一個合成的 click 事件——如果不擋，選單剛開就被這個
          // 「點在選單外面」的判斷立刻關掉。跟 chat-launcher.js 的
          // 點外關閉面板是同一個坑、同一個修法（開啟後短時間內不接受
          // 「點外面關閉」）。
          if (Date.now() - contextMenuOpenedAt < 300) return;
          closeContextMenu();
        });
      }

      if (els.discussBanner) {
        els.discussBanner.addEventListener("click", function (event) {
          if (event.target.closest("[data-discuss-clear]")) setDiscussTarget(null, "");
        });
      }

      if (els.replyBanner) {
        els.replyBanner.addEventListener("click", function (event) {
          if (event.target.closest("[data-reply-cancel]")) setReplyTarget(null);
        });
      }

      if (els.editBanner) {
        els.editBanner.addEventListener("click", function (event) {
          if (event.target.closest("[data-edit-cancel]")) {
            setEditTarget(null);
            els.input.value = "";
            updateComposerAction();
            autoGrowInput();
          }
        });
      }

      if (els.searchToggle && els.searchBar) {
        els.searchToggle.addEventListener("click", function () {
          els.searchBar.hidden = !els.searchBar.hidden;
          if (!els.searchBar.hidden) {
            els.searchInput.focus();
          } else {
            els.searchResults.hidden = true;
            els.searchInput.value = "";
          }
        });
        els.searchClose.addEventListener("click", function () {
          els.searchBar.hidden = true;
          els.searchResults.hidden = true;
          els.searchInput.value = "";
        });
        els.searchInput.addEventListener("input", function () {
          clearTimeout(searchDebounceTimer);
          var query = els.searchInput.value.trim();
          searchDebounceTimer = setTimeout(function () { performSearch(query); }, 300);
        });
        // 點搜尋結果：關掉搜尋、跳到那則訊息（不在已載入範圍就邊載歷史
        // 邊找，見 scrollToMessage）。
        els.searchResults.addEventListener("click", function (event) {
          var result = event.target.closest("[data-search-result]");
          if (!result) return;
          els.searchBar.hidden = true;
          els.searchResults.hidden = true;
          els.searchInput.value = "";
          scrollToMessage(result.dataset.messageId);
        });
      }

      if (els.notifToggle && els.notifPanel) {
        els.notifToggle.addEventListener("click", function (event) {
          event.stopPropagation();
          els.notifPanel.hidden = !els.notifPanel.hidden;
        });
        els.notifPanel.addEventListener("click", function (event) {
          var item = event.target.closest("[data-notif-shared]");
          if (!item) return;
          var card = els.thread.querySelector('[data-shared-card][data-item-id="' + item.dataset.itemId + '"]');
          if (card) {
            card.scrollIntoView({ block: "center" });
          }
          els.notifPanel.hidden = true;
        });
        document.addEventListener("click", function (event) {
          if (!els.notifPanel.hidden && !event.target.closest(".jonaminz-chat-notif-panel, [data-notif-toggle]")) {
            els.notifPanel.hidden = true;
          }
        });
      }

      if (els.sharedListToggle && els.sharedListPanel) {
        els.sharedListToggle.addEventListener("click", function (event) {
          event.stopPropagation();
          if (els.sharedListPanel.hidden) renderSharedListPanel();
          els.sharedListPanel.hidden = !els.sharedListPanel.hidden;
        });
        els.sharedListPanel.addEventListener("click", function (event) {
          var discussBtn = event.target.closest("[data-shared-list-discuss]");
          if (discussBtn) {
            event.stopPropagation();
            setDiscussTarget(discussBtn.dataset.itemId, discussBtn.dataset.itemTitle);
            els.sharedListPanel.hidden = true;
            els.input.focus();
            return;
          }
          var filterTab = event.target.closest("[data-shared-filter]");
          if (filterTab) {
            event.stopPropagation();
            sharedListFilter = filterTab.dataset.sharedFilter;
            renderSharedListPanel();
            return;
          }
          var item = event.target.closest("[data-shared-list-item]");
          if (!item) return;
          window.JonaminzBackend.markSharedItemSeen({ token: token, itemId: item.dataset.itemId }).catch(function () {});
          window.open(item.dataset.itemUrl, "_blank", "noopener");
          els.sharedListPanel.hidden = true;
        });
        document.addEventListener("click", function (event) {
          if (!els.sharedListPanel.hidden && !event.target.closest(".jonaminz-chat-notif-wrap")) {
            els.sharedListPanel.hidden = true;
          }
        });
      }

      // ---- 設定面板：我的電話號碼（後台可編輯，取代寫死）／撥打給對方
      // （語音通話「偷吃步」改用真實手機撥號取代）／推播通知開關。----
      function urlBase64ToUint8Array(base64String) {
        var padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
        var rawData = atob(base64);
        var outputArray = new Uint8Array(rawData.length);
        for (var i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i);
        return outputArray;
      }

      // 2026-07-14（真機回報修正）：iOS Safari（沒有加入主畫面的一般
      // 瀏覽模式）從 iOS 16.4 起雖然理論上支援 Web Push，但只限「已加入
      // 主畫面」的網頁 App，一般分頁裡 window.PushManager 直接不存在——
      // 這不是哪裡寫錯，是平台限制，先精準判斷出來給使用者看得懂的訊息，
      // 不要跟其他「真的不支援」的情況混在一起顯示同一句看不懂的話。
      function isIOSDevice() {
        return /iP(hone|od|ad)/.test(navigator.userAgent || "") ||
          (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      }
      function isStandaloneDisplay() {
        try {
          return window.navigator.standalone === true ||
            (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
        } catch (error) {
          return false;
        }
      }

      function refreshPushStatus() {
        if (!els.pushStatus) return;
        if (pushSubscribed) {
          // 2026-07-14（真機回饋）：開啟推播是一次性動作，開過就把按鈕
          // 變成打勾的完成狀態、不能再按——不是一顆永遠都能按的按鈕。
          if (els.pushToggleBtn) {
            els.pushToggleBtn.textContent = "✓ 已開啟推播通知";
            els.pushToggleBtn.disabled = true;
          }
          els.pushStatus.textContent = "";
          return;
        }
        if (isIOSDevice() && !isStandaloneDisplay()) {
          els.pushStatus.textContent = "iPhone 請先「分享→加入主畫面」，從主畫面開啟才能開啟推播通知";
          return;
        }
        // 面板本身跑在 iframe 裡，這裡的 serviceWorker/PushManager/
        // Notification.permission 檢查未必準確反映宿主頁面的能力（有些
        // 瀏覽器對非最上層瀏覽環境的判斷不同），這幾句只在整頁版
        // （!inPanel，本身就是最上層）先做初步判斷；面板情境一律顯示
        // 中性文字，真正的支援與否留到使用者按下按鈕、實際交給宿主
        // 執行後才知道結果。
        if (!inPanel) {
          if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
            els.pushStatus.textContent = "此瀏覽器不支援推播通知";
            return;
          }
          if (Notification.permission === "denied") {
            els.pushStatus.textContent = "通知權限被封鎖，需要到瀏覽器設定手動開啟";
            return;
          }
        }
        els.pushStatus.textContent = "尚未開啟這台裝置的推播通知";
      }

      // 2026-07-14（真機回報修正）：Notification.requestPermission()／
      // serviceWorker.register()／pushManager.subscribe() 這幾支 API，
      // 部分瀏覽器只信任「使用者目前看到的最上層網址列」那個瀏覽環境，
      // 面板是 iframe，不一定是最上層——交給宿主頁面（chat-launcher.js／
      // sdk-src/sdk.js）代為執行，回傳結果，跟「分享目前內容」問宿主要
      // title/url 同一種 postMessage 模式。整頁版（/pages/chat/）本身
      // 就是最上層，直接自己做，不用繞這一圈。
      function requestPushSubscription(applicationServerKey) {
        if (!inPanel) {
          if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
            return Promise.reject(new Error("此瀏覽器不支援推播通知"));
          }
          return Notification.requestPermission().then(function (permission) {
            if (permission !== "granted") throw new Error("使用者未允許通知權限");
            return navigator.serviceWorker.register("/sw.js");
          }).then(function () {
            // 見 chat-launcher.js 的 handlePushSubscribeRequest 同一處註解：
            // register() 回傳值不保證已 active，改用 serviceWorker.ready。
            return navigator.serviceWorker.ready;
          }).then(function (registration) {
            return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey });
          }).then(function (subscription) { return subscription.toJSON(); });
        }
        return new Promise(function (resolve, reject) {
          var done = false;
          function onMessage(event) {
            var data = event.data;
            if (!data || data.source !== "jonaminz-chat-panel-host" || data.action !== "pushSubscribeResult") return;
            if (done) return;
            done = true;
            window.removeEventListener("message", onMessage);
            if (data.ok) resolve(data.subscription);
            else reject(new Error(data.error || "推播開啟失敗"));
          }
          window.addEventListener("message", onMessage);
          try {
            window.parent.postMessage({
              source: "jonaminz-chat-panel",
              action: "requestPushSubscribe",
              applicationServerKey: Array.from(applicationServerKey)
            }, "*");
          } catch (error) {}
          setTimeout(function () {
            if (done) return;
            done = true;
            window.removeEventListener("message", onMessage);
            reject(new Error("逾時，沒有收到宿主頁面回應"));
          }, 15000);
        });
      }

      if (els.settingsToggle && els.settingsPanel) {
        els.settingsToggle.addEventListener("click", function (event) {
          event.stopPropagation();
          var opening = els.settingsPanel.hidden;
          els.settingsPanel.hidden = !els.settingsPanel.hidden;
          if (opening) {
            refreshPushStatus();
            // 2026-07-14（真機回報修正）：聯絡電話原本只在 mount 時抓一次
            // ——對方在那之後才存號碼的話，這邊永遠是舊的空值，按撥打
            // 就靜靜地沒反應。改成每次打開設定面板都重新抓一次，順便把
            // 「對方還沒設定號碼」的提示顯示在面板裡看得到的位置（原本
            // 寫在面板最底下的狀態列，被鍵盤/邊界擋住根本看不到）。
            // 電話號碼本身已直接存在資料庫（使用者裁決），編輯 UI 收掉，
            // 之後要改號碼再把設定功能加回來。
            window.JonaminzBackend.getContactInfo({ token: token })
              .then(function (result) {
                peerPhoneNumber = result.peerPhoneNumber || "";
                if (els.callStatus) {
                  els.callStatus.textContent = peerPhoneNumber ? "" : "對方還沒有設定電話號碼";
                }
              })
              .catch(function () {});
          }
        });
        document.addEventListener("click", function (event) {
          if (!els.settingsPanel.hidden && !event.target.closest(".jonaminz-chat-notif-wrap")) {
            els.settingsPanel.hidden = true;
          }
        });
      }

      if (els.callBtn) {
        els.callBtn.addEventListener("click", function () {
          if (!peerPhoneNumber) {
            if (els.callStatus) els.callStatus.textContent = "對方還沒有設定電話號碼";
            return;
          }
          if (inPanel) {
            // 面板是 iframe，部分瀏覽器（尤其 WebKit/iOS）不接受從非最
            // 上層瀏覽環境觸發 tel: 這類自訂協定導頁，交給宿主頁面執行。
            try {
              window.parent.postMessage(
                { source: "jonaminz-chat-panel", action: "requestCall", phoneNumber: peerPhoneNumber },
                "*"
              );
            } catch (error) {}
          } else {
            window.location.href = "tel:" + peerPhoneNumber;
          }
        });
      }

      // 2026-07-15（第二十三輪）：兩種泡泡（使用者跟 ChatGPT Work 討論
      // 過的兩條路，都做）——系統泡泡（Android 11 Bubbles）跟 Messenger
      // 式懸浮泡泡（覆蓋視窗＋前景服務）。都是 App 原生能力，面板
      // postMessage 請宿主呼叫原生外掛，回覆結果顯示在共用的狀態列。
      function requestNativeBubble(mode) {
        if (!els.bubbleStatus) return;
        els.bubbleStatus.textContent = "正在開啟...";
        if (!inPanel) {
          els.bubbleStatus.textContent = "泡泡是 App 的功能，請在 App 裡使用";
          return;
        }
        var done = false;
        function onMessage(event) {
          var data = event.data;
          if (!data || data.source !== "jonaminz-chat-panel-host" || data.action !== "bubbleResult") return;
          if (done) return;
          done = true;
          window.removeEventListener("message", onMessage);
          if (data.status === "opened") {
            els.bubbleStatus.textContent = "泡泡已開啟";
          } else if (data.status === "settings") {
            els.bubbleStatus.textContent = mode === "overlay"
              ? "已帶你到系統設定：允許「顯示在其他應用程式上層」，回來再按一次"
              : "已帶你到系統設定：把「允許顯示泡泡」打開，回來再按一次";
          } else {
            els.bubbleStatus.textContent = data.error || "這個環境不支援泡泡";
          }
        }
        window.addEventListener("message", onMessage);
        try {
          window.parent.postMessage({ source: "jonaminz-chat-panel", action: "requestBubble", mode: mode }, "*");
        } catch (error) {}
        setTimeout(function () {
          if (done) return;
          done = true;
          window.removeEventListener("message", onMessage);
          els.bubbleStatus.textContent = "沒有回應（泡泡要在 App 裡使用）";
        }, 8000);
      }

      if (els.bubbleBtn) {
        els.bubbleBtn.addEventListener("click", function () { requestNativeBubble("system"); });
      }
      if (els.overlayBtn) {
        els.overlayBtn.addEventListener("click", function () { requestNativeBubble("overlay"); });
      }

      if (els.pushToggleBtn) {
        els.pushToggleBtn.addEventListener("click", function () {
          els.pushStatus.textContent = "正在開啟推播通知...";
          window.JonaminzBackend.getVapidPublicKey({})
            .then(function (result) {
              return requestPushSubscription(urlBase64ToUint8Array(result.publicKey));
            })
            .then(function (subscription) {
              return window.JonaminzBackend.savePushSubscription({ token: token, subscription: subscription });
            })
            .then(function () {
              pushSubscribed = true;
              try { window.localStorage.setItem("jonaminz.pushEnabledHint", "1"); } catch (error) {}
              refreshPushStatus();
            })
            .catch(function (error) {
              els.pushStatus.textContent = "開啟失敗：" + (error.message || String(error));
            });
        });
      }

      // 2026-07-14：點送出按鈕原本會讓輸入框失焦（鍵盤收起來），送出流程
      // 跑完才在 doSendText() 尾端 els.input.focus() 拉回來，手機上看起來
      // 就是「鍵盤消失一下又跳出來」的閃爍。根因是 <button> 預設在
      // pointerdown 那一刻就會把焦點從原本聚焦的元素（輸入框）搶過去；
      // 在 pointerdown 擋掉這個預設行為，輸入框全程不失焦，鍵盤就不會
      // 收起來，doSendText() 尾端那次 focus() 也就變成不會有動作的
      // no-op（保留著沒關係，防呆用）。
      els.action.addEventListener("pointerdown", function (event) {
        event.preventDefault();
      });
      els.action.addEventListener("click", function () {
        var body = els.input.value.trim();
        // Messenger 式附件列：有附件就先送附件，打了字接著把文字當第二
        // 則送出（跟 Messenger 一樣是兩則訊息）。
        if (pendingAttachment) {
          var attachment = pendingAttachment;
          pendingAttachment = null;
          renderAttachTray();
          var sendPromise = attachment.kind === "image"
            ? sendImage(attachment.file)
            : sendFile(attachment.file);
          if (body) {
            els.input.value = "";
            updateComposerAction();
            autoGrowInput();
            Promise.resolve(sendPromise).then(function () { doSendText(body); });
          }
          return;
        }
        if (body) {
          els.input.value = "";
          updateComposerAction();
          autoGrowInput();
          doSendText(body);
        } else {
          doSendText(QUICK_REACTION);
        }
      });

      els.input.addEventListener("input", function () {
        updateComposerAction();
        autoGrowInput();
        // 輸入中心跳：不用 debounce 延遲（那樣使用者停下來一小段時間對方
        // 才看得到"正在輸入"），改成「最多每 2.5 秒送一次」的節流——打字
        // 期間持續是 true，跟已讀/送達一樣是「用 polling 頻率換簡單架構」
        // 的模式，不需要 WebSocket。
        if (els.input.value.trim() && Date.now() - lastTypingSentAt > TYPING_HEARTBEAT_MS) {
          lastTypingSentAt = Date.now();
          window.JonaminzBackend.setTypingState({ token: token }).catch(function () {});
        }
      });
      els.input.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          els.action.click();
        }
      });

      // 2026-07-14（真機回報修正）：手機鍵盤跳出來會把「視覺視窗」高度
      // 縮小，面板/整頁版原本用固定高度或 100dvh 算的訊息串高度不會
      // 自動重新捲到底部，導致鍵盤跳出來那瞬間看起來像是「捲動位置跑掉」
      // ——其實是內容還停在鍵盤跳出來之前的捲動位置，被縮小的視窗蓋住了
      // 最下面幾則。鍵盤彈出是非同步的（視覺視窗要過一小段時間才真的
      // 縮小），所以 focus 當下先捲一次、resize 事件觸發後再捲一次修正。
      function scrollThreadToBottom() {
        if (els.thread) els.thread.scrollTop = els.thread.scrollHeight;
      }
      // 使用者去點輸入框＝準備打字，貼圖/常用回覆面板應該讓位關掉。
      // 但「插入表情」那支自己會 programmatic focus() 拉回游標（要留著面板
      // 連續插），所以用旗標把那次程式化 focus 排除掉；setTimeout(0) 保證
      // 就算輸入框本來就有焦點（focus() 不觸發事件）旗標也會自清。
      var skipQuickCloseOnFocus = false;
      els.input.addEventListener("focus", function () {
        if (!skipQuickCloseOnFocus) closeQuickPanel();
        setTimeout(scrollThreadToBottom, 60);
        setTimeout(scrollThreadToBottom, 320);
      });
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", scrollThreadToBottom);
      }
      // App（adjustNothing）情境：鍵盤彈出時 visualViewport 不變，變的是
      // 面板 iframe 本身被宿主縮高——iframe 內是 window resize 事件。
      window.addEventListener("resize", scrollThreadToBottom);

      // 一顆 🙂 面板：切換開關；點常用回覆/貼圖＝直接送出，點插入表情
      // ＝插進輸入框游標處。
      if (els.quickToggle && els.quickPanel) {
        els.quickToggle.addEventListener("click", function (event) {
          event.stopPropagation();
          els.quickPanel.hidden = !els.quickPanel.hidden;
        });
        els.quickPanel.addEventListener("click", function (event) {
          var sticker = event.target.closest("[data-quick-sticker]");
          if (sticker) {
            closeQuickPanel();
            doSendText(sticker.dataset.quickSticker);
            return;
          }
          var canned = event.target.closest("[data-quick-reply]");
          if (canned) {
            closeQuickPanel();
            doSendText(canned.dataset.quickReply);
            return;
          }
          var emojiBtn = event.target.closest("[data-emoji]");
          if (emojiBtn) {
            var start = els.input.selectionStart || els.input.value.length;
            var end = els.input.selectionEnd || els.input.value.length;
            var value = els.input.value;
            els.input.value = value.slice(0, start) + emojiBtn.dataset.emoji + value.slice(end);
            var caret = start + emojiBtn.dataset.emoji.length;
            skipQuickCloseOnFocus = true;
            els.input.focus();
            els.input.setSelectionRange(caret, caret);
            setTimeout(function () { skipQuickCloseOnFocus = false; }, 0);
            updateComposerAction();
            autoGrowInput();
            return;
          }
        });
      }

      document.addEventListener("click", function (event) {
        if (!event.target.closest(".jonaminz-chat-input-shell")) {
          closeQuickPanel();
        }
      });
    }

    buildUI();
    poll().then(function () {
      if (!destroyed) pollTimer = setInterval(poll, POLL_INTERVAL_MS);
    });

    // 聯絡電話跟推播訂閱現況——都是「錦上添花」的次要資訊，失敗不影響
    // 訊息主線，各自獨立 catch。
    window.JonaminzBackend.getContactInfo({ token: token })
      .then(function (result) {
        myPhoneNumber = result.myPhoneNumber || "";
        peerPhoneNumber = result.peerPhoneNumber || "";
      })
      .catch(function () {});
    // App（FCM）情境的訂閱狀態沒辦法從瀏覽器 API 查（PushManager 不存在），
    // 用 localStorage 旗標記住「這台裝置成功開過推播」——localStorage 是
    // 同源共用，宿主/面板/整頁版都讀寫得到同一份。
    try {
      if (window.localStorage.getItem("jonaminz.pushEnabledHint") === "1") {
        pushSubscribed = true;
      }
    } catch (error) {}
    try {
      if (!pushSubscribed && "serviceWorker" in navigator && "PushManager" in window) {
        navigator.serviceWorker.getRegistration().then(function (registration) {
          if (!registration) return null;
          return registration.pushManager.getSubscription();
        }).then(function (subscription) {
          if (subscription) pushSubscribed = true;
        }).catch(function () {});
      }
    } catch (error) {}

    return {
      destroy: function () {
        destroyed = true;
        if (pollTimer) clearInterval(pollTimer);
      }
    };
  }

  window.JonaminzChatThread = { mount: mount };
})();
