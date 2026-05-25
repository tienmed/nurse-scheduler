@echo off
echo Dang thiet lap lich chay tu dong CHOT LICH TUAN vao luc 18:00 Chu nhat hang tuan...

set "SCRIPT_DIR=%~dp0"
set "BAT_FILE=%SCRIPT_DIR%run-generate-week.bat"

schtasks /create /tn "Nusres_Generate_Weekly_Schedule" /tr "\"%BAT_FILE%\"" /sc weekly /d SUN /st 18:00 /f

if %errorlevel% equ 0 (
    echo.
    echo Cai dat thanh cong! Task Scheduler da duoc them.
    echo Vao luc 18:00 Chu Nhat moi tuan, he thong se tu dong chot lich tuan moi.
    echo.
    echo ==========================================================
    echo LUU Y QUAN TRONG DE TASK CHAY KHI KHONG LOGIN:
    echo 1. Nhan to hop phim Windows + R, go 'taskschd.msc' de mo Task Scheduler.
    echo 2. Vao muc 'Task Scheduler Library'.
    echo 3. Tim task co ten 'Nusres_Generate_Weekly_Schedule' va click dup chuot.
    echo 4. Trong tab 'General', chon 'Run whether user is logged on or not'.
    echo 5. Nhan OK. He thong se yeu cau ban nhap mat khau Windows de luu.
    echo ==========================================================
) else (
    echo.
    echo Co loi xay ra. Vui long click chuot phai vao file nay va chon 'Run as administrator'.
)

pause
