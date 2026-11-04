@echo off
setlocal
pushd "%~dp0"
if errorlevel 1 goto folder_failed
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0export-moggate-json.ps1"
if errorlevel 1 goto export_failed
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-moggate-site.ps1" -SkipJsonCopy -Push
if errorlevel 1 goto update_failed
popd
echo.
echo Export and update completed.
pause
exit /b 0

:export_failed
echo.
echo ESPN export failed. The website update was not run.
goto failed

:update_failed
echo.
echo Website update failed. Review the error above.
goto failed

:folder_failed
echo Could not open the project folder.
pause
exit /b 1

:failed
popd
echo This window will stay open until you press a key.
pause
exit /b 1
