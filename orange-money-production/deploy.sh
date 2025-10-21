#!/bin/bash

# 🚀 Orange Money Production Deployment Script
# Run this script on your production server

set -e

echo "🚀 Starting Orange Money Payment Gateway deployment..."

# Configuration
APP_NAME="orange-money-payment"
APP_DIR="/var/www/orange-money-production"
DOMAIN="dreamexdatalab.com"
NODE_VERSION="18"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root for security reasons"
   exit 1
fi

# Update system
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js
print_status "Installing Node.js ${NODE_VERSION}..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node.js installation
NODE_VERSION_INSTALLED=$(node --version)
print_status "Node.js installed: $NODE_VERSION_INSTALLED"

# Install PM2
print_status "Installing PM2 process manager..."
sudo npm install -g pm2

# Install Nginx
print_status "Installing Nginx..."
sudo apt install nginx -y

# Install Certbot for SSL
print_status "Installing Certbot for SSL certificates..."
sudo apt install certbot python3-certbot-nginx -y

# Create application directory
print_status "Setting up application directory..."
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

# Copy application files (assumes they're in current directory)
if [ -f "package.json" ]; then
    print_status "Copying application files..."
    cp -r . $APP_DIR/
    cd $APP_DIR
else
    print_warning "No package.json found. Please upload your application files to $APP_DIR"
    print_warning "Then run: cd $APP_DIR && npm install --production"
fi

# Install application dependencies
if [ -f "$APP_DIR/package.json" ]; then
    print_status "Installing application dependencies..."
    cd $APP_DIR
    npm install --production
    
    # Create logs directory
    mkdir -p logs
    
    # Set up environment file for production
    if [ -f ".env.production" ]; then
        cp .env.production .env
        print_status "Production environment configured"
    else
        print_warning "Please create .env file with production settings"
    fi
fi

# Configure Nginx
print_status "Configuring Nginx..."
sudo tee /etc/nginx/sites-available/$DOMAIN > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    # SSL Configuration (will be configured by Certbot)
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Proxy to Node.js app
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Orange Money callback routes
    location /payment/success {
        proxy_pass http://localhost:3000/payment/success;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /payment/cancel {
        proxy_pass http://localhost:3000/payment/cancel;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api/payments/webhook {
        proxy_pass http://localhost:3000/api/payments/webhook;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
sudo nginx -t

# Start Nginx
sudo systemctl enable nginx
sudo systemctl start nginx

print_status "Nginx configured and started"

# Obtain SSL certificate
print_status "Obtaining SSL certificate..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

# Test SSL renewal
sudo certbot renew --dry-run

# Set up auto-renewal cron job
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -

print_status "SSL certificate configured with auto-renewal"

# Start application with PM2
if [ -f "$APP_DIR/ecosystem.config.js" ]; then
    print_status "Starting application with PM2..."
    cd $APP_DIR
    pm2 start ecosystem.config.js
    pm2 save
    pm2 startup
    print_status "Application started with PM2"
else
    print_warning "No PM2 config found. Start manually with: pm2 start server.js --name $APP_NAME"
fi

# Configure firewall
print_status "Configuring firewall..."
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
sudo ufw --force enable

print_status "Firewall configured"

# Final checks
print_status "Running final checks..."

# Check if Nginx is running
if sudo systemctl is-active --quiet nginx; then
    print_status "Nginx is running"
else
    print_error "Nginx is not running"
fi

# Check if PM2 app is running
if pm2 list | grep -q "online"; then
    print_status "PM2 application is running"
else
    print_warning "PM2 application may not be running. Check with: pm2 status"
fi

echo ""
echo "🎉 Deployment completed!"
echo ""
echo "Next steps:"
echo "1. Configure Orange Money portal with these URLs:"
echo "   - Success: https://$DOMAIN/payment/success"
echo "   - Cancel: https://$DOMAIN/payment/cancel"
echo "   - Webhook: https://$DOMAIN/api/payments/webhook"
echo ""
echo "2. Test your deployment:"
echo "   - Health check: https://$DOMAIN/health"
echo "   - Main page: https://$DOMAIN"
echo ""
echo "3. Monitor your application:"
echo "   - PM2 status: pm2 status"
echo "   - PM2 logs: pm2 logs"
echo "   - Nginx logs: sudo tail -f /var/log/nginx/error.log"
echo ""
print_status "Deployment script completed successfully!"