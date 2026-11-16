@echo off
echo Dang thiet lap lich tu dong gui EMAIL BANG CHAM CONG THANG vao luc 08:00 sang ngay 1 hang thang...

set "SCRIPT_DIR=%~dp0"
set "BAT_FILE=%SCRIPT_DIR%run-monthly-timesheet.bat"

schtasks /create /tn "Nusres_Monthly_Timesheet_Email" /tr "'%BAT_FILE%'" /sc monthly /d 1 /st 08:00 /f

if %errorlevel% equ 0 (
    echo.
    echo Cai dat thanh cong! Task Scheduler 'Nusres_Monthly_Timesheet_Email' da duoc them.
    echo Vao luc 08:00 sang ngay 1 hang thang, he thong se tu dong xuat file Excel cham cong thang cu va gui email.
) else (
    echo.
    echo Co loi xay ra. Vui long click chuot phai vao file nay va chon 'Run as administrator'.
)

pause
