@echo off
REM Ensure we're in the script directory
cd /d "%~dp0"

for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$ip = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { -not $_.IPAddress.StartsWith('127.') -and $_.PrefixOrigin -ne 'WellKnown' } | Sort-Object InterfaceMetric | Select-Object -First 1 -ExpandProperty IPAddress; if (-not $ip) { $ip = (Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled } | ForEach-Object { $_.IPAddress } | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' -and -not $_.StartsWith('127.') } | Select-Object -First 1) }; if ($ip) { $ip } else { '127.0.0.1' }"`) do set "LOCAL_IP=%%I"

echo.
echo Chatvora LAN address:
echo   http://%LOCAL_IP%:3000
echo.
echo Devices on the same Wi-Fi can open that URL in their browser.
echo.

REM التأكد من تشغيل خدمة MongoDB المحلية تلقائياً قبل بدء السيرفر
echo Starting Local MongoDB Service...
net start MongoDB >nul 2>&1

REM Start backend in a new terminal (keeps window open)
start "Chatvora Backend" /D "%~dp0backend" cmd /k "set HOST=0.0.0.0&& set PORT=5000&& node server.js"

REM Start frontend in a new terminal (keeps window open)
start "Chatvora Frontend" /D "%~dp0frontend" cmd /k "npm run dev"

REM Give the servers a moment to start, then open the app in the default browser
timeout /t 3 /nobreak >nul
start "" "http://%LOCAL_IP%:3000"

exit /b 0