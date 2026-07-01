# NetKnife Kali AMI (Packer)

Builds the standardized Kali Linux image used by Kali Labs.

## Quick start

```bash
cd packer/kali-netknife
packer init .
packer build -var "region=us-west-2"
```

Note the output AMI ID and set `kali_ami_id` in `infra/envs/dev/terraform.tfvars`.

## Override source AMI

If the Kali marketplace filter fails in your region:

```bash
packer build -var "region=us-west-2" -var "source_ami=ami-xxxxxxxx"
```

## What gets installed

See `files/tools-manifest.json` and `docs/KALI-LABS.md` for the full tool matrix.

## Scripts

| Script | Purpose |
|--------|---------|
| `01-base.sh` | SSM agent, Docker, motd |
| `02-cloud-security-tools.sh` | Trivy, Prowler, Scout Suite, etc. |
| `99-cleanup.sh` | AMI cleanup before snapshot |
