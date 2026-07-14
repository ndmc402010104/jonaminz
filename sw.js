/*
檔案位置：jonaminz/sw.js
用途：Jonaminz Chat 真推播通知用的 Service Worker。刻意放在網站根目錄
（不是放在 pages/chat 系列頁面資料夾底下）——Service Worker 的預設
scope 是它自己所在的目錄，放根目錄才能收到「不論使用者現在在站內哪一頁」
都送得出去的推播（使用者可能在 pages/chat/ 之外的任何頁面收到訊息推播）。

只做兩件事：收到 push 事件時顯示系統通知、使用者點通知時把焦點帶回
（或開啟）Chat 頁面。不處理離線快取／背景同步等 PWA 的其他能力——這個
專案沒有要做完整 PWA，只是借用 Service Worker 是 Web Push 的必要條件
這件事。
*/
"use strict";

self.addEventListener("push", function (event) {
  var data = { title: "Jonaminz Chat", body: "有新訊息", tag: "jonaminz-chat" };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch (error) {
    // 收到的 payload 不是 JSON 就用預設文字，不讓整個通知失敗。
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/assets/img/favicon-180.png",
      renotify: false
    }).catch(function () {})
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i += 1) {
        if ("focus" in clientList[i]) return clientList[i].focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/pages/chat/");
    })
  );
});
