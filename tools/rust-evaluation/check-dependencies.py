#!/usr/bin/env python3
"""Fail if production server pulls in SQLx, Postrust, or a GraphQL server."""
import argparse
import re
import subprocess

p = argparse.ArgumentParser()
p.add_argument('--cargo', default='cargo')
a = p.parse_args()
tree = subprocess.check_output([a.cargo, 'tree', '--locked', '-p', 'zc-server', '--edges', 'normal', '--prefix', 'none'], text=True)
for line in tree.splitlines():
    name = line.split()[0]
    if name.startswith(('postrust', 'async-graphql', 'sqlx')):
        raise SystemExit(f'Unexpected server dependency: {name}')
print('Diesel only; no SQLx, Postrust, or GraphQL server dependencies')
