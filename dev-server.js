/*
檔案位置：jonaminz/dev-server.js
用途：本機預覽用的極簡靜態伺服器，根目錄固定是這個檔案所在的 jonaminz 資料夾
（不管在哪一層打開 VS Code / 從哪個資料夾下指令都一樣），對應正式站
www.jonaminz.com 的根目錄。

所有頁面都用網站根目錄絕對路徑載資源（/assets/...、/config.json，見
README.md「檔案結構」），VS Code Live Server 預設是用「目前開啟的工作區」
當根目錄，如果工作區是 jonaminz 的上層資料夾（例如「程式碼」），/assets/...
就會少一層路徑變成 404、整頁沒套到樣式。這支腳本不吃工作區設定，永遠以
jonaminz 自己為根目錄，不需要另開 VS Code 視窗。

用法：
  node dev-server.js [port]     預設 port 5500
  瀏覽器開 http://localhost:5500/
*/
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.argv[2] || 5500);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

http
  .createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath.endsWith("/")) urlPath += "index.html";
    const filePath = path.join(root, urlPath);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found: " + urlPath);
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(port, () => console.log("jonaminz dev server -> http://localhost:" + port + "/"));
