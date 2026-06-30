"""Terraform operations."""

from __future__ import annotations

import json
import re
from pathlib import Path

from .paths import ProjectPaths
from .run import CommandError, run, run_stream, which
from . import ui


def _terraform_bin() -> str:
    tf = which("terraform")
    if not tf:
        raise CommandError("terraform not found on PATH", 127, ["terraform"])
    return tf


def ensure_tfvars(paths: ProjectPaths) -> None:
    if paths.tfvars.is_file():
        return
    if paths.tfvars_example.is_file():
        raise CommandError(
            f"Missing {paths.tfvars}. Copy from terraform.tfvars.example and configure.",
            1,
            [],
        )
    raise CommandError(f"Missing {paths.tfvars}", 1, [])


def ensure_init(paths: ProjectPaths, *, upgrade: bool = False) -> None:
    """Initialize Terraform — remote S3 if backend.hcl exists, else local state."""
    tf = _terraform_bin()
    cwd = str(paths.infra_env)

    if paths.backend_hcl.is_file():
        if not paths.uses_s3_backend_block():
            example = paths.infra_env / "backend.tf.example"
            if example.is_file():
                import shutil
                shutil.copy(example, paths.infra_env / "backend.tf")
        args = [tf, "init", "-input=false", f"-backend-config={paths.backend_hcl}"]
        if upgrade:
            args += ["-upgrade", "-reconfigure"]
    else:
        args = [tf, "init", "-input=false"]
        if upgrade:
            args += ["-upgrade", "-reconfigure"]

    code = run_stream(args, cwd=cwd)
    if code != 0:
        raise CommandError("terraform init failed", code, args)


def init(paths: ProjectPaths, *, upgrade: bool = True) -> None:
    ui.info(f"Running in {paths.infra_env}")
    ensure_init(paths, upgrade=upgrade)


def plan(paths: ProjectPaths, *, target: str | None = None, out: str | None = None) -> None:
    ensure_init(paths)
    tf = _terraform_bin()
    args = [tf, "plan"]
    if target:
        args += [f"-target={target}"]
    if out:
        args += ["-out", out]
    code = run_stream(args, cwd=str(paths.infra_env))
    if code != 0:
        raise CommandError("terraform plan failed", code, args)


def apply(
    paths: ProjectPaths,
    *,
    auto_approve: bool = False,
    target: str | None = None,
    plan_file: str | None = None,
) -> None:
    ensure_init(paths)
    tf = _terraform_bin()
    if plan_file:
        args = [tf, "apply", plan_file]
    else:
        args = [tf, "apply"]
        if auto_approve:
            args.append("-auto-approve")
        if target:
            args += [f"-target={target}"]
    code = run_stream(args, cwd=str(paths.infra_env))
    if code != 0:
        raise CommandError("terraform apply failed", code, args)


def validate(paths: ProjectPaths) -> None:
    tf = _terraform_bin()
    fmt = run([tf, "fmt", "-check", "-recursive"], cwd=str(paths.root / "infra"), capture=True, check=False)
    if fmt.returncode != 0:
        ui.warn("terraform fmt -check reported formatting differences")
    run([tf, "validate"], cwd=str(paths.infra_env))


def output_raw(paths: ProjectPaths, name: str) -> str:
    ensure_init(paths)
    tf = _terraform_bin()
    proc = run(
        [tf, "output", "-raw", name],
        cwd=str(paths.infra_env),
        capture=True,
    )
    return proc.stdout.strip()


def output_all(paths: ProjectPaths) -> dict[str, object]:
    ensure_init(paths)
    tf = _terraform_bin()
    proc = run(
        [tf, "output", "-json"],
        cwd=str(paths.infra_env),
        capture=True,
    )
    raw = json.loads(proc.stdout or "{}")
    return {k: v.get("value") for k, v in raw.items()}


def print_outputs(paths: ProjectPaths) -> None:
    outs = output_all(paths)
    if not outs:
        ui.warn("No terraform outputs (run terraform apply first)")
        return
    ui.title("Terraform outputs")
    for key in sorted(outs):
        val = outs[key]
        if isinstance(val, (dict, list)):
            ui.kv(key, json.dumps(val))
        else:
            ui.kv(key, str(val))


def lambda_target(function: str, env: str = "dev") -> str:
    """Map short name 'billing' → terraform target for that Lambda."""
    short = function.removeprefix("netknife-").removeprefix(f"{env}-")
    resource = f"module.api.aws_lambda_function.{short.replace('-', '_')}"
    # Terraform resource names use underscores; try common patterns
    candidates = [
        f"module.api.aws_lambda_function.{short}",
        f"module.api.aws_lambda_function.{short.replace('-', '_')}",
    ]
    # Known hyphenated lambda resources in main.tf often match the folder name
    return candidates[0] if "_" not in short else candidates[1]


def install_lambda_deps(paths: ProjectPaths) -> None:
    for script in (paths.install_lambda_deps, paths.prepare_lambda_shared):
        if script.is_file():
            code = run_stream(["bash", str(script)], cwd=str(paths.root))
            if code != 0:
                raise CommandError(f"{script.name} failed", code, ["bash", str(script)])
        else:
            ui.warn(f"Skipping missing script: {script}")


def sync_cloudflare_token(paths: ProjectPaths) -> None:
    if paths.sync_cloudflare.is_file():
        run_stream(["bash", str(paths.sync_cloudflare)], cwd=str(paths.infra_env))


def read_tfvar(paths: ProjectPaths, key: str) -> str | None:
    if not paths.tfvars.is_file():
        return None
    pattern = re.compile(rf"^\s*{re.escape(key)}\s*=\s*\"([^\"]*)\"", re.MULTILINE)
    m = pattern.search(paths.tfvars.read_text(encoding="utf-8"))
    return m.group(1) if m else None
