# Jonaminz Chat Core × Shared MVP 架構決策

版本：MVP 0.11  
日期：2026-07-13  
狀態：概念驗證，尚未接正式 Supabase、Microsoft Graph、Android Bubble 或現有 Jonaminz Core。

---

## 1. 本輪定案

### Chat 是 Jonaminz 核心能力

Chat 不屬於單一外部專案。它必須跨越整個 Jonaminz App，並在 Movie、Travel、Shared、後台與未來專案中隨時可用。

核心應包含：

- Chat Service：訊息、回覆、反應、已讀、未讀與附件 reference。
- Chat Shell：App 內右下角浮動聊天圈圈與迷你聊天視窗。
- Chat SDK：外部專案呼叫 `open()`、`sendText()`、`shareCurrentContext()`、`captureCurrentView()`。
- Android Bridge：Notification Bubble、Overlay Chat Head、推播與原生畫面擷取。
- File Core 介面：聊天只取得 `fileRef`，不直接處理 OneDrive 或 Google Drive 細節。

### 完整 Chat 是 System App

完整聊天頁可以存在於 Jonaminz 中，負責：

- 完整歷史
- 搜尋
- 圖片與文件
- 貼圖
- 對話設定
- 共享內容討論

它與浮動聊天窗使用相同 Chat Service。

### Shared 是外部專案

Shared 處理：

- URL 分享
- URL 正規化
- 相同網址去重與合併
- 兩人是否已看到
- 尚未兩人都看到的內容
- 歷史搜尋
- 傳送到 Movie、Travel 或其他專案
- Android Share Target 的外部內容入口

Chat Core 不依賴 Shared；Shared 依賴 Chat Core。

---

## 2. 正確依賴方向

```text
Shared ───────┐
Movie ────────┤
Travel ───────┼──▶ Chat SDK ─▶ Chat Core
其他專案 ─────┘

Chat Core ✕ 不反向依賴 Shared / Movie / Travel
```

外部專案傳送通用 reference：

```json
{
  "type": "content_ref",
  "appId": "movie",
  "entityId": "movie-123",
  "title": "Perfect Days",
  "deepLink": "jonaminz://movie/movie-123"
}
```

Chat Core 只保存 reference 與呈現必要的 snapshot，不把外部專案資料結構寫死。

---

## 3. 「已看到」規則

本產品不是待辦系統，不要求使用者處理每一筆分享。

UI 用詞：

- 尚未看到
- 已看到
- 標回未看

自動判斷：

```text
分享卡進入可見範圍至少 72%
並停留約 1 秒
→ 將目前使用者標記為已看到
```

此狀態只表示使用者注意到這筆分享存在，不宣稱已完整看完影片。

---

## 4. URL 去重

MVP 只做網址層級去重，不做 AI 語意判斷。

正規化包含：

- hostname 轉小寫
- 移除 hash
- 移除尾端多餘 `/`
- 移除常見追蹤參數：
  - `utm_*`
  - `igsh`
  - `igshid`
  - `fbclid`
  - `gclid`

偵測重複時：

- 不阻止分享
- 不建立第二筆內容
- 合併分享者與分享次數
- 更新附言
- 推回 Shared 最上方
- 顯示「你們都分享過」

---

## 5. File Core 與儲存策略

### OneDrive 是主要 Provider

理由：

- 目前約九成既有檔案位於 OneDrive。
- 兩人已形成 OneDrive / Microsoft 365 使用習慣。
- Office 文件整合自然。
- 不需要先搬遷資料。

### Google Drive 是第二 Provider

用途：

- 未來容量擴充
- 大型共同媒體
- 特定服務整合
- OneDrive 效能或限制不足時切換

### Supabase 不存大型檔案本體

Supabase 保存：

- chat message
- shared content
- provider
- drive ID / item ID
- owner
- MIME type
- size
- version / etag
- permission snapshot
- upload status

OneDrive / Google Drive 保存檔案本體。

---

## 6. 聊天附件的樂觀流程

```text
使用者選檔
→ App 立即顯示本機預覽
→ Supabase 建立 pending message
→ 背景上傳 OneDrive
→ 成功後寫回 provider_item_id
→ 對方取得可用檔案 reference
```

OneDrive 的延遲不能阻塞聊天 UI。

---

## 7. 畫面分享

分為兩種：

### Share Current Context

外部專案註冊正式 context：

```js
Jonaminz.chat.registerContext({
  appId: "movie",
  entityId: "movie-123",
  title: "Perfect Days",
  deepLink: "jonaminz://movie/movie-123"
});
```

優點：

- 可搜尋
- 可重新開啟
- 不依賴截圖
- 資料意義完整

### Capture Current View

擷取目前可見畫面，並附帶：

- appId
- pageId
- entityId
- deepLink
- scroll position
- capture time

正式 Android App 可透過 Capacitor local plugin 串接原生擷取。  
MVP 只生成模擬畫面卡片，未擷取其他 App。

---

## 8. Android 長期目標

### App 內

- 全站右下角聊天圈圈
- 邊滑內容邊聊天
- 分享目前內容
- 截取目前 Jonaminz 畫面

### App 外

- Android Notification Bubble
- 可選的 Overlay Chat Head
- Android Share Target
- Foreground Service（僅進階常駐泡泡需要）
- MediaProjection（擷取其他 App 畫面時需系統授權）

---

## 9. MVP 已實作

`index.html` 為單檔、零依賴 prototype，包含：

- 右下角全站浮動 Chat Shell
- 一般聊天
- 貼圖示意
- 傳送目前頁面
- 建立畫面截取卡片
- OneDrive / Google Drive Provider 選擇示意
- Shared 未一起看到清單
- 進入視野 1 秒自動標為已看到
- 標回未看
- URL 正規化與相同網址合併
- 雙方都分享過提示
- 表情反應
- 送往 Movie / Travel
- 身分切換模擬 Jonathan / Minz
- localStorage 保存 Demo 狀態
- Linen / Night Theme tokens

---

## 10. MVP 未實作

- 真實 Supabase
- Supabase Realtime
- RLS
- Microsoft OAuth
- Microsoft Graph
- 真實 OneDrive 檔案選擇器與上傳
- Google Drive API
- Android Notification Bubble
- Android Overlay
- Android Share Target
- 真實截圖
- Push notification
- 現有 Jonaminz entry / contract / capability 接入
- 真實 Movie / Travel repo 寫入

---

## 11. 正式實作建議順序

1. 將 MVP UX 驗收並修正。
2. 建立 Chat Core 資料模型與 RLS。
3. 完成兩人文字聊天與 Supabase Realtime。
4. 把浮動 Chat Shell 接入現有 Jonaminz Core。
5. 建立 `chat.*@1` additive capability。
6. 完成 Shared 外部專案的 URL 模型與去重。
7. 接 Android Share Target。
8. 接 OneDrive OAuth / Graph prototype，先測 300 KB、5 MB、20 MB。
9. 接 File Core 與樂觀上傳。
10. 接 Android Bubble。
11. 最後才做 Overlay Chat Head 與外部 App 畫面擷取。

---

## 12. 不可破壞的原則

- Chat Core 不依賴 Shared。
- 外部專案不能各自實作一套聊天。
- 圖片與文件本體不放 Postgres。
- Chat 不直接綁死 OneDrive。
- Share Current Context 優先於截圖。
- URL 重複只合併，不阻止。
- 「已看到」不是「已看完」。
- 第一版不使用 AI 自動分類。


---

## 13. v0.2 UX 裁決

- `Share Current Context` 只屬於 Chat Shell，不在內容頁面額外放按鈕。
- Shared 清單必須自然依內容高度排列，不可為填滿面板而壓縮卡片。
- 自動「已看到」只能在 Shared 分頁可見時啟用，避免背景或錯誤版面觸發。


---

## 14. v0.3 UX 裁決

- 展開 Chat Shell 時隱藏 Launcher；最小化後才恢復。
- Chat Shell 支援小／中／大三段高度，快速回覆不必佔滿畫面。
- Shared 在聊天內保留摘要入口，但仍維持獨立內容整理介面。
- Shared 預設使用緊湊橫式卡片，避免內容量增加後每屏只能看到一筆。
- 卡片表面只保留高頻回應；分類、未看、開啟原文與封存放入 overflow menu。
- Composer 使用單一 `＋` 入口；`Share Current Context` 優先於 screenshot。
- Shared discussion 必須保留 thread binding，避免「這個」失去上下文。
- 自動 seen 需同時考慮可見比例、停留、視窗焦點與滑動速度。


---

## 15. v0.4 UX 與通話裁決

- Chat Launcher 在面板展開時仍應保留，同一按鈕負責展開／縮小。
- Shared 數量卡不是純資訊，必須直接作為內容篩選器。
- `seen` 只代表閱讀狀態，不應改變內容價值；已看卡片不可整張變灰。
- 目前使用者尚未看到的卡片使用小紅點提示，看到後移除紅點。
- Chat Core 提供 `callPeer()` capability。
- Android 正式版可透過 Capacitor local plugin 呼叫原生 `ACTION_CALL`，並請求 `CALL_PHONE` runtime permission。
- 為避免誤觸，可保留 Jonaminz 自己的簡短確認層，但不跳轉至系統電話 App。
- Web/PWA fallback 使用 `ACTION_DIAL` / `tel:`，會進入系統撥號介面，無法達成同等體驗。


---

## 16. v0.5 Seen 定義修正

- 卡片出現在畫面中不代表使用者真的看過。
- 取消 IntersectionObserver 與停留秒數自動 seen。
- `seen` 只在以下行為發生時成立：
  1. 點進 Shared item 詳細預覽；
  2. 點「討論」進入此 item 的 thread；
  3. 點「開啟原始內容」。
- 使用者仍可手動標回未看。
- 未看紅點必須維持到上述明確互動發生為止。


---

## 17. v0.6 Chat Launcher 身分語意

- Chat Launcher 不是一般功能按鈕，而是「對方的存在」。
- Launcher 必須持續顯示對方 avatar，不因聊天面板展開而切換成 `—`、`×` 或聊天圖示。
- Jonathan 登入時顯示 Minz；Minz 登入時顯示 Jonathan。
- 未讀 badge 屬於對方 avatar。
- 同一個 avatar 點擊負責展開／縮小 Chat Shell。
- MVP 使用 `M`／`J` 字母；正式版改接聯絡人照片 URL。


---

## 18. v0.7 視窗狀態與 Chat Library 裁決

### 視窗狀態

僅保留：

1. Avatar：收合狀態。
2. Half：日常快速聊天，不完全遮住目前頁面。
3. Full：完整 Chat System App，用於搜尋、Shared、檔案與歷史。

移除：

- Small panel
- Header minimize button
- Header close button

Avatar 是唯一收合控制；`⛶` 僅切換 Half / Full。

### Chat Library

Chat 不寫死為 Jonathan / Minz 單一頁面，而是可重複掛載的工具：

```js
Jonaminz.chat.mount({
  instanceId: "couple-chat",
  appId: "jonaminz",
  roomId: "jonathan-minz",
  participants: ["jonathan", "minz"],
  features: ["text", "files", "shared-content", "call"]
});
```

未來 SKHPSv2 可建立自己的 instance：

```js
Jonaminz.chat.mount({
  instanceId: "skhps-chat",
  appId: "skhpsv2",
  roomId: "plastic-surgery-work",
  participants: ["authorized-staff"],
  features: ["text", "files"]
});
```

不同 instance 共用 Chat Core，但資料、權限、Theme、room 與功能開關完全分離。


---

## 19. v0.8 Avatar-centric Mobile Chat

手機版 Chat System App 的主要識別不是工具列，而是對方 avatar。

### Avatar 職責

- Floating avatar：展開／收合入口與未讀 badge。
- Header avatar：身份、狀態與聯絡入口。
- Message avatar：辨識對方訊息群組。
- Read-receipt avatar：表示對方已讀到哪一則自己的訊息。

### 訊息群組

同一 sender 的連續訊息視為一組：

- 中間訊息保留 avatar slot，但不重複畫 avatar。
- 該組最後一則顯示對方 avatar。
- 自己的訊息不重複顯示自己的 avatar。

### 手機全版

手機全版使用 Chat 自己的 Theme tokens：

- 黑色沉浸背景
- 固定 header
- 固定 composer
- 訊息流獨立捲動
- 不修改宿主頁面的 Theme

在線圓點與已讀 avatar 在 MVP 為視覺模擬；正式版必須由 Realtime presence / receipt 資料驅動。


---

## 20. v0.9 Composer、Reaction 與 Destination Registry

### Header

日常 Header 只顯示電話。視訊屬於 optional call provider；未設定 provider 時不可占用 UI。

Half / Full 使用頂部 sheet handle 切換，不再放在聯絡按鈕區。

### Composer

```text
[＋] [文字輸入] [貼圖] [快速心情／送出]
```

- 輸入框空白：最後一顆是使用者選定的 quick reaction。
- 輸入框有文字：同一顆按鈕切換成 Send。
- 長按 quick reaction：變更預設符號。
- Sticker 是內容插入工具，不是固定愛心按鈕。

### Message Reactions

長按任何文字訊息、貼圖或內容卡片，開啟 reaction tray。每位使用者對每則訊息保留一個 reaction，可更換或取消。

### Shared Destination

Shared item 不直接長出 Movie、Travel 等固定按鈕。所有目的地由 registry 提供：

```js
destinationRegistry = [
  { id: "movie", label: "Movie", icon: "🎬" },
  { id: "travel", label: "Travel", icon: "✈" }
];
```

卡片只保留單一 `送往…`，目的地數量增加不影響卡片高度。


---

## 21. v0.10 Realtime Interaction Model

### Typing

`typing_start` / `typing_stop` 是短暫事件，不寫入聊天歷史。正式版使用 Supabase Realtime Broadcast；輸入停止約 1–2 秒後送出 stop。

### Presence

在線／離線與目前房間屬低頻狀態，使用 Realtime Presence。

### Unread / Read

持久化每位成員在每個 room 的 `last_read_message_id`：

```text
chat_room_members
- room_id
- user_id
- last_read_message_id
- last_read_at
```

未讀數由「last_read 之後、sender 不是自己」的訊息計算。對方讀到哪裡以 avatar receipt 呈現。DB 更新後可透過 Postgres Changes 或 Broadcast 通知另一端。

### Shared recency

Shared item 分開保存：

- `shared_at`：最近一次被分享時間
- `last_viewed_at`：目前使用者最後一次真正點開時間

「全部分享」先依 `last_viewed_at DESC`，尚未看過者再依 `shared_at DESC`。


---

## 22. v0.11 Composer Context 與固定圖示

### Emoji picker

Emoji picker 是文字編輯工具，不是單次選擇對話框。選擇 emoji 後維持開啟，直到：

- 再按一次 emoji 按鈕；
- 點擊面板外；
- 打開其他 composer panel。

### Composer context

`replyTarget` 與 `activeThread` 的 banner 必須緊鄰文字輸入框上方，避免使用者輸入時失去目前回覆／討論的上下文。

### Stable icons

功能圖示不可使用平台 Emoji 作為唯一視覺，因為 Android、Windows、瀏覽器與 Emoji font 會產生不同造型。電話等固定功能採 inline SVG；表情內容才使用 Emoji。
