@echo off
cd /d "%~dp0"
echo Starting Longdan Marketing Ops app on port 4000...
start "Longdan Ops Server" /min cmd /c "npm start -- -p 4000 > longdan-ops-server.log 2>&1"
timeout /t 5 /nobreak >nul
echo Starting Cloudflare Tunnel...
start "Cloudflare Tunnel" /min cmd /c "cloudflared tunnel --url http://localhost:4000 > cloudflared.log 2>&1"
echo.
echo Done. Wait ~10 seconds, then open cloudflared.log to see your access link.
echo (Look for a line like: https://xxxx.trycloudflare.com)
pause
