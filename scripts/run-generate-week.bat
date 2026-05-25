@echo off
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%.."
node --env-file=.env.local scripts\auto-generate-week.mjs
