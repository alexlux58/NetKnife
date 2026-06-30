"""Terminal output helpers."""

from __future__ import annotations

import os
import sys


def _color_enabled() -> bool:
    if os.environ.get("NO_COLOR"):
        return False
    return hasattr(sys.stdout, "isatty") and sys.stdout.isatty()


class C:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    CYAN = "\033[36m"


def _c(text: str, code: str) -> str:
    if not _color_enabled():
        return text
    return f"{code}{text}{C.RESET}"


def title(msg: str) -> None:
    line = "=" * min(60, max(len(msg) + 4, 40))
    print(_c(line, C.DIM))
    print(_c(msg, C.BOLD + C.CYAN))
    print(_c(line, C.DIM))


def step(n: int, total: int, msg: str) -> None:
    print(_c(f"\n[{n}/{total}] {msg}", C.BLUE))


def ok(msg: str) -> None:
    print(_c(f"✓ {msg}", C.GREEN))


def warn(msg: str) -> None:
    print(_c(f"⚠ {msg}", C.YELLOW))


def err(msg: str) -> None:
    print(_c(f"✗ {msg}", C.RED), file=sys.stderr)


def info(msg: str) -> None:
    print(f"  {msg}")


def kv(key: str, value: str) -> None:
    print(f"  {_c(key + ':', C.DIM)} {value}")
