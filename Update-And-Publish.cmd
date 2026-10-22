@echo off
setlocal
node "%~dp0tools\publish-update.mjs" %*
set "publish_result=%errorlevel%"
if "%~1"=="" pause
exit /b %publish_result%
