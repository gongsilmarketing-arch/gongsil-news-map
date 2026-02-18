@echo off
echo ========================================================
echo [Gongsil News Map] Local Server Starting...
echo ========================================================
echo.
echo Please open your browser and access:
echo http://localhost:8000
echo.
echo (Make sure to add http://localhost:8000 to Kakao Developers > Platform > Web)
echo.
python -m http.server 8000
pause


