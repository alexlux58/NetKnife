# Social login setup (Google, Facebook, GitHub, Microsoft)

NetKnife uses **AWS Cognito federated identity providers**. Social buttons on `/login` and `/signup` redirect through Cognito Hosted UI.

## 1. Get the OAuth redirect URI

After `terraform apply`:

```bash
cd infra/envs/dev
terraform output cognito_oauth_idp_redirect_uri
```

Example:

```text
https://netknife-dev-772cb3e6.auth.us-west-2.amazoncognito.com/oauth2/idpresponse
```

Register this **exact URL** as an authorized redirect/callback in each OAuth app below.

## 2. Configure terraform.tfvars

Add client IDs and secrets (leave empty to disable a provider):

```hcl
google_client_id     = "....apps.googleusercontent.com"
google_client_secret = "..."

facebook_client_id     = "..."
facebook_client_secret = "..."

github_client_id     = "..."
github_client_secret = "..."

microsoft_client_id     = "..."
microsoft_client_secret = "..."
microsoft_tenant_id     = "common"   # or your Azure tenant ID
```

Then apply:

```bash
python3 scripts/nk.py deploy   # or: terraform apply in infra/envs/dev
```

Verify enabled providers:

```bash
terraform output enabled_social_providers
```

## 3. Create OAuth applications

### Google

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create **OAuth client ID** → Web application
3. Authorized redirect URIs: Cognito `oauth_idp_redirect_uri` from step 1
4. Copy Client ID and Client secret into `terraform.tfvars`

### Facebook

1. [Meta for Developers](https://developers.facebook.com/) → Create app → Consumer
2. Add **Facebook Login** product
3. Valid OAuth Redirect URIs: Cognito redirect URI
4. App ID → `facebook_client_id`, App Secret → `facebook_client_secret`

### GitHub

1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. Authorization callback URL: Cognito redirect URI
3. Enable **Email** scope; GitHub OIDC issuer is `https://github.com`
4. Client ID / Client secret → `terraform.tfvars`

### Microsoft (Entra ID)

1. [Azure Portal](https://portal.azure.com/) → Microsoft Entra ID → App registrations → New registration
2. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
3. Redirect URI: Web → Cognito redirect URI
4. Certificates & secrets → New client secret
5. Application (client) ID and secret → `terraform.tfvars`
6. Use `microsoft_tenant_id = "common"` for personal + work accounts

## 4. Frontend (optional)

To show only configured providers in the UI, set at build time:

```bash
VITE_SOCIAL_IDPS=Google,GitHub
```

If unset, all four buttons are shown (Cognito returns an error until that IdP is configured).

## 5. User experience

- **Hosted UI**: After Terraform apply, Cognito login page shows social buttons automatically.
- **NetKnife login page**: Buttons call Cognito with `identity_provider=Google` (etc.) for one-click sign-in.
- **First social login** creates a Cognito user; PreSignUp auto-confirms federated users.
- **Username/password** sign-up remains available via `/signup` (custom form with email/phone).

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Login option is not available` | IdP not in `terraform.tfvars` or `terraform apply` not run |
| Redirect URI mismatch | Use exact `cognito_oauth_idp_redirect_uri` output |
| GitHub email missing | Grant `user:email` on OAuth app; user must have public email |
| Microsoft personal account fails | Use `microsoft_tenant_id = "common"` |
