"""Subprocess helpers."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from collections.abc import Mapping, Sequence


class CommandError(RuntimeError):
    def __init__(self, message: str, returncode: int, cmd: Sequence[str]) -> None:
        super().__init__(message)
        self.returncode = returncode
        self.cmd = list(cmd)


def which(name: str) -> str | None:
    return shutil.which(name)


def require_binaries(*names: str) -> None:
    missing = [n for n in names if which(n) is None]
    if missing:
        raise CommandError(
            f"Missing required binaries: {', '.join(missing)}",
            returncode=127,
            cmd=missing,
        )


def run(
    cmd: Sequence[str],
    *,
    cwd: str | None = None,
    env: Mapping[str, str] | None = None,
    check: bool = True,
    capture: bool = False,
    input_text: str | None = None,
) -> subprocess.CompletedProcess[str]:
    merged = {**os.environ, **(dict(env) if env else {})}
    if capture:
        proc = subprocess.run(
            list(cmd),
            cwd=cwd,
            env=merged,
            text=True,
            capture_output=True,
            input=input_text,
        )
    else:
        proc = subprocess.run(
            list(cmd),
            cwd=cwd,
            env=merged,
            text=True,
            input=input_text,
        )
    if check and proc.returncode != 0:
        stderr = proc.stderr.strip() if capture and proc.stderr else ""
        hint = f"\n{stderr}" if stderr else ""
        raise CommandError(
            f"Command failed ({proc.returncode}): {' '.join(cmd)}{hint}",
            returncode=proc.returncode,
            cmd=cmd,
        )
    return proc


def run_stream(cmd: Sequence[str], *, cwd: str | None = None, env: Mapping[str, str] | None = None) -> int:
    merged = {**os.environ, **(dict(env) if env else {})}
    return subprocess.call(list(cmd), cwd=cwd, env=merged)


def die(msg: str, code: int = 1) -> None:
    print(msg, file=sys.stderr)
    raise SystemExit(code)
