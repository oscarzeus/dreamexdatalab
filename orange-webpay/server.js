// Load environment variables from .env/.env.local if present
try {
    const fs = require('fs');
    const dotenv = require('dotenv');
    const localEnv = require('path').join(__dirname, '.env.local');
    const baseEnv = require('path').join(__dirname, '.env');
    if (fs.existsSync(localEnv)) {
        dotenv.config({ path: localEnv });
    } else if (fs.existsSync(baseEnv)) {
        dotenv.config({ path: baseEnv });
    }
} catch (_) { /* dotenv optional */ }

const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// CORS (allow dreamexdatalab.com origins and same-origin)
app.use((req, res, next) => {
    try {
        const origin = req.headers.origin;
        if (origin) {
            // Allow same-origin and *.dreamexdatalab.com
            const u = new URL(origin);
            const host = u.hostname.toLowerCase();
            const allowDev = process.env.NODE_ENV !== 'production' && (host === 'localhost' || host === '127.0.0.1');
            if (host === 'dreamexdatalab.com' || host.endsWith('.dreamexdatalab.com') || allowDev) {
                res.setHeader('Access-Control-Allow-Origin', origin);
                res.setHeader('Vary', 'Origin');
                res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
                res.setHeader('Access-Control-Max-Age', '86400');
            }
        }
        if (req.method === 'OPTIONS') return res.sendStatus(204);
        next();
    } catch (e) {
        next();
    }
});

// ============================================================================
// CONFIGURATION - REMPLACEZ AVEC VOS VRAIES CRÉDENTIALS
// ============================================================================

const ORANGE_CONFIG = {
    // Fourni par Orange Money Guinée
    client_id: process.env.ORANGE_CLIENT_ID || process.env.CLIENT_ID || process.env.OM_CLIENT_ID || 'ZLw7FjAEJ3h97ZcF2k2qG93tq2LDFsFM',
    client_secret: process.env.ORANGE_CLIENT_SECRET || process.env.CLIENT_SECRET || process.env.OM_CLIENT_SECRET || '',
    // Merchant key fourni par Orange Money (WebPay GN)
    merchant_key: process.env.ORANGE_MERCHANT_KEY || process.env.MERCHANT_KEY || process.env.OM_MERCHANT_KEY || '427ab675',
    // Application ID (si requis par Orange/partenaire)
    application_id: process.env.ORANGE_APPLICATION_ID || process.env.APPLICATION_ID || process.env.APP_ID || process.env.OM_APP_ID || 'sdbSYSBaO2e2Dg60',
    // En-tête Authorization "Basic ..." (optionnel si calculé à partir de client_id:client_secret)
    // Utiliser uniquement si spécifié dans l'environnement; sinon, sera calculé dynamiquement
    authorization: process.env.ORANGE_AUTH_BASIC || process.env.AUTH_BASIC || process.env.OM_AUTHORIZATION
};

// ============================================================================
// FONCTIONS PRINCIPALES
// ============================================================================

let accessToken = null;
let tokenExpiry = null;

// Fonction pour obtenir le token d'accès
async function getOrangeToken() {
    if (accessToken && Date.now() < tokenExpiry) {
        console.log('✅ Utilisation du token existant');
        return accessToken;
    }

    console.log('🔄 Obtention d\'un nouveau token...');
    
    try {
        if (!ORANGE_CONFIG.client_id || !ORANGE_CONFIG.client_secret) {
            throw new Error('Missing client credentials. Set ORANGE_CLIENT_ID and ORANGE_CLIENT_SECRET.');
        }
        const basicHeader = ORANGE_CONFIG.authorization || ('Basic ' + Buffer.from(
            `${ORANGE_CONFIG.client_id}:${ORANGE_CONFIG.client_secret}`
        ).toString('base64'));

        const response = await axios.post(
            'https://api.orange.com/oauth/v3/token',
            'grant_type=client_credentials',
            {
                headers: {
                    'Authorization': basicHeader,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                timeout: 10000
            }
        );

        accessToken = response.data.access_token;
        tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 300000;
        
        console.log('✅ Nouveau token obtenu avec succès');
        return accessToken;
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'obtention du token:', error.response?.data || error.message);
        throw new Error('Impossible de se connecter à Orange Money');
    }
}

// ============================================================================
// ROUTES PRINCIPALES
// ============================================================================

// Route principale - sert le formulaire de paiement
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Route pour la page de test API
app.get('/api-test.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'api-test.html'));
});

// Route explicite pour index.html
app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Handler commun d'initiation de paiement (utilisé par /api/pay et /api/checkout)
async function initiatePayment(req, res) {
    console.log('🔄 Nouvelle demande de paiement:', req.body);
    
    try {
        const { amount, phone: rawPhone, customerMsisdn, orderId: providedOrderId, description, nextUrl, currency } = req.body || {};
        
        // Validation des données
        if (!amount || amount < 1000) {
            return res.json({ 
                success: false, 
                error: 'Le montant minimum est de 1000 GNF' 
            });
        }

        // Normaliser le téléphone (accepter phone ou customerMsisdn)
        const normalizedPhone = String((rawPhone ?? customerMsisdn ?? '')).replace(/\D/g, '');
        if (!normalizedPhone || !/^[0-9]{9}$/.test(normalizedPhone)) {
            return res.json({ 
                success: false, 
                error: 'Numéro de téléphone invalide. Utilisez 9 chiffres.' 
            });
        }
        
        // Obtenir le token
        const token = await getOrangeToken();
        
        // Préparer les données de paiement
        const orderId = providedOrderId && String(providedOrderId).trim() ? String(providedOrderId).trim() : 'CMD' + Date.now();
        // Build full candidate payload
        const publicBase = getPublicBaseUrl();
        const notifBase = getNotifBaseUrl(req);
        const returnUrl = (nextUrl && typeof nextUrl === 'string' && nextUrl.startsWith('http') && isPublicHttpUrl(nextUrl))
            ? `${nextUrl}${nextUrl.includes('?') ? '&' : '?'}order_id=${orderId}`
            : `${publicBase}/success.html?order_id=${orderId}`;
        const cancelUrl = `${publicBase}/cancel.html?order_id=${orderId}`;

        const paymentData = {
            merchant_key: ORANGE_CONFIG.merchant_key,
            currency: (currency && typeof currency === 'string' ? currency.toUpperCase() : 'GNF'),
            order_id: orderId,
            amount: amount,
            return_url: returnUrl,
            cancel_url: cancelUrl,
            notif_url: `${notifBase}/api/webhook`
        };

        // Only include non-standard fields when explicitly enabled
        const includePhone = String(process.env.OM_INCLUDE_PHONE || '').toLowerCase() === 'true';
        // Default include application_id unless explicitly disabled
        const includeAppId = (process.env.OM_INCLUDE_APP_ID == null)
            ? true
            : String(process.env.OM_INCLUDE_APP_ID).toLowerCase() === 'true';
        const includeLang = String(process.env.OM_INCLUDE_LANG || '').toLowerCase() === 'true';
        const includeReference = String(process.env.OM_INCLUDE_REFERENCE || '').toLowerCase() === 'true';
        if (includePhone) {
            paymentData.phone = normalizedPhone;
        }
        if (includeAppId && ORANGE_CONFIG.application_id) {
            paymentData.application_id = ORANGE_CONFIG.application_id;
        }
        if (includeLang) {
            paymentData.lang = 'fr';
        }
        if (includeReference) {
            paymentData.reference = description && String(description).trim() ? String(description).trim() : "REF" + orderId;
        }

        // Create the minimal payload Orange expects (omit any unknown fields by default)
        const payloadToOrange = {
            merchant_key: paymentData.merchant_key,
            currency: paymentData.currency,
            order_id: paymentData.order_id,
            amount: paymentData.amount,
            return_url: paymentData.return_url,
            cancel_url: paymentData.cancel_url,
            notif_url: paymentData.notif_url
        };
        if (includeAppId && paymentData.application_id) payloadToOrange.application_id = paymentData.application_id;
        if (includePhone && paymentData.phone) payloadToOrange.phone = paymentData.phone;
        if (includeLang && paymentData.lang) payloadToOrange.lang = paymentData.lang;
        if (includeReference && paymentData.reference) payloadToOrange.reference = paymentData.reference;

        console.log('📤 Envoi de la demande de paiement à Orange...');
        
        // Mode debug: renvoyer le payload sans appeler Orange
        if (req.query && req.query.debug === '1') {
            const { merchant_key, ...safePayload } = payloadToOrange; // ne pas renvoyer la clé marchande
            return res.json({ success: true, debug: true, payload: safePayload, computed: { publicBase, notifBase } });
        }
        
        // Envoyer la demande de paiement à Orange
        const orangeResponse = await axios.post(
            'https://api.orange.com/orange-money-webpay/gn/v1/webpayment',
            payloadToOrange,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );

        console.log('✅ Réponse d\'Orange:', orangeResponse.data);
        
        res.json({
            success: true,
            ok: true,
            payment_url: orangeResponse.data.payment_url,
            redirectUrl: orangeResponse.data.payment_url,
            order_id: orderId
        });

    } catch (error) {
        const status = error.response?.status;
        const data = error.response?.data;
        console.error('❌ Erreur de paiement:', status, data || error.message);

        let errorMessage = 'Erreur lors de la création du paiement';
        if (data?.message) errorMessage = data.message;
        else if (error.code === 'ECONNABORTED') errorMessage = 'Timeout - Service Orange Money non disponible';

        res.status(200).json({
            success: false,
            ok: false,
            error: errorMessage,
            status,
            details: data || undefined
        });
    }
}

// Route pour initier un paiement (avec error handler)
app.post('/api/pay', async (req, res) => {
    try {
        await initiatePayment(req, res);
    } catch (error) {
        console.error('❌ Error in /api/pay:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error: ' + error.message 
        });
    }
});

// Alias pour compatibilité
app.post('/api/checkout', async (req, res) => {
    try {
        await initiatePayment(req, res);
    } catch (error) {
        console.error('❌ Error in /api/checkout:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error: ' + error.message 
        });
    }
});

// Webhook pour les notifications de paiement
app.post('/api/webhook', (req, res) => {
    console.log('📩 Notification de paiement reçue:', req.body);
    
    // Traiter la notification de paiement
    const { order_id, status, amount, phone } = req.body;
    
    if (status === 'SUCCESS') {
        console.log(`✅ Paiement réussi pour la commande ${order_id}`);
        console.log(`📞 Numéro: ${phone}, 💰 Montant: ${amount} GNF`);
        
        // Ici vous pouvez:
        // - Mettre à jour votre base de données
        // - Envoyer un email de confirmation
        // - Activer un service, etc.
    } else if (status === 'FAIL') {
        console.log(`❌ Paiement échoué pour la commande ${order_id}`);
    }
    
    res.status(200).send('OK');
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// Debug config (non-sensitive)
app.get('/api/debug/config', (req, res) => {
    const cfg = {
        env: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 8080,
        public_base_url: getPublicBaseUrl(),
        api_base_url: getApiBaseUrl(req),
        notif_base_url: getNotifBaseUrl(req),
        merchant_key_present: !!ORANGE_CONFIG.merchant_key,
        client_id_present: !!ORANGE_CONFIG.client_id,
        client_id_masked: ORANGE_CONFIG.client_id ? ORANGE_CONFIG.client_id.replace(/.(?=.{4})/g, '*') : null,
        client_secret_present: !!ORANGE_CONFIG.client_secret,
        application_id_present: !!ORANGE_CONFIG.application_id,
        application_id_masked: ORANGE_CONFIG.application_id ? ORANGE_CONFIG.application_id.replace(/.(?=.{4})/g, '*') : null,
        has_basic_header: !!ORANGE_CONFIG.authorization,
        token_url: 'https://api.orange.com/oauth/v3/token',
        payment_url: 'https://api.orange.com/orange-money-webpay/gn/v1/webpayment',
        status_url: 'https://api.orange.com/orange-money-webpay/gn/v1/transactionstatus'
    };
    res.json(cfg);
});

// Simple endpoint to verify OAuth token retrieval without exposing the token
app.get('/api/test-token', async (req, res) => {
    try {
        const token = await getOrangeToken();
        const ttlMs = Math.max(0, tokenExpiry - Date.now());
        res.json({ ok: true, success: true, tokenPresent: !!token, expiresInSec: Math.round(ttlMs / 1000) });
    } catch (err) {
        res.status(500).json({ ok: false, success: false, error: err.message });
    }
});

// Simple echo endpoint to verify JSON responses
app.get('/api/echo', (req, res) => {
    res.json({
        success: true,
        message: 'echo',
        method: req.method,
        path: req.path,
        time: new Date().toISOString()
    });
});

// Page de succès
app.get('/success', (req, res) => {
    const orderId = req.query.order_id || 'Inconnu';
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Paiement Réussi</title>
            <style>
                body { 
                    font-family: Arial; 
                    text-align: center; 
                    padding: 50px; 
                    background: #f5f5f5;
                }
                .success-box {
                    background: white;
                    padding: 40px;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    max-width: 500px;
                    margin: 0 auto;
                }
                h2 { color: #28a745; }
                .btn { 
                    display: inline-block; 
                    padding: 10px 20px; 
                    background: #FF6600; 
                    color: white; 
                    text-decoration: none; 
                    border-radius: 5px; 
                    margin-top: 20px;
                }
                .info {
                    background: #e7f3ff;
                    padding: 15px;
                    border-radius: 5px;
                    margin: 20px 0;
                }
            </style>
        </head>
        <body>
            <div class="success-box">
                <h2>✅ Paiement Réussi!</h2>
                <div class="info">
                    <strong>Commande: ${orderId}</strong><br>
                    Votre paiement a été traité avec succès.
                </div>
                <p>📱 <strong>Code OTP validé avec succès</strong></p>
                <p>Vous recevrez une confirmation par SMS de Orange Money.</p>
                <a href="/" class="btn">Retour à l'accueil</a>
            </div>
        </body>
        </html>
    `);
});

// Page d'annulation
app.get('/cancel', (req, res) => {
    const orderId = req.query.order_id || 'Inconnu';
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Paiement Annulé</title>
            <style>
                body { 
                    font-family: Arial; 
                    text-align: center; 
                    padding: 50px; 
                    background: #f5f5f5;
                }
                .cancel-box {
                    background: white;
                    padding: 40px;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    max-width: 500px;
                    margin: 0 auto;
                }
                h2 { color: #dc3545; }
                .btn { 
                    display: inline-block; 
                    padding: 10px 20px; 
                    background: #FF6600; 
                    color: white; 
                    text-decoration: none; 
                    border-radius: 5px; 
                    margin-top: 20px;
                }
                .info {
                    background: #fff3cd;
                    padding: 15px;
                    border-radius: 5px;
                    margin: 20px 0;
                }
            </style>
        </head>
        <body>
            <div class="cancel-box">
                <h2>❌ Paiement Annulé</h2>
                <div class="info">
                    <strong>Commande: ${orderId}</strong><br>
                    Vous avez annulé le paiement.
                </div>
                <p>Le code OTP n'a pas été validé ou vous avez annulé l'opération.</p>
                <p>Aucun montant n'a été débité de votre compte Orange Money.</p>
                <a href="/" class="btn">Réessayer le paiement</a>
            </div>
        </body>
        </html>
    `);
});

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

function getPublicBaseUrl() {
    // Prefer explicit public base override
    const override = process.env.ORANGE_PUBLIC_BASE || process.env.PUBLIC_BASE_URL || process.env.BASE_URL;
    if (override && /^https?:\/\//i.test(override)) {
        try {
            const u = new URL(override);
            const host = u.hostname.toLowerCase();
            if (host !== 'localhost' && host !== '127.0.0.1') {
                return override.replace(/\/$/, '');
            }
        } catch (_) {}
    }
    // Default public site (GitHub Pages in Option B)
    return 'https://dreamexdatalab.com';
}

function getApiBaseUrl(req) {
    if (process.env.NODE_ENV === 'production') {
        // Use current host (api subdomain in Option B)
        const host = req.get('host');
        return `https://${host}`;
    }
    return `http://localhost:${process.env.PORT || 8080}`;
}

// ============================================================================
// URL de notification (Doit être publique; localhost/127.0.0.1 interdits par Orange)
function getNotifBaseUrl(req) {
    const override = process.env.ORANGE_NOTIF_BASE || process.env.NOTIF_BASE_URL;
    if (override && /^https?:\/\//i.test(override)) {
        return override.replace(/\/$/, '');
    }
    if (process.env.NODE_ENV === 'production') {
        const host = (req.get('host') || '').toLowerCase();
        if (host.includes('localhost') || host.includes('127.0.0.1')) {
            // Fallback to intended public API subdomain
            return 'https://api.dreamexdatalab.com';
        }
        return `https://${host}`;
    }
    // In dev, fallback to public site domain so it's not localhost
    return 'https://dreamexdatalab.com';
}

function isPublicHttpUrl(url) {
    try {
        const u = new URL(url);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
        const host = u.hostname.toLowerCase();
        if (host === 'localhost' || host === '127.0.0.1') return false;
        return true;
    } catch (_) {
        return false;
    }
}

// ============================================================================
// CATCH-ALL ERROR HANDLER - Must be last
// ============================================================================

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'API endpoint not found: ' + req.path 
    });
});

// General error handler
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    
    // If it's an API route, return JSON
    if (req.path.startsWith('/api/')) {
        return res.status(500).json({ 
            success: false, 
            error: 'Server error: ' + err.message 
        });
    }
    
    // Otherwise return HTML error page
    res.status(500).send('<h1>Server Error</h1><p>' + err.message + '</p>');
});

// ============================================================================
// DÉMARRAGE DU SERVEUR
// ============================================================================

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log('🚀 Serveur démarré sur http://localhost:' + PORT);
    console.log('');
    console.log('📱 FLUX DE PAIEMENT COMPLET:');
    console.log('   1. User entre montant & téléphone');
    console.log('   2. Redirection vers Orange Money');
    console.log('   3. User reçoit OTP par SMS');
    console.log('   4. User entre OTP dans page Orange');
    console.log('   5. Paiement confirmé');
    console.log('   6. Retour vers votre site');
    console.log('');
    console.log('🔑 PROCHAINES ÉTAPES:');
    console.log('   1. Obtenir credentials chez Orange Money Guinée');
    console.log('   2. Remplacer les credentials dans server.js');
    console.log('   3. Tester avec un vrai numéro Orange Money');
});
