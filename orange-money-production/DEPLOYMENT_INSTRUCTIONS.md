# 🚀 Orange Money Backend Production Deployment

## Quick Deployment to dreamexdatalab.com

Your site already has the proper IIS configuration in `web.config` to proxy API requests to the Orange Money backend. Follow these steps:

### 1. **Deploy the Backend** (Run from the orange-money-production directory)
```powershell
.\deploy-to-production.ps1
```

This will:
- ✅ Stop any existing Orange Money processes
- ✅ Set up production environment (port 8080)
- ✅ Install dependencies
- ✅ Start the Orange Money server
- ✅ Test the service health

### 2. **Set Up as Windows Service** (Optional - for automatic startup)
```powershell
.\setup-windows-service.ps1
```

This will:
- ✅ Install PM2 process manager
- ✅ Set up Orange Money as a Windows service
- ✅ Configure automatic restart and logging
- ✅ Enable automatic startup on system boot

## 🔗 API Endpoints After Deployment

Once deployed, your Orange Money API will be available at:

| Endpoint | URL | Purpose |
|----------|-----|---------|
| **Payment Initiation** | `https://dreamexdatalab.com/api/payments/initiate` | Start a payment |
| **Payment Webhook** | `https://dreamexdatalab.com/api/payments/webhook` | Orange Money callbacks |
| **Health Check** | `https://dreamexdatalab.com/health` | Service status |
| **Success Page** | `https://dreamexdatalab.com/success.html` | Payment success |
| **Cancel Page** | `https://dreamexdatalab.com/cancel.html` | Payment cancelled |

## 🔧 How It Works

Your existing `web.config` file contains these rules that proxy API requests:

```xml
<!-- Proxy all /api/* requests to the Node backend on localhost:8080 -->
<rule name="Proxy API to Node" stopProcessing="true">
  <match url="^api/(.*)" ignoreCase="true" />
  <action type="Rewrite" url="http://localhost:8080/{R:0}" logRewrittenUrl="true" />
</rule>

<!-- Proxy /health to the Node backend -->
<rule name="Proxy Health to Node" stopProcessing="true">
  <match url="^health$" ignoreCase="true" />
  <action type="Rewrite" url="http://localhost:8080/health" logRewrittenUrl="true" />
</rule>
```

## 🧪 Testing the Deployment

1. **Test API Health**:
   ```
   https://dreamexdatalab.com/health
   ```
   Should return: `{"status":"healthy","service":"Orange Money Payment Gateway"}`

2. **Test CORS Headers**:
   Open your company registration page and check browser console - no CORS errors should appear.

3. **Test Payment Flow**:
   - Fill out company registration form
   - Click "Pay with Orange Money"
   - Payment modal should load without errors

## 🔍 Troubleshooting

### If the service doesn't start:
1. Check Node.js is installed: `node --version`
2. Check port 8080 is free: `netstat -an | findstr :8080`
3. Check logs: `pm2 logs` (if using PM2)

### If CORS errors persist:
1. Verify the server is running on port 8080
2. Check IIS Application Request Routing (ARR) is enabled
3. Verify web.config proxy rules are active

### If payments fail:
1. Check Orange Money credentials in `.env.production`
2. Verify your domain is registered with Orange Money
3. Check webhook URL configuration in Orange Money portal

## 📝 Orange Money Portal Configuration

Make sure your Orange Money merchant portal has these settings:

- **Return URL**: `https://dreamexdatalab.com/success.html`
- **Cancel URL**: `https://dreamexdatalab.com/cancel.html`  
- **Webhook URL**: `https://dreamexdatalab.com/api/payments/webhook`
- **Domain**: `dreamexdatalab.com`

## 🎉 Success!

Once deployed, your company registration page will be able to:
- ✅ Connect to the Orange Money API without CORS errors
- ✅ Process payments through Orange Money
- ✅ Handle success/cancel redirects properly
- ✅ Receive webhook notifications

The deployment ensures your Orange Money backend runs on `localhost:8080` where your IIS web.config expects it, making all API calls work seamlessly.