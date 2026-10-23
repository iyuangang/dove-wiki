@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\Rollback-Website.ps1" %*
exit /b %errorlevel%
