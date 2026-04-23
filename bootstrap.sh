#!/usr/bin/env bash
# bootstrap.sh
# Run this ONCE before `terraform init` to create the remote state backend.
# Usage: ./bootstrap.sh <your-aws-region> <unique-suffix>
# Example: ./bootstrap.sh ap-south-1 myproject123

set -euo pipefail

REGION="${1:-ap-south-1}"
SUFFIX="${2:-$(date +%s)}"
BUCKET_NAME="terraform-state-${SUFFIX}"
DYNAMODB_TABLE="terraform-state-lock"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Terraform Remote State Bootstrap"
echo " Region: $REGION"
echo " Bucket: $BUCKET_NAME"
echo " DynamoDB Table: $DYNAMODB_TABLE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Create S3 bucket ──
echo ""
echo "[1/5] Creating S3 bucket: $BUCKET_NAME ..."

if [ "$REGION" = "us-east-1" ]; then
  aws s3api create-bucket \
    --bucket "$BUCKET_NAME" \
    --region "$REGION"
else
  aws s3api create-bucket \
    --bucket "$BUCKET_NAME" \
    --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"
fi

# ── 2. Enable versioning ──
echo "[2/5] Enabling versioning on $BUCKET_NAME ..."
aws s3api put-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --versioning-configuration Status=Enabled

# ── 3. Enable server-side encryption ──
echo "[3/5] Enabling AES256 encryption on $BUCKET_NAME ..."
aws s3api put-bucket-encryption \
  --bucket "$BUCKET_NAME" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# ── 4. Block all public access ──
echo "[4/5] Blocking public access on $BUCKET_NAME ..."
aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# ── 5. Create DynamoDB table for state locking ──
echo "[5/5] Creating DynamoDB table: $DYNAMODB_TABLE ..."
aws dynamodb create-table \
  --table-name "$DYNAMODB_TABLE" \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION" \
  --tags Key=ManagedBy,Value=terraform Key=Project,Value=infra-as-code-pipeline \
  2>/dev/null || echo "  DynamoDB table already exists, skipping."

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Bootstrap complete!"
echo ""
echo " Next steps:"
echo "   1. Replace 'REPLACE_WITH_YOUR_STATE_BUCKET' in all"
echo "      terraform/environments/*/main.tf files with:"
echo "      $BUCKET_NAME"
echo ""
echo "   2. Run:"
echo "      cd terraform/environments/staging"
echo "      terraform init"
echo "      terraform plan"
echo "      terraform apply"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
