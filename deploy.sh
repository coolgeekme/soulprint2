#!/bin/bash
# Deployment script for Emergent platform

echo "🚀 Starting Next.js deployment..."

# Set production environment
export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1

# Build the application with memory constraints
echo "📦 Building Next.js application..."
NODE_OPTIONS='--max-old-space-size=512' yarn build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    
    # Start the production server
    echo "🌐 Starting production server..."
    NODE_OPTIONS='--max-old-space-size=256' yarn start
else
    echo "❌ Build failed!"
    exit 1
fi
