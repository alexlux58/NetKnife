# NetKnife 🔪

**Network & Security Swiss Army Knife** - A serverless web application providing network engineers with essential tools, accessible from any browser without installing local software.

![AWS Serverless](https://img.shields.io/badge/AWS-Serverless-orange)
![React](https://img.shields.io/badge/React-18-blue)
![Terraform](https://img.shields.io/badge/Terraform-1.6+-purple)

## Features

### Offline Tools (Browser-only, no data leaves your machine)

**Network Calculators**
- **Subnet / CIDR Calculator** - IPv4/IPv6 subnet calculations with AWS-specific info
- **CIDR Range Checker** - Check if an IP falls within a CIDR range
- **IP Address Converter** - Convert between Decimal, Binary, Hex, and IPv4 formats

**Security Tools**
- **Password Generator** - Cryptographically secure password generation
- **Hash Generator** - MD5, SHA-1, SHA-256, SHA-384, SHA-512 hashes
- **PEM Decoder** - Parse X.509 certificates locally

**Development Helpers**
- **Regex Helper** - Build and test grep/egrep patterns with live preview
- **JWT Decoder** - Decode and inspect JSON Web Tokens
- **Encoder/Decoder** - Base64, Base64URL, Hex, URL, HTML, Unicode encoding
- **Timestamp Converter** - Unix timestamp ↔ human-readable dates
- **Cron Builder** - Visual cron expression builder with next execution preview
- **UUID Generator** - Generate UUID v1/v4/v5 locally
- **YAML ↔ JSON** - Convert between YAML and JSON formats
- **Diff Tool** - Compare two text blocks with unified/split view
- **QR Code Generator** - Generate QR codes for WiFi, URLs, vCard, etc.

**System Information**
- **MAC Vendor Lookup** - Identify device manufacturer from MAC OUI
- **Port Reference** - Searchable database of 150+ common ports/services

**Command Library**
- **Command Templates** - Multi-vendor CLI command library (Cisco, Arista, Juniper, FortiOS, Linux, Brocade, UniFi)

### Remote Tools (AWS-backed)

**Network Diagnostics**
- **DNS Lookup** - DNS-over-HTTPS resolver via Cloudflare (1.1.1.1)
- **DNS Propagation** - Check DNS records across 8 global resolvers
- **Reverse DNS (PTR)** - IP to hostname lookups
- **Traceroute** - Network path tracing from AWS vantage point
- **BGP Looking Glass** - Query public BGP route servers
- **PeeringDB Query** - Network and Internet Exchange information
- **ASN Details** - Lookup Autonomous System Number information

**Security Scanners**
- **TLS Inspector** - Certificate chain analysis with expiry tracking
- **SSL Labs** - SSL/TLS configuration analysis
- **HTTP Headers Scanner** - Security headers analysis (HSTS, CSP, X-Frame-Options)
- **Email Auth Check** - SPF, DKIM, DMARC validation
- **Password Breach** - Check passwords against HIBP database (k-anonymity)

**Threat Intelligence**
- **IP Reputation (AbuseIPDB)** - Abuse confidence scores and report data
- **Shodan** - Internet-connected device search (requires API key)
- **VirusTotal** - File/URL/domain/IP analysis (requires API key)
- **SecurityTrails** - Historical DNS and WHOIS data (requires API key)
- **Censys** - Internet-wide scan data (requires API key)
- **GreyNoise** - IP threat intelligence (requires API key)

**System Information**
- **RDAP Lookup** - Modern WHOIS replacement for IPs and domains

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLOUDFRONT CDN                              │
│                      (HTTPS, Security Headers, Cache)                    │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
           ┌────────▼────────┐          ┌─────────▼────────┐
           │    S3 BUCKET    │          │   API GATEWAY    │
           │   (React SPA)   │          │    (HTTP API)    │
           └─────────────────┘          └────────┬─────────┘
                                                 │
                                        ┌────────▼────────┐
                                        │ JWT AUTHORIZER  │
                                        │    (Cognito)    │
                                        └────────┬────────┘
                                                 │
              ┌──────────────────────────────────┼──────────────────────────────────┐
              │                                  │                                  │
     ┌────────▼────────┐               ┌─────────▼────────┐              ┌─────────▼────────┐
     │  LAMBDA: DNS    │               │  LAMBDA: RDAP    │              │  LAMBDA: TLS     │
     │  (Cloudflare)   │               │  (rdap.org)      │              │  (Connect+Parse) │
     └────────┬────────┘               └─────────┬────────┘              └──────────────────┘
              │                                  │
              └──────────────────────────────────┘
                                │
                       ┌────────▼────────┐
                       │    DYNAMODB     │
                       │   (Cache+TTL)   │
                       └─────────────────┘
```

## Security

- **Authentication**: AWS Cognito with admin-only user creation
- **Authorization**: JWT tokens validated at API Gateway
- **CORS**: Strict origin allowlist (CloudFront domain only)
- **WAF**: Rate limiting (1000 req/5min per IP)
- **Headers**: HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- **SSRF Protection**: Private IPs blocked in headers scanner
- **Secret Redaction**: Copy (redacted) button for sharing

## Deployment Guide

### Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Terraform** >= 1.6.0
3. **Node.js** >= 20.x
4. **Git**
5. **Cloudflare API Token** (optional, for custom domain)

### Step 1: Clone and Configure

```bash
# Clone the repository
git clone <your-repo-url> netknife
cd netknife

# Copy example variables
cp infra/envs/dev/terraform.tfvars.example infra/envs/dev/terraform.tfvars

# Edit the variables file
# Set your project name, AWS region, and alert email
# For custom domain (e.g., tools.alexflux.com):
#   - Set custom_domain = "tools.alexflux.com"
#   - Set cloudflare_zone_id = "your-zone-id"
```

### Step 2: Deploy Infrastructure

```bash
# Initialize Terraform
cd infra/envs/dev
terraform init

# If using custom domain with Cloudflare, export your API token:
export CLOUDFLARE_API_TOKEN="your-cloudflare-api-token"

# Review the plan
terraform plan

# Deploy (this creates: S3, CloudFront, Cognito, API Gateway, Lambda, DynamoDB, WAF)
# If using custom domain, also creates: ACM certificate + Cloudflare DNS records
terraform apply

# Save the outputs - you'll need them for the frontend
terraform output
```

Note the following outputs:
- `cloudfront_domain` - Your site URL
- `api_url` - Backend API endpoint
- `cognito_domain` - For OIDC configuration
- `cognito_client_id` - For frontend authentication
- `cognito_issuer` - For JWT validation

### Step 3: Create Admin User

```bash
# Create the user (admin-only, no self-service)
aws cognito-idp admin-create-user \
  --user-pool-id <USER_POOL_ID> \
  --username alex.lux \
  --user-attributes Name=email,Value=alex.lux@example.com \
  --temporary-password "ChangeMe123!"

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id <USER_POOL_ID> \
  --username alex.lux \
  --password "YourSecurePassword!" \
  --permanent
```

### Step 4: Build Frontend

```bash
cd ../../../frontend

# Install dependencies
npm install

# Create environment file
cat > .env.local << EOF
VITE_API_URL=<api_url from terraform output>
VITE_COGNITO_DOMAIN=<cognito_domain from terraform output>
VITE_COGNITO_CLIENT_ID=<cognito_client_id from terraform output>
VITE_COGNITO_ISSUER=<cognito_issuer from terraform output>
VITE_OIDC_REDIRECT_URI=https://<cloudfront_domain>/callback
VITE_OIDC_POST_LOGOUT_REDIRECT_URI=https://<cloudfront_domain>/login
VITE_REGION=us-west-2
EOF

# Build for production
npm run build
```

### Step 5: Deploy Frontend

```bash
# Upload to S3
aws s3 sync dist/ s3://<site_bucket_name>/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id <cloudfront_distribution_id> \
  --paths "/*"
```

### Step 6: Verify Deployment

1. Navigate to `https://<cloudfront_domain>`
2. Click "Sign in"
3. Enter your credentials
4. Test a tool (e.g., DNS lookup for "cloudflare.com")

## Custom Domain Setup (Optional)

To deploy at a custom domain like `tools.alexflux.com`:

### 1. Get Cloudflare API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use the "Edit zone DNS" template
4. Scope it to your zone (e.g., alexflux.com)
5. Copy the token

### 2. Get Zone ID

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click "Domains" → Select your domain
3. Scroll to "API" section on right sidebar
4. Copy the "Zone ID"

### 3. Configure Terraform

```bash
# Export token before running terraform
export CLOUDFLARE_API_TOKEN="your-token-here"

# In terraform.tfvars:
custom_domain      = "tools.alexflux.com"
cloudflare_zone_id = "your-zone-id-here"
```

### What Terraform Creates

- **ACM Certificate** in us-east-1 (required for CloudFront)
- **DNS Validation Records** in Cloudflare (for certificate issuance)
- **CNAME Record** pointing `tools.alexflux.com` → CloudFront

Certificate issuance typically takes 2-5 minutes.

---

## Cost Estimation

This serverless architecture is extremely cost-efficient for personal/small team use:

| Service | Free Tier | Estimated Monthly Cost |
|---------|-----------|----------------------|
| CloudFront | 1 TB / 10M requests | ~$0 (low traffic) |
| S3 | 5 GB storage | ~$0.02 |
| Lambda | 1M requests / 400K GB-sec | ~$0 (low traffic) |
| API Gateway | 1M requests | ~$0 (low traffic) |
| DynamoDB | 25 GB / 25 WCU | ~$0 (on-demand) |
| Cognito | 50K MAU | ~$0 |
| WAF | - | ~$5/month base |

**Estimated total: $5-10/month** (mostly WAF fixed cost)

### Cost Optimization Tips

- Disable WAF in dev environment to reduce costs
- Use CloudWatch log retention of 7 days instead of 30
- Clean up unused Lambda function versions

## Development

### Local Frontend Development

```bash
cd frontend
npm run dev
# Opens http://localhost:3000
```

Note: Remote tools won't work locally unless you have a backend running.

### Testing Lambda Functions Locally

```bash
# Use AWS SAM or serverless-offline
cd backend/functions/dns
node -e "
const handler = require('./index').handler;
handler({ body: JSON.stringify({ name: 'example.com', type: 'A' }) })
  .then(console.log);
"
```

## Project Structure

```
netknife/
├── frontend/                 # React SPA
│   ├── src/
│   │   ├── app/             # Router, Shell, Views
│   │   ├── components/      # Shared components
│   │   ├── lib/             # Auth, API, utilities
│   │   └── tools/           # Tool implementations
│   │       ├── offline/     # Browser-only tools
│   │       └── remote/      # AWS-backed tools
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   └── functions/           # Lambda functions
│       ├── dns/             # DNS-over-HTTPS
│       ├── dns-propagation/ # Global DNS propagation check
│       ├── rdap/            # RDAP lookup
│       ├── tls/             # TLS inspector
│       ├── ssl-labs/        # SSL Labs-style analysis
│       ├── headers/         # HTTP headers scanner
│       ├── peeringdb/       # PeeringDB query
│       ├── asn-details/     # ASN information
│       ├── bgp-looking-glass/ # BGP route queries
│       ├── traceroute/      # Network path tracing
│       ├── reverse-dns/     # PTR lookups
│       ├── email-auth/      # SPF/DKIM/DMARC
│       ├── hibp/            # Password breach check
│       ├── abuseipdb/       # IP reputation
│       ├── shodan/          # Shodan integration
│       ├── virustotal/      # VirusTotal integration
│       ├── security-trails/ # SecurityTrails integration
│       ├── censys/          # Censys integration
│       └── greynoise/       # GreyNoise integration
│
├── infra/                   # Terraform IaC
│   ├── modules/
│   │   ├── api/            # API Gateway + Lambdas
│   │   ├── auth/           # Cognito
│   │   ├── static_site/    # S3 + CloudFront
│   │   ├── ops/            # CloudWatch alarms
│   │   └── cost/           # Budgets + anomaly detection
│   └── envs/
│       └── dev/            # Development environment
│
└── README.md
```

## Adding New Tools

### Offline Tool

1. Create `frontend/src/tools/offline/YourTool.tsx`
2. Register in `frontend/src/tools/registry.tsx`
3. Build and deploy frontend

### Remote Tool

1. Create Lambda in `backend/functions/yourtool/index.js`
2. Add Terraform resources in `infra/modules/api/main.tf`
3. Create frontend in `frontend/src/tools/remote/YourTool.tsx`
4. Register in `frontend/src/tools/registry.tsx`
5. Deploy infrastructure and frontend

## Troubleshooting

### Common Issues

#### Lambda 500 Errors

Check CloudWatch logs for the specific Lambda:

```bash
# Tail logs for a Lambda function (last 5 minutes)
aws logs tail /aws/lambda/netknife-dev-dns --since 5m --region us-west-2

# Filter logs for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/netknife-dev-rdap \
  --filter-pattern "ERROR" \
  --region us-west-2
```

#### Test Lambda Functions Directly

Invoke Lambda functions directly to bypass API Gateway:

```bash
# Test DNS Lambda
aws lambda invoke \
  --function-name netknife-dev-dns \
  --payload '{"body": "{\"name\": \"google.com\", \"type\": \"A\"}"}' \
  --cli-binary-format raw-in-base64-out \
  --region us-west-2 \
  /tmp/dns-response.json && cat /tmp/dns-response.json

# Test RDAP Lambda
aws lambda invoke \
  --function-name netknife-dev-rdap \
  --payload '{"body": "{\"query\": \"8.8.8.8\"}"}' \
  --cli-binary-format raw-in-base64-out \
  --region us-west-2 \
  /tmp/rdap-response.json && cat /tmp/rdap-response.json

# Test TLS Lambda
aws lambda invoke \
  --function-name netknife-dev-tls \
  --payload '{"body": "{\"host\": \"github.com\", \"port\": 443}"}' \
  --cli-binary-format raw-in-base64-out \
  --region us-west-2 \
  /tmp/tls-response.json && cat /tmp/tls-response.json
```

#### Redeploy Lambda Functions

If Lambda code is outdated, force redeploy:

```bash
# Redeploy all Lambda functions via Terraform
cd infra/envs/dev
terraform apply -target=module.api -auto-approve

# Or manually update a single Lambda
cd backend/functions/dns
zip -r /tmp/dns.zip index.js
aws lambda update-function-code \
  --function-name netknife-dev-dns \
  --zip-file fileb:///tmp/dns.zip \
  --region us-west-2
```

#### Authentication Issues

```bash
# Check Cognito user status
aws cognito-idp admin-get-user \
  --user-pool-id us-west-2_XXXXXXXX \
  --username alex.lux \
  --region us-west-2

# Reset user password
aws cognito-idp admin-set-user-password \
  --user-pool-id us-west-2_XXXXXXXX \
  --username alex.lux \
  --password "NewPassword123!" \
  --permanent \
  --region us-west-2

# Force user to re-verify
aws cognito-idp admin-disable-user \
  --user-pool-id us-west-2_XXXXXXXX \
  --username alex.lux
aws cognito-idp admin-enable-user \
  --user-pool-id us-west-2_XXXXXXXX \
  --username alex.lux
```

#### Frontend Deployment

```bash
# Build frontend
cd frontend
npm run build

# Deploy to S3
aws s3 sync dist/ s3://netknife-site-ACCOUNT_ID --delete --region us-west-2

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id EXXXXXXXXXX \
  --paths "/*" \
  --region us-west-2

# Check CloudFront distribution status
aws cloudfront get-distribution \
  --id EXXXXXXXXXX \
  --query 'Distribution.Status'
```

#### DynamoDB Cache Issues

```bash
# List items in cache table
aws dynamodb scan \
  --table-name netknife-dev-cache \
  --region us-west-2 \
  --max-items 10

# Delete specific cache entry
aws dynamodb delete-item \
  --table-name netknife-dev-cache \
  --key '{"cache_key": {"S": "dns:google.com:A"}}' \
  --region us-west-2

# Clear all cache (be careful!)
# Items with TTL will auto-expire, but for immediate clearing:
aws dynamodb scan --table-name netknife-dev-cache --region us-west-2 \
  --projection-expression "cache_key" \
  --query "Items[*].cache_key.S" --output text | \
  xargs -I {} aws dynamodb delete-item \
    --table-name netknife-dev-cache \
    --key '{"cache_key": {"S": "{}"}}' \
    --region us-west-2
```

#### Terraform State Issues

```bash
# Refresh state without applying changes
cd infra/envs/dev
terraform refresh

# Import existing resource into state
terraform import module.api.aws_lambda_function.dns netknife-dev-dns

# Remove resource from state (doesn't delete actual resource)
terraform state rm module.api.aws_lambda_function.dns

# Show current state
terraform state list
terraform state show module.api.aws_lambda_function.dns
```

#### DNS / Custom Domain Issues

```bash
# Check Cloudflare DNS records
curl -X GET "https://api.cloudflare.com/client/v4/zones/ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq '.result[] | {name, type, content}'

# Check ACM certificate status
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT-ID \
  --region us-east-1

# Flush local DNS cache (macOS)
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder

# Test DNS resolution
dig tools.alexflux.com
nslookup tools.alexflux.com 8.8.8.8
```

#### Check API Gateway

```bash
# List API Gateway routes
aws apigatewayv2 get-routes \
  --api-id XXXXXXXXXX \
  --region us-west-2

# Get API Gateway logs (if enabled)
aws logs tail /aws/apigateway/netknife-dev --since 5m --region us-west-2
```

### Quick Health Check

Run this to verify all components are working:

```bash
#!/bin/bash
# health-check.sh

API_URL="https://XXXXXXXXXX.execute-api.us-west-2.amazonaws.com"
SITE_URL="https://tools.alexflux.com"

echo "=== NetKnife Health Check ==="

# Check frontend
echo -n "Frontend: "
curl -s -o /dev/null -w "%{http_code}" "$SITE_URL" && echo " ✓" || echo " ✗"

# Check API (will return 401 without auth, that's OK)
echo -n "API Gateway: "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/dns")
[[ "$STATUS" == "401" || "$STATUS" == "200" ]] && echo "$STATUS ✓" || echo "$STATUS ✗"

# Check Lambda (via AWS CLI)
echo -n "DNS Lambda: "
aws lambda invoke --function-name netknife-dev-dns \
  --payload '{"body": "{\"name\": \"example.com\", \"type\": \"A\"}"}' \
  --cli-binary-format raw-in-base64-out \
  --region us-west-2 /tmp/health.json 2>/dev/null && echo "✓" || echo "✗"

echo "=== Done ==="
```

## License

MIT License - See [LICENSE](LICENSE) file

## Contributing

This is a personal project, but suggestions are welcome. Please open an issue first to discuss changes.

