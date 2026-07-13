# DECISIONS

以下為使用者已裁決或在 MVP 中反覆確認的規則。

## 產品定位

### Chat

- Chat 是 Jonaminz Core capability。
- 完整聊天室是 Chat System App。
- Chat 需要跨 Jonaminz 頁面與未來其他 Repo 使用。
- Chat 不應依賴 Shared、Movie 或 Travel。
- 未來可做成通用 Chat Library。

### Shared

- Shared 不是獨立外部 App。
- Shared 是 Chat 裡的共享內容模組／收件匣。
- Shared 保存外部連結與內容 reference。
- Shared 處理：
  - URL 正規化
  - 同網址去重
  - 未看／已看
  - 歷史搜尋
  - 送往其他 App
  - 綁定討論
- 後台主頁只顯示摘要，例如「你有 4 筆分享尚未看到」。

## Chat Library

第一個 instance：

```text
couple-chat
```

未來可能新增：

```text
skhps-chat
```

不同 instance：

- 共用 Chat engine
- 資料完全分離
- room 分離
- 權限分離
- Theme 分離
- 功能開關分離

## 浮動入口

- 右下角不是聊天功能圖示，而是「對方」。
- Jonathan 登入時顯示 Minz。
- Minz 登入時顯示 Jonathan。
- MVP 用 `M`／`J`。
- 正式版改成照片。
- 頭像一直保留。
- 點同一顆頭像負責展開／收合。
- 未讀 badge 掛在對方頭像。

## 視窗狀態

只保留：

1. 頭像收合
2. 半版聊天
3. 全版聊天

移除：

- 小型聊天面板
- 標題列 `—`
- 標題列 `×`

半版／全版切換可用上方 handle，不要在右上角堆工具。

## Header

- 日常右上角只留電話。
- 視訊與資訊不先顯示。
- 未來真的有 call provider 才由功能設定開啟視訊。
- 功能性圖示用固定 SVG，不用平台 Emoji。
- 正式 Android 可評估直接撥號。
- Technical MVP 第一階段不做電話。

## 訊息與大頭貼

- 對方訊息顯示對方大頭貼。
- 連續訊息不需要每一則重複顯示。
- 自己訊息不重複顯示自己的頭貼。
- 對方小頭貼可作為 read receipt，表示讀到哪裡。
- 桌機 hover 訊息顯示：
  - reaction
  - reply
  - more
- 手機長按訊息開 reaction tray。
- Reaction tray 應貼著訊息，不可跑到畫面底部。
- 每位使用者對每則訊息保留一個 reaction，可更換或取消。

## Composer

結構：

```text
[＋] [文字輸入＋emoji] [快速心情／送出]
```

- 輸入框空白：
  - 最右側是 quick reaction
- 輸入文字：
  - 同一按鈕變成 send
- 長按 quick reaction：
  - 更換預設符號
- Emoji 是文字插入功能。
- Emoji 可以一次連續插入多個。
- Emoji 插入目前游標位置。
- Emoji picker 點外面或再按一次才關閉。
- Sticker 是獨立訊息內容。
- Sticker 放進 `＋` 選單。
- 「正在回覆／正在討論」必須放在輸入框正上方。

## Seen / Unread

### Shared item

- 卡片出現在畫面不算看過。
- 只有明確點進內容才算已看。
- 點討論或開啟原始內容也可視為進入該內容。
- 未看顯示小紅點。
- 已看只移除紅點。
- 已看不能整張變灰。
- 可標回未看。

### Shared filters

必須可按：

- 你尚未看到
- 對方尚未看到
- 尚未一起看到
- 全部分享

### Shared sort

「全部分享」：

- 最近實際看過的放最上面。
- 目的是剛看完想到事情時能立刻找回。
- 可記錄 `last_viewed_at`。
- 未看過者再依最近分享時間排序。

### Chat unread/read

需要支援：

- 真正未讀訊息數
- 未讀分隔線
- last read message
- read receipt avatar
- 最後訊息時間
- typing indicator

## URL 去重

- 只做 exact／normalized URL 去重。
- 不做 AI 語意判斷。
- 不阻止重複分享。
- 重複時合併：
  - 分享者
  - 分享次數
  - 最新附言
  - 最近分享時間
- 常見 tracking query 可移除。

## 送往其他 App

- 不得把 Movie、Travel 等目的地固定攤成一排按鈕。
- Shared 卡片只保留一個 `送往…`。
- 目的地由 registry 註冊。
- 目的地增加時卡片高度不可一直增加。
- 目的地選擇器可搜尋。

## 實作順序

現在停止畫面雕刻。

第一個真實 Technical MVP 只驗證：

1. 真實 identity
2. 真實文字訊息
3. 即時同步
4. 未讀
5. 已讀
6. typing
7. reaction

暫不做：

- OneDrive
- Google Drive
- 圖片附件
- Shared 正式資料
- Movie／Travel 寫入
- 電話
- Android floating overlay
- Push notification
