@echo off
cd /d "c:\Users\gongs\Desktop\newhomepage"

echo Installing dependencies...
call npm install axios --no-audit --silent

echo.
echo Fetching news...
node ingest.js

echo.
echo ====================================
echo [Gongsil News] Update Complete!
echo %date% %time%
echo ====================================
timeout /t 10
exit
