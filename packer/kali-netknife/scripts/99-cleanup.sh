#!/bin/bash
set -euo pipefail

echo "==> AMI cleanup"

# Clear shell history
history -c 2>/dev/null || true
rm -f /root/.bash_history /home/admin/.bash_history

# Clear apt cache
apt-get clean
rm -rf /var/lib/apt/lists/*

# Clear temp
rm -rf /tmp/*

# Zero free space (optional, speeds EBS snapshot)
dd if=/dev/zero of=/EMPTY bs=1M 2>/dev/null || true
rm -f /EMPTY

echo "==> Cleanup complete"
