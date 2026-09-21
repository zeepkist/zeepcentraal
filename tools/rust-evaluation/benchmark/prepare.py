#!/usr/bin/env python3
"""Create the minimal Docker context and compile existing Bun dependencies on Windows."""
import shutil
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[3]
out = root / 'artifacts/rust-evaluation/benchmark/build-context'
out.mkdir(parents=True, exist_ok=True)
for name in ('Cargo.toml', 'Cargo.lock'):
    shutil.copy2(root / name, out / name)
shutil.copytree(root / 'crates', out / 'crates', dirs_exist_ok=True)
shutil.copy2(Path(__file__).with_name('Dockerfile'), out / 'Dockerfile')
print(out)
