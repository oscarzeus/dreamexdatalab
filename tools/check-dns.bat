@echo off
echo Checking DNS propagation for api.dreamexdatalab.com...
echo.

echo Testing DNS lookup:
nslookup api.dreamexdatalab.com
echo.

echo If you see an IP address or CNAME result, DNS is working!
echo If you see "Non-existent domain", wait a few more minutes.

pause