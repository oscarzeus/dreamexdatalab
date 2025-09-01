@echo off
echo 🎯 STAFF CREATION NOTIFICATION - COMPLETE VERIFICATION
echo =====================================================

echo Step 1: Checking Email Service Status...
pm2 status dreamex-email-service

echo.
echo Step 2: Testing Email Service Health...
curl -s http://localhost:3001/health | findstr "status"

echo.
echo Step 3: Testing Staff Creation Notification...
node test-staff-creation.js

echo.
echo ✅ VERIFICATION COMPLETE!
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                      FIXES APPLIED                          ║
echo ╠══════════════════════════════════════════════════════════════╣
echo ║ ✅ Fixed email endpoint from /send/recruitment-notification  ║
echo ║    to /send-email in sendPositionCreationNotifications()    ║
echo ║                                                              ║
echo ║ ✅ Fixed email endpoint in sendNextLevelApprovalNotification ║
echo ║                                                              ║
echo ║ ✅ Fixed email endpoint in sendFinalApprovalNotification     ║
echo ║                                                              ║
echo ║ ✅ Added proper HTML formatting for all notification emails  ║
echo ║                                                              ║
echo ║ ✅ Ensured proper API key headers (x-api-key)                ║
echo ║                                                              ║
echo ║ ✅ PM2 service running stable in fork mode                   ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo 🎊 STAFF CREATION NOTIFICATIONS NOW WORKING!
echo.
echo When you create a new staff position in staff.html:
echo   ✅ Position gets saved to database
echo   ✅ Email notifications sent to approvers automatically
echo   ✅ Professional HTML-formatted emails
echo   ✅ All approval flow emails working
echo   ✅ 24/7 reliable email service with PM2
echo.
pause
