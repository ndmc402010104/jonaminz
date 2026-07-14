# Roadmap 2026-07 Phase 2 — 交接用工作清單

**寫作時點**：2026-07-14 中午，v0.23.0。上一份 `docs/roadmap-202607.md`
（順序①-⑧）已全部完成。這份是給下一棒（可能是不同模型/agent）的
待辦排序，每項都附「為什麼」跟「去哪裡看細節」。

**接手前必讀**（順序建議）：
1. `AI_CONTEXT/RULES.md` — 不可違反的規則（版本 bump、部署要問、
   時間戳查真實系統時間等）。
2. `AI_CONTEXT/PROJECT_STATE.md` §4.1/4.2 — Chat 與 Travel 現況。
3. `AI_CONTEXT/DECISIONS.md` §八 — 合約分級（功能合約 vs 視覺合約），
   2026-07-14 的核心架構裁決，後續多項工作都掛在這下面。
4. `AI_CONTEXT/CHANGELOG.md` 2026-07-14 的四條條目 — 今天發生的事。
5. `AI_CONTEXT/KNOWN_ISSUES.md` #12 — 待裁決的 capability 命名 bug。

**工作流程工具**（2026-07-14 起生效，在 repo 外的 `程式碼/.claude/`）：
- Stop hook：長計畫開跑前把步驟寫進 `程式碼/.claude/plan-progress.json`
  的 `remaining`，每完成一步移除一項，全部做完清空——中途想提前收工
  會被擋下來（已實測會擋）。
- Supabase 直連：整個 organization（jonaminz-db／skhps-db）採
  「每次操作先用 AskUserQuestion 彈窗寫明確切 SQL＋目標專案→使用者
  同意→執行」，已實測通過。claude.ai 的 Supabase MCP 連接器也已接上，
  優先考慮走它（不碰本機密碼檔）。
- wrangler deploy 照舊要先用 AskUserQuestion 問過。git push 不用問。

---

## P0 — 使用者自己的動作（agent 只需提醒，不能代勞）

- [ ] **核准 jonaminz-travel 的新 Contract snapshot**（含
  `chat.launcher@1` supports 宣告）。在 `/pages/admin/contracts/`，
  照 `docs/contract-approval-checklist.md` 走。核准後 travel 頁面
  右下角會自動出現 Chat 入口（要用登入過 jonaminz 的瀏覽器看）。
- [ ] Chat 真實兩身分互測（AT-03/04/05 的動態部分）：兩個瀏覽器
  分別登入 Jonathan/Minz 互傳，看未讀角標/已讀回條/在線點。
- [ ] 手機 APK 安裝（新 launcher icon 版，`jonaminz-mobile-app/android/
  app/build/outputs/apk/debug/app-debug.apk`）。網頁層改動不需要
  重裝 App（WebView 直連正式站）。

## P1 — 小而擋路，先做（裁決後半天內可完成）

- [ ] **修 KNOWN_ISSUES #12**：`identity.currentUser@1` 是 camelCase，
  過不了 contract schema 的 kebab-case pattern，外部專案永遠無法
  合法宣告——趁零消費者改名 `identity.current-user@1` 成本最低。
  需要使用者先拍板（修法選項寫在 KNOWN_ISSUES #12）。改名要動：
  `worker.js`＋`sdk-src/sdk.js`（重跑 generate-sdk-release.mjs、
  改 sdk-versions.json 指標）＋`integration-settings.json`＋
  wrangler deploy（問過再部署）。

## P2 — Chat 懸浮面板（半版/全版，交接包驗證過的完整 UX）

- [ ] 現況：點右下角大頭貼是「跳轉整頁 /pages/chat/」，交接包
  `DECISIONS.md`（jonaminz-chat交接包那份）定義的是三態模型：
  收合大頭貼 ⇄ 半版面板 ⇄ 全版面板（拖把手切換），聊天疊在當前
  頁面上不離開內容。參考畫面：交接包 `SOURCE/ux-mvp-v0.11/index.html`
  （用 Playwright 點 #chatLauncher／#panelHandle 可看到兩種面板態，
  2026-07-14 上午已截圖研究過）。
- **架構上路已鋪好**：launcher 已經是 iframe（`pages/chat-launcher/`），
  懸浮面板可以做成「同一個 iframe 依狀態變大」——embed 頁內部管理
  收合/半版/全版三態，postMessage 通知嵌入端調整 iframe 尺寸
  （嵌入端只改 width/height/position，聊天邏輯全部留在 embed 頁，
  外部專案自動獲得同樣功能，不用另外開發）。這就是當初選 iframe
  的延伸紅利。
- 注意：整頁版 `/pages/chat/` 保留（手機/深連結用），兩者共用
  Worker API，不要做成兩套訊息邏輯。

## P3 — 二選一（問使用者要先哪個）

- [ ] **Travel 旅行書生成**：Journey Builder 的「生成書本」面板目前
  是純說明卡（誠實標示還沒做）。這是 travel 最大的功能缺口。規格
  參考交接包 `jonaminz-travel-handoff-v1.0/`（在 travel repo 本機、
  被 gitignore，只有本機有）。
- [ ] **Chat 進階功能**：訊息反應（reaction）→ typing indicator →
  回覆（reply），交接包 schema（`chat_message_reactions` 表）已建好，
  缺 Worker action 與前端。注意交接包原本的「不准做」清單語意是
  「技術 MVP 驗證前不准」，MVP 已驗證完，解禁與否使用者說了算。

## P4 — 等條件成熟才做（不要主動開工）

- [ ] **功能合約**（header/footer/loading-gate 類）：DECISIONS §八
  39 條只裁決方向，明文「等真的有外部專案需要再定義第一批」——
  觸發條件大概是 skhpsv2 接入。
- [ ] **skhpsv2 接入（stage C）**：另一個 repo、目前 Codex 在處理，
  未經使用者明確交辦不要碰（memory 有記 2026-07-12 違規教訓）。
  接入前 P1 的 capability 改名必須先完成。
- [ ] **ADPF Theme Pack**（DECISIONS §五）：方向已裁決、零實作。
  第一個場景是 Theme 系統（`platform.theme-preset@1`），落地步驟
  在 `docs/pack-framework/README.md` §9。
- [ ] **Minz 房間 Phase 2**：分類資料仍是 mock，等「技術方案」專案
  （旅行內容管理）真的存在才有真資料可引用（DECISIONS §六 27 條的
  邊界不可違反：Minz 頁永不複製完整內容，只存來源引用）。
- [ ] **Chat polling → 真即時**：現況 3 秒 polling 是刻意的 MVP 簡化
  （交接包方案 C），長期選項是 Durable Object 或 Worker 簽發
  Supabase Realtime token。等兩人真實使用一段時間、確認 polling
  體感不夠好再動。

## 已知小債（有空順手，不排優先）

- KNOWN_ISSUES #10：admin contracts/theme/design 三頁的漸層大標
  CSS 沒接上（純視覺）。
- Chat 展示畫面的「+」按鈕是視覺佔位（附件未做）——附件屬交接包
  延後清單，不是漏做。
- `sessions`/`oauth_states` 過期列不清理（刻意取捨，見 KNOWN_ISSUES #5）。

## 陷阱備忘（重複踩過的，換模型後最容易忘）

- 前端改動＝git push 就上線；Worker 改動＝要另外 wrangler deploy
  （先問）。兩者獨立。
- push 前必 bump `version.js`（cache-buster 兼上線確認），時間戳要
  跑 `date` 查真實時間。
- OneDrive 會回滾本機編輯——大改完 grep 總盤點確認檔案沒被還原。
- 交接包中文路徑：Grep 工具的 path 參數帶中文會靜默失敗，用
  Bash grep 或先 cd。
- 沒有真 session token 測需登入頁面：用 stub JonaminzIdentity/
  JonaminzBackend 的 Playwright harness 載真 app.js（memory 有記，
  harness 記得補 `*{box-sizing:border-box}`）。
- 對話回覆一律繁體中文。
