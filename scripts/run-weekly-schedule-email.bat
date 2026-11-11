@echo off
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%.."
node --import ./scripts/register-alias.mjs --env-file=.env.local --env-file=email.env scripts\email-weekly-schedule.mjs %*
