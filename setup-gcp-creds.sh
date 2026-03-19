#!/bin/bash

# Configuration
PROJECT_ID="inspired-rhythm-490600-n1"
REGION="us-east1"
SERVICE_ACCOUNT_NAME="github-deployer"
REPO_NAME="dev-apps"

# 1. Set the active project
echo "Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# 2. Enable necessary APIs
echo "Enabling required APIs..."
gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    iam.googleapis.com

# 3. Create the Artifact Registry repository
echo "Creating Artifact Registry repository: $REPO_NAME..."
gcloud artifacts repositories create $REPO_NAME \
    --repository-format=docker \
    --location=$REGION \
    --description="Docker repository for GitHub deployments" || echo "Repository already exists."

# 4. Create the Service Account
echo "Creating Service Account: $SERVICE_ACCOUNT_NAME..."
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --display-name="GitHub Actions Deployer" || echo "Service account already exists."

# 5. Assign Roles to the Service Account
echo "Assigning IAM roles..."
ROLES=(
    "roles/run.admin"
    "roles/artifactregistry.writer"
    "roles/iam.serviceAccountUser"
)

for ROLE in "${ROLES[@]}"; do
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
        --role="$ROLE"
done

# 6. Generate and download the JSON key
echo "Generating Service Account JSON key..."
gcloud iam service-accounts keys create gcp-key.json \
    --iam-account=$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com

echo "--------------------------------------------------------"
echo "SETUP COMPLETE!"
echo "1. Download the file 'gcp-key.json' from this Cloud Shell session."
echo "2. Copy the entire contents of 'gcp-key.json'."
echo "3. Go to GitHub > Your Repo > Settings > Secrets and variables > Actions."
echo "4. Create a new secret called 'GCP_SA_KEY' and paste the content."
echo "5. You can delete 'gcp-key.json' from Cloud Shell after copying."
echo "--------------------------------------------------------"
