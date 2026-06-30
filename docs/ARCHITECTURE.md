# NetKnife Architecture

Logical diagrams for system topology, user flows, billing, and data. For deployment steps see [README](../README.md) and [infra/envs/dev/README](../infra/envs/dev/README.md). For Stripe setup see [STRIPE-SETUP.md](./STRIPE-SETUP.md).

**Contents:** [System overview](#1-system-overview) · [Infrastructure modules](#2-infrastructure-modules) · [Authentication](#3-authentication) · [Tool execution](#4-tool-execution) · [Billing](#5-billing) · [Profile & reports](#6-profile--reports) · [Message board](#7-message-board) · [Data model](#8-data-model) · [CI & security](#9-ci--security) · [Related docs](#related-docs)

---

## 1. System overview

NetKnife is a **serverless** app: React SPA on S3/CloudFront, API on API Gateway HTTP API + Lambda, auth on Cognito, persistence on DynamoDB, payments on Stripe.

```mermaid
flowchart TB
  subgraph User["User browser"]
    SPA["React SPA<br/>(Vite, TypeScript)"]
  end

  subgraph Edge["Edge & DNS"]
    CF_DNS["Cloudflare DNS<br/>(optional CNAME)"]
    CF["CloudFront CDN<br/>HTTPS, security headers"]
  end

  subgraph Static["Static hosting"]
    S3["S3 bucket<br/>netknife-site-*"]
  end

  subgraph API["API layer"]
    APIGW["API Gateway HTTP API<br/>JWT authorizer"]
    WAF["WAF ACL<br/>(created, not attached*)"]
  end

  subgraph Compute["Lambda functions (~38)"]
    Tools["Tool Lambdas<br/>dns, tls, shodan, …"]
    Core["Core Lambdas<br/>profile, reports, billing, board"]
    Triggers["cognito-triggers"]
  end

  subgraph Auth["Identity"]
    Cognito["Cognito User Pool<br/>Hosted UI + SignUp API"]
  end

  subgraph Data["Data"]
    DDB["DynamoDB<br/>18 tables"]
    Cache["Response cache + TTL"]
  end

  subgraph External["External services"]
    Stripe["Stripe<br/>Checkout, Portal, Webhooks"]
    Upstream["Cloudflare DoH, NVD, Shodan,<br/>OpenAI, third-party APIs"]
    SNS["SNS alerts"]
  end

  User --> CF_DNS --> CF
  CF --> S3
  SPA -->|Bearer JWT| APIGW
  SPA -->|OAuth login| Cognito
  APIGW --> Tools
  APIGW --> Core
  Cognito --> Triggers
  Triggers --> DDB
  Tools --> DDB
  Tools --> Upstream
  Core --> DDB
  Core --> Stripe
  Stripe -->|POST /billing/webhook| Core
  Compute --> SNS

  classDef note fill:#1e293b,stroke:#64748b,color:#e2e8f0
  class WAF note
```

> \* **WAF note:** Terraform provisions `netknife-{env}-api-waf`, but AWS WAF v2 cannot attach to API Gateway **HTTP APIs**. Rate limiting today relies on Cognito JWT + optional upstream API quotas. See [IMPROVEMENTS.md](./IMPROVEMENTS.md).

---

## 2. Infrastructure modules

Terraform lives under `infra/modules/` and is wired from `infra/envs/dev/`.

```mermaid
flowchart LR
  subgraph env["infra/envs/dev"]
    Main["main.tf"]
    TFVars["terraform.tfvars"]
  end

  subgraph modules["Terraform modules"]
    SS["static_site<br/>S3 + CloudFront OAC"]
    ACM["acm<br/>us-east-1 cert"]
    Auth["auth<br/>Cognito pool + triggers"]
    API["api<br/>API GW, Lambdas, DDB"]
    Ops["ops<br/>alarms, SNS, log groups"]
    Cost["cost<br/>budget alerts"]
  end

  Main --> SS
  Main --> ACM
  Main --> Auth
  Main --> API
  Main --> Ops
  Main --> Cost
  TFVars --> Main

  SS -->|"site_url"| Auth
  SS -->|"allowed_origins"| API
  Auth -->|"JWT issuer + client_id"| API
```

| Module | Key outputs | Purpose |
|--------|-------------|---------|
| `static_site` | `cloudfront_domain`, `bucket_name` | Private S3, CloudFront, SPA error routing |
| `acm` | ACM ARN | TLS for custom domain (must be `us-east-1` for CloudFront) |
| `auth` | `user_pool_id`, `client_id`, `cognito_domain_url` | User pool, Hosted UI, signup triggers |
| `api` | `api_url` | HTTP API, ~38 Lambdas, DynamoDB tables, shared layer |
| `ops` | `alerts_topic_arn` | CloudWatch alarms → SNS email |
| `cost` | — | Monthly AWS budget notification |

**Deploy path:** `terraform apply` → `frontend/update-env.sh` → `npm run build` → `aws s3 sync` → CloudFront invalidation.

---

## 3. Authentication

### 3.1 Login (Hosted UI)

```mermaid
sequenceDiagram
  actor U as User
  participant SPA as React SPA
  participant Cognito as Cognito Hosted UI
  participant CB as /callback page
  participant API as API Gateway

  U->>SPA: Open /login
  SPA->>Cognito: Redirect (OAuth code + PKCE)
  U->>Cognito: Enter credentials
  Cognito->>CB: Redirect with ?code=
  CB->>Cognito: Exchange code for tokens
  CB->>SPA: Store tokens (sessionStorage)
  SPA->>API: POST /dns {…} Authorization: Bearer
  API->>API: JWT authorizer validates issuer + aud
  API-->>SPA: 200 JSON
```

**Key files:** `frontend/src/lib/auth.ts`, `frontend/src/app/views/LoginPage.tsx`, `frontend/src/app/views/CallbackPage.tsx`, `infra/modules/auth/`.

### 3.2 Signup (custom form + triggers)

```mermaid
sequenceDiagram
  participant SPA as SignUpPage
  participant Cognito as Cognito SignUp API
  participant Pre as PreSignUp trigger
  participant Post as PostConfirmation trigger
  participant DDB as DynamoDB
  participant SNS as SNS

  SPA->>Cognito: signUp(email, phone, password)
  Cognito->>Pre: PreSignUp event
  Pre->>DDB: Read auth-config (signups_enabled?)
  alt signups disabled
    Pre-->>Cognito: Fail signup
  else enabled
    Pre-->>Cognito: autoConfirmUser
  end
  Cognito->>Post: PostConfirmation
  Post->>DDB: Put signups row (sub, email, …)
  Post->>SNS: Optional new-user email
```

**Failsafe:** `netknife-{env}-auth-config` item `id=CONFIG` with `signups_enabled`. Admins can flip signups off without redeploying Lambdas.

### 3.3 Authorization layers

```mermaid
flowchart TD
  Req["Incoming request"]
  JWT{"API Gateway<br/>JWT valid?"}
  UserId["Extract Cognito sub<br/>from claims"]
  Admin{"Admin username<br/>in tfvars?"}
  Exempt{"Billing-exempt<br/>username?"}
  Tool["Run tool Lambda"]
  Deny401["401 Unauthorized"]
  Deny403["403 Forbidden<br/>(admin-only routes)"]

  Req --> JWT
  JWT -->|no| Deny401
  JWT -->|yes| UserId
  UserId --> Admin
  Admin -->|admin route, not admin| Deny403
  Admin -->|ok| Exempt
  Exempt --> Tool
```

---

## 4. Tool execution

60 tools are registered in `frontend/src/tools/registry.tsx`: **30 offline** (browser-only) and **30 remote** (API-backed).

### 4.1 Offline vs remote

```mermaid
flowchart LR
  subgraph Offline["Offline tools (30)"]
    Browser["Pure client JS<br/>Web Crypto, math, parsers"]
    Browser --> Result1["Result in browser<br/>No network"]
  end

  subgraph Remote["Remote tools (30)"]
    UI["Tool UI"]
    Gate{"BillingContext<br/>canUseRemote?"}
    Lock["Upgrade prompt /<br/>locked sidebar"]
    API["apiPost('/route')"]
    Lambda["Lambda handler"]
    Upstream["External API"]
    Cache["DynamoDB cache"]
    UI --> Gate
    Gate -->|free plan| Lock
    Gate -->|pro / exempt| API
    API --> Lambda
    Lambda --> Cache
    Lambda --> Upstream
    Lambda --> Result2["JSON response"]
  end
```

### 4.2 Remote tool request path

```mermaid
sequenceDiagram
  participant T as Tool component
  participant API as api.ts
  participant GW as API Gateway
  participant L as Tool Lambda
  participant C as DynamoDB cache
  participant Ext as Upstream API

  T->>API: apiPost('/dns', { domain })
  API->>API: getAccessToken()
  API->>GW: POST + Bearer JWT
  GW->>L: Invoke (authorized)
  L->>C: Get cache_key
  alt cache hit
    C-->>L: Cached JSON
  else cache miss
    L->>Ext: Cloudflare DoH / NVD / …
    Ext-->>L: Response
    L->>C: Put with TTL
  end
  L-->>API: 200 { data }
  API-->>T: Render results
```

**Important gap:** Usage limits (`remoteCalls`, `advisorMessages`, `reportSaves`) are **enforced in the frontend** today. The billing Lambda reads usage from `netknife-{env}-usage`, but most tool Lambdas do **not** increment counters or return `402 Payment Required`. A client that calls the API directly can bypass Pro gating. See [IMPROVEMENTS.md](./IMPROVEMENTS.md#1-server-side-billing-enforcement-critical).

### 4.3 OSINT Dashboard orchestration

```mermaid
flowchart TB
  Dash["OSINT Dashboard UI"]
  Dash --> P1["Parallel apiPost calls"]
  P1 --> A["/abuseipdb"]
  P1 --> B["/shodan"]
  P1 --> C["/virustotal"]
  P1 --> D["/greynoise"]
  P1 --> E["…"]
  A & B & C & D & E --> Merge["Merge + display cards"]
```

---

## 5. Billing

Plans are defined in `backend/functions/billing/index.js`:

| Plan | Remote calls | Advisor msgs | Report saves |
|------|-------------|--------------|--------------|
| `free` | 0 | 0 | 3 |
| `pro` ($5/mo) | 500 | 100 | 50 |
| `grandfathered` | unlimited | unlimited | unlimited |

`alex.lux` and `billing_exempt_usernames` in tfvars are always exempt.

### 5.1 Subscription checkout

```mermaid
sequenceDiagram
  actor U as User
  participant P as PricingPage
  participant B as billing Lambda
  participant S as Stripe
  participant WH as /billing/webhook
  participant DDB as billing table

  U->>P: Subscribe ($5/mo)
  P->>B: action: create-checkout, email
  B->>B: ensureStripeCustomer(sub)
  B->>S: checkout.sessions.create(subscription)
  S-->>B: checkout URL
  B-->>P: { url }
  P->>S: Redirect to Stripe Checkout
  U->>S: Pay (test: 4242…)
  S->>WH: checkout.session.completed
  WH->>WH: Verify signature
  WH->>DDB: planId=pro, stripeSubscriptionId
  S->>P: Redirect /pricing?success=1
  P->>B: action: usage
  B-->>P: plan: pro, limits, usage
```

### 5.2 Donation (one-time, no plan change)

```mermaid
sequenceDiagram
  participant P as PricingPage
  participant B as billing Lambda
  participant S as Stripe
  participant WH as /billing/webhook

  P->>B: action: create-donation, amount
  B->>S: checkout.sessions.create(mode=payment)
  Note over B,S: metadata.type = donation
  S-->>P: checkout URL
  P->>S: User pays
  S->>WH: checkout.session.completed
  WH->>WH: mode=payment → skip plan upgrade
  S->>P: /pricing?donated=1
```

### 5.3 Billing state machine

```mermaid
stateDiagram-v2
  [*] --> free: New user
  free --> pro: checkout.session.completed<br/>(subscription)
  pro --> pro: subscription.updated<br/>(active/trialing)
  pro --> free: subscription.deleted<br/>or canceled
  free --> free: donation completed<br/>(no plan change)

  state pro {
    [*] --> active
    active --> past_due: payment fails
    past_due --> active: payment recovered
    past_due --> free: subscription deleted
  }
```

### 5.4 Stale Stripe customer recovery

After rotating Stripe API keys to a new account, DynamoDB may still reference old `cus_…` IDs. The billing Lambda detects `resource_missing` and clears stale refs:

```mermaid
flowchart TD
  A["ensureStripeCustomer / handleUsage"]
  B{"stripe.customers.retrieve"}
  C{"No such customer?"}
  D["clearStaleStripeCustomer<br/>planId=free, null Stripe IDs"]
  E["Create new customer<br/>in current Stripe account"]
  F["Continue checkout / usage"]

  A --> B
  B --> C
  C -->|yes| D
  D --> E
  E --> F
  C -->|no| F
```

---

## 6. Profile & reports

### 6.1 Profile / avatar

```mermaid
sequenceDiagram
  participant S as SettingsPage
  participant Img as avatarImage.ts
  participant P as profile Lambda
  participant DDB as profiles table

  S->>Img: Resize/compress upload
  Img-->>S: data URL (WebP/JPEG, ≤250KB)
  S->>P: action: update, avatarUrl
  P->>P: Validate data: or https: URL
  P->>DDB: Put pk=sub
  P-->>S: 200
  S->>S: Dispatch PROFILE_UPDATED_EVENT
```

### 6.2 Report builder

```mermaid
flowchart LR
  Tools["Any tool / Notes"] --> Btn["Add to Report"]
  Btn --> Ctx["ReportContext<br/>(in-memory)"]
  Ctx --> Builder["Report Builder page"]
  Builder --> Save["POST /reports save"]
  Save --> DDB["reports table"]
  Builder --> PDF["jsPDF + html2canvas"]
  Builder --> AI["Security Advisor<br/>for AI summary PDF"]
```

---

## 7. Message board

Eight DynamoDB tables back channels, threads, comments, likes, bookmarks, DMs, and an admin activity feed.

```mermaid
flowchart TB
  UI["Board UI"]
  BL["board Lambda"]
  UI -->|action: listChannels, createThread, …| BL
  BL --> CH["board-channels"]
  BL --> TH["board-threads"]
  BL --> CM["board-comments"]
  BL --> LK["board-likes"]
  BL --> BK["board-bookmarks"]
  BL --> DM["board-dm-*"]
  BL --> AC["board-activity<br/>TTL 30 days"]
```

Admin-only actions (e.g. create channel) check `admin_usernames` from environment.

---

## 8. Data model

```mermaid
erDiagram
  COGNITO_USER ||--o| PROFILES : "pk = sub"
  COGNITO_USER ||--o| BILLING : "pk = sub"
  COGNITO_USER ||--o{ USAGE : "pk = sub, sk = MONTH#YYYY-MM"
  COGNITO_USER ||--o{ REPORTS : "pk = userId#type"
  COGNITO_USER ||--o| SIGNUPS : "pk = sub"
  COGNITO_USER ||--o{ GUIDE_PROGRESS : "USER#sub"

  BILLING {
    string pk
    string planId
    string stripeCustomerId
    string stripeSubscriptionId
    string periodEnd
  }

  USAGE {
    string pk
    string sk
    int remoteCalls
    int advisorMessages
    int reportSaves
  }

  PROFILES {
    string pk
    string displayName
    string avatarUrl
    string theme
    string bio
  }

  CACHE {
    string cache_key
    json value
    int expires_at
  }
```

**Table prefix:** `netknife-{env}-*` (e.g. `netknife-dev-billing`). Full list in `infra/modules/api/main.tf`.

---

## 9. CI & security

```mermaid
flowchart LR
  PR["Pull request"]
  PR --> CI["ci.yml<br/>lint, typecheck, build, unit tests"]
  PR --> SEC["security.yml<br/>GitGuardian, Snyk, Checkov, Trivy"]
  CI --> Merge["Merge to main"]
  SEC --> Merge
  Merge --> Manual["Manual deploy<br/>terraform apply + s3 sync"]
```

| Control | Where |
|---------|--------|
| JWT validation | API Gateway authorizer (production path) |
| CORS | `allowed_origins` = site URL only |
| SSRF | Private IPs blocked in `headers` Lambda |
| Secrets | tfvars gitignored; Lambda env vars |
| Stripe webhooks | Signature verification (`whsec_…`) |
| Alerts | CloudWatch → SNS on Lambda errors, API 5xx |

---

## Related docs

| Document | Topic |
|----------|--------|
| [IMPROVEMENTS.md](./IMPROVEMENTS.md) | Prioritized recommendations |
| [STRIPE-SETUP.md](./STRIPE-SETUP.md) | Stripe products, webhooks, test cards |
| [KNOWLEDGE-BASE.md](./KNOWLEDGE-BASE.md) | Security checklists & tool directory |
| [scripts/README.md](../scripts/README.md) | Python `nk` CLI for deploy/test/ops |
| [SECURITY.md](../SECURITY.md) | CI security scanning |
| [CICD.md](./CICD.md) | GitHub Actions deploy on push to main |
| [README § Roadmap](../README.md#improvements--roadmap) | Task-sized backlog (B/M/L) |
