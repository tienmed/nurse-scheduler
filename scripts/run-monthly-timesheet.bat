@echo off
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%.."
set "SMTP_PORT=465"
node --import ./scripts/register-alias.mjs --env-file=.env.local --env-file=email.env scripts\email-monthly-timesheet.mjs %*
