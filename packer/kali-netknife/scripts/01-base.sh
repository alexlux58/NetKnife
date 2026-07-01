#!/bin/bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

echo "==> NetKnife Kali base setup"

# Ensure SSM agent (required for Session Manager access)
if ! command -v amazon-ssm-agent &>/dev/null; then
  mkdir -p /tmp/ssm
  cd /tmp/ssm
  wget -q "https://s3.${AWS_REGION:-us-west-2}.amazonaws.com/amazon-ssm-${AWS_REGION:-us-west-2}/latest/debian_amd64/amazon-ssm-agent.deb"
  dpkg -i amazon-ssm-agent.deb || apt-get install -f -y
  systemctl enable amazon-ssm-agent
fi

# Core packages
apt-get update -y
apt-get upgrade -y
apt-get install -y \
  curl wget git jq unzip ca-certificates gnupg lsb-release \
  python3 python3-pip python3-venv \
  docker.io docker-compose \
  unattended-upgrades

# Docker for Trivy image scans
usermod -aG docker admin || true
systemctl enable docker

# NetKnife directories
mkdir -p /opt/netknife/{scripts,reports,logs}
chown -R admin:admin /opt/netknife

# MOTD
cat > /etc/motd <<'EOF'
  _   __     _  __    _    _
 | \ | |   | |/ /   | |  | |
 |  \| | __| ' / ___| | _| | __ _ _ __
 | . ` |/ _` | | / _ \ |/ / |/ _` | '_ \
 | |\  | (_| | | |  __/   <| | (_| | | | |
 |_| \_|\__,_|_|  \___|_|\_\_|\__,_|_| |_|

 NetKnife Kali Lab — cloud security tools pre-installed.
 Run: netknife-tools list
EOF

echo "==> Base setup complete"
