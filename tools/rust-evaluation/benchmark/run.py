#!/usr/bin/env python3
"""Repeat isolated Linux benchmarks. Never connects to the interactive or production DB."""
import argparse
import hashlib
import json
import os
import shutil
import statistics
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
ARTIFACTS = ROOT / 'artifacts/rust-evaluation/benchmark'
DOCKER = shutil.which('docker.exe') or shutil.which('docker')
DB = 'zc-benchmark-db'
APP = 'zc-benchmark-app'
URL = 'postgres://zc_preview:local-preview-only@127.0.0.1:5432/zc_rust_sqlx'


def docker(*args, input=None, check=True):
    result = subprocess.run([DOCKER, *map(str, args)], input=input, text=True,
                            capture_output=True, cwd=ROOT)
    if check and result.returncode:
        raise RuntimeError(f'Docker {args[:3]} failed: {result.stderr[-3000:]} {result.stdout[-1000:]}')
    return (result.stdout + result.stderr if args and args[0] == "logs" else result.stdout).strip()


def host_path(path):
    if DOCKER.endswith('.exe') and os.name != 'nt':
        return subprocess.check_output(['wslpath', '-w', str(path)], text=True).strip().replace('\\', '/')
    return str(path)


def mount(path, destination, readonly=False):
    return f'type=bind,source={host_path(path)},target={destination}' + (',readonly' if readonly else '')


def sql(query, database='postgres'):
    return docker('exec', '-i', DB, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'zc_preview', '-d', database, input=query)


def owned(name):
    label = docker('inspect', '-f', '{{index .Config.Labels "zc.benchmark"}}', name, check=False)
    if label and label != 'true':
        raise RuntimeError(f'Refusing to touch container without benchmark label: {name}')
    return label == 'true'


def remove(name):
    if owned(name):
        docker('rm', '-f', name)


def initialize():
    if not owned(DB):
        docker('run', '-d', '--name', DB, '--label', 'zc.benchmark=true', '--cpuset-cpus', '2', '--memory', '1g',
               '-e', 'POSTGRES_USER=zc_preview', '-e', 'POSTGRES_PASSWORD=local-preview-only',
               '-e', 'POSTGRES_DB=zc_rust_sqlx', 'postgres:18.6',
               '-c', 'shared_buffers=128MB', '-c', 'max_connections=30', '-c', 'work_mem=4MB', '-c', 'jit=off')
    for _ in range(60):
        if 'accepting connections' in docker('exec', DB, 'pg_isready', '-U', 'zc_preview', check=False):
            break
        time.sleep(1)
    exists = sql("SELECT datname FROM pg_database WHERE datname='zc_benchmark_template';")
    if 'zc_benchmark_template' not in exists:
        sql((ROOT / 'crates/database/migrations/00000000000001_preview/up.sql').read_text(), 'zc_rust_sqlx')
        sql((HERE / 'seed.sql').read_text(), 'zc_rust_sqlx')
        sql('CREATE EXTENSION pg_prewarm;', 'zc_rust_sqlx')
        sql('CREATE DATABASE zc_benchmark_template TEMPLATE zc_rust_sqlx;')
    print('Benchmark template ready: 20,000 users / 2,000 levels / 1,000,000 records', flush=True)


def reset():
    sql('DROP DATABASE zc_rust_sqlx WITH (FORCE);')
    sql('CREATE DATABASE zc_rust_sqlx TEMPLATE zc_benchmark_template;')
    sql("SELECT pg_prewarm(c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','i') ORDER BY c.oid;", 'zc_rust_sqlx')


def sampler(target, name, output, filename):
    docker('run', '-d', '--name', name, '--label', 'zc.benchmark=true', '--pid', f'container:{target}',
           '--cap-add', 'SYS_PTRACE', '--cpuset-cpus', '3', '--memory', '128m',
           '--mount', mount(HERE, '/bench', True), '--mount', mount(output, '/results'),
           'python:3.12-slim', 'python', '/bench/sample.py', f'/results/{filename}')
    for _ in range(20):
        path = output / filename
        if path.exists() and path.stat().st_size:
            return
        if docker('inspect', '-f', '{{.State.Running}}', name) != 'true':
            raise RuntimeError(f'Sampler failed: {docker("logs", name, check=False)}')
        time.sleep(.5)
    raise RuntimeError('Sampler produced no samples')


def start(variant):
    base = ['run', '-d', '--name', APP, '--label', 'zc.benchmark=true', '--network', f'container:{DB}',
            '--cpuset-cpus', '0,1', '--memory', '512m', '--memory-swap', '512m',
            '-e', f'ZC_PREVIEW_DATABASE_URL={URL}', '-e', 'ZC_PREVIEW_PORT=4310',
            '-e', 'TOKIO_WORKER_THREADS=2', '-e', 'NODE_ENV=production', '--mount', mount(ARTIFACTS, '/bench-bin', True)]
    if variant.startswith('bun'):
        docker(*base, '-e', f'BENCH_WORKERS={2 if variant == "bun-2" else 1}',
               '--entrypoint', '/bench-bin/bun-server', 'zc-rust-benchmark:axum')
    else:
        docker(*base, '-e', 'ZC_PREVIEW_POOL_MAX=4',
               '--entrypoint', f'/app/{variant}', 'zc-rust-benchmark:axum')
    for _ in range(60):
        result = docker('exec', DB, 'bash', '-c',
                        "exec 3<>/dev/tcp/127.0.0.1/4310; printf 'GET /healthz HTTP/1.0\r\nHost: 127.0.0.1:4310\r\n\r\n' >&3; cat <&3", check=False)
        if '200 OK' in result:
            return
        if docker('inspect', '-f', '{{.State.Running}}', APP) != 'true':
            raise RuntimeError(docker('logs', APP, check=False))
        time.sleep(1)
    raise RuntimeError('Server not ready')


def load(output, phase, seconds, mode, amount):
    begin = time.time()
    result = docker('run', '--rm', '--label', 'zc.benchmark=true', '--network', f'container:{DB}',
                    '--cpuset-cpus', '3', '--memory', '256m', '--memory-swap', '256m',
                    '--mount', mount(ARTIFACTS, '/bench-bin', True), '--mount', mount(output, '/results'),
                    '--entrypoint', '/bench-bin/load', 'zc-rust-benchmark:axum',
                    seconds, mode, amount, f'/results/{phase}.json', check=False)
    file = output / f'{phase}.json'
    if not file.exists():
        raise RuntimeError(f'Load generator did not produce a result: {result}')
    data = json.loads(file.read_text())
    if data['errors'] or data['dropped']:
        raise RuntimeError(f'Invalid run {phase}: {data}')
    print(f"{output.name} {phase}: {data['rps']:.1f} req/s, p95 {data['latencyMs']['p95']:.1f} ms, generator {data['generatorCpuCores']:.2f} CPU cores", flush=True)
    return {'name': phase, 'begin': data['startedUnixSeconds'], 'end': data['endedUnixSeconds'], 'load': data}


def idle(name, seconds):
    begin = time.time()
    time.sleep(seconds)
    return {'name': name, 'begin': begin, 'end': time.time(), 'connectionsAfter': sql("COPY (SELECT state, count(*) FROM pg_stat_activity WHERE datname='zc_rust_sqlx' AND backend_type='client backend' GROUP BY state) TO STDOUT;")}


def trial(variant, round_number, output, quick=False):
    output.mkdir(parents=True, exist_ok=False)
    for name in (APP, 'zc-benchmark-app-sampler', 'zc-benchmark-db-sampler'):
        remove(name)
    reset()
    phases = []
    start(variant)
    sampler(APP, 'zc-benchmark-app-sampler', output, 'app-memory.jsonl')
    sampler(DB, 'zc-benchmark-db-sampler', output, 'db-memory.jsonl')
    try:
        phases.append(idle('cold-idle', 3 if quick else 15))
        phases.append(load(output, 'warmup', 3 if quick else 10, 'closed', 8))
        phases.append(idle('warm-idle', 3 if quick else 90))
        phases.append(load(output, 'typical', 3 if quick else 20, 'rate', 15))
        phases.append(load(output, 'burst', 3 if quick else 20, 'rate', 150))
        phases.append(load(output, 'capacity', 3 if quick else 20, 'closed', 32))
        phases.append(idle('recovery', 3 if quick else 90))
        for name in ('zc-benchmark-app-sampler', 'zc-benchmark-db-sampler'):
            if docker('inspect', '-f', '{{.State.Running}}', name) != 'true':
                raise RuntimeError(f'Sampler stopped: {docker("logs", name, check=False)}')
        result = {'implementation': 'axum-serde-scalar' if variant in ('sqlx', 'diesel') else 'bun-elysia', 'variant': variant, 'round': round_number, 'phases': phases,
                  'databaseChecks': sql('SELECT count(*) AS records FROM record; SELECT count(*) AS audits FROM record_audit;', 'zc_rust_sqlx'),
                  'appState': json.loads(docker('inspect', '-f', '{{json .State}}', APP))}
        # Every successful application write produces one audit row.
        successful_writes = sum(p.get('load', {}).get('counts', {}).get('write', 0) + p.get('load', {}).get('primerCounts', {}).get('write', 0) for p in phases)
        actual = sql('COPY (SELECT count(*) FROM record_audit) TO STDOUT;', 'zc_rust_sqlx')
        if int(actual) != successful_writes:
            raise RuntimeError(f'Write audit mismatch: {actual} vs {successful_writes}')
        (output / 'trial.json').write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps({'variant': variant, 'round': round_number,
                          'capacityRps': next(p['load']['rps'] for p in phases if p['name']=='capacity'),
                          'output': str(output)}), flush=True)
    finally:
        (output / 'app.log').write_text(docker('logs', APP, check=False))
        for name in ('zc-benchmark-app-sampler', 'zc-benchmark-db-sampler', APP):
            remove(name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--quick', action='store_true')
    parser.add_argument('--resume', action='store_true', help='Skip recorded attempts; verify the same image and load binaries')
    parser.add_argument('--rounds', type=int, default=3)
    parser.add_argument('--variants', nargs='+', choices=['bun-1', 'bun-2', 'sqlx', 'diesel'], default=['bun-2', 'sqlx', 'diesel'])
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--init-only', action='store_true')
    args = parser.parse_args()
    initialize()
    if args.init_only:
        return
    args.output.mkdir(parents=True, exist_ok=args.resume)
    metadata = {'created': time.time(), 'docker': {k: v for k, v in json.loads(docker('info', '--format', '{{json .}}')).items() if k in ('NCPU', 'MemTotal', 'KernelVersion', 'OSType', 'Architecture', 'ServerVersion')},
                'images': {image: json.loads(docker('image', 'inspect', image))[0]['Id']
                           for image in ['zc-rust-benchmark:axum', 'postgres:18.6', 'python:3.12-slim']},
                'binarySha256': {name: hashlib.sha256((ARTIFACTS / name).read_bytes()).hexdigest() for name in ('bun-server', 'load')},
                'sourceSha256': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in HERE.iterdir() if p.is_file()},
                'settings': {'appCpuSet': '0,1', 'dbCpuSet': '2', 'loadCpuSet': '3', 'appMemoryMiB': 512,
                             'databaseMemoryMiB': 1024, 'readUserPercent': 70, 'leaderboardPercent': 20,
                             'transactionPercent': 10, 'hotLevelRequestPercent': 80,
                             'hotLevelRecordsPercent': 40, 'rustPostrustEnabled': False, 'scalarEnabled': True, 'poolMax': 4, 'poolIdleSeconds': 30, 'quick': args.quick}}
    # Docker info is host metadata only; never inspect application environment values.
    metadata_path = args.output / 'metadata.json'
    if args.resume:
        previous = json.loads(metadata_path.read_text())
        if previous['images'] != metadata['images'] or previous['binarySha256'] != metadata['binarySha256'] or previous['settings'] != metadata['settings']:
            raise RuntimeError('Resume requires identical binaries, images and settings')
        changed = [name for name, digest in metadata['sourceSha256'].items() if previous['sourceSha256'].get(name) != digest]
        if any(name != 'run.py' for name in changed):
            raise RuntimeError(f'Resume source changed: {changed}')
        previous.setdefault('resumes', []).append({'unixSeconds': time.time(), 'controllerSha256': metadata['sourceSha256']['run.py']})
        metadata = previous
    metadata_path.write_text(json.dumps(metadata, indent=2) + '\n')
    for round_number in range(1, args.rounds + 1):
        # Rotate order to reduce systematic warm-cache/time bias.
        shift = (round_number - 1) % len(args.variants)
        order = args.variants[shift:] + args.variants[:shift]
        for variant in order:
            output = args.output / f'{round_number}-{variant}'
            if args.resume and ((output / 'trial.json').exists() or (output / 'failed.json').exists()):
                print(f'Skipping recorded attempt {output.name}', flush=True)
                continue
            print(f'Starting {variant} round {round_number}', flush=True)
            try:
                trial(variant, round_number, output, args.quick)
            except Exception as error:
                output.mkdir(parents=True, exist_ok=True)
                (output / 'failed.json').write_text(json.dumps({'variant': variant, 'round': round_number, 'reason': str(error)}, indent=2)+'\n')
                print(f'REJECTED {output.name}: {error}', flush=True)


if __name__ == '__main__':
    main()
