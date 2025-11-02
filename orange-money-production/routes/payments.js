import express from 'express';
import axios from 'axios';
import OrangeMoneyAuth from '../middleware/auth.js';
import OrangeMoneyConfig from '../config/orange-money.js';

const router = express.Router();

// Input validation middleware
const validatePaymentRequest = (req, res, next) => {
  const { amount, phone, order_id, description } = req.body;

  if (!amount || amount < 1000) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_AMOUNT',
      message: 'Le montant minimum est de 1000 GNF'
    });
  }

  if (!phone || !/^[0-9]{9}$/.test(phone)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_PHONE',
      message: 'Numéro de téléphone invalide. Format: 9 chiffres (ex: 624123456)'
    });
  }

  if (!order_id) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_ORDER_ID',
      message: 'Identifiant de commande requis'
    });
  }

  next();
};

// Initiate payment
router.post('/initiate', validatePaymentRequest, async (req, res) => {
  try {
    const { amount, phone, order_id, description } = req.body;
        
    console.log('💰 Initiating payment:', { order_id, amount, phone });

    // Get Orange Money access token
    const accessToken = await OrangeMoneyAuth.getAccessToken();

    // Prepare payment data
    const sep = (OrangeMoneyConfig.urls.return.includes('?') ? '&' : '?');
    const csep = (OrangeMoneyConfig.urls.cancel.includes('?') ? '&' : '?');
    const paymentData = {
      merchant_key: OrangeMoneyConfig.credentials.merchantKey,
      currency: OrangeMoneyConfig.currency,
      order_id: order_id,
      amount: parseInt(amount),
      return_url: `${OrangeMoneyConfig.urls.return}${sep}order_id=${order_id}`,
      cancel_url: `${OrangeMoneyConfig.urls.cancel}${csep}order_id=${order_id}`,
      notif_url: OrangeMoneyConfig.urls.notification,
      lang: OrangeMoneyConfig.language,
      reference: `REF_${order_id}`,
      ...(description && { description: description }),
      ...(OrangeMoneyConfig.applicationId && { application_id: OrangeMoneyConfig.applicationId })
    };

    console.log('📤 Sending payment request to Orange Money:', paymentData);

    // Send payment request to Orange Money
    const orangeResponse = await axios.post(
      OrangeMoneyConfig.urls.payment,
      paymentData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 15000
      }
    );

    console.log('✅ Orange Money response:', orangeResponse.data);

    // Return payment URL to frontend
    res.json({
      success: true,
      payment_url: orangeResponse.data.payment_url,
      order_id: order_id,
      notif_token: orangeResponse.data.notif_token,
      message: 'Paiement initialisé avec succès. Redirection vers Orange Money...'
    });

  } catch (error) {
    console.error('❌ Payment initiation error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });

    let errorCode = 'PAYMENT_INITIATION_FAILED';
    let errorMessage = 'Erreur lors de la création du paiement';

    if (error.response?.data) {
      errorCode = error.response.data.code || errorCode;
      errorMessage = error.response.data.message || errorMessage;
    } else if (error.code === 'ECONNABORTED') {
      errorCode = 'TIMEOUT_ERROR';
      errorMessage = 'Service Orange Money temporairement indisponible';
    }

    res.status(500).json({
      success: false,
      error: errorCode,
      message: errorMessage
    });
  }
});

// Payment webhook (for status updates)
router.post('/webhook', express.json(), async (req, res) => {
  try {
    const webhookData = req.body;
        
    console.log('📩 Orange Money Webhook Received:', webhookData);

    // Validate webhook signature (if provided)
    // await OrangeMoneyAuth.validateWebhookSignature(signature, webhookData);

    const { order_id, status, amount, phone, transaction_id, message } = webhookData;

    // Update your database based on payment status
    switch (status) {
      case 'SUCCESS':
        console.log(`✅ Payment successful for order ${order_id}`);
        // Update order status to "paid"
        // Send confirmation email
        // Activate user subscription, etc.
        break;
                
      case 'FAILED':
        console.log(`❌ Payment failed for order ${order_id}: ${message}`);
        // Update order status to "failed"
        // Notify user
        break;
                
      case 'CANCELLED':
        console.log(`⚠️ Payment cancelled for order ${order_id}`);
        // Update order status to "cancelled"
        break;
                
      default:
        console.log(`🔔 Unknown payment status for order ${order_id}: ${status}`);
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ status: 'WEBHOOK_RECEIVED' });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(200).json({ status: 'WEBHOOK_RECEIVED' }); // Still return 200
  }
});

// Check payment status
router.get('/status/:order_id', async (req, res) => {
  try {
    const { order_id } = req.params;
        
    // In a real implementation, you would:
    // 1. Check your database for the payment status
    // 2. Or call Orange Money's transaction status API
        
    // This is a simplified version
    res.json({
      success: true,
      order_id: order_id,
      status: 'PENDING', // This would come from your database
      last_updated: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Status check error:', error);
    res.status(500).json({
      success: false,
      error: 'STATUS_CHECK_FAILED',
      message: 'Erreur lors de la vérification du statut'
    });
  }
});

export default router;
