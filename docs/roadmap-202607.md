# jonaminz 待辦總表（2026-07-12 彙整）

彙整這一輪對話裡所有還沒做完的事，排出執行順序。之前的
`docs/frontend-quality-plan-202607.md`（前端品質重建計畫）內容仍然有效，
這份文件是把它跟後續冒出來的新任務（平台能力拉高層級、OAuth 本機導頁）
放在一起排序，不重複抄內容。

---

## 順序①：Google OAuth 本機導頁修復 ✅ 完成（2026-07-12，已部署）

見 `AI_CONTEXT/CHANGELOG.md` 同日「待辦總表順序①」條目。核心邏輯（白
名單驗證、資料流）已直連 DB 驗證過；Google 同意畫面那段需要使用者自己
在 `localhost:5500` 實際點一次確認能正常導回本機。

**現況**：`worker.js` 的 `handleGoogleCallback` 最後導回的網址寫死
`https://www.jonaminz.com/`，不管從哪裡發起登入都會被導去正式站，本機
`localhost:5500` 測不了 Google OAuth 這條路（內部密語登入不受影響，純
POST 沒有導頁問題）。

**做法**：把發起登入的來源存進 `oauth_states` 表跟著走一趟，`callback`
讀出來後導回原本那個來源，**限制在白名單**（只認
`https://www.jonaminz.com` 跟 `http://localhost:5500`，避免變成開放式
重導向——任何人都能把登入 token 導到自己網域的漏洞，跟登入頁 `?next=`
參數當初的防護是同一種風險）。

**範圍**：改 `worker.js`（`handleGoogleStart`／`handleGoogleCallback`／
`oauth_states` 用法），需要 `wrangler deploy`（部署前照規矩先問）。

---

## 順序②：平台能力拉高層級——讀條演算法

把 SKHPSV2 `loading-gate.js` 的 "Runway Chase" 讀條平滑動畫演算法搬進
jonaminz（重寫、去 SKHPS 命名，不是直接複製檔案），取代 `entry-core.js`
現在陽春的「里程碑硬寫死百分比」寫法。**先套進 jonaminz 自己**（entry-core.js
用起來），驗證好用再說。skhpsv2 自己遷移過去用 jonaminz 提供的版本，是
之後的事，需要你另外開新 prompt 交辦（skhpsv2 目前是 Codex 在處理）。

---

## 順序③：平台能力拉高層級——RWD/viewport 量測層

把 `layout-metrics.js` 的量測邏輯（layoutWidth/Height、orientation、RWD
mode/group、header/footer 邊界、可用內容區）搬進 jonaminz，補上
`config.json` 裡 `layout.rwd.groups` 現在有宣告但沒有 JS 真的在用的洞。
一樣先套進 jonaminz 自己，skhpsv2 遷移待另外交辦。

**順手要一併考慮的設計點（2026-07-12 使用者提出）**：手機用區網 IP
（例如 `192.168.1.101:5500`）測本機開發時，Google OAuth 的
`ALLOWED_OAUTH_RETURN_ORIGINS`／loopback 白名單機制不會放行（區網 IP
跟 loopback 不是同一個安全等級，見 `AI_CONTEXT/CHANGELOG.md` 對應日期
條目），使用者裁決先不處理、等這個 RWD/裝置辨識系統做出來後，考慮
在登入頁「偵測到是手機裝置就自動導去內部密語登入、跳過 Google
OAuth」——手機用戶反正也比較常用密語登入，這樣可以順帶繞開 LAN IP
導頁的問題，不用真的放行區網 IP 白名單。這不是這個 RWD 量測層本身的
需求，是它做出來之後可以順便解決的一個週邊問題，動手時記得考慮進去。

---

## 順序④：平台能力拉高層級——Runtime 診斷系統（重新設計）

**這個不是直接搬**——SKHPS 的 `runtime.js` 把五個子系統名稱
（config/backend/css/externalApps/loadingGate）寫死在 API 裡
（`setConfig()`／`setBackend()`／`setCssRuntime()`…），要先重新設計成
可插拔（`registerModule(name, {deriveStatus})`）才能給不同專案登記自己
的模組用，不是改名字就好。底層的 log/task done/fail 核心是通用的，可以
沿用邏輯但要重寫外層 API。排在②③之後是因為它的天職是「觀測其他系統」，
先有東西可觀測比較合理。

---

## 順序⑤：麵包屑（等真的需要再做）

SKHPS 的 `page-map.js` 邏輯跟它的 dev/prod 網址參數纏在一起，決定不搬、
要在 jonaminz 重寫一份乾淨版本。**但現在 jonaminz 頁面層級還很淺，沒有
巢狀到需要麵包屑**——排在 Jonathan/Minz 門戶頁做出來、頁面深度真的增加
之後再動手，避免設計出沒人真的用過的東西。

---

## 順序⑥：前端品質重建計畫階段②——Jonathan/Minz 門戶頁

見 `docs/frontend-quality-plan-202607.md` 階段②。首頁兩個 name-link 變
真頁面，SKHPS 連結從後台搬過去。需要你提供 Jonathan 的簡介文字/照片
（沒有可以先佔位）。**這個完成後，順序⑤的麵包屑時機才成立。**

---

## 順序⑦：前端品質重建計畫階段③——後台首頁 Dashboard 化

見 `docs/frontend-quality-plan-202607.md` 階段③。pending Contract 數量、
外部專案回報狀態、登入身分徽章、快速入口。都用既有 Worker action，不用
動後端。

---

## 排在後面、需要你另開新 prompt 才會動的（不主動排入）

- **skhpsv2 遷移**：讀條演算法／RWD 量測層／Runtime 診斷實際換成
  jonaminz 提供的版本、刪掉 skhpsv2 自己那份重複的程式碼。目前是 Codex
  的地盤，等你交辦。
- **identity.currentUser@1 階段 C**：真的把身分能力接進 skhpsv2 顯示
  「OO你好」。同上，等你交辦。
- **skhpsv2 開放註冊系統**：給科內同事用，完全是 skhpsv2 自己的工作
  範圍，跟 jonaminz 無關。

## 懸而未決、不是任務、只是還沒拍板的問題

- **jonaminz 自己要不要開放註冊**（給 Jonathan/Minz 以外的人）：你自己
  也還沒想清楚，現在沒有對應功能情境，不用先設計。
- **首頁封面照片要不要換掉**：目前用「縮小＋固定比例」解決了 RWD 問題，
  沒有新照片可換，你之後有新照片再說。

## 已知但刻意不修的小事

- `favicon.ico` 缺失，瀏覽器自動要會 404，不影響功能。想補的話告訴我。
- `docs/contract-schema/README.md` 的「進 Worker 前 release checklist」
  （schema `$id` 正式發布）：implementation plan 第 1 項當時留下的唯一
  未收尾項目，不擋任何後續工作，優先度最低。
