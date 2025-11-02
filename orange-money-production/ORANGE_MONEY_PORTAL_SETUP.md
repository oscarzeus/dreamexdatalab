# 🔧 Orange Money Portal Configuration Guide

## 📋 Required Callback URLs for dreamexdatalab.com

Configure these **EXACT** URLs in your Orange Money merchant portal:

### ✅ Primary Callback URLs
| Purpose | URL | Description |
|---------|-----|-------------|
| **Success Return URL** | `https://dreamexdatalab.com/company-complete-registration.html?payment=success` | Where users go after successful payment |
| **Cancel Return URL** | `https://dreamexdatalab.com/company-complete-registration.html?payment=cancel` | Where users go if they cancel payment |
| **Notification URL (Webhook)** | `https://api.dreamexdatalab.com/api/payments/webhook` | Where Orange sends payment status updates |

### 🔍 Portal Access Information
- **Portal URL**: Contact your Orange Money business representative
- **Login Credentials**: Use your merchant account credentials
- **Merchant ID**: Your assigned merchant identifier

## 📋 Step-by-Step Portal Configuration

### 1. Login to Orange Money Portal
1. Navigate to your Orange Money merchant portal
2. Login with your merchant credentials
3. Go to **Application Settings** or **Integration Settings**

### 2. Configure Application Details
- **Application Name**: `dreamexdatalab Payment Gateway`
- **Application ID**: `sdbSYSBaO2e2Dg60` ✓ (already configured)
- **Client ID**: `ZLw7FjAEJ3h97ZcF2k2qG93tq2LDFsFM` ✓ (already configured)
- **Environment**: `Production`

### 3. Set Callback URLs
Navigate to **Callback Configuration** or **URLs** section:

#### Return URLs
```
Success URL: https://dreamexdatalab.com/company-complete-registration.html?payment=success
Cancel URL:  https://dreamexdatalab.com/company-complete-registration.html?payment=cancel
```

#### Notification/Webhook URLs
```
Notification URL: https://api.dreamexdatalab.com/api/payments/webhook
```

#### Optional URLs (if available)
```
Logo URL: https://dreamexdatalab.com/assets/logo.png
Terms URL: https://dreamexdatalab.com/terms
Privacy URL: https://dreamexdatalab.com/privacy
```

### 4. Configure Payment Settings
- **Currency**: `GNF` (Guinea Franc)
- **Language**: `fr` (French)
- **Payment Methods**: Orange Money
- **Country**: Guinea (GN)

### 5. Security Settings
- **IP Whitelist** (if required): Add your server IP
- **Webhook Security**: Enable if available
- **SSL Verification**: Ensure enabled

### 6. Test Configuration
Before going live, use Orange Money's test environment:
- **Test Success URL**: `https://dreamexdatalab.com/company-complete-registration.html?payment=success&test=1`
- **Test Cancel URL**: `https://dreamexdatalab.com/company-complete-registration.html?payment=cancel&test=1`
- **Test Webhook URL**: `https://api.dreamexdatalab.com/api/payments/webhook`

## 🧪 Testing Checklist

### URL Testing
- [ ] Success URL loads correctly: `https://dreamexdatalab.com/company-complete-registration.html?payment=success`
- [ ] Cancel URL loads correctly: `https://dreamexdatalab.com/company-complete-registration.html?payment=cancel`
- [ ] Webhook URL responds with 200: `https://api.dreamexdatalab.com/api/payments/webhook`
- [ ] SSL certificate is valid for all URLs

### Payment Flow Testing
- [ ] Initiate test payment from your site
- [ ] Verify redirect to Orange Money works
- [ ] Complete test payment with OTP
- [ ] Confirm return to success page
- [ ] Check webhook receives status update
- [ ] Test cancellation flow

### Webhook Testing
Test webhook endpoint manually:
```bash
curl -X POST https://dreamexdatalab.com/api/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "test_123",
    "status": "SUCCESS",
    "amount": 1000,
    "currency": "GNF",
    "transaction_id": "OM123456789",
    "phone": "624123456"
  }'
```

Expected response: `{"status":"WEBHOOK_RECEIVED"}`

## 📞 Support Contacts

### Orange Money Guinea Support
- **Technical Support**: Contact your integration manager
- **Documentation**: Request API documentation
- **Portal Issues**: Report via merchant support channel

### Common Portal Sections
Different portals may use different terminology:
- **Integration Settings** / **API Settings** / **Developer Settings**
- **Callback URLs** / **Return URLs** / **Webhook URLs**
- **Application Configuration** / **App Settings**

## ⚠️ Important Notes

### SSL Requirements
- **HTTPS is mandatory** for all callback URLs
- Certificate must be valid (not self-signed)
- URLs must be publicly accessible
- Test SSL: https://www.ssllabs.com/ssltest/

### URL Format Rules
- Must start with `https://`
- No trailing slashes
- Case-sensitive paths
- Must be publicly accessible (no localhost, 192.168.x.x, etc.)

### Go-Live Checklist
- [ ] All URLs configured and tested
- [ ] SSL certificate valid
- [ ] Application approved by Orange Money
- [ ] Test transactions completed successfully
- [ ] Webhook handling tested
- [ ] Production credentials activated

## 🔧 Troubleshooting

### Common Issues
1. **URLs not reachable**: Check DNS and firewall
2. **SSL errors**: Verify certificate validity
3. **Webhook not received**: Check server logs and firewall
4. **Payment fails**: Verify credentials and URL configuration

### Verification Commands
```bash
# Test URL accessibility
curl -I https://dreamexdatalab.com/payment/success.html
curl -I https://dreamexdatalab.com/payment/cancel.html
curl -I https://dreamexdatalab.com/api/payments/webhook

# Test SSL certificate
openssl s_client -connect dreamexdatalab.com:443 -servername dreamexdatalab.com
```

---

**✅ Once configured, your Orange Money integration will be ready for live transactions!**