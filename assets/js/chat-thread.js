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

  var POLL_INTERVAL_MS = 3000;
  var PRESENCE_WINDOW_MS = 5 * 60 * 1000;
  var IDENTITY_LABEL = { jonathan: "Jonathan", minz: "Minz" };
  var QUICK_REACTION = "👍";
  var EMOJI_SET = [
    "😀", "😂", "😍", "😘",
    "😢", "😭", "😎", "🥰",
    "👍", "👌", "🙏", "👏",
    "❤️", "🔥", "🎉", "😱"
  ];

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
    var els = {};

    function maybeMarkRead() {
      if (!isVisible) return;
      if (!lastMessageId || lastMessageId === lastReadMarkedId) return;
      lastReadMarkedId = lastMessageId;
      window.JonaminzBackend.markChatRead({ token: token, messageId: lastMessageId }).catch(function () {});
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
      els.peerStatus.textContent = lastMessage ? "最後訊息 " + formatTime(lastMessage.created_at) : "還沒有訊息";

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
    }

    function render(data) {
      identity = data.identity;
      renderHead(data);

      var messages = data.messages || [];
      var readState = data.readState || {};
      sharedItems = data.sharedItems || {};
      var myRead = readState[identity] || {};
      var otherRead = readState[otherIdentity()] || {};

      if (!messages.length) {
        els.thread.innerHTML = '<p class="jonaminz-chat-empty">還沒有訊息，說句話開始吧。</p>';
        return;
      }

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
      var lastTimeLabel = "";
      var dividerInserted = firstUnreadIndex < 0; // 沒有已讀紀錄或沒有對方的未讀訊息就不畫分隔線

      messages.forEach(function (m, index) {
        var mine = m.sender_identity === identity;
        var timeLabel = formatTime(m.created_at);
        if (timeLabel && timeLabel !== lastTimeLabel) {
          html += '<div class="jonaminz-chat-time-divider">' + escapeHtml(timeLabel) + "</div>";
          lastTimeLabel = timeLabel;
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

        var bodyHtml;
        if (m.kind === "shared_item" && m.shared_item_id && sharedItems[m.shared_item_id]) {
          var item = sharedItems[m.shared_item_id];
          var viewerSeen = Boolean(item.seenState && item.seenState[identity]);
          bodyHtml =
            '<div class="jonaminz-chat-shared-card' + (viewerSeen ? "" : " is-unseen") + '" ' +
            'data-shared-card data-item-id="' + escapeHtml(item.id) + '" ' +
            'data-item-url="' + escapeHtml(item.url) + '">' +
            '<div class="jonaminz-chat-shared-card-source">' + escapeHtml(item.source) + "</div>" +
            '<div class="jonaminz-chat-shared-card-title">' + escapeHtml(item.title) + "</div>" +
            (viewerSeen ? "" : '<div class="jonaminz-chat-shared-card-unseen">尚未查看</div>') +
            '<button type="button" class="jonaminz-chat-shared-card-discuss" data-discuss-btn ' +
            'data-item-id="' + escapeHtml(item.id) + '" data-item-title="' + escapeHtml(item.title) + '">討論</button>' +
            "</div>";
        } else {
          bodyHtml = '<div class="jonaminz-chat-bubble">' + escapeHtml(m.body) + "</div>";
        }

        html +=
          '<div class="jonaminz-chat-message" data-mine="' + mine + '">' +
          avatarHtml +
          bodyHtml +
          "</div>";

        if (readByOther) {
          html +=
            '<div class="jonaminz-chat-read-receipt"><div class="jonaminz-chat-message-avatar is-tiny">' +
            escapeHtml(initialOf(otherIdentity())) + "</div></div>";
        }
      });

      var wasNearBottom = els.thread.scrollHeight - els.thread.scrollTop - els.thread.clientHeight < 80;
      els.thread.innerHTML = html;
      if (wasNearBottom || !lastMessageId) els.thread.scrollTop = els.thread.scrollHeight;

      var newestId = messages[messages.length - 1].id;
      if (newestId !== lastMessageId) {
        lastMessageId = newestId;
      }
      // 2026-07-14：面板 iframe 現在跟大頭貼同時建立、background 一直在
      // poll（見第七次修正），所以「render() 被呼叫過」不再等於「使用者
      // 真的有看到」——面板收合在背景時一樣會 poll/render，不能在這時候
      // 就標記已讀。已讀只在 isVisible 為真（面板真的展開，或整頁版一律
      // 視為可見）時才觸發，見 maybeMarkRead()／mount() 的 visibility
      // 訊息處理。
      maybeMarkRead();
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

    function doSendText(body) {
      if (!body || sending) return;
      sending = true;
      els.action.disabled = true;
      var clientMessageId = identity + "-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      var sendPayload = { token: token, body: body, clientMessageId: clientMessageId };
      if (activeSharedItemId) sendPayload.sharedItemId = activeSharedItemId;
      window.JonaminzBackend.sendChatMessage(sendPayload)
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

    function buildUI() {
      var plusButtonHtml = inPanel
        ? '<button type="button" class="jonaminz-chat-plus-btn" data-plus ' +
          'aria-label="更多功能" aria-haspopup="true">+</button>' +
          '<div class="jonaminz-chat-plus-panel" data-plus-panel hidden>' +
          '<button type="button" data-share-current>分享目前內容</button>' +
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
        "</section>" +
        '<div class="jonaminz-chat-thread" data-thread><p class="jonaminz-chat-empty">載入中...</p></div>' +
        '<div class="jonaminz-chat-discuss-banner" data-discuss-banner hidden>' +
        '<span data-discuss-title></span>' +
        '<button type="button" data-discuss-clear aria-label="取消討論">✕</button>' +
        "</div>" +
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
        '<p class="jonaminz-chat-status-line" data-page-status></p>';

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
        document.addEventListener("click", function (event) {
          if (!els.plusPanel.hidden && !event.target.closest(".jonaminz-chat-plus-wrap")) {
            closePlusPanel();
          }
        });
      }

      els.thread.addEventListener("click", function (event) {
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
        }
      });

      if (els.discussBanner) {
        els.discussBanner.addEventListener("click", function (event) {
          if (event.target.closest("[data-discuss-clear]")) setDiscussTarget(null, "");
        });
      }

      els.action.addEventListener("click", function () {
        var body = els.input.value.trim();
        if (body) {
          els.input.value = "";
          updateComposerAction();
          doSendText(body);
        } else {
          doSendText(QUICK_REACTION);
        }
      });

      els.input.addEventListener("input", updateComposerAction);
      els.input.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          els.action.click();
        }
      });

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

    return {
      destroy: function () {
        destroyed = true;
        if (pollTimer) clearInterval(pollTimer);
      }
    };
  }

  window.JonaminzChatThread = { mount: mount };
})();
