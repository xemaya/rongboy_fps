#!/usr/bin/env python3
"""Prepare/submit once/status/pull a specifically authorized Rongboy shot, seed7.

Prepare reads current shot-plan.json. Submit never retries. No model or service is installed/restarted.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import time

BASE = Path(__file__).resolve().parent
CAST = Path('/Users/huanghaibin/Workspace/games/rongboy_fps/assets/rongboy/intro-ai-v1/cast')
HOST = 'shouyun-4090'
PROJECT = '/data/app/huanghaibin/rongboy-intro-ai-v1-20261116'
INPUT = '/data/app/huanghaibin/input'
OUTPUT = '/data/app/huanghaibin/output'
PREFIX = 'rgintro_20261116_v1_'
SEED = 7
VARIANT = ''
PROMPT_PATH_OVERRIDE = None
GUIDE_FRAMES = []
FIRST_OVERRIDE = None
MOTION_OVERRIDE = None


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1024 * 1024), b''):
            h.update(b)
    return h.hexdigest()


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    with open(tmp, 'w') as f:
        json.dump(value, f, ensure_ascii=False, indent=2)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def run(args, capture=True):
    return subprocess.run([str(x) for x in args], capture_output=capture, text=True, check=True)


def probe(path):
    return json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path]).stdout)


def ssh(command):
    return run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', HOST, command]).stdout


def receipt_path(shot):
    tag = shot + ('_' + VARIANT if VARIANT else '')
    return BASE / 'receipts' / f'{tag}_seed{SEED}.json'


def manifest_path(shot):
    tag = shot if SEED == 7 and not VARIANT else shot + ('_' + VARIANT if VARIANT else '') + f'_seed{SEED}'
    return BASE / 'runs' / tag / 'manifest.json'


def prepare(shot):
    if shot == 's02' and (BASE / 's02-receipt.json').exists():
        raise RuntimeError('s02 already has its accepted seed7 output; this launcher will not rerun it')
    rp = receipt_path(shot)
    if rp.exists() and json.loads(rp.read_text()).get('submission_attempted'):
        raise RuntimeError('An attempt exists. Preserve its manifest and inspect it before any new preparation.')
    plan = json.loads((BASE / 'shot-plan.json').read_text())
    job = next(j for j in plan['jobs'] if j['id'] == shot)
    sec = float(job['sec'])
    x = max(5, round(sec * 24))
    native = x + (5 - x % 17) % 17
    if native != job['nativeFrames'] or job['frames'] != job['f1'] - job['f0']:
        raise RuntimeError('Current plan has inconsistent frame counts')
    first, guide, prompt = BASE / 'firstframes' / f'{shot}_paint.png', BASE / job['guide'], BASE / 'jobs' / f'{shot}.txt'
    if FIRST_OVERRIDE is not None:
        first = FIRST_OVERRIDE.resolve()
    if MOTION_OVERRIDE is not None:
        guide = MOTION_OVERRIDE.resolve()
    if PROMPT_PATH_OVERRIDE is not None:
        prompt = PROMPT_PATH_OVERRIDE.resolve()
    paths = [('first', first), ('guide', guide)] + [('cast_' + c, CAST / (c + '.png')) for c in job['cast']]
    extra_guides, occupied = [], {0}
    for number, value in enumerate(GUIDE_FRAMES):
        index, name = value.split(':', 1)
        index, path = int(index), Path(name).resolve()
        resolved = index if index >= 0 else native + index
        if not 0 <= resolved < native or resolved in occupied:
            raise RuntimeError('Extra guide index is invalid or conflicts with an existing guide')
        occupied.add(resolved)
        role = f'frame_{number}'
        paths.append((role, path))
        extra_guides.append({'frame_idx': index, 'resolved_frame_index': resolved, 'role': role, 'source': str(path)})
    for role, path in paths + [('prompt', prompt)]:
        if not path.is_file():
            raise RuntimeError(f'Required final {role} is not ready: {path}')
    f = next(s for s in probe(first)['streams'] if s['codec_type'] == 'video')
    if (f['width'], f['height']) != (1024, 576):
        raise RuntimeError('First frame must already be 1024x576')
    for role, path in paths:
        if role.startswith('frame_'):
            i = next(s for s in probe(path)['streams'] if s['codec_type'] == 'video')
            if (i['width'], i['height']) != (1024, 576):
                raise RuntimeError('Every extra guide must already be 1024x576')
    g = next(s for s in probe(guide)['streams'] if s['codec_type'] == 'video')
    if (g['width'], g['height'], g['r_frame_rate']) != (1024, 576, '24/1') or int(g.get('nb_frames', 0)) < native:
        raise RuntimeError('Guide must be 1024x576/24fps and cover the native H3 duration')
    audio = run(['ffmpeg', '-nostdin', '-v', 'info', '-i', guide, '-vn', '-af', 'volumedetect', '-f', 'null', '-'])
    if not any(x in audio.stderr for x in ('max_volume: -91.0 dB', 'max_volume: -inf dB')):
        raise RuntimeError('Guide audio was not verified silent; replace it before prepare')
    assets = []
    for role, path in paths:
        h = sha(path)
        name = f'{PREFIX}{shot}_{role}_{h[:16]}{path.suffix.lower()}'
        assets.append({'role': role, 'local': str(path.resolve()), 'remote': f'{INPUT}/{name}', 'sha256': h})
    cfg = {'shot': shot, 'cast': job['cast'], 'plan_job': job, 'variant': VARIANT, 'prompt_source': str(prompt),
           'source_overrides': {'first': str(FIRST_OVERRIDE) if FIRST_OVERRIDE else None,
                                'motion': str(MOTION_OVERRIDE) if MOTION_OVERRIDE else None},
           'recipe': {'w': 1024, 'h': 576, 'sec': sec, 'steps': 8, 'seed': SEED}, 'assets': assets,
           'prompt_sha256': sha(prompt), 'shot_plan_sha256': sha(BASE / 'shot-plan.json'),
           'remote_driver_sha256': sha(BASE / 'remote-h3-shot.py'), 'guides': extra_guides}
    if extra_guides:
        cfg['project_runner_sha256'] = sha(BASE / 'h3run-multiguide.py')
    run_id = hashlib.sha256(json.dumps(cfg, sort_keys=True).encode()).hexdigest()[:16]
    remote = f'{PROJECT}/{shot}/{run_id}'
    cfg.update(run_id=run_id, remote_dir=remote, output_prefix=f'rongboy-intro-ai-v1-20261116/{shot}/{PREFIX}{shot}_s{SEED}_{run_id}')
    local = manifest_path(shot).parent / run_id
    local.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(prompt, local / 'prompt.txt')
    write(local / 'config.json', cfg)
    shutil.copyfile(BASE / 'remote-h3-shot.py', local / 'remote-h3-shot.py')
    if extra_guides:
        shutil.copyfile(BASE / 'h3run-multiguide.py', local / 'h3run-multiguide.py')
    manifest = {'config': cfg, 'local_dir': str(local)}
    write(manifest_path(shot), manifest)
    write(rp, {'phase': 'prepared', 'shot': shot, 'seed': SEED, 'variant': VARIANT, 'run_id': run_id, 'remote_dir': remote,
               'submission_attempted': False, 'prompt_ids': [], 'outputs': [], 'created': time.time()})
    return {'shot': shot, 'seed': SEED, 'variant': VARIANT, 'phase': 'prepared', 'sec': sec, 'native_frames': native,
            'cast_order': job['cast'], 'run_id': run_id}


def submit(shot):
    manifest = json.loads(manifest_path(shot).read_text())
    cfg, local = manifest['config'], Path(manifest['local_dir'])
    rp = receipt_path(shot)
    receipt = json.loads(rp.read_text())
    if receipt.get('submission_attempted'):
        raise RuntimeError('Submission already attempted. Use status; never resubmit automatically.')
    remote = cfg['remote_dir']
    ssh('mkdir -p ' + shlex.quote(remote))
    controls = [(local / 'config.json', remote + '/config.json'), (local / 'prompt.txt', remote + '/prompt.txt'),
                (local / 'remote-h3-shot.py', remote + '/remote-h3-shot.py')]
    if cfg.get('project_runner_sha256'):
        controls.append((local / 'h3run-multiguide.py', remote + '/h3run-multiguide.py'))
    for item in cfg['assets']:
        if sha(item['local']) != item['sha256']:
            raise RuntimeError('Asset changed after prepare: ' + item['local'])
        run(['rsync', '-a', '--ignore-existing', item['local'], f'{HOST}:{item["remote"]}'])
    for source, dest in controls:
        run(['rsync', '-a', '--ignore-existing', source, f'{HOST}:{dest}'])
    hashes = {dest: sha(source) for source, dest in controls}
    check = 'import pathlib,hashlib; expected=' + repr(hashes) + '; assert all(hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()==h for p,h in expected.items())'
    ssh('python3 -c ' + shlex.quote(check))
    receipt.update(phase='remote_start_requested', submission_attempted=True, submission_attempted_at=time.time())
    write(rp, receipt)
    try:
        result = json.loads(ssh('/home/huanghaibin/envs/comfy/bin/python ' + shlex.quote(remote + '/remote-h3-shot.py') + ' start'))
    except Exception as e:
        receipt.update(phase='remote_start_outcome_unknown_do_not_retry', error=str(e))
        write(rp, receipt)
        raise
    if result.get('phase') == 'waiting_for_idle_gpu':
        receipt['submission_attempted'] = False
    receipt.update(phase=result['phase'], remote_start=result)
    write(rp, receipt)
    return {'shot': shot, 'phase': result['phase'], 'port': result.get('port'), 'gpu': result.get('gpu'),
            'run_id': cfg['run_id'], 'queues': result.get('queues')}


def status(shot):
    manifest = json.loads(manifest_path(shot).read_text())
    remote = manifest['config']['remote_dir']
    result = json.loads(ssh('/home/huanghaibin/envs/comfy/bin/python ' + shlex.quote(remote + '/remote-h3-shot.py') + ' status'))
    rp = receipt_path(shot)
    receipt = json.loads(rp.read_text())
    h = result.get('h3') or {}
    receipt.update(remote_status=result, last_readback=time.time())
    receipt['prompt_ids'] = list(dict.fromkeys(receipt.get('prompt_ids', []) + [h[k] for k in ('token', 'prompt_id') if h.get(k)]))
    if h.get('phase'):
        receipt['phase'] = h['phase']
    history = result.get('history') or {}
    st = history.get('status') or {}
    if st.get('status_str') == 'success':
        prefix = f'rongboy-intro-ai-v1-20261116/{shot}/'
        receipt.update(phase='completed', outputs=[f['path'] for f in history.get('files', [])
                                                if f['path'].startswith(prefix) and f['path'].endswith('.mp4')])
    elif st.get('status_str') == 'error':
        receipt.update(phase='failed', execution_status=st)
    write(rp, receipt)
    return {'shot': shot, 'phase': receipt['phase'], 'prompt_id': h.get('prompt_id'),
            'port': h.get('port'), 'queue_location': result.get('queue_location'),
            'outputs': receipt.get('outputs'), 'readback_error': result.get('readback_error')}


def pull(shot):
    current = status(shot)
    if current['phase'] != 'completed':
        raise RuntimeError('Exact prompt history has not confirmed success')
    manifest = json.loads(manifest_path(shot).read_text())
    cfg = manifest['config']
    files = current['outputs']
    if len(files) != 1 or Path(files[0]).is_absolute() or '..' in Path(files[0]).parts:
        raise RuntimeError('Expected exactly one generated video under this shot output prefix')
    native = Path(manifest['local_dir']) / Path(files[0]).name
    run(['rsync', '-a', '--ignore-existing', f'{HOST}:{OUTPUT}/{files[0]}', native])
    expected = ssh('sha256sum ' + shlex.quote(f'{OUTPUT}/{files[0]}')).split()[0]
    if sha(native) != expected:
        raise RuntimeError('Downloaded file checksum mismatch')
    clips = BASE / 'clips'
    clips.mkdir(exist_ok=True)
    target = clips / f'{shot}_seed{SEED}.mp4'
    if target.exists() and sha(target) != expected:
        raise RuntimeError('Different delivery file already exists; refusing overwrite')
    if not target.exists():
        shutil.copyfile(native, target)
    info = probe(target)
    v = next(s for s in info['streams'] if s['codec_type'] == 'video')
    frames = cfg['plan_job']['nativeFrames']
    if (v['width'], v['height'], v['r_frame_rate'], int(v['nb_frames'])) != (1024, 576, '24/1', frames):
        raise RuntimeError('Unexpected generated video format/frame count')
    run(['ffmpeg', '-nostdin', '-v', 'error', '-i', target, '-f', 'null', '-'])
    selected = [0, frames // 2, frames - 1]
    contact = clips / f'{shot}_seed{SEED}_contact.png'
    expression = '+'.join(f'eq(n\\,{n})' for n in selected)
    run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', target, '-vf',
         f'select={expression},scale=512:288,tile=3x1', '-frames:v', '1', contact])
    rp = receipt_path(shot)
    receipt = json.loads(rp.read_text())
    receipt['delivery'] = {'video': str(target), 'contact_sheet': str(contact), 'sha256': expected,
                           'remote_video': f'{OUTPUT}/{files[0]}', 'native_frames': frames, 'native_fps': 24,
                           'video_duration': frames / 24, 'target_edit_frames': cfg['plan_job']['frames'],
                           'stretch': cfg['plan_job']['stretch'], 'full_decode': 'passed', 'contact_frames': selected,
                           'media_info': info}
    write(rp, receipt)
    return {'shot': shot, 'phase': 'delivered', **{k: receipt['delivery'][k] for k in ('video', 'contact_sheet', 'native_frames', 'target_edit_frames', 'stretch')}}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('prepare', 'submit', 'status', 'pull'))
    parser.add_argument('--shot', required=True, choices=[f's{i:02d}' for i in range(1, 12)])
    parser.add_argument('--seed', type=int, default=7, choices=(7, 11))
    parser.add_argument('--variant', default='', choices=('', 'fix'))
    parser.add_argument('--prompt', type=Path, default=None)
    parser.add_argument('--guide-frame', action='append', default=[], metavar='FRAME:LOCAL_IMAGE')
    parser.add_argument('--first', type=Path, default=None, help='Explicit conditioning first-frame override')
    parser.add_argument('--motion', type=Path, default=None, help='Explicit reference-video override')
    a = parser.parse_args()
    SEED, VARIANT, PROMPT_PATH_OVERRIDE, GUIDE_FRAMES = a.seed, a.variant, a.prompt, a.guide_frame
    FIRST_OVERRIDE, MOTION_OVERRIDE = a.first, a.motion
    print(json.dumps(globals()[a.action](a.shot), ensure_ascii=False, indent=2))
