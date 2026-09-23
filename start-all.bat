@echo off
setlocal
set "ROOT=%~dp0"

echo Dang khoi dong backend (port 4000)...
start "Salon Backend" cmd /k "cd /d "%ROOT%backend" && npm run dev"

echo Dang khoi dong frontend (port 5173)...
start "Salon Frontend" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

echo Doi vai giay de backend/frontend san sang...
timeout /t 8 /nobreak >nul

echo Bat Tailscale Funnel...
"C:\Program Files\Tailscale\tailscale.exe" funnel --bg 5173

echo.
echo ================================================
echo  Link co dinh: https://laptop-m23gkq84.tailb7499f.ts.net/
echo ================================================
echo.
pause
