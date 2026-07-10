<!--
狀態：RFC（已凍結，2026-07-10）。本文內容不再修改。
用途：發給每一位審查 Agent 的同一份 Review Request。
流程：Draft Spec → 本 RFC → 收集 3~5 份 Architecture Review →
      彙整共識與分歧 → Specification v1.0（Frozen）→ Schema → SDK。
收到的 Review 不要寫進本檔，一份一檔放 docs/platform-integration-reviews/。
背景資料（審查者可另行參考，非 RFC 本體）：
  docs/platform-integration-consensus.md、docs/platform-integration-spec-review.md
-->

# Jonaminz Platform Integration v1 — Architecture Discussion Request

我目前正在設計 Jonaminz Platform Integration 的長期架構，希望在正式實作前，先完成架構層級的驗證。

請不要直接寫程式，而是以「十年以上可維護的平台架構」為目標，挑戰我的設計。

---

## 背景

Jonaminz 不是單一網站，而是一個 Platform。

外部專案只需要：

1. 提供 `jonaminz.contract.json`
2. 在 `<head>` 載入：

```html
<script src="https://jonaminz.com/sdk/jonaminz-entry.js"></script>
```

SDK 會：

* 讀取 Contract
* 驗證
* 回報平台
* 取得 Integration Settings
* 建立 Platform API
* 啟用平台允許的能力

外部專案永遠不直接呼叫平台後端。

---

## 尺度與限制（審查的第一個輸入，請以此校準建議）

* 本平台服務**兩位使用者**（Jonathan 與 Minz）。
* 所有外部專案皆為**自行開發的 first-party app**，預計 10-15 個，
  **沒有陌生第三方開發者**，短期內也不開放註冊。
* 前端為 GitHub Pages **靜態託管**、原生 JS、**沒有 build pipeline**。
* 後端為**單一 Cloudflare Worker + Supabase**。
* **一人開發維護**。
* 已存在一個運作中的前身系統（registry.json 白名單 + manifest 拉取 +
  獨立 theme script）；遷移成本是評估維度之一，但目前尚無正式外部專案接入，
  切換成本低。

請以此尺度審查。「大平台常見做法」（API gateway、灰度發布、多租戶隔離、
SLA 監控等）若在此尺度下屬於過度設計，請明說，不要照搬。
十年穩定的目標是**介面與規則不變**，不是預先蓋好大平台的所有設施。

---

## 已經確定的哲學

### Contract 是自我聲明

Contract 只描述：

* 我是誰
* 我有哪些入口（可選）
* 我有哪些整合物件（可選）
* 我支援哪些能力
* 我需要哪些能力

Contract 永遠不能決定：

* enabled
* placement
* visibility
* permissions
* granted capabilities

全部由 Jonaminz Integration Settings 決定。

---

### Platform 分三層

Platform Core

* Runtime
* SDK
* Contract Loader
* Settings Loader
* Platform Bridge

Platform Shell

* Header
* Footer
* Theme
* Navigation
* CSS

Platform Services

* Search
* Pin
* Relationship
* AI
* Analytics
* Notification
* Calendar
* File
* Health
* Profile
* Shared Cache

---

### Entries / Objects

Entries 是：

> 專案願意暴露給 Jonaminz 的入口。

不是所有頁面。

Objects 是：

> 專案願意暴露給 Jonaminz 理解的資料型別。

不是資料庫。

兩者都可以是空的。

---

### CSS

目前規劃：

Shell 的 CSS 整合程度可以宣告：

* none
* tokens
* components
* full
* self

第一版只實作：

* none
* tokens

---

### SDK

SDK 是常青網址。

所有外部專案永遠載入最新版 SDK。

SDK 必須：

* 向下相容所有歷史 Contract
* 失敗不得破壞宿主頁面
* 可以安全回滾

---

### Platform API

目前我們決定：

不要在沒有真實使用者（caller）的情況下，提前設計 Search、Notification、AI 等 API 的詳細方法。

目前只凍結：

* Service 名稱
* Namespace
* Promise 模型
* 錯誤模型
* Capability Version 機制

真正的方法簽名（例如 Search Query、Search Result）等第一個真實使用案例出現，再發布 `search@1`。

---

## 我希望你挑戰的地方

請不要重複我的內容。

請專注找出：

### 1.

哪些凍結層（Frozen Layer）

我現在沒有想到，

但是一旦開始實作，以後就很難修改。

---

### 2.

哪些地方現在看起來合理，

十年後很可能變成技術債。

---

### 3.

Platform Core / Shell / Services 的切分，

有沒有更合理的方法。

---

### 4.

Contract 的責任邊界，

是不是還有混到 SDK 或 Integration Settings。

---

### 5.

SDK Lifecycle

有沒有遺漏的重要步驟。

---

### 6.

Contract Discovery

目前預設是根目錄：

`/jonaminz.contract.json`

你認為：

是否需要保留可擴充的 Discovery 機制？

例如：

* HTML meta
* HTTP Header
* 其他方式

哪種比較值得十年後維護？

---

### 7.

Platform API

目前採：

> 名稱先凍結，方法晚凍結。

你認為這是不是長期最安全的策略？

還是有更好的方法？

---

### 8.

Integration Settings

目前 v1 打算維持 Git 管理，

未來可以換成 DB，

但 SDK 不應知道背後使用 Git 或 DB。

你認為這樣的抽象是否足夠？

---

### 9.

錯誤模型的具體形狀（已知未定案，請直接投票並給理由）：

Platform API 失敗時，應該——

A. resolve 帶 `{ ok: false, code, message }`（呼叫端永遠走同一條路，用 if 分流）

B. reject 帶固定錯誤碼（呼叫端用 catch，符合 Promise 慣例）

十年尺度下哪個比較不後悔？為什麼？

---

### 10.

SDK Ready 介面（已知未定案）：

外部專案怎麼知道 SDK 初始化完成、可以開始呼叫 Platform API？

* DOM event？
* `window.Jonaminz.ready`（Promise）？
* command queue stub（類似 gtag：先收集呼叫、ready 後重放）？

這是外部專案每天都會寫的那一行，凍結錯了就是十年負債。請給明確建議。

---

### 11.

常青 SDK 的部署風險：

「失敗不得破壞宿主頁面」是否足以覆蓋「一次壞部署同時打到所有外部專案」？

需不需要額外的 kill-switch / 金絲雀 / 版本回滾機制？

另外「可以安全回滾」的語意需要釐清：是 SDK 部署回滾，還是 Contract 版本回滾？

在一人維護、無 build pipeline 的前提下，什麼程度的保護是值得的？

---

### 12.

推模式收合約的威脅模型：

SDK 把 Contract 推送給平台後端時，後端驗證請求的 Origin header

是否等於該 projectId 在 Integration Settings 登記的網域。

對「非瀏覽器偽造請求」（curl 直打、偽造 Origin）這樣夠嗎？

目前的假設：偽造者最多塞進一份「不被採信」的合約副本，

上架與授權永遠只看 Integration Settings，所以無害。

這個假設有沒有洞？

---

## 回覆方式

請不要直接開始寫程式。

請站在「平台架構審查」角度回答。

如果你認為我的設計有問題，

請直接指出問題，

並說明：

* 為什麼會變成問題
* 什麼情況下會發生
* 你的改善方案
* 是否會影響相容性

格式要求（多份 Review 需要彙整比對，請遵守）：

* 每個發現標註嚴重度：**架構級**（改了會動到凍結層/不改十年後拆不掉）
  或 **建議級**（品質改善，不改也不會壞）。
* 每個發現標註對應的問題編號（1-12）；不屬於任何編號的新發現，標「新增」。
* 問題 9 請明確二選一並給理由，不要兩個都可以。

不要因為想符合我的想法而保守回答。

我希望得到真正的 Architecture Review，而不是認同我的設計。
