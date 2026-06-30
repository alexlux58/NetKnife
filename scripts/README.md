# NetKnife CLI (`nk`)

Python toolkit to simplify deploy, test, and day-to-day ops. **Stdlib only** — no `pip install` required (Python 3.10+).

## Setup

```bash
# From repo root — either works:
python3 scripts/nk.py check
./scripts/nk.py check

# Optional: add to PATH
chmod +x scripts/nk.py
export PATH="$PWD/scripts:$PATH"
nk check
```

Requires on your machine: `aws`, `terraform`, `node`, `npm` (and `dig` for DNS checks).

## Command reference

| Command | What it does |
|---------|----------------|
| `nk check` | Verify AWS CLI, Terraform, Node, `terraform.tfvars` |
| `nk status` | Project paths + terraform outputs summary |
| `nk init` | `terraform init -upgrade -reconfigure` |
| `nk plan` | `terraform plan` (`--target` optional) |
| `nk apply -y` | `terraform apply` |
| `nk outputs` | Print all terraform outputs |
| `nk lambda-deps` | Run `install-lambda-deps.sh` + shared layer prep |
| `nk env` | Write `frontend/.env.production` from terraform |
| `nk build` | `npm run build` |
| `nk deploy-fe` | S3 sync + CloudFront invalidation |
| `nk quick` | **Fast loop:** env → build → deploy-fe (no terraform) |
| `nk deploy -y` | **Full deploy:** infra + env + build + S3 |
| `nk deploy-infra -y` | Lambda deps + terraform only |
| `nk deploy-lambda billing` | Redeploy one Lambda (`-target`) |
| `nk dev` | Start Vite at http://localhost:5173 |
| `nk test` | Frontend lint + typecheck + vitest + backend tests |
| `nk test --terraform` | Also `terraform validate` |
| `nk verify` | Health check: AWS, CloudFront, S3, HTTP, DNS |
| `nk dns` | Check custom domain CNAME vs CloudFront |
| `nk logs billing` | Recent CloudWatch logs (`--minutes`, `--filter`) |
| `nk signups status` | Cognito signup failsafe (`enable` / `disable`) |
| `nk password USER PASS` | Set Cognito password (`--email` if new user) |

Global flags: `--root /path/to/NetKnife`, `--env dev` (default).

## Typical workflows

### First deploy

```bash
cp infra/envs/dev/terraform.tfvars.example infra/envs/dev/terraform.tfvars
# edit tfvars…

nk check
nk init
nk plan
nk deploy -y
nk verify
```

### After code changes (frontend only)

```bash
nk quick
```

### After Lambda / billing fix

```bash
nk deploy-lambda billing
# or all infra:
nk deploy-infra -y
```

### Local development

```bash
nk env          # once, after terraform apply
nk dev          # Vite — remote tools still hit deployed API
```

### Before opening a PR

```bash
nk test
nk test --terraform
```

### Debug production billing

```bash
nk logs billing --minutes 60 --filter "ERROR"
nk verify
```

## Environment variables

| Variable | Purpose |
|----------|---------|
| `AWS_PROFILE` / `AWS_ACCESS_KEY_ID` | AWS credentials |
| `AWS_DEFAULT_REGION` | Default `us-west-2` |
| `CLOUDFLARE_API_TOKEN` | Used by terraform if in tfvars sync |
| `NO_COLOR` | Disable ANSI colors |

## Relation to shell scripts

The CLI wraps existing workflows (`install-lambda-deps.sh`, `update-env.sh`, terraform, aws cli). Shell scripts under `infra/envs/dev/` still work; `nk` is the unified entry point for vibe-coding loops.

## See also

- [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) — system diagrams
- [infra/envs/dev/README.md](../infra/envs/dev/README.md) — Terraform details
- [docs/STRIPE-SETUP.md](../docs/STRIPE-SETUP.md) — billing configuration
