#!/bin/bash

# Production startup script optimized for Cloud Run
# This script uses node instead of tsx/genkit start to minimize memory usage

echo "🚀 Starting production server..."

# Set production environment
export NODE_ENV=production

# Enable garbage collection for memory optimization
export NODE_OPTIONS="--max-old-space-size=512 --expose-gc"

# Start the server with the compiled production build
node dist/index.js
