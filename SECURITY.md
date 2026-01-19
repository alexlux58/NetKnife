# Security

NetKnife uses several automated checks to reduce secrets in code, dependency vulnerabilities, and infrastructure misconfigurations.

---

## 1. GitGuardian (ggshield) – secrets in code

- **What:** Scans commits for 500+ secret types (API keys, tokens, etc.).
- **Where:** `.github/workflows/security.yml` (job `secrets`) and optional pre-commit.
- **Setup:**
  1. [GitGuardian](https://dashboard.gitguardian.com) → API key.
  2. GitHub: **Settings → Secrets and variables → Actions** → `GITGUARDIAN_API_KEY`.
- **Config:** `.gitguardian.yaml` (ignored paths, `exit_zero`).
- **Docs:** [ggshield](https://github.com/GitGuardian/ggshield), [GitGuardian/ggshield-action](https://github.com/GitGuardian/ggshield-action).

---

## 2. Snyk – dependencies + Terraform

- **What:** Vulnerability DB for npm and IaC (Terraform) misconfigs.
- **Where:** `.github/workflows/security.yml` (jobs `snyk-deps`, `snyk-iac`).
- **Setup:**
  1. [Snyk](https://app.snyk.io/account) → Account → API token.
  2. GitHub Actions secret: `SNYK_TOKEN`.
- **Projects scanned:** `frontend`, `backend/functions/billing`, `backend/functions/cognito-triggers`, `infra/` (Terraform).
- **Docs:** [Snyk CLI](https://docs.snyk.io/snyk-cli), [Snyk GitHub Actions](https://github.com/snyk/actions).

---

## 3. npm audit – dependency vulns (no sign‑up)

- **What:** Built‑in npm check for known CVEs.
- **Where:** `.github/workflows/security.yml` (job `npm-audit`), and `npm run audit` in `frontend`.
- **Local:**  
  `cd frontend && npm audit --audit-level=high`  
  and similarly in `backend/functions/billing`, `backend/functions/cognito-triggers`.

---

## 4. Checkov – Terraform / IaC (no sign‑up)

- **What:** Policy-as-code for Terraform, CloudFormation, etc.
- **Where:** `.github/workflows/security.yml` (job `checkov`), `infra/`.
- **Local:** `pip install checkov && checkov -d infra/ --framework terraform`.

---

## 5. Trivy – config & filesystem (no sign‑up)

- **What:** Scans configs, lockfiles, and filesystem for issues.
- **Where:** `.github/workflows/security.yml` (job `trivy`).
- **Local:** `trivy fs --severity CRITICAL,HIGH .`

---

## 6. pre-commit – before each commit

- **What:** `trailing-whitespace`, `end-of-file-fixer`, `detect-private-key`, `detect-secrets` (heuristic, no API).
- **Setup:**
  ```bash
  pip install pre-commit
  pre-commit install
  pre-commit run --all-files   # optional first run
  ```
- **Config:** `.pre-commit-config.yaml`. `detect-secrets` uses `.secrets.baseline`; to refresh:  
  `detect-secrets scan --baseline .secrets.baseline`.
- **Optional:** Uncomment the `ggshield` hook in `.pre-commit-config.yaml` and set `GITGUARDIAN_API_KEY` in your env to run ggshield at commit time.

---

## 7. Dependabot – dependency update PRs

- **What:** Weekly (npm) / monthly (Terraform, GitHub Actions) PRs for outdated deps.
- **Config:** `.github/dependabot.yml`.

---

## Other options (not wired by default)

| Tool            | Purpose              | Notes                                      |
|-----------------|----------------------|--------------------------------------------|
| **CodeQL**      | SAST (code vulns)    | Free for public repos; enable in Security  |
| **Renovate**    | Dep updates          | Alternative to Dependabot                  |
| **Terrascan**   | IaC                  | Similar to Checkov                         |
| **Gitleaks**    | Secrets              | Alternative to detect-secrets / ggshield   |
| **OWASP ZAP**   | Dynamic web testing  | For deployed frontend/API                  |

---

## Fail-open in CI

The workflow uses `continue-on-error: true` for GitGuardian, Snyk, and Trivy so missing secrets or one-off findings don’t block the build. To **fail the pipeline** on those checks, remove `continue-on-error` from the corresponding steps and ensure `GITGUARDIAN_API_KEY` and `SNYK_TOKEN` are set.
