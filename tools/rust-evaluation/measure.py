#!/usr/bin/env python3
"""Measure explicit local evaluation targets. Never sends production mutations."""
import argparse
import concurrent.futures
import json
import statistics
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse


def percentile(values, fraction):
    ordered = sorted(values)
    index = (len(ordered) - 1) * fraction
    lo = int(index)
    hi = min(lo + 1, len(ordered) - 1)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (index - lo)


def memory(pid):
    """Linux PSS avoids counting shared pages fully for every process."""
    if pid is None:
        return None
    result = {}
    for line in Path(f'/proc/{pid}/smaps_rollup').read_text().splitlines():
        key, _, value = line.partition(':')
        if key in ('Rss', 'Pss', 'Private_Clean', 'Private_Dirty'):
            result[key + '_kib'] = int(value.split()[0])
    return result


def run(base, count, concurrency):
    paths = ['/evaluation/user/76561198000000001', '/evaluation/leaderboard/1']
    def request(i):
        start = time.perf_counter()
        try:
            with urllib.request.urlopen(base + paths[i % len(paths)], timeout=10) as response:
                json.load(response)
                return (time.perf_counter() - start) * 1000, response.status
        except (OSError, ValueError):
            return (time.perf_counter() - start) * 1000, 0
    started = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
        outcomes = list(pool.map(request, range(count)))
    elapsed = time.perf_counter() - started
    durations = [item[0] for item in outcomes]
    return {'requests': count, 'concurrency': concurrency, 'seconds': elapsed,
            'requests_per_second': count / elapsed,
            'errors': sum(status != 200 for _, status in outcomes),
            'latency_ms': {'median': statistics.median(durations),
                           'p95': percentile(durations, .95), 'p99': percentile(durations, .99)}}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', required=True)
    parser.add_argument('--label', required=True)
    parser.add_argument('--requests', type=int, default=1000)
    parser.add_argument('--concurrency', type=int, default=8)
    parser.add_argument('--pid', type=int, help='Linux server PID; omit on Windows')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    parsed = urlparse(args.url)
    if parsed.scheme != 'http' or parsed.hostname not in ('localhost', '127.0.0.1') or parsed.path not in ('', '/'):
        parser.error('Use a local HTTP evaluation server')
    if not 1 <= args.requests <= 100000 or not 1 <= args.concurrency <= 128:
        parser.error('Request or concurrency bound exceeded')
    # Warmup belongs outside reported measurements.
    warmup = run(args.url.rstrip('/'), 50, args.concurrency)
    if warmup['errors']:
        raise SystemExit('Warmup failed; no benchmark written')
    before = memory(args.pid)
    result = run(args.url.rstrip('/'), args.requests, args.concurrency)
    result.update(label=args.label, memory_before=before, memory_after=memory(args.pid),
                  scope='HTTP evaluation reads only; excludes jobs, SteamCMD and production baseline',
                  preview_features='Record runtime setting alongside this result')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
    if result['errors']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
