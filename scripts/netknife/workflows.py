"""High-level deploy / test workflows."""

from __future__ import annotations

from .paths import ProjectPaths
from . import aws_ops
from . import frontend_ops as fe
from . import terraform_ops as tf
from . import ui
from .run import CommandError


# CLI name → Terraform aws_lambda_function resource suffix
LAMBDA_ALIASES: dict[str, str] = {
    "dns": "dns",
    "rdap": "rdap",
    "tls": "tls",
    "headers": "headers",
    "peeringdb": "peeringdb",
    "reverse-dns": "reverse_dns",
    "reverse_dns": "reverse_dns",
    "email-auth": "email_auth",
    "email_auth": "email_auth",
    "hibp": "hibp",
    "abuseipdb": "abuseipdb",
    "dns-propagation": "dns_propagation",
    "asn-details": "asn_details",
    "bgp-looking-glass": "bgp_looking_glass",
    "ssl-labs": "ssl_labs",
    "traceroute": "traceroute",
    "shodan": "shodan",
    "virustotal": "virustotal",
    "security-trails": "securitytrails",
    "securitytrails": "securitytrails",
    "censys": "censys",
    "greynoise": "greynoise",
    "emailrep": "emailrep",
    "ip-api": "ip_api",
    "breachdirectory": "breachdirectory",
    "phone-validator": "phone_validator",
    "ipqualityscore": "ipqualityscore",
    "ipqs-email": "ipqs_email",
    "ipqs-phone": "ipqs_phone",
    "ipqs-url": "ipqs_url",
    "hunter": "hunter",
    "security-advisor": "security_advisor",
    "reports": "reports",
    "guides": "guides",
    "scanners": "scanners",
    "cve-lookup": "cve_lookup",
    "cve_lookup": "cve_lookup",
    "profile": "profile",
    "board": "board",
    "alarms": "alarms",
    "billing": "billing",
}


def lambda_terraform_target(short_name: str) -> str:
    key = short_name.strip().lower()
    resource = LAMBDA_ALIASES.get(key, key.replace("-", "_"))
    return f"module.api.aws_lambda_function.{resource}"


def deploy_infra(paths: ProjectPaths, *, yes: bool = False, target: str | None = None) -> None:
    tf.ensure_tfvars(paths)
    tf.sync_cloudflare_token(paths)
    tf.install_lambda_deps(paths)
    tf.ensure_init(paths)
    tf.apply(paths, auto_approve=yes, target=target)


def deploy_lambda(paths: ProjectPaths, name: str) -> None:
    tf.ensure_tfvars(paths)
    target = lambda_terraform_target(name)
    ui.info(f"Target: {target}")
    tf.install_lambda_deps(paths)
    tf.ensure_init(paths)
    tf.apply(paths, auto_approve=True, target=target)


def deploy_frontend(paths: ProjectPaths, *, build_first: bool = True) -> None:
    tf.ensure_tfvars(paths)
    fe.update_env(paths)
    if build_first:
        fe.build(paths)
    fe.deploy_s3(paths)


def quick_frontend(paths: ProjectPaths) -> None:
    """Fast loop: env + build + S3 (no terraform)."""
    fe.update_env(paths)
    fe.build(paths)
    fe.deploy_s3(paths)


def full_deploy(paths: ProjectPaths, *, yes: bool = False, skip_infra: bool = False) -> None:
    total = 4 if skip_infra else 5
    n = 1
    tf.ensure_tfvars(paths)

    if not skip_infra:
        ui.step(n, total, "Infrastructure (Terraform + Lambda deps)")
        deploy_infra(paths, yes=yes)
        n += 1

    ui.step(n, total, "Frontend environment (.env.production)")
    fe.update_env(paths)
    n += 1

    ui.step(n, total, "Frontend build")
    fe.build(paths)
    n += 1

    ui.step(n, total, "Upload to S3 + CloudFront invalidation")
    fe.deploy_s3(paths)

    ui.title("Deploy complete")
    try:
        site = tf.output_raw(paths, "site_url")
        ui.kv("Site", site)
    except CommandError:
        pass
    ui.info("Allow 2–5 minutes for CloudFront; DNS may take longer.")


def run_tests(paths: ProjectPaths, *, frontend: bool = True, backend: bool = True, terraform_validate: bool = False) -> None:
    failed = False
    if frontend:
        ui.title("Frontend tests")
        try:
            fe.lint(paths)
            fe.typecheck(paths)
            fe.test(paths)
            ui.ok("Frontend checks passed")
        except CommandError as e:
            ui.err(str(e))
            failed = True

    if backend:
        ui.title("Backend tests")
        from .run import run_stream
        if not (paths.backend / "node_modules").is_dir():
            ui.info("Installing backend dev dependencies…")
            code = run_stream(["npm", "ci"], cwd=str(paths.backend))
            if code != 0:
                run_stream(["npm", "install"], cwd=str(paths.backend))
        code = run_stream(["npm", "test"], cwd=str(paths.backend))
        if code != 0:
            ui.err("Backend tests failed")
            failed = True
        else:
            ui.ok("Backend tests passed")

    if terraform_validate:
        ui.title("Terraform validate")
        try:
            tf.validate(paths)
            ui.ok("Terraform validate passed")
        except CommandError as e:
            ui.err(str(e))
            failed = True

    if failed:
        raise CommandError("One or more test suites failed", 1, [])


def status(paths: ProjectPaths) -> None:
    ui.title(f"NetKnife status ({paths.env})")
    ui.kv("Root", str(paths.root))
    aws_ops.check_prerequisites(paths)
    try:
        outs = tf.output_all(paths)
        for key in ("site_url", "api_url", "bucket_name", "cloudfront_id", "user_pool_id"):
            if key in outs:
                ui.kv(key, str(outs[key]))
    except CommandError:
        ui.warn("Terraform outputs unavailable")
