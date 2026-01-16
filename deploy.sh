#!/bin/bash

# Cloud Run deployment script
set -e

# Load project ID from .env file
if [ -f .env.local ]; then
    # Source the .env file to get GCP_PROJECT_ID
    export $(grep -v '^#' .env.local | xargs)
    if [ -z "$GCP_PROJECT_ID" ]; then
        echo "❌ GCP_PROJECT_ID not found in .env.local file"
        exit 1
    fi
else
    echo "❌ .env file not found"
    exit 1
fi

# Configuration
PROJECT_ID="$GCP_PROJECT_ID"  # Using GCP_PROJECT_ID from .env
REGION="europe-southwest1"    # Match your Vertex AI region
SERVICE_NAME="agentic-api"
IMAGE_NAME="agentic-api"

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

# Load environment variables from .env.local files
ENV_FILE=""
if [ -f .env.local ]; then
    echo "🔧 Creating YAML file from .env.local..."
    # Create temporary YAML file
    ENV_FILE="temp_env.yaml"
    echo "# Environment variables for Cloud Run" > $ENV_FILE
    
    # Add NODE_ENV=production first
    echo "NODE_ENV: \"production\"" >> $ENV_FILE
    
    # Convert .env format to YAML
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        if [[ $key =~ ^[[:space:]]*# ]] || [[ -z $key ]]; then
            continue
        fi
        # Skip NODE_ENV as it's already added
        if [[ $key == "NODE_ENV" ]]; then
            continue
        fi
        # Remove quotes from value if present
        value=$(echo $value | sed 's/^"//' | sed 's/"$//' | sed "s/^'//" | sed "s/'$//")
        echo "$key: \"$value\"" >> $ENV_FILE
    done < .env.local
    
    echo "✅ Environment file created: $ENV_FILE"
else
    echo "⚠️  Warning: No .env.local file found. Proceeding without environment variables."
fi

# Deploy to Cloud Run
echo "🚢 Deploying to Cloud Run..."
if [ -z "$ENV_FILE" ]; then
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
        --set-env-vars NODE_ENV=production
else
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
        --env-vars-file $ENV_FILE
fi

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
    --region $REGION \
    --format 'value(status.url)')

# Clean up temporary file if created
if [ -f "temp_env.yaml" ]; then
    rm temp_env.yaml
    echo "🧹 Temporary environment file cleaned up"
fi

echo "✅ Deployment complete!"
echo "🌐 Your application is live at: $SERVICE_URL"
echo "⚠️  Remember to set environment variables in Cloud Run console:"
echo "   - GEMINI_API_KEY"
echo "   - Other required .env variables"
