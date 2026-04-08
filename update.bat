@echo off
echo Đang cap nhat code len GitHub...
git add .
git commit -m "Auto update %date% %time%"
git push origin main
echo.
echo Thanh cong! Da day code len GitHub.
pause