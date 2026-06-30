"""Project path resolution."""

from __future__ import annotations

import os
from pathlib import Path


def find_project_root(start: Path | None = None) -> Path:
    """Walk up from *start* until we find README.md + infra/envs."""
    cur = (start or Path.cwd()).resolve()
    for candidate in [cur, *cur.parents]:
        if (candidate / "README.md").is_file() and (candidate / "infra" / "envs").is_dir():
            return candidate
    raise FileNotFoundError(
        "Could not find NetKnife project root (expected README.md and infra/envs/). "
        "Run from the repo or pass --root."
    )


class ProjectPaths:
    def __init__(self, root: Path, env: str = "dev") -> None:
        self.root = root.resolve()
        self.env = env
        self.infra_env = self.root / "infra" / "envs" / env
        self.frontend = self.root / "frontend"
        self.backend = self.root / "backend"
        self.tfvars = self.infra_env / "terraform.tfvars"
        self.tfvars_example = self.infra_env / "terraform.tfvars.example"
        self.env_production = self.frontend / ".env.production"
        self.install_lambda_deps = self.root / "infra" / "scripts" / "install-lambda-deps.sh"
        self.prepare_lambda_shared = self.root / "infra" / "scripts" / "prepare-lambda-shared.sh"
        self.sync_cloudflare = self.infra_env / "sync-cloudflare-token.sh"

    @property
    def backend_hcl(self) -> Path:
        return self.infra_env / "backend.hcl"

    @property
    def local_state_file(self) -> Path:
        return self.infra_env / "terraform.tfstate"

    def uses_s3_backend_block(self) -> bool:
        return (self.infra_env / "backend.tf").is_file()

    @property
    def aws_region(self) -> str:
        return os.environ.get("AWS_DEFAULT_REGION", os.environ.get("AWS_REGION", "us-west-2"))

