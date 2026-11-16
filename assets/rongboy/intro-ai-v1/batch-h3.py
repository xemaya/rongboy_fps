#!/usr/bin/env python3
"""Bounded parallel wrapper; only the explicit shot list runs and no action retries."""
import argparse
import concurrent.futures
import json
from pathlib import Path
import subprocess
import sys
import time

BASE = Path(__file__).resolve().parent


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('action', choices=('prepare', 'submit', 'status', 'pull'))
    p.add_argument('--shots', nargs='+', required=True, choices=[f's{i:02d}' for i in range(1, 12)])
    p.add_argument('--workers', type=int, default=5)
    a = p.parse_args()
    if not 1 <= a.workers <= 5 or len(set(a.shots)) != len(a.shots):
        p.error('workers must be 1..5 and shot ids must be unique')
    results = []

    def one(shot):
        r = subprocess.run([sys.executable, str(BASE / 'h3-shot.py'), a.action, '--shot', shot],
                           capture_output=True, text=True)
        if r.returncode:
            return {'shot': shot, 'ok': False, 'exit_code': r.returncode, 'error': r.stderr[-2500:], 'stdout': r.stdout[-1000:]}
        try:
            return {'shot': shot, 'ok': True, 'result': json.loads(r.stdout)}
        except ValueError:
            return {'shot': shot, 'ok': False, 'error': 'Unexpected stdout; inspect receipt, never retry blindly', 'stdout': r.stdout[-2500:]}

    with concurrent.futures.ThreadPoolExecutor(max_workers=a.workers) as pool:
        futures = [pool.submit(one, shot) for shot in a.shots]
        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            results.append(result)
            print(json.dumps(result, ensure_ascii=False), flush=True)
    receipt_dir = BASE / 'batch-receipts'
    receipt_dir.mkdir(exist_ok=True)
    (receipt_dir / f'{time.time_ns()}-{a.action}.json').write_text(json.dumps(
        {'action': a.action, 'shots': a.shots, 'workers': a.workers, 'at': time.time(), 'results': results},
        ensure_ascii=False, indent=2))
    return 0 if all(r['ok'] for r in results) else 1


if __name__ == '__main__':
    raise SystemExit(main())
