#!/usr/bin/env python3
"""Run one immutable shot config through the existing H3 CLI, without retries."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request

HERE = Path(__file__).resolve().parent
PROJECT = Path('/data/app/huanghaibin/rongboy-intro-ai-v1-20261116')
SAFE_PORTS = (8188, 8189, 8190, 8192, 8194)
RUNNER = Path('/home/huanghaibin/bin/h3run.py')
PYTHON = '/home/huanghaibin/envs/comfy/bin/python'
STATE = HERE / 'launcher-receipt.json'
RECEIPT = HERE / 'h3-receipt.json'


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1024 * 1024), b''):
            h.update(b)
    return h.hexdigest()


def write(path, value):
    tmp = path.with_suffix(path.suffix + '.tmp')
    with open(tmp, 'w') as f:
        json.dump(value, f, ensure_ascii=False, indent=2)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def get(port, path):
    with urllib.request.urlopen(f'http://127.0.0.1:{port}{path}', timeout=10) as r:
        return json.load(r)


def inspect():
    data = {'run_dir': str(HERE), 'launcher': json.loads(STATE.read_text()) if STATE.exists() else None,
            'h3': json.loads(RECEIPT.read_text()) if RECEIPT.exists() else None}
    h = data['h3']
    if h and h.get('prompt_id') and h.get('port') in SAFE_PORTS:
        try:
            pid = h['prompt_id']
            history = get(h['port'], f'/history/{pid}').get(pid)
            if history:
                files = []
                for output in history.get('outputs', {}).values():
                    for value in output.values():
                        if isinstance(value, list):
                            for item in value:
                                if isinstance(item, dict) and 'filename' in item:
                                    files.append({'path': str(Path(item.get('subfolder', '')) / item['filename']),
                                                  'type': item.get('type')})
                data['history'] = {'status': history.get('status'), 'files': files}
            else:
                q = get(h['port'], '/queue')
                data['queue_location'] = next((k for k in ('queue_running', 'queue_pending')
                                               if any(len(row) > 1 and row[1] == pid for row in q.get(k, []))), None)
        except Exception as e:
            data['readback_error'] = str(e)
    return data


def lease_active(port):
    lease = PROJECT / f'lease-{port}.json'
    if not lease.exists():
        return False
    previous = json.loads(lease.read_text())
    hp = Path(previous['run_dir']) / 'h3-receipt.json'
    if not hp.exists():
        return True
    h = json.loads(hp.read_text())
    if h.get('phase') in ('completed', 'rejected'):
        return False
    pid = h.get('prompt_id')
    if pid:
        history = get(port, f'/history/{pid}').get(pid)
        if history and history.get('status', {}).get('completed'):
            return False
    # An unknown submission, or a runner not yet in the queue, retains its claim.
    return True


def confirm_gpu(port):
    gpu = port - 8188
    gpu_map = subprocess.run(['nvidia-smi', '--query-gpu=index,uuid', '--format=csv,noheader,nounits'],
                             capture_output=True, text=True, check=True).stdout
    uuids = dict((int(r.split(',')[0].strip()), r.split(',')[1].strip()) for r in gpu_map.splitlines() if r.strip())
    procs = subprocess.run(['nvidia-smi', '--query-compute-apps=gpu_uuid,pid,process_name',
                            '--format=csv,noheader,nounits'], capture_output=True, text=True, check=True).stdout
    found = False
    for row in procs.splitlines():
        cols = [x.strip() for x in row.split(',', 2)]
        if len(cols) != 3 or cols[0] != uuids[gpu]:
            continue
        if 'llama' in cols[2].lower():
            raise RuntimeError('A llama process is on the selected GPU; aborting')
        p = Path('/proc') / cols[1]
        try:
            argv = p.joinpath('cmdline').read_bytes().decode().split('\0')
            env = p.joinpath('environ').read_bytes().decode().split('\0')
            if '--port' in argv and argv[argv.index('--port') + 1] == str(port):
                found = found or (f'CUDA_VISIBLE_DEVICES={gpu}' in env and any(x.endswith('main.py') for x in argv))
        except (OSError, ValueError, IndexError):
            continue
    if not found:
        raise RuntimeError('Could not confirm safe port to physical GPU mapping')
    return gpu


def start():
    cfg = json.loads((HERE / 'config.json').read_text())
    recipe = cfg['recipe']
    if cfg['shot'] not in [f's{i:02d}' for i in range(1, 12)]:
        raise RuntimeError('Unexpected shot id')
    if (recipe['w'], recipe['h'], recipe['steps']) != (1024, 576, 8) or recipe['seed'] not in (7, 11):
        raise RuntimeError('Unexpected model recipe; no automatic model changes')
    runner = HERE / 'h3run-multiguide.py' if cfg.get('project_runner_sha256') else RUNNER
    if cfg.get('project_runner_sha256') and sha(runner) != cfg['project_runner_sha256']:
        raise RuntimeError('Project-local multi-guide runner checksum mismatch')
    source = runner.read_text()
    if not all(x in source for x in ('if a.first and (a.ref or a.refvideo)', 'frame_idx=0', 'ap.add_argument("--receipt"')):
        raise RuntimeError('Installed h3run lacks required F path or durable receipt support')
    for item in cfg['assets']:
        if not Path(item['remote']).is_file() or sha(item['remote']) != item['sha256']:
            raise RuntimeError('Remote asset mismatch: ' + item['remote'])
    if sha(HERE / 'prompt.txt') != cfg['prompt_sha256']:
        raise RuntimeError('Remote prompt mismatch')
    with open(PROJECT / 'dispatch.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if (HERE / 'attempted').exists() or STATE.exists() or RECEIPT.exists():
            raise RuntimeError('An attempt already exists. Inspect it; never retry automatically.')
        checks, selected = [], None
        for port in SAFE_PORTS:
            try:
                q = get(port, '/queue')
                active = lease_active(port)
                checks.append({'port': port, 'running': len(q.get('queue_running', [])),
                               'pending': len(q.get('queue_pending', [])), 'reserved_by_project': active, 'at': time.time()})
                if not active and not q.get('queue_running') and not q.get('queue_pending'):
                    selected = port
                    break
            except Exception as e:
                checks.append({'port': port, 'error': str(e), 'at': time.time()})
        if selected is None:
            print(json.dumps({'phase': 'waiting_for_idle_gpu', 'shot': cfg['shot'], 'queues': checks}))
            return
        gpu = confirm_gpu(selected)
        q = get(selected, '/queue')
        if q.get('queue_running') or q.get('queue_pending'):
            print(json.dumps({'phase': 'waiting_for_idle_gpu', 'shot': cfg['shot'], 'reason': 'queue_changed'}))
            return
        names = {x['role']: Path(x['remote']).name for x in cfg['assets']}
        cmd = [PYTHON, str(runner), '--receipt', str(RECEIPT), '--port', str(selected),
               '--prompt-file', str(HERE / 'prompt.txt'), '--unet', 'minimax_h3_fl2va_pruned_fp8_scaled.safetensors',
               '--lora', 'minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors:1',
               '--first', names['first'], '--refvideo', names['guide'], '--w', '1024', '--h', '576',
               '--sec', str(recipe['sec']), '--steps', '8', '--seed', str(recipe['seed']),
               '--sampler', 'res_multistep', '--scheduler', 'simple', '--prefix', cfg['output_prefix']]
        for cast in cfg['cast']:
            cmd.extend(['--ref', names['cast_' + cast]])
        for guide in cfg.get('guides', []):
            cmd.extend(['--guide', f'{guide["frame_idx"]}:{names[guide["role"]]}'])
        marker = os.open(HERE / 'attempted', os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.close(marker)
        state = {'phase': 'launching', 'shot': cfg['shot'], 'at': time.time(), 'port': selected, 'gpu': gpu,
                 'queue_checks': checks, 'argv': cmd, 'config_sha256': sha(HERE / 'config.json'),
                 'h3run_sha256': sha(runner), 'output_prefix': cfg['output_prefix'], 'guides': cfg.get('guides', [])}
        write(STATE, state)
        write(PROJECT / f'lease-{selected}.json', {'run_dir': str(HERE), 'shot': cfg['shot'], 'at': time.time()})
        with open(HERE / 'h3run.log', 'ab', buffering=0) as log:
            process = subprocess.Popen(cmd, cwd='/home/huanghaibin/bin', stdin=subprocess.DEVNULL,
                                       stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        state.update(phase='runner_started', pid=process.pid)
        write(STATE, state)
    print(json.dumps(state, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=('start', 'status'))
    a = parser.parse_args()
    print(json.dumps(inspect(), ensure_ascii=False)) if a.action == 'status' else start()
