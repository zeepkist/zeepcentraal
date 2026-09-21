#!/usr/bin/env python3
"""Offline Discord application replay. No real Gateway or Discord HTTP traffic."""
import argparse
import importlib.util
import json
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('rest_bench', HERE.parent / 'benchmark/run.py')
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
BIN = b.ROOT / 'artifacts/rust-evaluation/discord'
IMAGE = 'zc-discord-benchmark:local'
FIXTURE = 'zc-discord-fixture'
APP = 'zc-discord-app'


def start(variant, output):
    for name in (APP, FIXTURE, 'zc-discord-app-sampler', 'zc-discord-fixture-sampler'):
        b.remove(name)
    b.docker('run', '-d', '--name', FIXTURE, '--label', 'zc.benchmark=true', '--cpuset-cpus', '2', '--memory', '256m',
             '--mount', b.mount(BIN, '/bench', True), '--entrypoint', '/bench/fixture', IMAGE)
    command = '/bench/bun' if variant == 'discord-js' else '/app/discord'
    b.docker('run', '-d', '--name', APP, '--label', 'zc.benchmark=true', '--network', f'container:{FIXTURE}',
             '--cpuset-cpus', '0,1', '--memory', '512m', '--memory-swap', '512m', '-e', 'TOKIO_WORKER_THREADS=2',
             '-e', 'ZC_DISCORD_EVAL_TTL_MS=15000', '--mount', b.mount(BIN, '/bench', True), '--entrypoint', command, IMAGE)
    for _ in range(30):
        if b.docker('inspect', '-f', '{{.State.Running}}', APP) != 'true':
            raise RuntimeError(f'App exited: {b.docker("logs", APP, check=False)}')
        status = b.docker('exec', FIXTURE, '/bench/probe', 'health', check=False)
        if '"ok":true' in status:
            break
        time.sleep(1)
    else:
        raise RuntimeError(f'Not ready: {b.docker("logs", APP, check=False)}')
    b.sampler(APP, 'zc-discord-app-sampler', output, 'app-memory.jsonl')
    b.sampler(FIXTURE, 'zc-discord-fixture-sampler', output, 'fixture-memory.jsonl')


def snapshot():
    return json.loads(b.docker('exec', FIXTURE, '/bench/probe', 'stats'))


def idle(name, duration):
    begin = time.time()
    time.sleep(duration)
    return {'name': name, 'begin': begin, 'end': time.time(), 'state': snapshot()}


def load(output, name, scenario, duration, mode, amount):
    b.docker('run', '--rm', '--label', 'zc.benchmark=true', '--network', f'container:{FIXTURE}',
             '--cpuset-cpus', '3', '--memory', '256m', '--memory-swap', '256m',
             '--mount', b.mount(BIN, '/bench', True), '--mount', b.mount(output, '/results'), '--entrypoint', '/bench/load',
             IMAGE, duration, mode, amount, f'/results/{name}.json', scenario)
    data = json.loads((output / f'{name}.json').read_text())
    if data['errors'] or data['dropped']:
        raise RuntimeError(f'Invalid replay {name}: {data}')
    print(f'{output.name} {name}: {data["rps"]:.1f} events/s', flush=True)
    return {'name': name, 'begin': data['startedUnixSeconds'], 'end': data['endedUnixSeconds'], 'load': data, 'state': snapshot()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--rounds', type=int, default=3)
    parser.add_argument('--quick', action='store_true')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=False)
    metadata = {'scope': 'offline application replay; no Gateway connection/cache', 'quick': args.quick,
                'sessionTtlMs': 15000, 'serenityRevision': '86866e9a20dc441faac7b38c68a3cf78721ded1c',
                'image': b.docker('image', 'inspect', '-f', '{{.Id}}', IMAGE),
                'binaries': {p.name: b.hashlib.sha256(p.read_bytes()).hexdigest() for p in BIN.iterdir() if p.is_file()}}
    (args.output / 'metadata.json').write_text(json.dumps(metadata, indent=2)+'\n')
    for r in range(1, args.rounds+1):
        for variant in (['discord-js', 'serenity'] if r % 2 else ['serenity', 'discord-js']):
            output = args.output / f'{r}-{variant}'
            output.mkdir()
            try:
                start(variant, output)
                phases = [idle('cold-idle', 3 if args.quick else 15)]
                phases.append(load(output, 'warmup', 'mixed', 3 if args.quick else 10, 'closed', 8))
                phases.append(idle('warm-idle', 3 if args.quick else 20))
                for scenario in ('profile', 'autocomplete', 'page', 'feed'):
                    phases.append(load(output, scenario, scenario, 3 if args.quick else 10, 'rate', 15))
                phases.append(load(output, 'burst', 'mixed', 3 if args.quick else 20, 'rate', 150))
                phases.append(load(output, 'capacity', 'mixed', 3 if args.quick else 20, 'closed', 32))
                phases.append(idle('recovery', 3 if args.quick else 75))
                state = snapshot()
                expected = sum(sum(p.get('load',{}).get(key,{}).values()) for p in phases for key in ('counts','primerCounts'))
                feeds = sum(p.get('load',{}).get(key,{}).get('feed',0) for p in phases for key in ('counts','primerCounts'))
                if state['fixture']['deliveries'] != expected or state['fixture']['cursors'] != feeds or state['fixture']['duplicates']:
                    raise RuntimeError(f'Delivery/cursor audit mismatch: {state}, {expected}, {feeds}')
                if not args.quick and state['app']['sessions'] != 0:
                    raise RuntimeError('Expired sessions retained')
                (output / 'trial.json').write_text(json.dumps({'variant':variant,'round':r,'phases':phases,'final':state},indent=2)+'\n')
            finally:
                (output/'app.log').write_text(b.docker('logs',APP,check=False))
                for name in ('zc-discord-app-sampler','zc-discord-fixture-sampler',APP,FIXTURE): b.remove(name)

if __name__ == '__main__': main()
