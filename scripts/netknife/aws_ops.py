"""AWS CLI helpers (Cognito, verification, logs)."""

from __future__ import annotations

import json
import re
import socket
import subprocess
import time
import urllib.error
import urllib.request
from typing import Any

from .paths import ProjectPaths
from .run import CommandError, run, which
from . import terraform_ops as tf
from . import ui


def aws_identity(paths: ProjectPaths) -> dict[str, str]:
    proc = run(
        ["aws", "sts", "get-caller-identity", "--output", "json"],
        capture=True,
        env={"AWS_DEFAULT_REGION": paths.aws_region},
    )
    return json.loads(proc.stdout or "{}")


def set_password(
    paths: ProjectPaths,
    username: str,
    password: str,
    *,
    email: str | None = None,
    create_if_missing: bool = True,
) -> None:
    if len(password) < 14:
        raise CommandError("Password must be at least 14 characters (Cognito policy)", 1, [])

    pool = tf.output_raw(paths, "user_pool_id")
    region = paths.aws_region
    env = {"AWS_DEFAULT_REGION": region}

    exists = run(
        ["aws", "cognito-idp", "admin-get-user", "--user-pool-id", pool, "--username", username],
        capture=True,
        check=False,
        env=env,
    ).returncode == 0

    if not exists:
        if not create_if_missing:
            raise CommandError(f"Cognito user '{username}' does not exist", 1, [])
        if not email:
            raise CommandError("email required to create new Cognito user (--email)", 1, [])
        run(
            [
                "aws", "cognito-idp", "admin-create-user",
                "--user-pool-id", pool,
                "--username", username,
                "--user-attributes", f"Name=email,Value={email}",
                "--temporary-password", "TempPass123!@#$",
            ],
            env=env,
        )
        ui.ok(f"Created user {username}")
        time.sleep(2)

    run(
        [
            "aws", "cognito-idp", "admin-set-user-password",
            "--user-pool-id", pool,
            "--username", username,
            "--password", password,
            "--permanent",
        ],
        env=env,
    )
    ui.ok(f"Password set for {username}")


def signups(paths: ProjectPaths, action: str) -> None:
    table = tf.output_raw(paths, "auth_config_table_name")
    env = {"AWS_DEFAULT_REGION": paths.aws_region}
    if action == "status":
        proc = run(
            [
                "aws", "dynamodb", "get-item",
                "--table-name", table,
                "--key", json.dumps({"id": {"S": "CONFIG"}}),
                "--output", "json",
            ],
            capture=True,
            check=False,
            env=env,
        )
        if proc.returncode != 0:
            ui.info("Sign-ups: ENABLED (default; no CONFIG item)")
            return
        data = json.loads(proc.stdout or "{}")
        val = data.get("Item", {}).get("signups_enabled", {}).get("BOOL")
        if val is False:
            ui.info("Sign-ups: DISABLED (failsafe on)")
        elif val is True:
            ui.info("Sign-ups: ENABLED")
        else:
            ui.info("Sign-ups: ENABLED (default)")
        return

    enabled = action == "enable"
    run(
        [
            "aws", "dynamodb", "put-item",
            "--table-name", table,
            "--item", json.dumps({"id": {"S": "CONFIG"}, "signups_enabled": {"BOOL": enabled}}),
        ],
        env=env,
    )
    ui.ok(f"Sign-ups {'ENABLED' if enabled else 'DISABLED'}")


def tail_lambda_logs(paths: ProjectPaths, name: str, *, minutes: int = 30, filter_text: str | None = None) -> None:
    fn = name if name.startswith("netknife-") else f"netknife-{paths.env}-{name}"
    log_group = f"/aws/lambda/{fn}"
    start_ms = int((time.time() - minutes * 60) * 1000)
    args = [
        "aws", "logs", "filter-log-events",
        "--log-group-name", log_group,
        "--start-time", str(start_ms),
        "--max-items", "50",
    ]
    if filter_text:
        args += ["--filter-pattern", filter_text]
    proc = run(args, capture=True, env={"AWS_DEFAULT_REGION": paths.aws_region}, check=False)
    if proc.returncode != 0:
        ui.err(proc.stderr or f"Could not read logs for {log_group}")
        return
    data = json.loads(proc.stdout or "{}")
    events = data.get("events", [])
    if not events:
        ui.info(f"No log events in last {minutes}m for {fn}")
        return
    for e in events:
        print(e.get("message", "").rstrip())


def _http_status(url: str, timeout: float = 10.0) -> int | None:
    try:
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code
    except OSError:
        return None


def _dig_cname(host: str) -> list[str]:
    if not which("dig"):
        return []
    proc = subprocess.run(
        ["dig", "+short", host, "CNAME"],
        capture_output=True,
        text=True,
        check=False,
    )
    return [ln.strip().rstrip(".") for ln in proc.stdout.splitlines() if ln.strip()]


def verify(paths: ProjectPaths) -> bool:
    """Run deployment health checks. Returns True if all critical checks pass."""
    ui.title("Deployment verification")
    ok_all = True

    try:
        outs = tf.output_all(paths)
    except CommandError as e:
        ui.err(str(e))
        return False

    site_url = str(outs.get("site_url") or "")
    cf_domain = str(outs.get("cloudfront_domain") or "")
    cf_id = str(outs.get("cloudfront_id") or "")
    bucket = str(outs.get("bucket_name") or "")
    custom = tf.read_tfvar(paths, "custom_domain") or ""

    # AWS identity
    try:
        ident = aws_identity(paths)
        ui.kv("AWS account", ident.get("Account", "?"))
        ui.kv("AWS ARN", ident.get("Arn", "?"))
    except CommandError:
        ui.err("AWS credentials not configured")
        ok_all = False

    # CloudFront
    if cf_id:
        proc = run(
            ["aws", "cloudfront", "get-distribution", "--id", cf_id, "--query", "Distribution.Status", "--output", "text"],
            capture=True,
            check=False,
            env={"AWS_DEFAULT_REGION": paths.aws_region},
        )
        status = (proc.stdout or "").strip() or "unknown"
        ui.kv("CloudFront status", status)
        if status != "Deployed":
            ui.warn("CloudFront may still be deploying")
    else:
        ok_all = False

    # S3 objects
    if bucket:
        proc = run(
            ["aws", "s3", "ls", f"s3://{bucket}/", "--summarize"],
            capture=True,
            check=False,
            env={"AWS_DEFAULT_REGION": paths.aws_region},
        )
        if proc.returncode == 0 and "index.html" in (proc.stdout or ""):
            ui.ok("S3 bucket has index.html")
        else:
            ui.warn("S3 bucket missing index.html — run `nk deploy-fe`")
            ok_all = False

    # HTTP checks
    for label, url in [("CloudFront", f"https://{cf_domain}"), ("Site", site_url)]:
        if not url or url == "https://":
            continue
        code = _http_status(url)
        if code and code < 500:
            ui.ok(f"{label} HTTP {code} — {url}")
        else:
            ui.warn(f"{label} not reachable — {url}")
            if label == "Site":
                ok_all = False

    # DNS
    if custom:
        ui.kv("Custom domain", custom)
        cnames = _dig_cname(custom)
        if cnames:
            ui.kv("DNS CNAME", ", ".join(cnames))
            if cf_domain and not any(cf_domain in c or c in cf_domain for c in cnames):
                ui.warn(f"CNAME does not match CloudFront domain {cf_domain}")
        else:
            ui.warn(f"DNS not resolving for {custom} (propagation or misconfiguration)")
            try:
                socket.gethostbyname(custom)
                ui.info("A/AAAA record resolves (may be proxied)")
            except socket.gaierror:
                pass

    # API smoke (unauthenticated → expect 401/403, not 5xx)
    api_url = str(outs.get("api_url") or "")
    if api_url:
        code = _http_status(f"{api_url.rstrip('/')}/dns")
        if code == 405 or code == 401 or code == 403:
            ui.ok(f"API reachable (HTTP {code} without auth is expected)")
        elif code and code < 500:
            ui.ok(f"API HTTP {code}")
        else:
            ui.warn(f"API may be unhealthy — {api_url}")

    return ok_all


def check_prerequisites(paths: ProjectPaths) -> bool:
    ui.title("Prerequisites")
    ok_all = True
    for name in ("aws", "terraform", "node", "npm"):
        if which(name):
            ui.ok(name)
        else:
            ui.err(f"Missing: {name}")
            ok_all = False

    if paths.tfvars.is_file():
        ui.ok(f"terraform.tfvars ({paths.env})")
    else:
        ui.err(f"Missing {paths.tfvars}")
        ok_all = False

    if (paths.infra_env / ".terraform").is_dir():
        ui.ok("terraform initialized")
    else:
        ui.warn("terraform not initialized — run `nk init`")

    return ok_all
