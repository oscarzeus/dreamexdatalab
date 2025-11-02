import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import paymentRoutes from './routes/payments.js';

// Load environment variables
dotenv.config();

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const allowedOrigins = [
  process.env.DOMAIN || 'https://dreamexdatalab.com',
  'https://api.dreamexdatalab.com',
  'http://localhost:3000',
  'http://localhost:3001', 
  'http://localhost:3002',
  'http://localhost:5500', // Live Server default port
  'http://127.0.0.1:5500',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
];

// In development, allow all localhost origins
if (process.env.NODE_ENV === 'development') {
  app.use(cors({
    origin: true, // Allow all origins in development
    credentials: true,
  }));
} else {
  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
  }));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Trop de requêtes, veuillez réessayer plus tard.',
  },
});

app.use(limiter);

// Logging
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/payments', paymentRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  });
});

// Main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Success page
app.get('/payment/success.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'success.html'));
});

// Cancel page
app.get('/payment/cancel.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'cancel.html'));
});

// Backward compatibility (redirect to .html versions)
app.get('/payment/success', (req, res) => {
  res.redirect('/payment/success.html');
});

app.get('/payment/cancel', (req, res) => {
  res.redirect('/payment/cancel.html');
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'ROUTE_NOT_FOUND',
    message: 'Route non trouvée',
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('🚨 Global error handler:', error);
    
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Une erreur interne est survenue',
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
🚀 ORANGE MONEY PAYMENT GATEWAY
📍 Environment: ${process.env.NODE_ENV || 'development'}
📍 Port: ${PORT}
📍 Domain: ${process.env.DOMAIN || 'http://localhost:' + PORT}
📍 Health: http://localhost:${PORT}/health
📍 Ready to accept payments!
  `);
});

export default app;
