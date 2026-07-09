# 外部專案接入 jonaminz 水庫

jonaminz 是水庫，外部專案是下游用水戶。外部專案要出現在 jonaminz 首頁的「外部專案」清單，
不需要改動 jonaminz 任何程式碼，只需要兩步：

## 1. 外部專案自己放一份 `jonaminz-app.json`

放在該專案自己網域的根目錄，例如 `https://example-project.jonaminz.com/jonaminz-app.json`：

```json
{
  "schemaVersion": 1,
  "projectId": "example-project",
  "title": "Example Project",
  "description": "一句話描述這個專案在做什麼。",
  "href": "https://example-project.jonaminz.com/",
  "version": "v0.1.0-202607090000"
}
```

規則：

- `projectId` 必須跟 `registry.json` 裡登錄的 `projectId` 一致。
- 這份 manifest 只能提供**顯示用**資料（title / description / href / version），
  不能宣告自己的 enabled / position / order——那些由 jonaminz 的 `registry.json` 決定。
- 靜態檔案即可，不需要動態產生；但伺服器要允許跨網域讀取（GitHub Pages 預設就會送出
  `Access-Control-Allow-Origin: *`，不需要額外設定）。

## 2. jonaminz 在 `registry.json` 新增一筆登錄

編輯 jonaminz repo 根目錄的 `registry.json`：

```json
{
  "schemaVersion": 1,
  "externalProjects": [
    {
      "projectId": "example-project",
      "manifestUrl": "https://example-project.jonaminz.com/jonaminz-app.json",
      "enabled": true,
      "position": "front",
      "group": "未分類",
      "order": 0
    }
  ]
}
```

- `enabled` / `position` / `group` / `order` 是水庫（jonaminz）自己擁有的狀態，外部專案
  不能自己決定要不要顯示或排在哪裡。
- 之後外部專案更新自己的 `jonaminz-app.json`（例如改標題、改版本），jonaminz 首頁會在
  下次載入時自動抓到新內容，不用回來改 jonaminz 的程式碼或內容。
- 單一外部專案的 manifest 抓取失敗（離線 / 404 / CORS 設定錯誤）只會讓那張卡片顯示
  「目前無法連線」，不會擋住其他專案顯示，也不會擋住 jonaminz 首頁本身的 loading gate。

## 3.（選用）回報自己上線

外部專案想讓 jonaminz 後台知道「我上線了、最後一次是什麼時候」，可以在自己頁面載入時
呼叫 jonaminz 的 Worker（不需要載 jonaminz 任何 JS，直接 fetch 即可）：

```js
fetch("https://<jonaminz-worker-domain>/api/action", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "registerExternalApp",
    payload: {
      projectId: "example-project",   // 必填，要跟 registry.json 的 projectId 一致
      title: "Example Project",
      href: "https://example-project.jonaminz.com/",
      version: "v0.1.0-202607090000",
      env: "prod"
    }
  })
}).catch(function () {
  // 回報失敗不影響外部專案自己的功能，忽略即可。
});
```

規則：

- `projectId` 必填，其餘欄位都只是顯示用途。
- 這是背景報到，不要 await、不要擋自己頁面的載入或功能。
- jonaminz 這端只記錄 `last_seen_at`（最後一次回報時間），不會因為沒收到回報就把
  專案從首頁清單移除——移不移除仍然只看 `registry.json` 的 `enabled`。
- Worker 網址目前尚未對外公開；已串接的專案請跟 jonaminz 管理者要目前的 Worker 網址。

## 誰負責什麼

```txt
jonaminz（水庫）擁有：
  registry.json 的 enabled / position / group / order
  卡片外觀（CSS）
  抓取時機與逾時處理（assets/js/registry-loader.js）

外部專案（下游）擁有：
  jonaminz-app.json 的 title / description / href / version
  自己的網域、自己的程式碼、自己的部署
```
