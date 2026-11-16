"""Reuse the film's original score synthesizer; conform foley to AI edit."""
from pathlib import Path
import importlib.util,json,hashlib
B=Path(__file__).resolve().parent
repo=B.parents[2] if B.name=='intro-ai-v1' else Path('/Users/huanghaibin/Workspace/games/rongboy_fps')
source=repo/'scenes/rongboy-intro/score.py';sound=B/'sound';sound.mkdir(exist_ok=True)
cue=json.loads((source.parent/'cue-map.json').read_text())
for c in cue['cues']:
 if c['type']=='bow':c['t']=21.65
 if c['type']=='fuse':c['t']=22.65
 if c['type']=='cushion':c['t']=14.67
cue['cues'].append({'t':29.25,'type':'cloth'})
(sound/'cue-map.json').write_text(json.dumps(cue,ensure_ascii=False,indent=2))
spec=importlib.util.spec_from_file_location('rongboy_original_score',source);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);mod.HERE=sound;mod.main()
(sound/'retime-manifest.json').write_text(json.dumps({'originalGenerator':str(source),'generatorSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'changes':['cushion cue15.0 to14.67 for observed AI landing','bow cue 22.5 to21.65 for archer insert','fuse cue 21.4 to22.65 for bomber insert','soft cloth air cue at29.25 for incoming toy grenade'],'music':'same original composition, instruments, seed and pauses'},indent=2))
