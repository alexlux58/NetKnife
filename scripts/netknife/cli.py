"""Argument parser and command dispatch."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import __version__
from .paths import ProjectPaths, find_project_root
from .run import CommandError, die
from . import aws_ops
from . import frontend_ops as fe
from . import terraform_ops as tf
from . import workflows as wf
from . import ui


def _paths(args: argparse.Namespace) -> ProjectPaths:
    root = Path(args.root).resolve() if args.root else find_project_root()
    return ProjectPaths(root, env=args.env)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="nk",
        description="NetKnife developer CLI — deploy, test, and ops",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  nk check                    Verify tools and tfvars
  nk init && nk plan          First-time infra setup
  nk deploy -y                Full deploy (infra + frontend)
  nk quick                    Fast frontend-only deploy
  nk deploy-lambda billing    Redeploy one Lambda
  nk dev                      Local Vite dev server
  nk test                     Run frontend + backend tests
  nk verify                   Health-check live deployment
  nk logs billing --minutes 60
  nk signups status
        """,
    )
    p.add_argument("--root", help="Project root (auto-detected if omitted)")
    p.add_argument("--env", default="dev", help="Terraform env name (default: dev)")
    sub = p.add_subparsers(dest="command", required=True)

    sub.add_parser("check", help="Verify prerequisites (aws, terraform, node, tfvars)")

    sub.add_parser("init", help="terraform init -upgrade -reconfigure")
    plan_p = sub.add_parser("plan", help="terraform plan")
    plan_p.add_argument("--target", help="Terraform -target resource")

    apply_p = sub.add_parser("apply", help="terraform apply")
    apply_p.add_argument("-y", "--yes", action="store_true", help="Auto-approve")
    apply_p.add_argument("--target", help="Terraform -target resource")

    sub.add_parser("outputs", help="Print terraform outputs")
    sub.add_parser("lambda-deps", help="npm install for Lambda functions")
    sub.add_parser("env", help="Update frontend/.env.production from terraform")

    build_p = sub.add_parser("build", help="npm run build (frontend)")
    build_p.add_argument("--no-install", action="store_true", help="Skip npm ci if node_modules exists")

    fe_p = sub.add_parser("deploy-fe", help="S3 sync + CloudFront invalidation")
    fe_p.add_argument("--no-build", action="store_true", help="Skip build (use existing dist/)")

    dep_p = sub.add_parser("deploy-infra", help="Lambda deps + terraform apply")
    dep_p.add_argument("-y", "--yes", action="store_true", help="Auto-approve")

    lam_p = sub.add_parser("deploy-lambda", help="Redeploy a single Lambda")
    lam_p.add_argument("name", help="Lambda short name (e.g. billing, dns, profile)")

    full_p = sub.add_parser("deploy", help="Full deploy: infra + env + build + S3")
    full_p.add_argument("-y", "--yes", action="store_true", help="Auto-approve terraform")
    full_p.add_argument("--frontend-only", action="store_true", help="Skip terraform (same as quick)")

    sub.add_parser("quick", help="Fast loop: env + build + deploy-fe (no terraform)")
    sub.add_parser("dev", help="Start Vite dev server (localhost:5173)")
    sub.add_parser("invalidate", help="CloudFront cache invalidation only")

    test_p = sub.add_parser("test", help="Run test suites")
    test_p.add_argument("--frontend-only", action="store_true")
    test_p.add_argument("--backend-only", action="store_true")
    test_p.add_argument("--terraform", action="store_true", help="Also run terraform validate")

    sub.add_parser("verify", help="Health-check deployment (DNS, S3, HTTP)")
    sub.add_parser("status", help="Show project + AWS + terraform summary")

    dns_p = sub.add_parser("dns", help="Show custom domain DNS from tfvars + dig")
    dns_p.add_argument("host", nargs="?", help="Override hostname to check")

    logs_p = sub.add_parser("logs", help="Tail recent CloudWatch logs for a Lambda")
    logs_p.add_argument("name", help="Lambda short name (e.g. billing)")
    logs_p.add_argument("--minutes", type=int, default=30)
    logs_p.add_argument("--filter", dest="filter_text", help="CloudWatch filter pattern")

    sig_p = sub.add_parser("signups", help="Toggle Cognito signup failsafe")
    sig_p.add_argument("action", choices=["enable", "disable", "status"])

    pwd_p = sub.add_parser("password", help="Set Cognito user password")
    pwd_p.add_argument("username")
    pwd_p.add_argument("password")
    pwd_p.add_argument("--email", help="Required when creating a new user")

    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    paths = _paths(args)

    try:
        return _dispatch(args, paths)
    except CommandError as e:
        ui.err(str(e))
        return e.returncode if e.returncode else 1
    except KeyboardInterrupt:
        ui.warn("Interrupted")
        return 130


def _dispatch(args: argparse.Namespace, paths: ProjectPaths) -> int:
    cmd = args.command

    if cmd == "check":
        return 0 if aws_ops.check_prerequisites(paths) else 1

    if cmd == "init":
        tf.init(paths)
        ui.ok("Terraform initialized")
        return 0

    if cmd == "plan":
        tf.ensure_tfvars(paths)
        tf.plan(paths, target=getattr(args, "target", None))
        return 0

    if cmd == "apply":
        tf.ensure_tfvars(paths)
        tf.apply(paths, auto_approve=args.yes, target=getattr(args, "target", None))
        ui.ok("Terraform apply complete")
        return 0

    if cmd == "outputs":
        tf.print_outputs(paths)
        return 0

    if cmd == "lambda-deps":
        tf.install_lambda_deps(paths)
        ui.ok("Lambda dependencies installed")
        return 0

    if cmd == "env":
        tf.ensure_tfvars(paths)
        fe.update_env(paths)
        return 0

    if cmd == "build":
        fe.build(paths, skip_install=args.no_install)
        ui.ok("Frontend built")
        return 0

    if cmd == "deploy-fe":
        tf.ensure_tfvars(paths)
        if not args.no_build:
            fe.update_env(paths)
            fe.build(paths)
        fe.deploy_s3(paths)
        return 0

    if cmd == "deploy-infra":
        wf.deploy_infra(paths, yes=args.yes)
        ui.ok("Infrastructure deployed")
        return 0

    if cmd == "deploy-lambda":
        wf.deploy_lambda(paths, args.name)
        ui.ok(f"Lambda {args.name} deployed")
        return 0

    if cmd == "deploy":
        if args.frontend_only:
            wf.quick_frontend(paths)
        else:
            wf.full_deploy(paths, yes=args.yes)
        return 0

    if cmd == "quick":
        wf.quick_frontend(paths)
        return 0

    if cmd == "dev":
        fe.dev_server(paths)
        return 0

    if cmd == "invalidate":
        tf.ensure_tfvars(paths)
        fe.invalidate_cloudfront(paths)
        return 0

    if cmd == "test":
        fe_only = args.frontend_only
        be_only = args.backend_only
        wf.run_tests(
            paths,
            frontend=not be_only,
            backend=not fe_only,
            terraform_validate=args.terraform,
        )
        ui.ok("All requested tests passed")
        return 0

    if cmd == "verify":
        ok = aws_ops.verify(paths)
        return 0 if ok else 1

    if cmd == "status":
        wf.status(paths)
        return 0

    if cmd == "dns":
        host = args.host or tf.read_tfvar(paths, "custom_domain")
        if not host:
            die("No custom_domain in terraform.tfvars and no host argument")
        ui.title(f"DNS: {host}")
        from .aws_ops import _dig_cname
        cnames = _dig_cname(host)
        if cnames:
            for c in cnames:
                ui.kv("CNAME", c)
        else:
            ui.warn("No CNAME found (try 1.1.1.1 / 8.8.8.8 if your router DNS fails)")
        try:
            cf = tf.output_raw(paths, "cloudfront_domain")
            ui.kv("Expected target", cf)
        except CommandError:
            pass
        return 0

    if cmd == "logs":
        aws_ops.tail_lambda_logs(paths, args.name, minutes=args.minutes, filter_text=args.filter_text)
        return 0

    if cmd == "signups":
        aws_ops.signups(paths, args.action)
        return 0

    if cmd == "password":
        aws_ops.set_password(paths, args.username, args.password, email=args.email)
        return 0

    die(f"Unknown command: {cmd}")


if __name__ == "__main__":
    sys.exit(main())
