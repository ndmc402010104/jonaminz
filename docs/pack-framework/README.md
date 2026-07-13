# AI Prompt 生成與宣告式套件匯入框架（ADPF）

**狀態：方向已裁決，尚未實作。** 見 `AI_CONTEXT/DECISIONS.md` §五。第一個
落地目標是 jonaminz 自己的 Theme 系統（多組具名視覺預設集＋公開圖書館／
管理員室分流），不是這份文件列出的 Travel/Movies/Photos 等全部場景——
那些是未來其他 App 出現時才會用到的同一套機制，這次不動手做。

原始來源：使用者與 ChatGPT 共同驗證的架構提案（v1.0，2026-07-13），原文
以 PDF／Markdown 併附一份 `GENERIC_PACK_ENVELOPE_SCHEMA.json` 貼進對話。
本檔是該提案的忠實重整版（原始 `.md` 版本貼上時编碼已損毀，本檔改依
乾淨可讀的 PDF 內容重新謄寫，內容未增刪，只是換成本專案慣用的檔案
組織方式）。`AGENT_IMPLEMENTATION_CHECKLIST.md` 與
`pack-envelope.schema.json` 兩份原始附件另存同資料夾。

---

## 0. 執行摘要

一個可在 Jonaminz 各網站與 first-party external app 大量重用的產品模式：

> **AI 輔助宣告式套件框架（ADPF）**：使用者只填少量自然語言需求；系統
> 自動組成帶 Schema、enum、限制與輸出規則的正式 Prompt；AI 只回傳受限
> JSON Pack；系統驗證、預覽、版本化後才允許套用。

- 這不是單純的 Prompt 複製按鈕，而是一條安全、可預覽、可回退、可版本化
  的 AI 產物管線。
- 共用的是 Prompt、解析、驗證、版本、Registry、匯入與同步機制；各 App
  自己擁有 Pack Schema 與 Renderer。
- **AI 不直接產生或執行 CSS、JavaScript、HTML、SQL、權限或部署設定**。
- 第一階段應先用在低風險的展示與視覺 Pack。
- 匯入與套用必須分開；任何正式作品都綁定精確 Pack 版本。

## 1. 問題與核心循環

### 1.1 為什麼需要這個框架

- 使用者不應反覆記住欄位、enum、數值範圍、安全限制與輸出格式。
- 讓 AI 直接改程式碼會造成 selector 衝突、RWD／列印不一致、無法驗證與
  資安風險。
- 只有固定幾套內建模板仍是封閉系統；真正的可擴充性來自受控 Pack
  Contract。

### 1.2 標準產品循環

```text
使用者填寫簡短需求
  ↓
Prompt Builder 組成正式 Prompt
  ↓
外部 AI / 未來內建 AI 產生 JSON Pack
  ↓
Parser → Schema → Semantic → Security → Compatibility
  ↓
Preview Renderer
  ↓
使用者確認匯入與套用
  ↓
Registry + Version + Optimistic Sync
```

## 2. 必要概念與責任邊界

| 概念 | 用途 |
|---|---|
| Prompt Recipe | 系統內建的 Prompt 配方：使用者欄位、完整 Schema、允許值、限制與輸出要求 |
| Pack Schema | 定義某個 Pack Type 能包含的宣告式資料 |
| Pack Registry | 管理 Pack metadata、版本、來源、狀態與使用關係 |
| Renderer Adapter | 將已驗證 payload 投影到既有 UI；不執行 AI 程式碼 |
| Apply Binding | 記錄哪一個 target 綁定哪一個 Pack 的精確版本 |

### 2.1 平台與 App 分工

| 責任方 | 責任 |
|---|---|
| Jonaminz 共用 Pack Kit | Prompt shell、文字抽取、Envelope validator、安全掃描、版本、Registry UI、Optimistic queue、audit、Preview shell |
| 各 external app | packType、payload Schema、Prompt domain 規則、semantic validator、preview fixture、renderer、migration |
| AI | 依 Prompt 產生符合規格的宣告式資料，不取得執行權 |
| 使用者 | 決定需求、審查預覽、確認匯入與套用 |

**平台邊界**：Core 可以提供共用機制，但不應解讀 Travel／Movies／Photos
的 domain payload。Pack Type 的語意仍由 App 擁有。

## 3. Pack Envelope 與 Prompt Builder

### 3.1 通用 Envelope

```json
{
  "schemaVersion": "1.0",
  "packType": "travel.book-style@1",
  "packId": "showa-railway-1980",
  "name": "昭和鐵道旅行誌",
  "version": "1.0.0",
  "description": "奶油紙、深綠與焦褐色的鐵道旅行手冊風格。",
  "author": "AI generated for Jonaminz",
  "targetApp": "jonaminz-travel",
  "compatibility": {
    "appVersion": ">=1.0.0 <2.0.0",
    "rendererVersion": "book-style-renderer@1"
  },
  "payload": {},
  "assets": [],
  "metadata": {
    "source": "imported",
    "createdAt": "2026-07-13T00:00:00+08:00"
  }
}
```

完整 JSON Schema 見同資料夾 `pack-envelope.schema.json`。

- Envelope 穩定且共用。
- `payload` 由各 Pack Type 自行定義。
- `packId + version` 唯一識別不可變版本。
- 發布後的 Pack Version 應 immutable。

### 3.2 Prompt Builder

使用者介面應保持簡單，常用欄位：今天要的主題／希望的氣氛／偏好的
色彩材質語彙／不希望出現／主要使用情境／簡潔-平衡-豐富偏好。

系統組成的正式 Prompt 必須自動附上：AI 角色與 Pack 責任範圍、與 App
Theme／Page Master／domain data 的邊界、完整 Schema 與必填欄位、enum
與數值範圍、相容性與可讀性要求、禁止 CSS／JS／SQL／URL／base64、僅
輸出合法 JSON。

**避免規格漂移**：Prompt 內的 Schema 說明應由同一份程式化 spec 產生，
不要手動維護另一份文字，否則 Prompt 與 Validator 會逐漸不一致。

## 4. 匯入、驗證與安全管線

| 層級 | 檢查內容 |
|---|---|
| L0 文字抽取 | 接受純 JSON、fenced JSON、前後帶少量說明；只擷取 JSON object |
| L1 JSON Parse | 合法 JSON、最外層 object |
| L2 Envelope Schema | packType、packId、version、target、compatibility |
| L3 Payload Schema | App-owned 必填欄位、型別、enum、range |
| L4 Semantic Validation | 對比、溢出、資產、母版能力、ID 衝突等邏輯 |
| L5 Security Guard | 拒絕可執行內容、外部 URL、secret 等 |
| L6 Compatibility | App／renderer／asset／migration 是否相容 |
| L7 Preview | 固定 fixture 安全預覽，不改正式資料 |
| L8 Commit | 使用者明確確認後才匯入與套用 |

### 4.1 預設禁止欄位

```text
css, style, selector, className, html,
script, javascript, eval, sql,
url, base64, fontFile,
secret, token, credential
```

**安全原則**：AI 的輸出是資料，不是程式。特殊能力應透過正式
enum／token／asset 類型新增，不應以 `customCss` 或 `script` 後門解決。

## 5. Optimistic UI、版本與資料模型

### 5.1 Optimistic UI

1. 套用時畫面立即呈現新 Pack。
2. 建立含 idempotency key 的 pending action。
3. 後端成功後標記 synced。
4. 失敗時恢復舊 Binding，顯示原因與重試。
5. 離線時保留 queue，不能顯示成已同步。

```json
{
  "actionId": "uuid",
  "type": "pack.apply",
  "packType": "travel.book-style@1",
  "packId": "showa-railway-1980",
  "version": "1.0.0",
  "targetType": "travel.trip",
  "targetId": "trip-2026-okayama",
  "status": "pending",
  "attempts": 0,
  "idempotencyKey": "uuid"
}
```

### 5.2 版本規則

- 作品綁定 `packId` 與精確 `packVersion`。
- 新版本不可讓舊作品靜默改樣。
- 升級前必須預覽與顯示變更摘要。
- 局部修改存為 `overrides`，不複製整包：

```json
{
  "packId": "showa-railway",
  "packVersion": "1.0.0",
  "overrides": { "colors.accentPrimary": "#A85336" }
}
```

- Schema major version 升級必須提供 migration function、migration 後
  產生 preview、不直接覆寫舊版本、保留原始 payload 與 audit log。

### 5.3 建議資料表

| 資料表 | 核心內容 |
|---|---|
| `pack_versions` | `pack_type`、`pack_id`、`version`、`payload_json`、`compatibility_json`、`source`、`validation_status`、`checksum`、`created_by`、`created_at`、`is_archived`；unique `(pack_type, pack_id, version)` |
| `pack_bindings` | `target_app`、`target_type`、`target_id`、`pack_type`、`pack_id`、`pack_version`、`overrides_json`、`updated_at` |
| `pack_assets` | `pack_type`、`pack_id`、`pack_version`、`asset_id`、`asset_type`、`storage_path`、`checksum` |
| `pack_audit_log` | `action_id`、`action_type`、`actor`、`target`、`before_json`、`after_json`、`status`、`created_at` |

注意：若遵循 external app domain ownership，這些表可以由各 App 自己
持有，Core 只保存通用 metadata 與治理欄位，不解讀 payload。

## 6. Jonaminz 可重用場景

| 區域 | Pack Type 建議 | 用途 | 風險 |
|---|---|---|---|
| Travel | `travel.book-style@1` | 每本旅行書的美術風格 | 低 |
| Travel | `travel.export-preset@1` | A4／手機離線包／照片冊輸出 | 低 |
| Movies | `movies.collection-style@1` | 影展型錄、錄影帶、黑色電影誌 | 低 |
| Movies | `movies.shelf-layout@1` | 收藏展示密度與卡片組合 | 低 |
| Photos | `photos.album-style@1` | 家庭相簿、底片接觸表、寫真集 | 低 |
| Learning | `learning.card-style@1` | 單字卡、圖鑑、教科書呈現 | 低 |
| Home | `home.handbook-style@1` | 家庭手冊與設備指南 | 低 |
| 個人頁 | `profile.presentation-style@1` | 公開頁展示語言 | 低 |
| Dashboard | `dashboard.layout-preset@1` | 區塊排序、尺寸、資訊密度 | 中 |
| Notifications | `digest.presentation@1` | 每日摘要的結構與語氣 | 中 |
| Search | `search.filter-preset@1` | 可重用的搜尋條件組 | 中 |

（**jonaminz 平台自己的 Theme 預設集**——本輪要落地的目標——原報告未列
出，屬於這次擴充：`platform.theme-preset@1`，見 §9「下一步」。）

### 6.1 不適用直接匯入

Auth／permissions、Contract governance、DB schema／migration SQL、
Worker／JavaScript／shell code、Secret／API key、自動部署設定。上述
高風險內容可由 AI 生成「報告、差異、任務單或審查提案」，但不可當作
Pack 直接執行。

## 7. 建議程式結構與實作階段

### 7.1 共用 Pack Kit

```text
shared/pack-kit/
├─ prompt-composer.js
├─ pack-text-extractor.js
├─ pack-envelope-validator.js
├─ forbidden-field-guard.js
├─ compatibility-checker.js
├─ pack-registry-client.js
├─ optimistic-pack-actions.js
├─ pack-import-ui.js
└─ pack-preview-shell.js
```

### 7.2 App-owned Pack Type

```text
packs/book-style/
├─ schema.json
├─ prompt-recipe.js
├─ allowed-values.js
├─ semantic-validator.js
├─ preview-fixture.json
├─ preview-renderer.js
├─ apply-adapter.js
└─ migrations/
```

### 7.3 分階段（原報告，全域範圍）

| 階段 | 內容 |
|---|---|
| Phase 0 | 凍結 Envelope、命名、forbidden fields、版本規則與驗收 fixture |
| Phase 1 | 以一個低風險 Pack Type 做完整 reference implementation |
| Phase 2 | 第二個 App 接入時抽取真正共用 Pack Kit |
| Phase 3 | 支援含 manifest、preview、SVG／WebP assets 的 zip Pack |
| Phase 4 | 接內建 AI Provider Adapter，但沿用同一 Prompt 與驗證管線 |
| Phase 5 | 建立 Jonathan／Minz 私人 Pack Library；暫不急著做公開 marketplace |

## 8. Agent 指令與驗收標準

完整版見 `agent-implementation-checklist.md`。核心規則：

1. 先盤點 App Theme、layout／master、domain data，不可混層。
2. 先完成 Schema、Validator、fixture 與 Renderer，再做 AI 生成 UI。
3. 禁止 arbitrary CSS／JS／HTML／SQL；禁止 `eval` 與動態 script。
4. Prompt 的欄位與 allowed values 應從程式 spec 生成，不手動維護第二份。
5. Preview 與正式套用共用同一 Renderer Adapter。
6. 匯入與套用分離。
7. 已發布 Pack Version immutable，Binding 釘住 exact version。
8. 後端 mutation 使用 idempotency key。
9. Optimistic update 失敗必須 rollback。
10. 更新 FACTS／DECISIONS／CURRENT_STATE／KNOWN_ISSUES／EXPERIMENTS／
    SESSION_LOG／CHECKPOINTS。

## 9. 在 jonaminz 的下一步（本次擴充，非原報告內容）

第一個落地目標**只做 Theme**，不做 Travel/Movies/Photos 等（那些等對應
App 真的出現才需要）：

1. 新增 Pack Type `platform.theme-preset@1`：payload 是固定 schema 的
   設計 token（`colors.background`／`colors.accent`／
   `typography.display` 等具名欄位），**不是**現行
   `theme_css_rules` 的自由 `selector/property/value` 三元組——這是
   ADPF 安全模型（forbidden fields 含 `selector`／`css`／`style`）
   帶來的順便修正：現行 `saveThemeCssRules` 登入後可以寫任意
   selector，改用固定 schema 後這個面會收斂。
2. 亞麻米（D）與當初另外三個提案（A 墨黑金屬／B 瓷白墨藍／C 深綠石）
   各自存成一筆 `pack_versions`，D 標記為目前 admin 空間的 active
   binding。
3. 公開圖書館選出的新方向（見 `DECISIONS.md` §四第 18 條，待選定）
   同樣存成一筆，binding 給 `space="public"`。
4. `theme-runtime.js` 改讀 Pack Registry／Binding，不再讀
   `theme_css_rules` 全表；cache key 內插 space。
5. `/pages/admin/theme/` 後台從「編輯散落的 CSS 規則」改成「在
   Registry 裡選一個 Pack、預覽、套用」。
6. Prompt Builder／AI 生成暫緩：先把「已知的四＋一個方向」用這個
   Registry 模型跑通，AI 動態生成新方向是之後才加的能力，不是這次的
   必要條件——ADPF 的價值在於資料模型本身（具名、可版本、可 binding），
   不是一定要先有 AI 生成才能用。

其他 App（Travel／Movies／Photos／Learning／…）要不要用同一套機制，
等那些 App 真的出現時再評估——這次只證明 Theme 這一個場景可行。

## 10. 更瘋狂的延伸（未拍板，見 `AI_CONTEXT/EXPERIMENTS.md`）

使用者提出：這套機制有沒有機會做成「圖書館工具」，開放給
jonaminz 生態圈以外的其他人／專案呼叫？**這是純方向性提問，沒有具體
設計，本文件不展開**，追蹤在 `EXPERIMENTS.md` 對應條目。
