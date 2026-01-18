# NetKnife 🔪

**Network & Security Swiss Army Knife** — A serverless web application for network and security work in the browser.

![AWS Serverless](https://img.shields.io/badge/AWS-Serverless-orange)
![React](https://img.shields.io/badge/React-18-blue)
![Terraform](https://img.shields.io/badge/Terraform-1.6+-purple)

**Contents:** [Features](#features) · [Architecture](#architecture) · [Security](#security) · [Deployment](#deployment-guide) · [Custom Domain](#custom-domain-setup-optional) · [Cost](#cost-estimation) · [Development](#development) · [Project Structure](#project-structure) · [Report Builder](#report-builder--chat-storage) · [Adding Tools](#adding-new-tools) · [OSINT](#osint-features) · [API Keys](#api-keys-configuration) · [Production Readiness](#production-readiness) · [Monetization](#monetization) · [Infra / Dev](#infra--dev-environment) · [Improvements & Roadmap](#improvements--roadmap) · [Troubleshooting](#troubleshooting)

---

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
- **Notes** - Notion-like block editor (headings, lists, code, quotes); add to reports
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
- **CVE Lookup** - NVD (NIST) + OSV; optional AI "should I be worried?" (free APIs; NVD key optional)
- **CVSS Explainer** - Parse CVSS 2.0/3.x vectors, explain metrics, base score (offline)
- **IP Reputation (AbuseIPDB)** - Abuse confidence scores and report data
- **IP Reputation (IPQualityScore)** - Fraud score, VPN/proxy/Tor detection (requires API key)
- **Shodan** - Internet-connected device search (requires API key)
- **VirusTotal** - File/URL/domain/IP analysis (requires API key)
- **SecurityTrails** - Historical DNS and WHOIS data (requires API key)
- **Censys** - Internet-wide scan data (requires API key)
- **GreyNoise** - IP threat intelligence (requires API key)

**OSINT & Email Intelligence**
- **Email Reputation (EmailRep)** - Email reputation, suspicious activity, credentials leaked
- **Email Breach Check (BreachDirectory)** - Check if email appears in data breaches
- **Email Verification (IPQualityScore)** - Validate email, detect disposable/spamtraps (requires API key)
- **Email Finder (Hunter)** - Verify email and find associated accounts (requires API key)
- **OSINT Dashboard** - Consolidated threat intelligence from multiple sources

**Phone & URL Intelligence**
- **Phone Validator** - Phone number validation and carrier detection
- **Phone Validation (IPQualityScore)** - Phone validation and risk assessment (requires API key)
- **URL Scanner (IPQualityScore)** - Malicious URL scanner for phishing/malware (requires API key)

**AI Security Advisor**
- **Security Advisor** - AI-powered chatbot providing expert security guidance and tool recommendations (requires OpenAI API key)
- **Chat Storage** - Save and load Security Advisor conversations

**Report Builder & Notes**
- **Report Builder** - Collect data from any tool and Notion-like notes; generate PDF reports
- **Notes** - Block editor (headings, lists, code, quotes); add to reports (offline)
- **Add to Report** - One-click button in tools to add results to reports
- **PDF Export** - Download reports as PDF (notes rendered as formatted text)

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
./init.sh  # Or: terraform init

# If using custom domain with Cloudflare, export your API token:
export CLOUDFLARE_API_TOKEN="your-cloudflare-api-token"

# Review the plan
terraform plan

# Deploy (this creates: S3, CloudFront, Cognito, API Gateway, Lambda, DynamoDB, WAF)
# If using custom domain, also creates: ACM certificate + Cloudflare DNS records
terraform apply -auto-approve

# Save the outputs - you'll need them for the frontend
terraform output
```

Note the following outputs:
- `cloudfront_domain` - Your site URL
- `api_url` - Backend API endpoint
- `cognito_domain` - For OIDC configuration
- `cognito_client_id` - For frontend authentication
- `cognito_issuer` - For JWT validation

**⚠️ Important**: After redeploying, the Cognito domain will have a new random suffix. You must update the frontend environment variables (see Step 4).

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

**Option 1: Automated Deployment (Recommended)**

```bash
cd frontend
./deploy.sh
```

This script automatically:
1. Gets the bucket name from Terraform
2. Uploads files from `dist/` to S3
3. Invalidates CloudFront cache
4. Shows deployment status

**Option 2: Manual Deployment**

```bash
# Get bucket name from Terraform
cd infra/envs/dev
BUCKET_NAME=$(terraform output -raw bucket_name)
CLOUDFRONT_ID=$(terraform output -raw cloudfront_id)

# Upload to S3
cd ../../../frontend
aws s3 sync dist/ "s3://$BUCKET_NAME/" --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_ID" \
  --paths "/*"
```

**Note**: The `--delete` flag removes files from S3 that no longer exist in `dist/`.

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

## Report Builder & Chat Storage

### Where to Find Everything

- **Report Builder** (`/tools/report-builder`): Sidebar → **Utilities** → Report Builder. View items, save, load, delete, download PDF, or AI-enhanced PDF. Use the **Reports** link in the top bar from anywhere.
- **Add to Report**: In any tool, after results appear, use the **Add to Report** button to add that result to your current report.
- **Save Chat** (Security Advisor): In **Threat Intelligence** → Security Advisor, click **Save Chat** when you have messages; load saved chats from the list.

### Features

- **Collect data** from any tool with one click; **save** reports with title, description, and category (Pentest, Breach, Report, General); **load** and **delete** saved reports; **filter** by category in the dashboard.
- **PDF**: **Download PDF** (standard) or **AI PDF** (includes AI analysis via Security Advisor: Executive Summary, Key Findings, Risk Assessment, Recommendations).
- **Chats**: Save and load Security Advisor conversations. All data is user-scoped (Cognito) and has a 1-year TTL in DynamoDB.

### Step-by-Step: First Report

1. **Add items:** Run any tool (e.g. Email Reputation, IP-API), then click **Add to Report** on the results.
2. **View report:** Go to **Report Builder** (Utilities or top bar **Reports**). You’ll see all items with tool name, input, and data.
3. **Save:** Click **Save Report**, choose title/description/category, then **Save**.
4. **PDF:** Click **Download PDF** or **AI PDF** (AI requires Security Advisor to be configured).
5. **Load:** In Saved Reports, click **Load** on a report to continue editing.

### Adding "Add to Report" to Tools

Import and use the component; pass a `category` that matches the tool’s purpose (e.g. `"DNS & Domain"`, `"Threat Intelligence"`, `"Email Security"`, `"Certificates & TLS"`, `"Network Intelligence"`, `"Encoding & Crypto"`, `"Reference & Templates"`).

```tsx
import AddToReportButton from '../../components/AddToReportButton'

// After displaying results:
{result && (
  <div className="flex items-center justify-end mb-2">
    <AddToReportButton
      toolId="your-tool-id"
      input={userInput}
      data={result}
      category="Your Category"
    />
  </div>
)}
```

### Report Structure & Storage

- **DynamoDB** table: `netknife-{env}-reports`; user-scoped by Cognito `sub`; 1-year TTL.
- **Lambda** `reports`: save, get, list, delete for reports and chats.
- **Frontend:** `ReportContext`, `AddToReportButton`, `ReportBuilderTool`; PDF via jsPDF + html2canvas; AI PDF calls Security Advisor.

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
5. Add "Add to Report" button (optional but recommended)
6. Deploy infrastructure and frontend

## OSINT Features

### OSINT Dashboard

The **OSINT Dashboard** (`/tools/osint-dashboard`) consolidates results from multiple sources to provide comprehensive threat intelligence.

**Features:**
- **Multi-source analysis:** Automatically detects input type (email, IP, or domain)
- **Parallel queries:** Runs all relevant checks simultaneously for speed
- **Risk scoring:** Calculates overall risk score (0-100) based on all findings
- **Risk levels:** Categorizes as Low, Medium, High, or Critical
- **Actionable recommendations:** Provides specific security recommendations
- **Tabbed interface:** Organized view of all results
- **Error handling:** Gracefully handles missing API keys or failed queries

**Email Analysis:**
- EmailRep.io (reputation, suspicious activity)
- BreachDirectory (breach detection)
- Hunter.io (verification, if API key configured)
- IPQualityScore Email (validation, spam detection, if API key configured)

**IP Analysis:**
- IP-API.com (geolocation, ISP)
- AbuseIPDB (reputation, if API key configured)
- IPQualityScore (fraud score, VPN/proxy detection, if API key configured)
- GreyNoise (threat intelligence, if API key configured)

**Domain Analysis:**
- DNS lookup (A records)
- RDAP (WHOIS replacement)
- SecurityTrails (historical data, if API key configured)

### Security Advisor Chatbot

The **Security Advisor** (`/tools/security-advisor`) is an AI-powered chatbot that provides expert security guidance and recommends NetKnife tools for investigating security incidents.

**Features:**
- **Context-aware advice:** Understands security situations and provides tailored guidance
- **Tool recommendations:** Suggests specific NetKnife tools with step-by-step instructions
- **Dual audience:** Provides both technical details (for engineers) and executive summaries
- **Conversation context:** Maintains conversation history for follow-up questions
- **Quick questions:** Pre-populated common security scenarios

**AI Model:** GPT-4o-mini
- **Cost:** ~$0.15/$0.60 per 1M tokens (input/output)
- **Quality:** Excellent performance for security guidance
- **Estimated cost:** ~$0.0003-0.0006 per conversation

**Configuration:**
1. Get OpenAI API key from https://platform.openai.com/api-keys
2. Add to `terraform.tfvars`: `openai_api_key = "sk-..."`
3. Deploy: `terraform apply`

**Example Usage:**
- Ask: "I think I got breached"
- Advisor recommends: Email breach checks, password checks, OSINT Dashboard
- Provides step-by-step guidance and both technical and executive summaries

### IPQualityScore Tools

All IPQualityScore tools use the same API key and share the free tier limit (1,000 requests/month total).

**IP Reputation** (`/tools/ipqualityscore`)
- Fraud score (0-100)
- VPN/Proxy/Tor detection
- Bot detection
- Recent abuse detection
- Free tier: 100 requests/day

**Email Verification** (`/tools/ipqs-email`)
- Email syntax, domain, and MX validation
- Disposable email detection
- Spamtrap/honeypot detection
- Recent abuse detection
- Free tier: 1,000 requests/month

**Phone Validation** (`/tools/ipqs-phone`)
- Phone number format validation
- Line type detection (mobile, landline, VOIP)
- Risky number detection
- Carrier information
- Free tier: 1,000 requests/month

**URL Scanner** (`/tools/ipqs-url`)
- Phishing detection
- Malware detection
- Suspicious content detection
- Domain and server information
- Free tier: 1,000 requests/month

## API Keys Configuration

### Required API Keys

Add these to `infra/envs/dev/terraform.tfvars`:

```hcl
# IPQualityScore (for IP reputation, email, phone, URL tools)
ipqualityscore_api_key = "your-key-here"

# Hunter.io (for email verification and finder)
hunter_api_key = "your-key-here"

# OpenAI (for Security Advisor chatbot)
openai_api_key = "sk-..."
openai_model = "gpt-4o-mini"  # Optional, defaults to gpt-4o-mini
```

### Optional API Keys (Increase Rate Limits)

```hcl
# EmailRep.io (optional, increases rate limits)
emailrep_api_key = "your-key-here"

# NumLookup (optional, increases rate limits)
numlookup_api_key = "your-key-here"
```

### Tools That Work Without API Keys

- **IP-API.com** - Full functionality, 45 req/min
- **BreachDirectory** - Full functionality, no limits
- **EmailRep.io** - Works without key (lower rate limits)

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

**Quick Deploy (Recommended)**:
```bash
cd frontend
./deploy.sh
```

**Manual Deploy**:
```bash
# Build frontend
cd frontend
npm run build

# Get current bucket name and CloudFront ID
cd ../infra/envs/dev
BUCKET_NAME=$(terraform output -raw bucket_name)
CLOUDFRONT_ID=$(terraform output -raw cloudfront_id)

# Deploy to S3
cd ../../../frontend
aws s3 sync dist/ "s3://$BUCKET_NAME/" --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_ID" \
  --paths "/*"

# Check CloudFront distribution status
aws cloudfront get-distribution \
  --id "$CLOUDFRONT_ID" \
  --query 'Distribution.Status'
```

**Update Environment Variables**:
If you've updated infrastructure, update the frontend environment variables:
```bash
cd frontend
./update-env.sh
npm run build
./deploy.sh
```

#### Tools Not Showing After Deployment

If you've run `terraform apply` and `./deploy.sh` but don't see all tools:

**1. CloudFront Cache Invalidation**
CloudFront cache invalidation can take **5-15 minutes** to fully propagate.

**Check invalidation status:**
```bash
cd infra/envs/dev
CLOUDFRONT_ID=$(terraform output -raw cloudfront_id)
aws cloudfront list-invalidations --distribution-id "$CLOUDFRONT_ID" --max-items 1
```

**Force immediate refresh:**
- Hard refresh browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows/Linux)
- Or open in incognito/private window

**2. Rebuild Frontend**
Make sure you rebuilt after adding new tools:
```bash
cd frontend
npm run build
./deploy.sh
```

**3. Verify Build Includes New Tools**
```bash
cd frontend
grep -r "ipqs-email\|ipqs-phone\|ipqs-url\|security-advisor" dist/assets/*.js | head -5
```

**4. Verify Registry Count**
```bash
cd frontend
grep -c "id: '" src/tools/registry.tsx
```
Should show 56 tools total.

**5. Manual Cache Clear**
```bash
cd infra/envs/dev
CLOUDFRONT_ID=$(terraform output -raw cloudfront_id)
aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_ID" \
    --paths "/*" \
    --paths "/index.html" \
    --paths "/assets/*"
```

**Expected Tool Count:**
- **Total tools:** 56
- **New IPQS tools:** 3 (ipqs-email, ipqs-phone, ipqs-url)
- **Security Advisor:** 1 (security-advisor)

#### Report Builder and Chats

- **Add to Report / Save Chat not visible:** Button appears only after a successful result. Rebuild frontend (`npm run build`), hard refresh, and ensure you’re logged in.
- **Save Report disabled:** You need at least one item; add via **Add to Report** in other tools first.
- **401 Unauthorized on save/load/list:** JWT or backend misconfiguration. Ensure backend is deployed and you’re logged in; check CloudWatch for the `reports` Lambda.
- **Where data is stored:** DynamoDB `netknife-{env}-reports`; user-scoped by Cognito ID; 1-year TTL.

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

## Production Readiness

Priorities before launch: **Favicon** (`public/favicon.svg`), **dev bypass** only when `import.meta.env.DEV` (see `lib/auth.ts`), **API URL** guard in `lib/api.ts`, **source maps** off in prod (`vite.config.ts`). **High:** 402 + Upgrade modal (`UpgradeModal.tsx`, `netknife:show-upgrade`), 404 for unknown paths (`NotFoundPage`), ToS/Privacy routes, security headers on CloudFront, user-facing error copy (`body?.error` or `body?.message`), Headers Lambda 500 `details` only for known safe messages. **Medium:** Loading/empty states, a11y on Callback/ProtectedRoute, ESLint in devDependencies and CI. **Infra:** WAF is not supported for HTTP API; use REST API or Lambda+usage plans; keep CORS to prod origins only.

---

## Monetization

**Model:** Browser-only tools are **free**. API/remote tools, Security Advisor, and higher report limits require **API Access — $5/mo**. One-time **donations** supported. User `alex.lux` is grandfathered (no limits).

**Free:** All offline (LOCAL) tools; 0 API/remote calls; 0 Security Advisor; 3 saved reports/month.

**API Access ($5/mo):** 500 API/remote calls; 100 Security Advisor messages; 50 saved reports.

**Donations:** One-time via Stripe (min $1, max $1000); no subscription. See Pricing page.

**Tech:** DynamoDB `billing` (planId, stripeCustomerId, periodEnd) and `usage` (pk=userId, sk=MONTH#YYYY-MM, remoteCalls, advisorMessages, reportSaves); Stripe Checkout (subscription + one-time), Customer Portal, webhook; billing layer: `getAuth`, `checkLimit`, `incrementUsage`; 402 with `{ code, upgradeUrl, message }` when over limit; frontend Upgrade modal on 402. **Pricing page:** `/pricing` — usage, Subscribe, Manage, Donate.

---

## Infra / Dev Environment

**Quick start:** `cd infra/envs/dev`, `./init.sh`, `cp terraform.tfvars.example terraform.tfvars`, edit vars, `terraform apply -auto-approve`. **Scripts:** `init.sh`, `apply.sh`, `redeploy.sh`, `deploy-complete.sh`, `update-env.sh` (frontend), `set-password.sh`, `verify-deployment.sh`, `check-dns.sh`, `sync-cloudflare-token.sh`. **Custom domain:** set `custom_domain`, `cloudflare_zone_id`, `cloudflare_zone_name`, `cloudflare_subdomain`; DNS record name is the subdomain (e.g. `tools`) not the FQDN. **Cognito:** 14+ chars, upper, lower, number, symbol; after `terraform apply`, run `./update-env.sh` in `frontend/` and rebuild so Cognito domain/client/issuer stay in sync. **Full details:** [infra/envs/dev/README.md](infra/envs/dev/README.md) (init, DNS, password, troubleshooting, redeploy, Cloudflare token).

---

## Improvements & Roadmap

Suggested improvements and future work. **B** = quick win, **M** = medium, **L** = larger.

### Billing & Monetization

- **Extend billing to all remote Lambdas [L]:** `dns`, `security-advisor`, `cve-lookup`, `reports`, `rdap`, and `headers` use the billing layer. Remaining: tls, traceroute, reverse-dns, dns-propagation, asn-details, bgp-looking-glass, peeringdb, ip-api, breachdirectory, emailrep, hibp, email-auth, abuseipdb, shodan, virustotal, greynoise, censys, security-trails, ipqualityscore, ipqs-*, hunter, phone-validator, ssl-labs. Pattern: add `layers = [billing]`, `BILLING_TABLE`, `USAGE_TABLE`; in handler: `getAuth`, `checkLimit(..., 'remote')` → 402 if over limit; `incrementUsage` before each 200.
- **Usage in Topbar [B]:** e.g. “X/500 API calls” when `plan === 'pro'”.
- **Approaching-limit warning [M]:** When usage ≥ 90% of limit, show a notice.

### Auth & Tokens

- **Silent token refresh [B] — DONE:** `getAccessToken()` uses `signinSilent()` when the access token is expired and a refresh token exists.
- **Idle logout [M]:** Optional session timeout or “Session expired” after N minutes inactive.

### Documentation

- **Per-Lambda READMEs [B]:** Short `README.md` in each `backend/functions/<name>/` with purpose, env vars, request/response, and build steps.
- **ToS & Privacy [M]:** `/terms` and `/privacy`; link from Login and Pricing.

### New Tools & Features

- **Kali-style / recon [M–L]:** Port Scanner (Node TCP connect), Dir Buster (`fetch` + wordlist), Subdomain Check (DoH), Hash Identifier (offline, infer hash type), nmap (binary in layer/image, `-sT -sV -Pn`), Tech Detector (`fetch` + fingerprints).
- **Report Builder:** Export as JSON [B]; report templates (Pentest, Incident) [M]. Notes: image paste, tables, “/” block selector [M].
- **Search & UX:** Tool deep link with query (e.g. `/tools?q=cve`) [B]; ErrorBoundary for tools [B]; Cmd+K tool search [M].

### Infra & Ops

- **Cache attribute consistency [M]:** Some Lambdas use `Item.value`, others `Item.data`; standardize (e.g. `value`) and a shared helper.
- **Staging / prod [M]:** `tfvars.staging` and separate Stripe/Cognito where needed.

### Security & Hardening

- **SSRF:** Headers already block private IPs; TLS/DNS use explicit upstreams. Apply the same to any new “fetch URL” tool.
- **WAF:** Not supported for HTTP API; consider REST or Lambda usage plans for extra limits.
- **Secrets:** Keep avoiding logging or returning API keys, tokens, PII; “Copy (redacted)” is good.

### Frontend & Polish

- **`apiPost` and `VITE_API_URL` [B]:** Guard when `!API_URL` in dev.
- **Loading/empty states:** Ensure every remote tool has clear loading and “no data” states.
- **`requiresApiKey` [M]:** Use it to show “Configure API key” and optionally disable Run when the key is known to be unset.
- **Theme [M]:** Optional light theme or system preference.

### Testing & CI

- **ESLint** in devDependencies and CI.
- **Lambda unit tests:** Billing layer, `checkLimit`/`incrementUsage`, CVE/CVSS parsers.
- **E2E (e.g. Playwright):** Login → tool → add to report → PDF.

---

## License

MIT License - See [LICENSE](LICENSE) file

## Contributing

This is a personal project, but suggestions are welcome. Please open an issue first to discuss changes.

