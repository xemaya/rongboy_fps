from pathlib import Path
import json,subprocess,sys
base=Path('/tmp/rongboy-intro-ai');plan=json.loads((base/'shot-plan.json').read_text());film=base/'guides/clean-skeleton.mp4'
for j in plan['jobs']:
 if len(sys.argv)>1 and j['id'] not in sys.argv[1:]:continue
 first=base/j['first'];guide=base/j['guide'];pad=max(.15,j['nativeFrames']/24-j['sec']+.12)
 subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(film),'-vf',f"select=eq(n\\,{j['f0']})",'-frames:v','1',str(first)],check=True)
 vf=f"trim=start_frame={j['f0']}:end_frame={j['f1']},setpts={j['stretch']}*(PTS-STARTPTS),scale=1024:576:flags=lanczos,fps=24,tpad=stop_mode=clone:stop_duration={pad:.6f}"
 subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(film),'-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-vf',vf,'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','16','-pix_fmt','yuv420p','-c:a','aac','-shortest',str(guide)],check=True)
 print(j['id'],j['frames'],j['stretch'],flush=True)
assert sum(j['frames'] for j in plan['jobs'])==720
