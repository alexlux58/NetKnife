# NetKnife 🔪

**Network & Security Swiss Army Knife** - A serverless web application providing network engineers with essential tools, accessible from any browser without installing local software.

![AWS Serverless](https://img.shields.io/badge/AWS-Serverless-orange)
![React](https://img.shields.io/badge/React-18-blue)
![Terraform](https://img.shields.io/badge/Terraform-1.6+-purple)

## Features

### Offline Tools (Browser-only, no data leaves your machine)
- **Subnet Calculator** - IPv4 CIDR calculations (sipcalc-style)
- **Regex Helper** - Build and test grep/egrep patterns with live preview
- **Password Generator** - Cryptographically secure password generation
- **Command Templates** - Multi-vendor CLI command library (Cisco, Arista, Juniper, FortiOS, Linux)

### Remote Tools (AWS-backed)
- **DNS Lookup** - DNS-over-HTTPS resolver via Cloudflare (1.1.1.1)
- **RDAP Lookup** - Modern WHOIS replacement for IPs and domains
- **TLS Inspector** - Certificate chain analysis with expiry tracking
- **HTTP Headers Scanner** - Security headers analysis (HSTS, CSP, X-Frame-Options)
- **PeeringDB Query** - Network and Internet Exchange information

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
│       ├── rdap/            # RDAP lookup
│       ├── tls/             # TLS inspector
│       ├── headers/         # HTTP headers scanner
│       └── peeringdb/       # PeeringDB query
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

## License

MIT License - See [LICENSE](LICENSE) file

## Contributing

This is a personal project, but suggestions are welcome. Please open an issue first to discuss changes.

