@echo off
echo Dang thiet lap lich chay tu dong thong bao Nusres vao luc 07:30 hang ngay...

set "SCRIPT_DIR=%~dp0"
set "BAT_FILE=%SCRIPT_DIR%run-notify.bat"

schtasks /create /tn "Nusres_Daily_Notify" /tr "\"%BAT_FILE%\"" /sc daily /st 07:30 /f

if %errorlevel% equ 0 (
    echo.
    echo Cai dat thanh cong! Task Scheduler da duoc them.
    echo Vao luc 07:30 moi ngay, he thong se tu dong kiem tra va thong bao lich nghi.
) else (
    echo.
    echo Co loi xay ra. Vui long click chuot phai vao file nay va chon 'Run as administrator'.
)

pause
