#!/bin/bash

# Cloud Run deployment script
set -e

# Load project ID from .env file
if [ -f .env ]; then
    # Source the .env file to get GCP_PROJECT_ID
    export $(grep -v '^#' .env | xargs)
    if [ -z "$GCP_PROJECT_ID" ]; then
        echo "❌ GCP_PROJECT_ID not found in .env file"
        exit 1
    fi
else
    echo "❌ .env file not found"
    exit 1
fi

# Configuration
PROJECT_ID="$GCP_PROJECT_ID"  # Using GCP_PROJECT_ID from .env
REGION="europe-southwest1"    # Match your Vertex AI region
SERVICE_NAME="agentic-project"
IMAGE_NAME="agentic-project"

echo "🚀 Deploying to Google Cloud Run..."

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found. Please install it first."
    exit 1
fi

# Set the project
echo "📋 Setting project to: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com

# Build and push the image
echo "🏗️  Building Docker image..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$IMAGE_NAME

# Load environment variables from .env file
if [ -f .env ]; then
    echo "🔧 Loading environment variables from .env file..."
    # Read .env file, remove comments and empty lines, and format as KEY=VALUE pairs
    ENV_VARS=$(grep -v '^#' .env | grep -v '^$' | sed 's/^/--set-env-vars /' | tr '\n' ' ')
    # Remove NODE_ENV from ENV_VARS if it exists to avoid duplication
    ENV_VARS=$(echo "$ENV_VARS" | sed 's/--set-env-vars NODE_ENV=[^ ]* //')
else
    echo "⚠️  Warning: .env file not found. Proceeding without environment variables."
    ENV_VARS=""
fi

# Deploy to Cloud Run
echo "🚢 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image gcr.io/$PROJECT_ID/$IMAGE_NAME \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 1 \
    --timeout 600 \
    --concurrency 10 \
    --min-instances 0 \
    --max-instances 10 \
    --set-env-vars NODE_ENV=production \
    $ENV_VARS

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
    --region $REGION \
    --format 'value(status.url)')

echo "✅ Deployment complete!"
echo "🌐 Your application is live at: $SERVICE_URL"
echo "⚠️  Remember to set environment variables in Cloud Run console:"
echo "   - GEMINI_API_KEY"
echo "   - Other required .env variables"
