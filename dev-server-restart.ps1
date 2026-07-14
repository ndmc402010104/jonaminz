# 檔案位置：jonaminz/dev-server-restart.ps1
# 用途：啟動 dev-server.js（本機測試用靜態伺服器）之前，先關掉任何殘留的
# 舊 dev-server.js process，避免跟 VS Code 的 Live Server（預設也用 5500）
# 同時綁在同一個 port 打架。
#
# 背景：2026-07-14 早上一個殘留的 dev-server.js 沒關掉，跟 Live Server
# 同時綁在 0.0.0.0:5500，瀏覽器打 localhost:5500 時作業系統不確定分派給
# 哪一個，導致內容時對時錯（看到舊快照、甚至 404）——使用者當下誤以為
# 是網站真的壞了，其實是本機兩個伺服器互相干擾。
#
# 邏輯：只關閉「命令列包含 dev-server.js」的殘留 process（就是這支腳本
# 自己啟動過的那種），不會誤殺 VS Code / Live Server 或其他佔用該 port
# 的東西——如果 port 被別的東西佔用（例如 Live Server 正在跑），直接
# 中止並提示，不會硬要搶那個 port。
#
# 用法：pwsh ./dev-server-restart.ps1 [-Port 5500]
param(
  [int]$Port = 5500
)

$conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($conns) {
  $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
  $blockedByOther = $false

  foreach ($p in $pids) {
    $cim = Get-CimInstance Win32_Process -Filter "ProcessId=$p" -ErrorAction SilentlyContinue
    if ($cim -and $cim.CommandLine -like "*dev-server.js*") {
      Write-Host "關閉殘留的 dev-server.js：PID $p"
      Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    } else {
      $name = if ($cim) { $cim.Name } else { "unknown" }
      Write-Host "Port $Port 已經被別的 process 占用（PID $p, $name），不動它。"
      $blockedByOther = $true
    }
  }

  if ($blockedByOther) {
    Write-Host "如果那是 VS Code Live Server，代表本機測試站已經在跑了，不需要再啟動 dev-server.js。"
    exit 1
  }
}

Write-Host "啟動 dev-server.js on port $Port ..."
node "$PSScriptRoot/dev-server.js" $Port
