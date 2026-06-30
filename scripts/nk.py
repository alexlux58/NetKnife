#!/usr/bin/env python3
"""NetKnife CLI entry point. Run from anywhere in the repo."""

import sys
from pathlib import Path

# Allow running without pip install: scripts/nk.py
sys.path.insert(0, str(Path(__file__).resolve().parent))

from netknife.cli import main

if __name__ == "__main__":
    raise SystemExit(main())
