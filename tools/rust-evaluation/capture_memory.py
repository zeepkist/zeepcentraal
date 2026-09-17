#!/usr/bin/env python3
"""Read-only Linux host/process sampler. No environment values or command lines."""
import argparse
import json
import time
from pathlib import Path


def fields(path):
    values = {}
    for line in path.read_text().splitlines():
        name, _, value = line.partition(':')
        if value.strip():
            try:
                values[name] = int(value.split()[0])
            except ValueError:
                pass
    return values


def sample(pids):
    processes = []
    for pid in pids:
        try:
            values = fields(Path(f'/proc/{pid}/smaps_rollup'))
            processes.append({'pid': pid, 'rss_kib': values['Rss'], 'pss_kib': values['Pss'],
                              'private_kib': values.get('Private_Clean', 0) + values.get('Private_Dirty', 0)})
        except (FileNotFoundError, ProcessLookupError):
            processes.append({'pid': pid, 'exited': True})
    info = fields(Path('/proc/meminfo'))
    return {'unix_seconds': time.time(), 'processes': processes,
            'total_pss_kib': sum(p.get('pss_kib', 0) for p in processes),
            'host_kib': {key: info[key] for key in ('MemAvailable', 'SwapTotal', 'SwapFree', 'Cached')},
            'memory_pressure': Path('/proc/pressure/memory').read_text().strip()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pid', action='append', required=True, type=int)
    parser.add_argument('--duration', type=float, default=600)
    parser.add_argument('--interval', type=float, default=1)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    if args.interval <= 0 or args.duration <= 0 or any(pid < 1 for pid in args.pid):
        parser.error('PIDs, interval and duration must be positive')
    pids = sorted(set(args.pid))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    deadline = time.monotonic() + args.duration
    with args.output.open('x') as output:
        while True:
            row = sample(pids)
            output.write(json.dumps(row) + '\n')
            output.flush()
            # Never count a dead service as a memory improvement.
            if any(process.get('exited') for process in row['processes']):
                raise SystemExit('Observed process exited; sample run is incomplete')
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            time.sleep(min(args.interval, remaining))


if __name__ == '__main__':
    main()
