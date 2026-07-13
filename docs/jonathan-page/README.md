# Jonathan 公開頁設計與實作規格 v1

> 2026-07-13 使用者提供的完整規格，忠實保存於此。實作狀態與跟原規格
> 的差異記錄在 `AI_CONTEXT/DECISIONS.md` §七、`AI_CONTEXT/CURRENT_STATE.md`，
> 這份文件本身不隨實作進度修改內容。

## 1. 頁面定位

Jonathan 頁是 `Jonaminz` 品牌下的個人公開入口。

它不是：

- Jonathan 與 Minz 登入後使用的共用後台／Digital Home
- 需要長期經營更新的個人品牌網站
- 刻意強調「這些都是我做的」的作品集
- 醫院內部系統後台
- 病人導向的醫師形象官網

它目前的主要用途是：

1. 讓現實中已認識 Jonathan 的同事、朋友與熟人，快速找到公開資訊與可使用的專案。
2. 讓使用者只需記得 `jonaminz.com`，不必記住 SKHPSv2 等各專案網址。
3. 提供簡潔的 Jonathan 自我介紹。
4. 未來可自然加入作品、收藏與病人導向的專業成果頁，但目前不得顯示空分類。

---

## 2. 與其他 Jonaminz 區域的關係

### Jonaminz 總入口

負責讓訪客選擇進入：

- Jonathan
- Minz
- 登入後共用的 Digital Home

### Jonathan 公開頁

提供：

- Jonathan 簡介
- SKHPSv2 公開入口
- About
- 未來的公開專案、作品、收藏與專業成果

### 登入後共用後台

這才是 Jonathan 與 Minz 日常使用的：

- App Launcher
- 控制中心
- 私人資料
- 生活工具
- 共用專案入口

不得把公開 Jonathan 頁做成私人後台或 Dashboard。

---

## 3. 第一版資訊架構

第一版只顯示實際存在的內容：

```text
首頁
├── Jonathan Hero
├── SKHPSv2
├── About Jonathan
└── Footer
```

目前導覽：

```text
Jonaminz Logo | SKHPSv2 | About | Minz
```

未來內容增加後，才能轉為：

```text
Jonaminz Logo | Projects | Collections | Professional | About | Minz
```

不得在第一版放置：

- 作品整理中
- 收藏即將推出
- 專業內容敬請期待
- 空卡片
- 尚未存在的導覽分類

但程式結構必須預留以下可選區塊：

```text
projects
collections
professional
patientGallery
```

沒有內容時完全不渲染。

---

## 4. 首頁 Hero

### 桌機版配置

使用左右分欄：

- 左側約 40%
- 右側約 60%

右側主視覺應比左側更有視覺重量。

### 左側內容

只放四個核心元素：

```text
Jonathan

我是 Jonathan，一名整形外科醫師，
也喜歡把想法做成真正能使用的東西。

[進入 SKHPSv2] [關於 Jonathan]
```

要求：

- 文字簡潔
- 不增加最近更新
- 不增加狀態列
- 不增加技能標籤牆
- 不增加長篇自介
- 不使用過度自我宣傳的語氣

### 按鈕層級

主要按鈕：

```text
進入 SKHPSv2
```

次要按鈕：

```text
關於 Jonathan
```

SKHPSv2 按鈕直接前往實際系統入口。

---

## 5. 右側精密展示艙

### 核心概念

右側不是直接放一張完整 SKHPSv2 截圖，而是一個：

> 抽象精密展示艙

視覺組成：

- 霧面金屬外殼
- 少量深色玻璃
- 深藍／灰藍介面光感
- 精密切線
- 抽象核心
- 少量 SKHPSv2 UI 碎片

### SKHPSv2 UI 的使用方式

UI 素材只能以以下方式出現：

- 局部裁切
- 透視處理
- 半透明
- 模糊背景
- 映射於玻璃或金屬結構中
- 作為資訊層片段

不得直接把完整 Dashboard 截圖當成首頁大圖。

### 未來擴充

展示艙未來應可承載：

- SKHPSv2
- 3D 列印作品
- 數位工具
- 收藏
- 專業成果

第一版只有 SKHPSv2 時，不得硬做空白輪播。

預設固定顯示一個內容；未來有多個項目後，才加入低調切換功能。

---

## 6. 動態規格

整體動態採「緩慢運作」，不是明顯機械動畫。

可使用：

- 極輕微旋轉
- 呼吸光
- 緩慢光影移動
- 小幅游標視差
- 點擊後的輕微展開
- 淡入與層次轉換

不得使用：

- 大幅度機械組裝
- 高速旋轉
- 強烈霓虹閃爍
- 遊戲登入畫面式動畫
- 過度浮動
- 自動快速輪播
- 影響文字閱讀的背景動態

必須支援：

```css
@media (prefers-reduced-motion: reduce)
```

在減少動態模式下，所有非必要動畫需停用。

---

## 7. SKHPSv2 區塊

Hero 下方放置簡潔的 SKHPSv2 詳細卡。

建議文案：

```text
SKHPSv2

新光整形外科目前使用中的數位工作系統。

[進入系統] [了解更多]

院內授權使用
```

### 敘事原則

主要強調：

> 這是一套目前真的正在使用的系統。

不得以以下方向作為主文案：

- Jonathan 的代表作品
- 我設計與開發的成果
- 我的創作旅程
- 我的得意作品

Jonathan 的開發與維護角色可以放在：

- About
- 專案介紹頁底部
- Credits

例如：

```text
由 Jonathan 持續設計與維護。
```

但不得成為首頁主敘事。

### 權限標示

卡片上可用低調小字顯示：

```text
院內授權使用
```

真正的安全性仍必須由：

- 登入
- 授權
- 白名單
- 後端權限檢查

負責。

`noindex` 只能降低搜尋曝光，不可視為安全機制。

---

## 8. About Jonathan

### 首頁

首頁只保留一句自我介紹與 About 按鈕。

### About 頁

About 先說明 Jonathan 平常做哪些事情，再簡短補充為什麼會做。

內容順序：

1. 整形外科醫師
2. 數位系統與工具
3. 3D 列印與實體製作
4. 旅行、收藏與其他興趣
5. 喜歡理解問題，再把想法做成真正能使用的東西

醫師身分放在第一順位，但只做簡短介紹。

完整的：

- 醫療經歷
- 專長
- 病人衛教
- 醫療成果
- 病人案例

留給未來獨立的 Professional／病人專業頁。

---

## 9. 照片策略

### 一般 Jonathan 公開頁

照片可使用，但不得成為主角。

適合：

- About 頁自然照片
- 側邊小型人物照
- 工作、旅行或製作物品時的照片

不必：

- 白袍主視覺
- 滿版形象照
- 醫師官網式構圖

### 未來病人專業頁

可更明確使用：

- 正式形象照
- 白袍照
- 工作情境照
- 醫師身分與專業資訊

一般公開頁與病人專業頁必須是不同的內容模式。

---

## 10. 視覺主題

主題名稱：

```text
Dark Precision
深色精密工作室
```

### 色彩方向

主色：

- 深藍
- 灰藍

結構色：

- 墨黑
- 炭灰
- 近黑

輔助色：

- 冷白
- 低飽和金屬灰
- 克制的藍色光感

### 質感

使用：

- 霧面金屬
- 少量深色玻璃
- 精密切線
- 柔和陰影
- 克制高光
- 大面積深色留白

避免：

- 賽博龐克
- 紫藍霓虹氾濫
- 高反光玻璃
- 過量 Glassmorphism
- 工程後台感
- 醫院官網感
- SaaS Landing Page 套版感

---

## 11. 字體

內文：

- 現代無襯線
- 清楚好讀
- 中文需具備完整繁體字支持

大標題與專案名稱：

- 可使用稍窄體
- 或帶幾何感的無襯線
- 不可犧牲中文可讀性

字體須透過 Theme Tokens 控制，不得散落硬編碼。

---

## 12. 導覽列

採極簡細導覽。

桌機：

```text
[Jonaminz Logo]                 SKHPSv2  About  Minz
```

要求：

- 不使用大型膠囊導覽
- 不使用浮誇金屬控制條
- 不搶展示艙視覺
- 清楚顯示目前所在頁面
- 可返回 Jonaminz 總入口
- 可切換至 Minz 頁

手機可收成簡潔選單，但 SKHPSv2 主要入口仍需容易找到。

---

## 13. Footer

Footer 維持極簡，只放：

- Jonaminz
- Jonathan／Minz 切換
- 版權資訊

不得加入：

- 大型 Sitemap
- 多欄導覽
- 企業資訊
- 不必要聯絡表單
- 社群圖示牆
- 空的未來分類

---

## 14. 響應式規格

### 桌機

目標：

> 首頁盡量一屏完成。

包含：

- Header
- Hero
- SKHPSv2 簡短資訊
- Footer 或 Footer 的主要入口

不得為了硬塞一屏而縮小到難以閱讀。

### 手機

允許自然的短距離捲動。

順序：

1. Jonathan
2. 一句自介
3. 進入 SKHPSv2
4. 關於 Jonathan
5. 小型抽象核心
6. SKHPSv2 詳細卡
7. Footer

桌機大型展示艙不得直接縮小塞入手機。

手機版改為：

- 小型抽象核心
- 輕量動畫
- 少量 UI 碎片
- 不阻塞主要操作
- 不拖慢首次載入

---

## 15. Jonathan 與 Minz 頁面的關係

兩頁屬於同一個 Jonaminz 品牌。

必須共用：

- 品牌識別
- 導覽骨架
- 元件系統
- 按鈕邏輯
- 版面節奏
- Footer
- 返回總入口
- 人物切換方式

採中度視覺差異：

- 各自主題色
- 各自背景材質
- 各自首頁構圖
- 各自卡片氣氛
- 各自內容與照片

但不可做成兩個完全無關的獨立網站。

---

## 16. 內容與 Registry 架構

首頁內容不得全部寫死在頁面元件中。

至少建立可擴充的公開內容資料結構，例如：

```json
{
  "id": "skhpsv2",
  "owner": "jonathan",
  "type": "app",
  "title": "SKHPSv2",
  "summary": "新光整形外科目前使用中的數位工作系統。",
  "visibility": "public-listing",
  "access": "authorized-users",
  "featured": true,
  "navigation": true,
  "actions": [
    {
      "type": "launch",
      "label": "進入系統",
      "url": "https://skhps.jonaminz.com"
    },
    {
      "type": "details",
      "label": "了解更多",
      "url": "/jonathan/projects/skhpsv2"
    }
  ]
}
```

未來每個內容可自行決定：

- 直接開啟
- 查看介紹
- 同時提供兩種操作
- 只展示
- 登入後才能進入
- 完全不公開

不得讓 Jonathan 頁另行維護一份與 Jonaminz Registry 脫節的專案清單。

---

## 17. Theme 架構要求

所有以下項目必須使用 Theme Tokens：

- 顏色
- 字體
- 背景
- 邊框
- 陰影
- 圓角
- 間距
- 玻璃透明度
- 金屬高光
- 動畫速度
- 光感強度

不得把 Jonathan Theme 的數值硬編碼在頁面元件中。

建議 Token 類型：

```css
--theme-bg-primary
--theme-bg-secondary
--theme-surface
--theme-surface-elevated
--theme-text-primary
--theme-text-secondary
--theme-accent
--theme-accent-soft
--theme-border
--theme-metal-highlight
--theme-glass-opacity
--theme-shadow
--theme-radius
--theme-space
--theme-motion-duration
--theme-motion-easing
--theme-glow-strength
```

Jonathan 與 Minz 頁面應共用元件與語義 Token，只替換 Theme Preset。

---

## 18. 效能與可用性要求

### 首次載入

- Hero 的核心資訊與主要按鈕不可等待大型動畫資源載入。
- 展示艙載入失敗時，必須降級為靜態主視覺。
- 不得因為 3D、Canvas、WebGL 或大型圖片而阻塞操作入口。
- 手機與低效能裝置應優先載入輕量版本。

### 可存取性

- 文字與背景需維持足夠對比。
- 所有互動皆須支援鍵盤操作。
- 焦點狀態不得移除。
- 動畫不可承擔唯一資訊傳達方式。
- 圖片與視覺碎片需提供合適的替代文字；純裝飾素材應標示為裝飾。
- 主要按鈕點擊範圍需適合手機使用。

### 安全性

- 公開頁不得包含任何病人資料、院內帳密、敏感 API URL 或內部設定。
- UI 碎片若來自真實系統，需確認已去識別化。
- 進入 SKHPSv2 後仍必須走原本登入與授權流程。
- 公開頁只負責導覽，不負責取代權限控管。

---

## 19. 第一版驗收標準

第一版完成時，至少應符合：

- [ ] 桌機首頁清楚區分公開頁與登入後共用後台。
- [ ] 第一屏左側只有 Jonathan、短自介與兩個主要操作。
- [ ] 第一屏右側為抽象精密展示艙，不使用完整 SKHPSv2 截圖。
- [ ] SKHPSv2 被描述為實際使用中的系統，而不是自我宣傳式作品。
- [ ] 「院內授權使用」以低調方式標示。
- [ ] 沒有空的 Projects、Collections、Professional 或 Patient Gallery 區塊。
- [ ] 導覽目前直接顯示 SKHPSv2，未來可切換成分類式導覽。
- [ ] 手機版不直接縮小桌機展示艙，主要按鈕優先可見。
- [ ] 所有視覺數值由 Theme Tokens 控制。
- [ ] `prefers-reduced-motion` 可正常停用非必要動畫。
- [ ] 展示艙載入失敗時仍可正常進入 SKHPSv2。
- [ ] 頁面不包含敏感院內資訊或病人資料。
- [ ] Jonathan 與 Minz 頁面看得出屬於同一個 Jonaminz 品牌。
- [ ] 第一版不要求頻繁更新或維護內容。

---

## 20. 明確禁止事項

Agent 不得擅自：

- 把 Jonathan 公開頁改成後台 Dashboard。
- 加入技能百分比、履歷時間軸或自我品牌式數據。
- 為尚未存在的內容建立空卡片。
- 直接把完整 SKHPSv2 Dashboard 截圖放進 Hero。
- 使用大量紫色霓虹、粒子或賽博龐克效果。
- 把醫師形象照設為一般公開頁的滿版主角。
- 把登入後共用 Digital Home 的功能搬到公開頁。
- 在頁面內硬編碼 Theme 數值。
- 建立第二份獨立的專案清單，與 Jonaminz Registry 分離。
- 為了桌機一屏而犧牲字級、按鈕大小或閱讀性。
- 把 `noindex` 當成安全機制。
- 未經去識別化便使用真實院內畫面。

---

## 21. 第一版實作優先順序

1. 建立 Jonathan 公開頁骨架與 Theme Preset。
2. 完成極簡 Header、Hero 左側內容與主要按鈕。
3. 建立可降級的靜態展示艙視覺。
4. 加入少量、去識別化的 SKHPSv2 UI 碎片。
5. 完成 SKHPSv2 詳細卡與公開 Registry 讀取。
6. 完成 About 基礎頁。
7. 完成手機版輕量視覺與短距離捲動。
8. 加入低強度動態與 `prefers-reduced-motion`。
9. 驗證載入失敗、無 JavaScript、低效能裝置與權限入口。
10. 最後才調整金屬、玻璃、光感與動畫細節。

---

## 22. 核心設計句

> Jonathan 公開頁是一個精緻、克制、容易使用的對外入口。
> 它讓熟人快速找到 Jonathan 與目前真正存在的系統，也為未來的作品、收藏與專業成果保留自然成長的空間；但不要求 Jonathan 持續經營或展示自己。
