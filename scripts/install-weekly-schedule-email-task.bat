@echo off
echo Dang thiet lap lich tu dong gui EMAIL LICH TUAN SAU vao luc 08:00 sang Chu Nhat hang tuan...

set "SCRIPT_DIR=%~dp0"
set "BAT_FILE=%SCRIPT_DIR%run-weekly-schedule-email.bat"

schtasks /create /tn "Nusres_Weekly_Schedule_Email" /tr "\"%BAT_FILE%\"" /sc weekly /d SUN /st 08:00 /f

if %errorlevel% equ 0 (
    echo.
    echo Cai dat thanh cong! Task Scheduler 'Nusres_Weekly_Schedule_Email' da duoc them.
    echo Vao luc 08:00 sang Chu Nhat hang tuan, he thong se tu dong sinh lich tuan sau (neu chua co) va gui email.
) else (
    echo.
    echo Co loi xay ra. Vui long click chuot phai vao file nay va chon 'Run as administrator'.
)

pause
