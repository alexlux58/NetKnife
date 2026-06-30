# ==============================================================================
# NETKNIFE - KALI LINUX AMI (Packer)
# ==============================================================================
# Builds a standardized Kali image with cloud security tools and SSM agent.
#
# Usage:
#   packer init .
#   packer build -var "region=us-west-2" .
#
# Prerequisites:
#   - AWS credentials with ec2:RunInstances, ec2:RegisterImage, iam:PassRole
#   - Packer >= 1.9
# ==============================================================================

packer {
  required_plugins {
    amazon = {
      version = ">= 1.2.8"
      source  = "github.com/hashicorp/amazon"
    }
  }
}

variable "region" {
  type    = string
  default = "us-west-2"
}

variable "instance_type" {
  type    = string
  default = "t3.medium"
}

variable "ami_name" {
  type    = string
  default = "netknife-kali-{{timestamp}}"
}

variable "source_ami" {
  type        = string
  default     = ""
  description = "Override source AMI ID. If empty, uses latest Kali from Canonical/Marketplace filter."
}

locals {
  source_ami_id = var.source_ami != "" ? var.source_ami : data.amazon-ami.kali.id
}

# Latest official Kali Linux x86_64 HVM AMI (AWS Marketplace / Kali team)
data "amazon-ami" "kali" {
  filters = {
    name                = "kali-last-snapshot-amd64-*"
    root-device-type    = "ebs"
    virtualization-type = "hvm"
  }
  most_recent = true
  owners      = ["679593333241"] # Kali Linux official AWS account
  region      = var.region
}

source "amazon-ebs" "kali" {
  ami_name      = var.ami_name
  instance_type = var.instance_type
  region        = var.region
  source_ami    = local.source_ami_id
  ssh_username  = "admin"

  tags = {
    Name        = "netknife-kali"
    Project     = "netknife"
    ManagedBy   = "packer"
    BuildDate   = "{{timestamp}}"
  }

  launch_block_device_mappings {
    device_name           = "/dev/xvda"
    volume_size           = 30
    volume_type           = "gp3"
    delete_on_termination = true
  }
}

build {
  sources = ["source.amazon-ebs.kali"]

  # Base system setup
  provisioner "shell" {
    script = "scripts/01-base.sh"
  }

  # Cloud security tools
  provisioner "shell" {
    script = "scripts/02-cloud-security-tools.sh"
  }

  # NetKnife tooling + manifest
  provisioner "file" {
    source      = "files/tools-manifest.json"
    destination = "/tmp/tools-manifest.json"
  }

  provisioner "file" {
    source      = "files/netknife-tools"
    destination = "/tmp/netknife-tools"
  }

  provisioner "shell" {
    inline = [
      "sudo mv /tmp/tools-manifest.json /opt/netknife/tools-manifest.json",
      "sudo mv /tmp/netknife-tools /usr/local/bin/netknife-tools",
      "sudo chmod +x /usr/local/bin/netknife-tools",
    ]
  }

  # Cleanup for AMI
  provisioner "shell" {
    script = "scripts/99-cleanup.sh"
  }
}
