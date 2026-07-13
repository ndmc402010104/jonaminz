Set-Location $PSScriptRoot
Start-Process "http://localhost:8765/web/?identity=jonathan"
py -m http.server 8765
