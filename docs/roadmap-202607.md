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

## 順序②：平台能力拉高層級——讀條演算法 ✅ 完成（2026-07-12，已上線）

見 `AI_CONTEXT/CHANGELOG.md` 同日「待辦總表順序②」條目。已套進
jonaminz 自己的 `entry-core.js`，Playwright 驗證過平滑動畫、8 秒逾時
保底、全站 regression。skhpsv2 遷移待另開新 prompt。

把 SKHPSV2 `loading-gate.js` 的 "Runway Chase" 讀條平滑動畫演算法搬進
jonaminz（重寫、去 SKHPS 命名，不是直接複製檔案），取代 `entry-core.js`
現在陽春的「里程碑硬寫死百分比」寫法。**先套進 jonaminz 自己**（entry-core.js
用起來），驗證好用再說。skhpsv2 自己遷移過去用 jonaminz 提供的版本，是
之後的事，需要你另外開新 prompt 交辦（skhpsv2 目前是 Codex 在處理）。

---

## 順序③：平台能力拉高層級——RWD/viewport 量測層 ✅ 完成（2026-07-12，已上線）

見 `AI_CONTEXT/CHANGELOG.md` 同日「待辦總表順序③」條目。已套進
jonaminz 自己（`assets/js/layout-metrics.js`，entry-core.js shell 鏈
載入）。目前沒有頁面訂閱，機制先上線；下方「手機自動導去內部密語
登入」的設計考量仍待實作，之後接手機登入判斷邏輯時要用到這裡的
`rwdGroup`/`rwdMode`。

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

## 順序④：平台能力拉高層級——Runtime 診斷系統（重新設計）✅ 完成（2026-07-12，已驗證）

見 `AI_CONTEXT/CHANGELOG.md` 同日「待辦總表順序④」條目。新檔
`assets/js/runtime.js`：`window.JonaminzRuntime`（`log()`／
`registerModule()`／`setModuleStatus()`／`getState()`／`getModuleState()`／
`subscribe()`），跟 SKHPS 版本不同的地方就是不寫死任何子系統名稱——任何
呼叫端自己登記自己的模組名字。只做資料層＋事件，**沒有 UI**（SKHPS 那套
footer 五盞燈號診斷面板這次刻意不搬，等真的需要畫面時再設計）。

`entry-core.js` 登記 `loading-gate` 模組，把 gate 生命週期關鍵時間點
（init 開始／version.js 載完／config 解析完／css ready／shell ready／
task done/fail／all-ready／8 秒逾時保底／init 失敗）發成 log、更新模組
狀態（`ok`/`warn`/`error`）。Playwright 驗證兩條路徑都對：正常路徑全部
log 依序出現、最終狀態 `ok`；逾時路徑（故意讓 header.js 卡 9 秒）在
~8.45 秒放行、狀態正確標成 `warn` 且不被之後補到的 task 蓋掉。全程
console 零錯誤。

skhpsv2 自己遷移過去用這個版本，是之後的事，需要另開新 prompt 交辦。

---

## 順序⑤：麵包屑（等真的需要再做）

SKHPS 的 `page-map.js` 邏輯跟它的 dev/prod 網址參數纏在一起，決定不搬、
要在 jonaminz 重寫一份乾淨版本。**但現在 jonaminz 頁面層級還很淺，沒有
巢狀到需要麵包屑**——排在 Jonathan/Minz 門戶頁做出來、頁面深度真的增加
之後再動手，避免設計出沒人真的用過的東西。

---

## 順序⑥：前端品質重建計畫階段②——Jonathan/Minz 門戶頁 ✅ 完成（2026-07-12，已驗證）

見 `AI_CONTEXT/CHANGELOG.md` 同日「待辦總表順序⑥」條目、
`docs/frontend-quality-plan-202607.md` 階段②驗收清單。新增
`pages/jonathan/`（真實內容：簡介＋SKHPS 專案卡片）、`pages/minz/`
（骨架佔位頁，內容留白等本人提供）。首頁兩個 name-link 從死錨點改成
真實路徑，`pages/admin/` 移除 SKHPS 卡片（搬到 Jonathan 頁）。

**跟原計畫的差異**：原計畫「SKHPS、jonaminz-movies 也放入」Jonathan 的
專案卡片——實作時使用者當場糾正：jonaminz-movies 是 Jonathan／Minz
兩人共用的後台功能，不是 Jonathan 個人專案，已從卡片移除，不歸類在這裡
（它真正該放哪裡，之後再決定）。SKHPS 卡片改成環境感知：本機測試
（loopback，任何 port）自動連本機 `/skhpsv2/`，正式站才連
`https://skhps.jonaminz.com`——跟 OAuth `origin` 白名單同一套「loopback
不寫死單一 port」的判斷精神。

**這個完成後，順序⑤的麵包屑時機才成立**（頁面深度已經增加，但麵包屑
本身仍維持「等真的需要再做」，不因為條件成立就順便一起做）。

---

## 順序⑦：前端品質重建計畫階段③——後台首頁 Dashboard 化 ✅ 完成（2026-07-13，已驗證）

見 `AI_CONTEXT/CHANGELOG.md` 同日「待辦總表順序⑦」條目、
`docs/frontend-quality-plan-202607.md` 階段③驗收清單。`pages/admin/`
從路線佔位卡片升級成 dashboard：登入身分徽章（沿用登入頁
`.jonaminz-identity-badge` 視覺）、pending Contract 數量（跟
`pages/admin/contracts/` 同一套 `status==="pending"` 篩選邏輯，數字
保證一致）、外部專案回報清單（既有功能，未改邏輯）、Theme/Contracts
快速入口。全程沒有動 `worker.js`，純前端聚合既有的
`listPendingContracts`／`listExternalAppRegistrations`。Playwright
驗證三種情境：正常路徑（身分/pending 數量/外部專案清單都正確）、
0 筆 pending 顯示「無待審」而非空白、Worker 打不通時 pending／
registrations 兩個區塊各自顯示錯誤文字、gate 仍在 400ms 內正常放行
（背景資訊不擋頁面揭幕）。

**待辦總表①-⑦全部完成。** 下一項是順序⑧手機 App 包裝，排在 roadmap
最後、使用者已確認的下一步。

---

## 順序⑧：手機 App 包裝（2026-07-12 使用者提出，排在 roadmap 其餘項目之後）

使用者明確表態：不要 PWA（之前試過覺得「很隨便」），要至少像
`skhps-mobile-app`（同一台機器上 `SKHPS/skhps-mobile-app/`）那樣、有
安裝感的真的殼。已勘查過那個專案（讀取，沒有動它）：用 **Capacitor**
包 Android，`capacitor.config.json` 的 `server.url` 直接指到正式站網址
（`https://dev-skhps.jonaminz.com`），殼本身不帶內容、原生 WebView 載
即時網站——這代表 jonaminz 網站本身**不需要為了包 App 而改任何程式碼**，
純粹是外掛一層殼。那個專案本身停在 `npx cap add android` 剛跑完的骨架
階段（`www/index.html` 只有 29 bytes 佔位，2 個 commit，沒人接著做完），
但做法本身是驗證過可行的，不是死路。

**做法（動手時再細化，不是現在就開工）**：新開一個獨立資料夾/repo
（例如 `jonaminz-mobile-app`，跟 jonaminz 網站本身的 repo 分開——手機殼
需要 Android SDK/Gradle 工具鏈，不該混進靜態網站 repo），`npm install
@capacitor/core @capacitor/cli @capacitor/android`，`capacitor.config.json`
的 `server.url` 指到 `https://www.jonaminz.com`，`npx cap add android`，
再用 Android Studio／gradle build 出 APK。

**排序**：使用者明確要求「把整個這一個 roadmap 做完再弄」——排在順序
①-⑦全部完成之後，不要插隊。

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
