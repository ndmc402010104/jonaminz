@echo off
cd /d "%~dp0"
start "" http://localhost:8765/web/?identity=jonathan
py -m http.server 8765
