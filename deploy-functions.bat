@echo off
REM Windows Batch Script to Deploy Firebase Functions

echo =====================================
echo Firebase Functions Deployment Script
echo =====================================
echo.

REM Run PowerShell script
powershell -ExecutionPolicy Bypass -File "%~dp0deploy-functions.ps1"

pause
