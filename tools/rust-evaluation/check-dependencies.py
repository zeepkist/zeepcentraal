#!/usr/bin/env python3
"""Fail if the standalone server pulls in the other DB driver or a GraphQL server."""
import argparse
import re
import subprocess

p = argparse.ArgumentParser()
p.add_argument('adapter', choices=['sqlx', 'diesel'])
p.add_argument('--cargo', default='cargo')
a = p.parse_args()
tree = subprocess.check_output([a.cargo, 'tree', '--locked', '-p', 'zc-server', '--no-default-features', '--features', f'db-{a.adapter}', '--edges', 'normal', '--prefix', 'none'], text=True)
for line in tree.splitlines():
    name = line.split()[0]
    if name.startswith(('postrust', 'async-graphql')) or (a.adapter == 'diesel' and name.startswith('sqlx')) or (a.adapter == 'sqlx' and name.startswith('diesel')):
        raise SystemExit(f'Unexpected server dependency: {name}')
print(f'{a.adapter}: exclusive adapter; no Postrust/GraphQL server dependencies')
