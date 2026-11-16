from pathlib import Path
import subprocess,json,re,hashlib
B=Path(__file__).resolve().parent;D=B/'delivery';film=D/'rongboy-intro-ai-v1.mp4'
p=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(film)]));v=next(s for s in p['streams'] if s['codec_type']=='video');a=next(s for s in p['streams'] if s['codec_type']=='audio')
assert int(v['nb_frames'])==720 and v['r_frame_rate']=='24/1' and [v['width'],v['height']]==[1920,1080]
assert v['codec_name']=='h264' and a['codec_name']=='aac' and int(a['sample_rate'])==48000 and int(a['channels'])==2
assert abs(float(p['format']['duration'])-30)<.05
q=subprocess.run(['ffmpeg','-hide_banner','-nostats','-v','info','-i',str(film),'-vf','blackdetect=d=0.1:pix_th=0.10:pic_th=0.98,freezedetect=n=-45dB:d=0.4','-af','ebur128=peak=true','-f','null','-'],capture_output=True,text=True,check=True)
(D/'technical-qa.log').write_text(q.stderr)
black=[m.group(0) for m in re.finditer(r'black_start:[^\n]+',q.stderr)];freezes=[m.group(0) for m in re.finditer(r'lavfi.freezedetect.freeze_[^\n]+',q.stderr)];loud=q.stderr[q.stderr.rfind('Summary:'):]
report={'probe':p,'fullDecode':'passed in combined black/freeze/loudness analysis','blackDetection':{'settings':'d=0.1,pixel=0.10,picture=0.98','events':black},'freezeDetection':{'settings':'noise=-45dB,minDuration=0.4','events':freezes,'interpretation':'Low motion in held puppet reactions is reviewed visually; a numeric event alone does not establish an error.'},'audioSummary':loud.strip(),'sha256':hashlib.sha256(film.read_bytes()).hexdigest()}
(D/'technical-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({k:report[k] for k in ['fullDecode','blackDetection','freezeDetection','audioSummary','sha256']},ensure_ascii=False,indent=2))
