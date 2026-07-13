# Manual Test

## 本機雙分頁

1. 執行 `run-local.bat`。
2. Jonathan 頁按「開啟另一個身分」。
3. Minz 分頁出現。

### 測試 A：訊息

- Jonathan 發「測試 1」。
- Minz 不刷新即看到。
- 重新整理兩個分頁，訊息仍存在。

### 測試 B：typing

- Jonathan 在輸入框打字但不送出。
- Minz 顯示「對方輸入中」。
- 停止輸入約 1.4 秒後消失。

### 測試 C：未讀／已讀

- Minz 收合或停在不捲到底的位置。
- Jonathan 發新訊息。
- Minz 未讀數增加。
- Minz 捲動訊息區，約 900ms 後 mark read。
- Jonathan 的「對方已讀」更新。

### 測試 D：reaction

- Minz 對 Jonathan 的訊息按 ❤️。
- Jonathan 不刷新即看到數量。
- Minz 改按 😂，原 ❤️ 應被替換，不是新增第二個自己的 reaction。

### 測試 E：防重

在 DevTools 執行兩次相同 clientMessageId 的 adapter send；
local adapter 與正式 Worker 都應只保存一則。

## 正式兩裝置

正式整合後，使用 Jonathan 與 Minz 各自 Google 登入：

- Android App + desktop
- Android App + Android App
- Wi-Fi ↔ 行動網路切換
- App 進背景 2 分鐘後回前景
- Worker deploy/restart 後 reconnect
