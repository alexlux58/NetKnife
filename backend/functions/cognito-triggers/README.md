# Cognito Triggers (PreSignUp + PostConfirmation)

`npm install --omit=dev` is run automatically by Terraform before zipping. To preinstall:

```bash
npm install --omit=dev
```

- **PreSignUp**: Failsafe (read `signups_enabled` from auth config table); auto-confirm and auto-verify email.
- **PostConfirmation**: SNS notification for each new sign-up.

**Failsafe (disable new sign-ups):** from `infra/envs/dev` run:

```bash
./toggle-signups.sh disable
./toggle-signups.sh enable   # to re-enable
./toggle-signups.sh status   # to check
```
