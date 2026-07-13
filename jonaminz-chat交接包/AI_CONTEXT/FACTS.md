# FACTS

以下只記已確認事實，不混入推測。

## 專案與 Repo

- 正式 Repo：`ndmc402010104/jonaminz`
- Jonaminz 是 Jonathan 與 Minz 的 shared-first couple digital home。
- 公開身分頁可以分流，但登入後私人空間是共同空間。
- 外部專案標準接入模型為：
  - `jonaminz.contract.json`
  - `jonaminz-entry.js`
  - Platform 控制授權與 placement
- 目前前端以 GitHub Pages／靜態原生 JS 為主。
- 後端是 Cloudflare Worker＋Supabase。
- 使用者偏好持續專案都維護結構化 AI_CONTEXT 紀錄。

## 現有登入與安全模型

從正式 Repo 已確認：

- 身分只有 `jonathan`、`minz` 兩個固定 identity。
- 登入成功會建立 Supabase `sessions` row。
- Session token 存在瀏覽器 `localStorage`：
  - key：`jonaminz.sessionToken`
- 前端呼叫既有 Cloudflare Worker 的 `/api/action`。
- Worker 驗證 session 後，以 Supabase secret/service-role 存取資料。
- Supabase secret 不放前端。
- Google OAuth 已支援網頁與 Capacitor deep link。
- 現有 Android Capacitor App 殼已能運作。

## 使用情境

Jonathan 與 Minz：

- 都使用 Android。
- 喜歡 Messenger 的 floating chat head。
- 不喜歡為了聊天離開目前正在使用的 App。
- 常從 Instagram、Threads、Messenger、YouTube 等分享內容。
- 核心痛點：
  - 不知道對方有沒有真的點進去
  - 重複分享
  - 舊內容找不到
  - 不知道先看什麼
- 分享通常只是希望對方看到與回應，不是待辦。

## 儲存

- 兩人都有 Microsoft 365，各有 OneDrive 1TB。
- 約九成既有檔案在 OneDrive。
- Google Drive 是後來因 Gemini 訂閱增加的第二空間。
- OneDrive 應作主要 Provider。
- Google Drive 作第二 Provider。
- Supabase 不應保存大型檔案本體，只存 metadata/reference。
- Technical Chat MVP 第一階段不做檔案串接。

## 原型狀態

- UX 原型最後版本：`v0.11`
- Technical MVP 草案：`0.1`
- 使用者回報 Technical MVP「失敗」。
- 目前沒有具體失敗 log，因此根因未知。
