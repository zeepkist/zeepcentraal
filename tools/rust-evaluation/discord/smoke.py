#!/usr/bin/env python3
"""Exercise local rate-limit, transient and permanent delivery failures."""
import argparse
from pathlib import Path
import run as d

p = argparse.ArgumentParser()
p.add_argument('--output', type=Path, required=True)
a = p.parse_args()
for variant in ('discord-js','serenity'):
    output = a.output / variant
    output.mkdir(parents=True, exist_ok=False)
    try:
        d.start(variant, output)
        result = d.b.docker('exec', d.FIXTURE, '/bench/probe', 'smoke')
        (output/'result.json').write_text(result+'\n')
        print(variant, result, flush=True)
    finally:
        (output/'app.log').write_text(d.b.docker('logs', d.APP, check=False))
        for name in ('zc-discord-app-sampler','zc-discord-fixture-sampler',d.APP,d.FIXTURE): d.b.remove(name)
