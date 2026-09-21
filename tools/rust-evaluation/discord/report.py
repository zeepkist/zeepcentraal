#!/usr/bin/env python3
"""Summarize offline replay, never label it real Discord capacity."""
import argparse
import importlib.util
import json
import statistics
from pathlib import Path

spec = importlib.util.spec_from_file_location('memory_report', Path(__file__).resolve().parents[1]/'benchmark/report.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
p = argparse.ArgumentParser()
p.add_argument('directory', type=Path)
a = p.parse_args()
trials = []
for path in sorted(a.directory.glob('*/trial.json')):
    trial = json.loads(path.read_text())
    series = {who: [json.loads(line) for line in (path.parent/f'{who}-memory.jsonl').read_text().splitlines()] for who in ('app','fixture')}
    for phase in trial['phases']:
        begin = max(phase['begin'],phase['end']-10) if phase['name'] in ('warm-idle','recovery') else phase['begin']
        phase['memory'] = {who:m.memory(rows,begin,phase['end']) for who,rows in series.items()}
    trials.append(trial)
if not trials: raise SystemExit('No completed trials')
summary = []
for variant in sorted({t['variant'] for t in trials}):
    matches = [t for t in trials if t['variant']==variant]
    row = {'variant':variant,'repetitions':len(matches)}
    for name in ('cold-idle','warm-idle','profile','autocomplete','page','feed','burst','capacity','recovery'):
        phases = [next(p for p in t['phases'] if p['name']==name) for t in matches]
        row[name] = {who:{key:statistics.median(p['memory'][who][key] for p in phases) for key in ('pssMedianMiB','pssP95MiB','rssP95MiB','workingSetP95MiB','cpuCores','privateMedianMiB','fileCacheMedianMiB')} for who in ('app','fixture')}
        if 'load' in phases[0]:
            rates = [p['load']['rps'] for p in phases]
            row[name]['load'] = {'rpsMedian':statistics.median(rates),'rpsMin':min(rates),'rpsMax':max(rates),'p95Ms':statistics.median(p['load']['latencyMs']['p95'] for p in phases),'ackP95Ms':statistics.median(p['load']['acknowledgementMs']['p95'] for p in phases) if all(p['load'].get('acknowledgementMs') for p in phases) else None,'errors':sum(p['load']['errors'] for p in phases),'dropped':sum(p['load']['dropped'] for p in phases)}
    summary.append(row)
(a.directory/'report.json').write_text(json.dumps({'summary':summary,'trials':trials},indent=2)+'\n')
lines = ['# Offline Discord application replay','','No Gateway login/cache. Normalized fixture responses, not complete production commands. Session TTL is 15 seconds for recovery measurements.','','| Variant | Trials | Idle PSS MiB | Burst p95 PSS MiB | Recovery PSS MiB | Capacity events/s (range) | Capacity p95 ms |','| --- | ---: | ---: | ---: | ---: | ---: | ---: |']
for row in summary:
    rate=row['capacity']['load']
    lines.append(f"| {row['variant']} | {row['repetitions']} | {row['warm-idle']['app']['pssMedianMiB']:.1f} | {row['burst']['app']['pssP95MiB']:.1f} | {row['recovery']['app']['pssMedianMiB']:.1f} | {rate['rpsMedian']:.0f} ({rate['rpsMin']:.0f}–{rate['rpsMax']:.0f}) | {rate['p95Ms']:.1f} |")
lines += ['', '## Scenario latency', '',
          'Medians across per-trial p95 values. Acknowledgement measures local fixture completion, not Discord network latency.', '',
          '| Variant | Scenario | Completion p95 ms | Acknowledgement p95 ms | Errors / dropped |',
          '| --- | --- | ---: | ---: | ---: |']
for row in summary:
    for name in ('profile','autocomplete','page','feed','burst'):
        load = row[name]['load']
        ack = f"{load['ackP95Ms']:.2f}" if load['ackP95Ms'] is not None else '—'
        lines.append(f"| {row['variant']} | {name} | {load['p95Ms']:.2f} | {ack} | {load['errors']} / {load['dropped']} |")
lines += ['', '## Capacity resource accounting', '',
          '| Variant | App RSS p95 MiB | App working set p95 MiB | App CPU cores | Fixture PSS median MiB | Fixture CPU cores |',
          '| --- | ---: | ---: | ---: | ---: | ---: |']
for row in summary:
    app, fixture = row['capacity']['app'], row['capacity']['fixture']
    lines.append(f"| {row['variant']} | {app['rssP95MiB']:.1f} | {app['workingSetP95MiB']:.1f} | {app['cpuCores']:.2f} | {fixture['pssMedianMiB']:.1f} | {fixture['cpuCores']:.2f} |")
lines += ['', '## Delivery and recovery audits', '',
          '| Attempt | Deliveries | Persisted feed cursors | Duplicate sends | Retained sessions | Pending feeds | Peak pending feeds |',
          '| --- | ---: | ---: | ---: | ---: | ---: | ---: |']
for trial in trials:
    app, fixture = trial['final']['app'], trial['final']['fixture']
    lines.append(f"| {trial['round']}-{trial['variant']} | {fixture['deliveries']} | {fixture['cursors']} | {fixture['duplicates']} | {app['sessions']} | {app['pendingFeeds']} | {app['peakPendingFeeds']} |")
(a.directory/'report.md').write_text('\n'.join(lines)+'\n')
print('\n'.join(lines))
