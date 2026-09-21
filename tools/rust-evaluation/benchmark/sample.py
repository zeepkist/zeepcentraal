#!/usr/bin/env python3
"""Sample only PID 1 and its descendants from a separate shared-PID sidecar."""
import json
import os
import time
from pathlib import Path
import sys


def pairs(path):
    result = {}
    for line in Path(path).read_text().splitlines():
        bits = line.replace(':', '').split()
        if len(bits) >= 2:
            try:
                result[bits[0]] = int(bits[1])
            except ValueError:
                pass
    return result


def sample():
    parents = {}
    for item in Path('/proc').iterdir():
        if item.name.isdigit():
            try:
                parents[int(item.name)] = pairs(item / 'status').get('PPid', -1)
            except (FileNotFoundError, ProcessLookupError):
                pass
    selected = {1}
    while True:
        added = {pid for pid, parent in parents.items() if parent in selected and pid != os.getpid()}
        if added <= selected:
            break
        selected |= added
    processes = []
    for pid in sorted(selected):
        try:
            data = pairs(f'/proc/{pid}/smaps_rollup')
            processes.append({'pid': pid, 'rssKiB': data['Rss'], 'pssKiB': data['Pss'],
                              'privateKiB': data.get('Private_Clean', 0) + data.get('Private_Dirty', 0)})
        except (FileNotFoundError, ProcessLookupError):
            continue
    if not any(p['pid'] == 1 for p in processes):
        raise RuntimeError('Measured service exited')
    cgroup = Path('/proc/1/root/sys/fs/cgroup')
    if (cgroup / 'memory.current').exists():
        memory = pairs(cgroup / 'memory.stat')
        current = int((cgroup / 'memory.current').read_text())
        inactive = memory.get('inactive_file', 0)
        anon, file = memory.get('anon'), memory.get('file')
        cpu = pairs(cgroup / 'cpu.stat')
        events = pairs(cgroup / 'memory.events')
        swap = int((cgroup / 'memory.swap.current').read_text())
    else:
        memory = pairs(cgroup / 'memory/memory.stat')
        current = int((cgroup / 'memory/memory.usage_in_bytes').read_text())
        inactive = memory.get('total_inactive_file', 0)
        anon, file = memory.get('total_rss'), memory.get('total_cache')
        cpu = pairs(cgroup / 'cpu/cpu.stat')
        cpu['usage_usec'] = int((cgroup / 'cpuacct/cpuacct.usage').read_text()) // 1000
        events = {'limitHits': int((cgroup / 'memory/memory.failcnt').read_text())}
        swap = memory.get('total_swap', 0)
    return {'unixSeconds': time.time(), 'processes': processes,
            'pssKiB': sum(p['pssKiB'] for p in processes),
            'rssKiB': sum(p['rssKiB'] for p in processes),
            'privateKiB': sum(p['privateKiB'] for p in processes),
            'cgroupBytes': current,
            'workingSetBytes': max(0, current - inactive),
            'anonBytes': anon, 'fileBytes': file, 'swapBytes': swap,
            'cpu': cpu, 'memoryEvents': events,
            'hostKiB': {k: v for k, v in pairs('/proc/meminfo').items() if k in ('MemAvailable', 'SwapTotal', 'SwapFree')},
            'hostMemoryPressure': Path('/proc/pressure/memory').read_text().strip() if Path('/proc/pressure/memory').exists() else None}


with open(sys.argv[1], 'x', buffering=1) as stream:
    while True:
        stream.write(json.dumps(sample()) + '\n')
        time.sleep(0.5)
