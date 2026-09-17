#!/usr/bin/env python3
"""Aggregate time-series and repeated runs without pooling unlike memory definitions."""
import argparse
import json
import statistics
from pathlib import Path


def percentile(values, q):
    values = sorted(values)
    if not values:
        raise ValueError('No samples for phase')
    position = (len(values) - 1) * q
    lower = int(position)
    upper = min(lower + 1, len(values) - 1)
    return values[lower] + (values[upper] - values[lower]) * (position - lower)


def memory(rows, begin, end):
    selected = [r for r in rows if begin <= r['unixSeconds'] <= end]
    if len(selected) < 3:
        raise ValueError('Insufficient memory samples')
    pss = [r['pssKiB'] / 1024 for r in selected]
    rss = [r['rssKiB'] / 1024 for r in selected]
    working = [r['workingSetBytes'] / 1048576 for r in selected]
    full = [r['cgroupBytes'] / 1048576 for r in selected]
    cpu = (selected[-1]['cpu']['usage_usec'] - selected[0]['cpu']['usage_usec']) / 1000000
    elapsed = selected[-1]['unixSeconds'] - selected[0]['unixSeconds']
    return {'samples': len(selected), 'pssMedianMiB': statistics.median(pss),
            'pssP95MiB': percentile(pss, .95), 'pssPeakMiB': max(pss),
            'rssMedianMiB': statistics.median(rss), 'rssP95MiB': percentile(rss, .95),
            'workingSetMedianMiB': statistics.median(working), 'workingSetP95MiB': percentile(working, .95),
            'cgroupMedianMiB': statistics.median(full), 'cpuCores': cpu / elapsed,
            'processCountMin': min(len(r['processes']) for r in selected),
            'processCountMax': max(len(r['processes']) for r in selected),
            'swapPeakBytes': max(r['swapBytes'] for r in selected),
            'memoryEvents': selected[-1]['memoryEvents']}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('directory', type=Path)
    args = parser.parse_args()
    trials = []
    for path in sorted(args.directory.glob('*/trial.json')):
        trial = json.loads(path.read_text())
        series = {who: [json.loads(line) for line in (path.parent / f'{who}-memory.jsonl').read_text().splitlines()]
                  for who in ('app', 'db')}
        for phase in trial['phases']:
            begin, end = phase['begin'], phase['end']
            # Retained idle after pool expiry; do not average in the early recovery transition.
            if phase['name'] in ('warm-idle', 'recovery'):
                begin = max(begin, end - 10)
            phase['memory'] = {who: memory(rows, begin, end) for who, rows in series.items()}
        trials.append(trial)
    if not trials:
        raise SystemExit('No completed trials')
    summary = []
    for variant in sorted({t['variant'] for t in trials}):
        matches = [t for t in trials if t['variant'] == variant]
        get = lambda t, name: next(p for p in t['phases'] if p['name'] == name)
        row = {'variant': variant, 'repetitions': len(matches)}
        for name in ('cold-idle', 'warm-idle', 'typical', 'burst', 'capacity', 'recovery'):
            phases = [get(t, name) for t in matches]
            row[name] = {
                who: {metric: statistics.median(p['memory'][who][metric] for p in phases)
                      for metric in ('pssMedianMiB', 'pssP95MiB', 'pssPeakMiB', 'rssMedianMiB', 'rssP95MiB',
                                     'workingSetMedianMiB', 'workingSetP95MiB', 'cgroupMedianMiB', 'cpuCores')}
                for who in ('app', 'db')}
            if 'load' in phases[0]:
                rates = [p['load']['rps'] for p in phases]
                row[name]['load'] = {'rpsMedian': statistics.median(rates), 'rpsMin': min(rates), 'rpsMax': max(rates),
                                     'p95Ms': statistics.median(p['load']['latencyMs']['p95'] for p in phases),
                                     'errors': sum(p['load']['errors'] for p in phases),
                                     'dropped': sum(p['load']['dropped'] for p in phases),
                                     'generatorCpuCores': max(p['load']['generatorCpuCores'] for p in phases)}
        summary.append(row)
    (args.directory / 'report.json').write_text(json.dumps({'summary': summary, 'trials': trials}, indent=2) + '\n')
    lines = ['# Linux database-slice benchmark', '',
             'PSS counts shared pages proportionally. Values below are medians across trials; idle uses the final 10 seconds of the warm-idle window. Active uses per-trial p95 during saturation. This is not a production-service benchmark.', '',
             '| Variant | Trials | Idle PSS MiB | Active p95 PSS MiB | Recovery PSS MiB | Capacity req/s (min–max) | Capacity p95 ms |',
             '| --- | ---: | ---: | ---: | ---: | ---: | ---: |']
    for row in summary:
        load = row['capacity']['load']
        lines.append(f"| {row['variant']} | {row['repetitions']} | {row['warm-idle']['app']['pssMedianMiB']:.1f} | {row['capacity']['app']['pssP95MiB']:.1f} | {row['recovery']['app']['pssMedianMiB']:.1f} | {load['rpsMedian']:.0f} ({load['rpsMin']:.0f}–{load['rpsMax']:.0f}) | {load['p95Ms']:.1f} |")
    lines += ['', '## Fixed offered load', '', '| Variant | 15 req/s p95 ms | 150 req/s p95 ms | 15 req/s PSS p95 MiB | 150 req/s PSS p95 MiB | Errors / dropped |', '| --- | ---: | ---: | ---: | ---: | ---: |']
    for row in summary:
        a, b = row['typical'], row['burst']
        lines.append(f"| {row['variant']} | {a['load']['p95Ms']:.1f} | {b['load']['p95Ms']:.1f} | {a['app']['pssP95MiB']:.1f} | {b['app']['pssP95MiB']:.1f} | {a['load']['errors']+b['load']['errors']} / {a['load']['dropped']+b['load']['dropped']} |")
    lines += ['', '## PostgreSQL and container accounting at saturation', '', '| Variant | DB PSS median MiB | DB working set median MiB | App working set p95 MiB | App RSS p95 MiB | DB CPU cores | Generator CPU cores |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: |']
    for row in summary:
        p = row['capacity']
        lines.append(f"| {row['variant']} | {p['db']['pssMedianMiB']:.1f} | {p['db']['workingSetMedianMiB']:.1f} | {p['app']['workingSetP95MiB']:.1f} | {p['app']['rssP95MiB']:.1f} | {p['db']['cpuCores']:.2f} | {p['load']['generatorCpuCores']:.2f} |")
    (args.directory / 'report.md').write_text('\n'.join(lines) + '\n')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
