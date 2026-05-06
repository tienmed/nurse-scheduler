@echo off
echo Dang thiet lap lich chay tu dong gui EMAIL bao cao nghi phep Nusres vao luc 19:00 hang ngay...

set "SCRIPT_DIR=%~dp0"
set "BAT_FILE=%SCRIPT_DIR%run-email.bat"

schtasks /create /tn "Nusres_Daily_Email" /tr "\"%BAT_FILE%\"" /sc daily /st 19:00 /f

if %errorlevel% equ 0 (
    echo.
    echo Cai dat thanh cong! Task Scheduler da duoc them.
    echo Vao luc 19:00 moi ngay, he thong se tu dong kiem tra va gui email (neu co).
    echo.
    echo ==========================================================
    echo LUU Y QUAN TRONG DE TASK CHAY KHI KHONG LOGIN:
    echo 1. Nhan to hop phim Windows + R, go 'taskschd.msc' de mo Task Scheduler.
    echo 2. Vao muc 'Task Scheduler Library'.
    echo 3. Tim task co ten 'Nusres_Daily_Email' va click dup chuot.
    echo 4. Trong tab 'General', chon 'Run whether user is logged on or not'.
    echo 5. Nhan OK. He thong se yeu cau ban nhap mat khau Windows de luu.
    echo ==========================================================
) else (
    echo.
    echo Co loi xay ra. Vui long click chuot phai vao file nay va chon 'Run as administrator'.
)

pause
