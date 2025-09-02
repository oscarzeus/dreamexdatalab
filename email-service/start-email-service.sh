#!/bin/bash

# Dreamex Email Service Startup Script
echo "🚀 Starting Dreamex Email Service..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Navigate to email service directory
cd "$(dirname "$0")"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Copying from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ .env file created. Please update the email credentials."
    else
        echo "❌ .env.example file not found. Please create a .env file with your email configuration."
        exit 1
    fi
fi

# Start the email service
echo "📧 Starting email service on port 3001..."
echo "🔗 Service will be available at: http://localhost:3001"
echo "📊 Health check: http://localhost:3001/health"
echo "🛑 Press Ctrl+C to stop the service"
echo ""

# Run with development mode for better logging
if [ "$1" = "dev" ]; then
    echo "🔧 Running in development mode with auto-restart..."
    npm run dev
else
    echo "🚀 Running in production mode..."
    npm start
fi
