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
  var PRESENCE_WINDOW_MS = 5 * 60 * 1000;
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
  // 一般文字訊息如果整則「就只是一個網址」，直接當成分享內容處理（跟
  // Discord/Slack/iMessage 一樣：貼一個純網址會變成預覽卡，不是純文字）
  // ——訊息裡「還有其他文字」的情況不觸發，避免正常聊天句子裡帶到連結
  // 就被硬轉成卡片。
  var BARE_URL_RE = /^https?:\/\/\S+$/i;

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

      var peerLastActivity = 0;
      messages.forEach(function (m) {
        if (m.sender_identity === peer) {
          var t = new Date(m.created_at).getTime();
          if (t > peerLastActivity) peerLastActivity = t;
        }
      });
      if (peerRead.lastReadAt) {
        var readAt = new Date(peerRead.lastReadAt).getTime();
        if (readAt > peerLastActivity) peerLastActivity = readAt;
      }
      var isOnline = peerLastActivity > 0 && (Date.now() - peerLastActivity) < PRESENCE_WINDOW_MS;
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

      renderNotifPanel(unreadCount);

      if (!messages.length) {
        els.thread.innerHTML = '<p class="jonaminz-chat-empty">還沒有訊息，說句話開始吧。</p>';
        return;
      }

      // 2026-07-14：真的有「對方送來的新訊息」才播提示音——排除自己剛
      // 送出的訊息、也排除第一次載入時把既有訊息全部當成「新的」誤觸發。
      var newestMessage = messages[messages.length - 1];
      if (hasRenderedOnce && newestMessage.id !== lastMessageId && newestMessage.sender_identity !== identity) {
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
        var canEditOrDelete = mine && !deleted && m.kind !== "shared_item";
        var canReplyOrReact = !deleted;

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
            var quotedSnippet = quoted.kind === "shared_item" ? "[分享的內容]" : (quoted.deleted_at ? "此訊息已刪除" : quoted.body);
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
        var reactionRows = m.chat_message_reactions || [];
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
          bodyHtml = '<div class="jonaminz-chat-bubble-col">' + replyQuoteHtml +
            '<div class="jonaminz-chat-bubble">' + escapeHtml(m.body) +
            (m.edited_at ? '<span class="jonaminz-chat-edited-tag">已編輯</span>' : "") + "</div>" +
            reactionsHtml + "</div>";
        }

        html +=
          '<div class="jonaminz-chat-message" data-mine="' + mine + '" data-message-id="' + escapeHtml(m.id) + '"' +
          (canEditOrDelete ? " data-editable=\"true\"" : "") +
          (deleted ? ' data-deleted="true"' : "") +
          (canReplyOrReact ? " data-reactable=\"true\"" : "") +
          (!deleted && m.kind !== "shared_item" ? ' data-copy-text="' + escapeHtml(m.body) + '"' : "") + ">" +
          avatarHtml +
          bodyHtml +
          "</div>";

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

      var wasNearBottom = els.thread.scrollHeight - els.thread.scrollTop - els.thread.clientHeight < 80;
      els.thread.innerHTML = loadMoreHtml + html;
      if (wasNearBottom || !lastMessageId) els.thread.scrollTop = els.thread.scrollHeight;

      var newestId = messages[messages.length - 1].id;
      if (newestId !== lastMessageId) {
        lastMessageId = newestId;
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
      return window.JonaminzBackend.listChatMessages({ token: token })
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
      var hasText = Boolean(els.input.value.trim());
      els.action.textContent = hasText ? "➤" : QUICK_REACTION;
      els.action.classList.toggle("is-send-mode", hasText);
      els.action.setAttribute("aria-label", hasText ? "送出訊息" : "快速送出 " + QUICK_REACTION);
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
        })
        .then(function () {
          sending = false;
          els.action.disabled = false;
          els.input.focus();
        });
    }

    function closeEmojiPanel() {
      els.emojiPanel.hidden = true;
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
    function closeContextMenu() {
      if (els.contextMenu) els.contextMenu.hidden = true;
    }

    function openContextMenu(messageEl, x, y) {
      if (!els.contextMenu) return;
      var messageId = messageEl.dataset.messageId;
      var editable = messageEl.dataset.editable === "true";
      var reactable = messageEl.dataset.reactable === "true";
      var copyText = messageEl.dataset.copyText;
      var items = [];
      if (reactable) {
        items.push('<div class="jonaminz-chat-context-reactions">' +
          REACTION_SET.map(function (emoji) {
            return '<button type="button" data-menu-react data-message-id="' + escapeHtml(messageId) +
              '" data-emoji="' + emoji + '">' + emoji + "</button>";
          }).join("") + "</div>");
      }
      if (copyText) {
        items.push('<button type="button" data-menu-copy data-text="' + escapeHtml(copyText) + '">複製</button>');
      }
      if (copyText) {
        items.push('<button type="button" data-menu-reply data-message-id="' + escapeHtml(messageId) +
          '" data-text="' + escapeHtml(copyText) + '">回覆</button>');
      }
      if (editable) {
        items.push('<button type="button" data-menu-edit data-message-id="' + escapeHtml(messageId) +
          '" data-text="' + escapeHtml(copyText || "") + '">編輯</button>');
        items.push('<button type="button" data-menu-delete data-message-id="' + escapeHtml(messageId) + '">刪除</button>');
      }
      if (!items.length) return;
      els.contextMenu.innerHTML = items.join("");
      els.contextMenu.hidden = false;
      contextMenuOpenedAt = Date.now();
      var menuWidth = els.contextMenu.offsetWidth || 120;
      var menuHeight = els.contextMenu.offsetHeight || 40;
      var maxLeft = (root.clientWidth || window.innerWidth) - menuWidth - 6;
      var maxTop = (root.clientHeight || window.innerHeight) - menuHeight - 6;
      els.contextMenu.style.left = Math.max(6, Math.min(x, maxLeft)) + "px";
      els.contextMenu.style.top = Math.max(6, Math.min(y, maxTop)) + "px";
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
              var snippet = m.kind === "shared_item" ? "[分享的內容]" : m.body;
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

    function buildUI() {
      var plusButtonHtml = inPanel
        ? '<button type="button" class="jonaminz-chat-plus-btn" data-plus ' +
          'aria-label="更多功能" aria-haspopup="true">+</button>' +
          '<div class="jonaminz-chat-plus-panel" data-plus-panel hidden>' +
          '<button type="button" data-share-current>分享目前內容</button>' +
          '<button type="button" data-pick-image>分享圖片（相機／相簿）</button>' +
          '<input type="file" accept="image/*" data-image-input hidden>' +
          "</div>"
        : '<button type="button" class="jonaminz-chat-plus-btn" data-plus disabled ' +
          'title="附件與更多動作——之後開放" aria-label="更多功能（尚未開放）">+</button>';

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
        '<button type="button" class="jonaminz-chat-head-icon-btn" data-shared-list-toggle aria-label="所有分享內容">🗂</button>' +
        '<div class="jonaminz-chat-notif-panel" data-shared-list-panel hidden></div>' +
        "</div>" +
        '<div class="jonaminz-chat-notif-wrap">' +
        '<button type="button" class="jonaminz-chat-head-icon-btn" data-settings-toggle aria-label="設定">⚙️</button>' +
        '<div class="jonaminz-chat-notif-panel jonaminz-chat-settings-panel" data-settings-panel hidden>' +
        '<button type="button" class="jonaminz-chat-settings-call-btn" data-call-btn>📞 撥打給對方</button>' +
        '<p class="jonaminz-chat-settings-note" data-call-status></p>' +
        '<button type="button" class="jonaminz-chat-settings-push-btn" data-push-toggle>開啟推播通知</button>' +
        '<p class="jonaminz-chat-settings-note" data-push-status></p>' +
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
        '<div class="jonaminz-chat-discuss-banner jonaminz-chat-image-preview-banner" data-image-preview-banner hidden>' +
        '<img data-image-preview-thumb alt="預覽圖片">' +
        '<span>圖片已選好，等 OneDrive 接上這步才能真的送出</span>' +
        '<button type="button" data-image-preview-cancel aria-label="取消">✕</button>' +
        "</div>" +
        '<div class="jonaminz-chat-context-menu" data-context-menu hidden></div>' +
        '<div class="jonaminz-chat-composer">' +
        '<div class="jonaminz-chat-plus-wrap">' + plusButtonHtml + "</div>" +
        '<div class="jonaminz-chat-input-shell">' +
        '<textarea data-input placeholder="輸入訊息..." rows="1"></textarea>' +
        '<button type="button" class="jonaminz-chat-emoji-toggle" data-emoji-toggle ' +
        'aria-label="插入表情符號">🙂</button>' +
        '<div class="jonaminz-chat-emoji-panel" data-emoji-panel hidden></div>' +
        "</div>" +
        '<button type="button" class="jonaminz-chat-action-btn" data-action ' +
        'aria-label="快速送出 ' + QUICK_REACTION + '">' + QUICK_REACTION + "</button>" +
        "</div>" +
        '<p class="jonaminz-chat-status-line" data-page-status aria-live="polite"></p>';

      els.avatar = root.querySelector("[data-avatar]");
      els.peerName = root.querySelector("[data-peer-name]");
      els.peerStatus = root.querySelector("[data-status]");
      els.thread = root.querySelector("[data-thread]");
      els.input = root.querySelector("[data-input]");
      els.action = root.querySelector("[data-action]");
      els.status = root.querySelector("[data-page-status]");
      els.emojiToggle = root.querySelector("[data-emoji-toggle]");
      els.emojiPanel = root.querySelector("[data-emoji-panel]");
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
      els.replyBanner = root.querySelector("[data-reply-banner]");
      els.replyTitle = root.querySelector("[data-reply-title]");
      els.imageInput = root.querySelector("[data-image-input]");
      els.imagePreviewBanner = root.querySelector("[data-image-preview-banner]");
      els.imagePreviewThumb = root.querySelector("[data-image-preview-thumb]");
      els.sharedListToggle = root.querySelector("[data-shared-list-toggle]");
      els.sharedListPanel = root.querySelector("[data-shared-list-panel]");
      els.settingsToggle = root.querySelector("[data-settings-toggle]");
      els.settingsPanel = root.querySelector("[data-settings-panel]");
      els.callBtn = root.querySelector("[data-call-btn]");
      els.callStatus = root.querySelector("[data-call-status]");
      els.pushToggleBtn = root.querySelector("[data-push-toggle]");
      els.pushStatus = root.querySelector("[data-push-status]");

      els.emojiPanel.innerHTML = EMOJI_SET.map(function (emoji) {
        return '<button type="button" data-emoji="' + emoji + '">' + emoji + "</button>";
      }).join("");

      if (inPanel && els.plusPanel) {
        els.plus.addEventListener("click", function (event) {
          event.stopPropagation();
          closeEmojiPanel();
          els.plusPanel.hidden = !els.plusPanel.hidden;
        });
        els.plusPanel.addEventListener("click", function (event) {
          if (event.target.closest("[data-pick-image]")) {
            closePlusPanel();
            if (els.imageInput) els.imageInput.click();
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
        // 2026-07-14（第十五輪）：圖片分享——這輪只做「調用手機相機/相簿
        // 權限＋本機預覽」，使用者明確要求儲存位置下一輪才接 OneDrive，
        // 這裡刻意不呼叫任何送出/上傳 action，只示範權限流程能動。
        if (els.imageInput) {
          els.imageInput.addEventListener("change", function () {
            var file = els.imageInput.files && els.imageInput.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function () {
              if (els.imagePreviewThumb) els.imagePreviewThumb.src = String(reader.result || "");
              if (els.imagePreviewBanner) els.imagePreviewBanner.hidden = false;
            };
            reader.readAsDataURL(file);
            els.imageInput.value = "";
          });
        }
        if (els.imagePreviewBanner) {
          els.imagePreviewBanner.addEventListener("click", function (event) {
            if (!event.target.closest("[data-image-preview-cancel]")) return;
            els.imagePreviewBanner.hidden = true;
            if (els.imagePreviewThumb) els.imagePreviewThumb.src = "";
          });
        }
        document.addEventListener("click", function (event) {
          if (!els.plusPanel.hidden && !event.target.closest(".jonaminz-chat-plus-wrap")) {
            closePlusPanel();
          }
        });
      }

      els.thread.addEventListener("click", function (event) {
        var loadMoreBtn = event.target.closest("[data-load-more]");
        if (loadMoreBtn) {
          loadOlder();
          return;
        }
        var discussBtn = event.target.closest("[data-discuss-btn]");
        if (discussBtn) {
          setDiscussTarget(discussBtn.dataset.itemId, discussBtn.dataset.itemTitle);
          els.input.focus();
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
          window.JonaminzBackend.toggleMessageReaction({ token: token, messageId: pill.dataset.messageId, emoji: pill.dataset.emoji })
            .then(function () { return poll(); })
            .catch(function () {});
        }
      });

      // 2026-07-14（第十四輪）：往上捲到接近頂端就自動載入更早的訊息
      // （標準的「無限捲動往上」慣例），load-more 按鈕留著給不想靠捲動
      // 觸發的人手動點。
      els.thread.addEventListener("scroll", function () {
        closeContextMenu();
        if (els.thread.scrollTop < 60) loadOlder();
      });

      // ---- 長按訊息跳出複製／編輯／刪除選單 ----
      var longPressTimer = null;
      var longPressStart = null;
      function cancelLongPress() {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        longPressStart = null;
      }
      els.thread.addEventListener("pointerdown", function (event) {
        if (event.target.closest("[data-discuss-btn], [data-shared-card], [data-load-more]")) return;
        var messageEl = event.target.closest(".jonaminz-chat-message");
        if (!messageEl) return;
        longPressStart = { x: event.clientX, y: event.clientY };
        longPressTimer = setTimeout(function () {
          openContextMenu(messageEl, longPressStart.x, longPressStart.y);
          longPressTimer = null;
        }, LONG_PRESS_MS);
      });
      els.thread.addEventListener("pointermove", function (event) {
        if (!longPressStart) return;
        var dx = event.clientX - longPressStart.x;
        var dy = event.clientY - longPressStart.y;
        if (Math.sqrt(dx * dx + dy * dy) > 10) cancelLongPress();
      });
      els.thread.addEventListener("pointerup", cancelLongPress);
      els.thread.addEventListener("pointercancel", cancelLongPress);

      if (els.contextMenu) {
        els.contextMenu.addEventListener("click", function (event) {
          var reactBtn = event.target.closest("[data-menu-react]");
          if (reactBtn) {
            closeContextMenu();
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
          var editBtn = event.target.closest("[data-menu-edit]");
          if (editBtn) {
            setEditTarget(editBtn.dataset.messageId, editBtn.dataset.text);
            closeContextMenu();
            return;
          }
          var deleteBtn = event.target.closest("[data-menu-delete]");
          if (deleteBtn) {
            closeContextMenu();
            if (!window.confirm("確定要刪除這則訊息嗎？")) return;
            window.JonaminzBackend.deleteChatMessage({ token: token, messageId: deleteBtn.dataset.messageId })
              .then(function () { return poll(); })
              .catch(function (error) {
                els.status.textContent = "刪除失敗：" + (error.message || String(error));
              });
          }
        });
        document.addEventListener("click", function (event) {
          if (els.contextMenu.hidden) return;
          if (event.target.closest(".jonaminz-chat-context-menu")) return;
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

      // ---- Shared 獨立瀏覽（樣板）：列出這個房間全部分享過的內容，不只
      // 未讀的——比 App 內通知面板更完整的版本，等 OneDrive 圖片分享做好
      // 之後這裡會擴充成真的獨立瀏覽畫面，這輪先做這個樣板。----
      function renderSharedListPanel() {
        if (!els.sharedListPanel) return;
        var items = Object.keys(sharedItems).map(function (id) { return sharedItems[id]; })
          .sort(function (a, b) { return new Date(b.lastSharedAt) - new Date(a.lastSharedAt); });
        if (!items.length) {
          els.sharedListPanel.innerHTML = '<div class="jonaminz-chat-notif-item is-empty">還沒有分享過的內容</div>';
          return;
        }
        els.sharedListPanel.innerHTML = items.map(function (item) {
          var seen = Boolean(item.seenState && item.seenState[identity]);
          return '<div class="jonaminz-chat-notif-item" data-shared-list-item data-item-id="' + escapeHtml(item.id) +
            '" data-item-url="' + escapeHtml(item.url) + '">' +
            (seen ? "" : "🔴 ") + escapeHtml(item.source) + " · " + escapeHtml(item.title) +
            (item.shareCount > 1 ? ' <span class="jonaminz-chat-notif-item-meta">(分享 ' + item.shareCount + ' 次)</span>' : "") +
            "</div>";
        }).join("");
      }

      if (els.sharedListToggle && els.sharedListPanel) {
        els.sharedListToggle.addEventListener("click", function (event) {
          event.stopPropagation();
          if (els.sharedListPanel.hidden) renderSharedListPanel();
          els.sharedListPanel.hidden = !els.sharedListPanel.hidden;
        });
        els.sharedListPanel.addEventListener("click", function (event) {
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
      els.input.addEventListener("focus", function () {
        setTimeout(scrollThreadToBottom, 60);
        setTimeout(scrollThreadToBottom, 320);
      });
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", scrollThreadToBottom);
      }

      els.emojiToggle.addEventListener("click", function (event) {
        event.stopPropagation();
        els.emojiPanel.hidden = !els.emojiPanel.hidden;
      });
      els.emojiPanel.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-emoji]");
        if (!btn) return;
        var start = els.input.selectionStart || els.input.value.length;
        var end = els.input.selectionEnd || els.input.value.length;
        var value = els.input.value;
        els.input.value = value.slice(0, start) + btn.dataset.emoji + value.slice(end);
        var caret = start + btn.dataset.emoji.length;
        els.input.focus();
        els.input.setSelectionRange(caret, caret);
        updateComposerAction();
        autoGrowInput();
      });
      document.addEventListener("click", function (event) {
        if (!els.emojiPanel.hidden && !event.target.closest(".jonaminz-chat-input-shell")) {
          closeEmojiPanel();
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
