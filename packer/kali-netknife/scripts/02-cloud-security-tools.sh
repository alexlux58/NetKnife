#!/bin/bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

echo "==> Installing cloud security tools"

TOOLS_DIR="/opt/netknife/tools"
mkdir -p "$TOOLS_DIR"
cd "$TOOLS_DIR"

# --- Trivy ---
if ! command -v trivy &>/dev/null; then
  curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
fi

# --- OpenSCAP ---
apt-get install -y openscap-scanner scap-security-guide || true

# --- Prowler ---
if [ ! -d prowler ]; then
  git clone --depth 1 https://github.com/prowler-cloud/prowler.git
  cd prowler && pip3 install --break-system-packages -r requirements.txt 2>/dev/null || pip3 install -r requirements.txt
  ln -sf "$TOOLS_DIR/prowler/prowler.py" /usr/local/bin/prowler
  cd ..
fi

# --- Scout Suite ---
if [ ! -d ScoutSuite ]; then
  git clone --depth 1 https://github.com/nccgroup/ScoutSuite.git
  cd ScoutSuite && pip3 install --break-system-packages -r requirements.txt 2>/dev/null || pip3 install -r requirements.txt
  ln -sf "$TOOLS_DIR/ScoutSuite/scout.py" /usr/local/bin/scout-suite
  cd ..
fi

# --- CloudSplaining ---
pip3 install --break-system-packages cloudsplaining 2>/dev/null || pip3 install cloudsplaining

# --- Steampipe ---
if ! command -v steampipe &>/dev/null; then
  curl -fsSL https://steampipe.io/install/steampipe.sh | sh
  steampipe plugin install aws azure gcp 2>/dev/null || true
fi

# --- Cloud Custodian ---
pip3 install --break-system-packages c7n 2>/dev/null || pip3 install c7n

# --- Checkov ---
pip3 install --break-system-packages checkov 2>/dev/null || pip3 install checkov

# --- Terrascan ---
if ! command -v terrascan &>/dev/null; then
  curl -L "$(curl -s https://api.github.com/repos/tenable/terrascan/releases/latest | jq -r '.assets[] | select(.name|test("Linux_x86_64")) | .browser_download_url')" -o /tmp/terrascan.tar.gz
  tar -xzf /tmp/terrascan.tar.gz -C /usr/local/bin terrascan
fi

# --- osquery ---
apt-get install -y osquery || true

# --- Kubernetes tools ---
# kube-bench
if ! command -v kube-bench &>/dev/null; then
  KUBE_BENCH_VER=$(curl -s https://api.github.com/repos/aquasecurity/kube-bench/releases/latest | jq -r .tag_name)
  curl -L "https://github.com/aquasecurity/kube-bench/releases/download/${KUBE_BENCH_VER}/kube-bench_${KUBE_BENCH_VER#v}_linux_amd64.tar.gz" -o /tmp/kube-bench.tar.gz
  tar -xzf /tmp/kube-bench.tar.gz -C /usr/local/bin kube-bench
fi

# kube-hunter
pip3 install --break-system-packages kube-hunter 2>/dev/null || pip3 install kube-hunter

# Kubescape
if ! command -v kubescape &>/dev/null; then
  curl -s https://raw.githubusercontent.com/kubescape/kubescape/master/install.sh | /bin/bash
fi

# --- AWS CLI v2 (for Prowler, Scout Suite, etc.) ---
if ! command -v aws &>/dev/null; then
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
  unzip -q /tmp/awscliv2.zip -d /tmp
  /tmp/aws/install
fi

chown -R admin:admin "$TOOLS_DIR"
echo "==> Cloud security tools installed"
