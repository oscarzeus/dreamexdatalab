@echo off
cd /d "C:\Users\Dreamex Lab\dreamexdatalab\orange-webpay"
set NODE_ENV=production
set PORT=8080
echo Starting Orange Money Backend...
node server.js
pause
