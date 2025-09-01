@echo off
echo 🎯 EMAIL SERVICE STATUS VERIFICATION
echo ===================================

echo Step 1: Checking PM2 Service Status...
pm2 status dreamex-email-service

echo.
echo Step 2: Testing Service Health...
curl -s http://localhost:3001/health | findstr "status"

echo.
echo Step 3: Checking Port Usage...
netstat -ano | findstr :3001 | findstr LISTENING

echo.
echo Step 4: Running Email Test...
node test-email-send.js

echo.
echo ✅ VERIFICATION COMPLETE!
echo.
echo If all steps show success:
echo   ✅ PM2 service is running (status: online)
echo   ✅ Health check returns "healthy" 
echo   ✅ Port 3001 is listening
echo   ✅ Test email sends successfully
echo.
echo Your staff reminder emails should now work in staff.html!
echo.
pause
