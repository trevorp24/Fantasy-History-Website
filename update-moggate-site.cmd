@echo off
setlocal
pushd "%~dp0"
if errorlevel 1 goto failed
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-moggate-site.ps1" -Push
set "UpdateResult=%errorlevel%"
popd
if not "%UpdateResult%"=="0" goto failed
exit /b 0

:failed
echo.
echo Website update failed. Review the error above.
pause
exit /b 1
