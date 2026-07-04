"""Frontend build, env, and S3 deploy."""

from __future__ import annotations

from pathlib import Path

from .paths import ProjectPaths
from .run import CommandError, run, run_stream, which
from . import terraform_ops as tf
from . import ui


def _npm() -> str:
    npm = which("npm")
    if not npm:
        raise CommandError("npm not found on PATH", 127, ["npm"])
    return npm


def ensure_node_modules(paths: ProjectPaths) -> None:
    if (paths.frontend / "node_modules").is_dir():
        return
    ui.info("Installing frontend dependencies…")
    npm_install(paths)


def npm_install(paths: ProjectPaths) -> None:
    code = run_stream([_npm(), "ci"], cwd=str(paths.frontend))
    if code != 0:
        code = run_stream([_npm(), "install"], cwd=str(paths.frontend))
    if code != 0:
        raise CommandError("npm install failed", code, ["npm", "install"])


def _env_content(
    *,
    api_url: str,
    cognito_domain: str,
    client_id: str,
    issuer: str,
    redirect_uri: str,
    logout_uri: str,
    region: str,
    social_idps: str = "",
    dev_bypass: bool = False,
) -> str:
    bypass = "true" if dev_bypass else "false"
    social_line = f"VITE_SOCIAL_IDPS={social_idps}\n" if social_idps else "VITE_SOCIAL_IDPS=\n"
    return f"""VITE_API_URL={api_url}
VITE_COGNITO_DOMAIN={cognito_domain}
VITE_COGNITO_CLIENT_ID={client_id}
VITE_COGNITO_ISSUER={issuer}
VITE_OIDC_REDIRECT_URI={redirect_uri}
VITE_OIDC_POST_LOGOUT_REDIRECT_URI={logout_uri}
VITE_REGION={region}
{social_line}VITE_DEV_BYPASS_AUTH={bypass}
"""


def _social_idps_from_tf(paths: ProjectPaths) -> str:
    try:
        import json
        proc = run(
            [tf._terraform_bin(), "output", "-json", "enabled_social_providers"],
            cwd=str(paths.infra_env),
            capture=True,
            check=False,
        )
        if proc.returncode != 0:
            return ""
        providers = json.loads(proc.stdout or "[]")
        if isinstance(providers, list) and providers:
            return ",".join(str(p) for p in providers)
    except Exception:
        pass
    return ""


def update_env(paths: ProjectPaths) -> None:
    """Write frontend/.env.production from terraform outputs."""
    api_url = tf.output_raw(paths, "api_url")
    cognito_domain = tf.output_raw(paths, "cognito_domain_url")
    client_id = tf.output_raw(paths, "client_id")
    issuer = tf.output_raw(paths, "cognito_issuer")
    site_url = tf.output_raw(paths, "site_url")
    region = paths.aws_region

    content = _env_content(
        api_url=api_url,
        cognito_domain=cognito_domain,
        client_id=client_id,
        issuer=issuer,
        redirect_uri=f"{site_url}/callback",
        logout_uri=f"{site_url}/login",
        region=region,
        social_idps=_social_idps_from_tf(paths),
    )
    paths.env_production.write_text(content, encoding="utf-8")
    ui.ok(f"Wrote {paths.env_production}")
    ui.kv("API URL", api_url)
    ui.kv("Site URL", site_url)
    ui.kv("Cognito", cognito_domain)


def update_dev_env(paths: ProjectPaths, *, port: int = 3000) -> None:
    """Write frontend/.env.development.local for Vite dev server."""
    try:
        api_url = tf.output_raw(paths, "api_url")
        cognito_domain = tf.output_raw(paths, "cognito_domain_url")
        client_id = tf.output_raw(paths, "client_id")
        issuer = tf.output_raw(paths, "cognito_issuer")
        region = paths.aws_region
    except CommandError:
        if not paths.env_production.is_file():
            raise
        ui.warn("Terraform outputs unavailable — copying from .env.production")
        prod = paths.env_production.read_text(encoding="utf-8")
        paths.env_development_local.write_text(
            prod.replace(
                "VITE_OIDC_REDIRECT_URI=https://netknife.alexflux.com/callback",
                f"VITE_OIDC_REDIRECT_URI=http://127.0.0.1:{port}/callback",
            ).replace(
                "VITE_OIDC_POST_LOGOUT_REDIRECT_URI=https://netknife.alexflux.com/login",
                f"VITE_OIDC_POST_LOGOUT_REDIRECT_URI=http://127.0.0.1:{port}/login",
            ),
            encoding="utf-8",
        )
        ui.ok(f"Wrote {paths.env_development_local} (from production env)")
        return

    local_url = f"http://127.0.0.1:{port}"
    content = _env_content(
        api_url=api_url,
        cognito_domain=cognito_domain,
        client_id=client_id,
        issuer=issuer,
        redirect_uri=f"{local_url}/callback",
        logout_uri=f"{local_url}/login",
        region=region,
        social_idps=_social_idps_from_tf(paths),
    )
    paths.env_development_local.write_text(content, encoding="utf-8")
    ui.ok(f"Wrote {paths.env_development_local}")
    ui.kv("Local URL", local_url)
    ui.kv("API URL", api_url)


def build(paths: ProjectPaths, *, skip_install: bool = False) -> None:
    if not skip_install:
        ensure_node_modules(paths)
    code = run_stream([_npm(), "run", "build"], cwd=str(paths.frontend))
    if code != 0:
        raise CommandError("npm run build failed", code, ["npm", "run", "build"])
    if not (paths.frontend / "dist").is_dir():
        raise CommandError("Build succeeded but dist/ is missing", 1, [])


def dev_server(paths: ProjectPaths) -> None:
    """Start Vite dev server (local UI; remote tools need deployed API)."""
    ensure_node_modules(paths)
    try:
        update_dev_env(paths)
    except CommandError as e:
        ui.warn(f"Could not write dev env: {e}. Run `nk env` after terraform apply.")
    ui.info("Starting Vite at http://127.0.0.1:3000 (Ctrl+C to stop)")
    code = run_stream([_npm(), "run", "dev"], cwd=str(paths.frontend))
    raise SystemExit(code)


def deploy_s3(paths: ProjectPaths, *, bucket: str | None = None, cloudfront_id: str | None = None) -> None:
    dist = paths.frontend / "dist"
    if not dist.is_dir():
        raise CommandError("dist/ not found — run `nk build` first", 1, [])

    bucket = bucket or tf.output_raw(paths, "bucket_name")
    cloudfront_id = cloudfront_id or tf.output_raw(paths, "cloudfront_id")

    ui.kv("S3 bucket", bucket)
    ui.kv("CloudFront", cloudfront_id)

    code = run_stream(
        ["aws", "s3", "sync", str(dist) + "/", f"s3://{bucket}/", "--delete"],
        cwd=str(paths.frontend),
        env={"AWS_DEFAULT_REGION": paths.aws_region},
    )
    if code != 0:
        raise CommandError("aws s3 sync failed", code, ["aws", "s3", "sync"])

    ui.ok("Uploaded to S3")

    inv = run(
        [
            "aws", "cloudfront", "create-invalidation",
            "--distribution-id", cloudfront_id,
            "--paths", "/*",
        ],
        capture=True,
        env={"AWS_DEFAULT_REGION": paths.aws_region},
    )
    inv_id = ""
    if inv.stdout:
        import json
        try:
            inv_id = json.loads(inv.stdout).get("Invalidation", {}).get("Id", "")
        except json.JSONDecodeError:
            pass
    ui.ok(f"CloudFront invalidation started{f' ({inv_id})' if inv_id else ''}")


def invalidate_cloudfront(paths: ProjectPaths, *, cloudfront_id: str | None = None) -> None:
    cloudfront_id = cloudfront_id or tf.output_raw(paths, "cloudfront_id")
    run(
        [
            "aws", "cloudfront", "create-invalidation",
            "--distribution-id", cloudfront_id,
            "--paths", "/*",
        ],
        env={"AWS_DEFAULT_REGION": paths.aws_region},
    )
    ui.ok(f"Invalidation submitted for {cloudfront_id}")


def lint(paths: ProjectPaths) -> None:
    ensure_node_modules(paths)
    run_stream([_npm(), "run", "lint"], cwd=str(paths.frontend))


def typecheck(paths: ProjectPaths) -> None:
    ensure_node_modules(paths)
    run_stream(["npx", "tsc", "--noEmit"], cwd=str(paths.frontend))


def test(paths: ProjectPaths) -> None:
    ensure_node_modules(paths)
    code = run_stream([_npm(), "test"], cwd=str(paths.frontend))
    if code != 0:
        raise CommandError("frontend tests failed", code, ["npm", "test"])
