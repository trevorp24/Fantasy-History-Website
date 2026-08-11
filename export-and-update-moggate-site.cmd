@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0export-moggate-json.ps1"
if errorlevel 1 pause && exit /b %errorlevel%
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-moggate-site.ps1" -SkipJsonCopy -Push
