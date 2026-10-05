"""Usage: python scripts/latency_report.py backend.log"""
import collections
import json
import math
import sys

samples = collections.defaultdict(list)
errors = collections.Counter()
for line in open(sys.argv[1]):
    if 'LATENCY ' not in line:
        continue
    try:
        item = json.loads(line.split('LATENCY ', 1)[1])
        key = item['stage'] + (' ' + item['route'] if 'route' in item else '')
        samples[key].append(float(item['duration_ms']))
        errors[key] += item['outcome'] == 'error'
    except (ValueError, KeyError, TypeError):
        continue
print(f'{"Stage / route":65} {"Count":>7} {"Errors":>7} {"p50 ms":>10} {"p95 ms":>10} {"Max ms":>10}')
for key, values in sorted(samples.items()):
    values.sort()
    percentile = lambda p: values[max(0, math.ceil(len(values)*p)-1)]
    print(f'{key:65} {len(values):7} {errors[key]:7} {percentile(.5):10.1f} {percentile(.95):10.1f} {max(values):10.1f}')
