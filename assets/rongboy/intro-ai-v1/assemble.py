#!/usr/bin/env python3
"""Conform H3 native shots to the locked 720-frame animatic; preserve originals."""
from pathlib import Path
import argparse,json,subprocess,hashlib
from PIL import Image,ImageDraw,ImageFont,ImageFilter
B=Path(__file__).resolve().parent

def run(*a): subprocess.run([str(x) for x in a],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
def probe(p): return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(p)]))
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

def title_card(p):
 w,h=1920,1080; im=Image.new('RGBA',(w,h)); d=ImageDraw.Draw(im)
 brand=ImageFont.truetype('/System/Library/Fonts/Supplemental/Georgia Bold.ttf',98)
 sub=ImageFont.truetype('/System/Library/Fonts/Supplemental/Songti.ttc',31)
 def spaced(text,font,y,gap):
  widths=[d.textlength(c,font=font) for c in text]; x=(w-sum(widths)-gap*(len(text)-1))/2
  for c,cw in zip(text,widths):d.text((x,y),c,font=font,fill=(255,240,210,255),anchor='ls');x+=cw+gap
 spaced('RONGBOY',brand,140,13.7);spaced('一颗毛球惹的祸',sub,214,9)
 shadow=Image.new('RGBA',(w,h),(43,36,27,0));shadow.putalpha(im.getchannel('A').filter(ImageFilter.GaussianBlur(12)).point(lambda a:int(a*.85)))
 shadow.alpha_composite(im);shadow.save(p)

def main():
 a=argparse.ArgumentParser();a.add_argument('--selection',type=Path,default=B/'selection.json');a.add_argument('--out',type=Path,default=B/'delivery');a.add_argument('--score',type=Path,default=(B/'sound/out/mix.wav' if (B/'sound/out/mix.wav').exists() else (B.parents[2]/'scenes/rongboy-intro/out/mix.wav' if B.name=='intro-ai-v1' else Path('/Users/huanghaibin/Workspace/games/rongboy_fps/scenes/rongboy-intro/out/mix.wav'))));args=a.parse_args()
 plan=json.loads((B/'shot-plan.json').read_text());sel=json.loads(args.selection.read_text());overrides=json.loads((B/'edit-overrides.json').read_text()) if (B/'edit-overrides.json').exists() else {};out=args.out;out.mkdir(parents=True,exist_ok=True);con=B/'conformed';con.mkdir(exist_ok=True);records=[]
 for j in plan['jobs']:
  source=B/sel[j['id']];info=probe(source);vs=next(s for s in info['streams'] if s['codec_type']=='video');n=int(vs.get('nb_frames') or round(float(vs['duration'])*24));need=round(j['frames']*j['stretch'])
  if n+1<need:raise ValueError(f'{j["id"]}: only {n} source frames; need {need}')
  edit=overrides.get(j['id']);speed=j['stretch']
  prefix=''
  if edit and 'segments' not in edit:
   speed=(edit['sourceEndFrame']-edit['sourceStartFrame'])/j['frames']
   prefix=f'trim=start_frame={edit["sourceStartFrame"]}:end_frame={edit["sourceEndFrame"]},'
  target=con/(j['id']+'.mp4');vf=prefix+f'setpts=(PTS-STARTPTS)/{speed},fps=24,trim=end_frame={j["frames"]},setpts=PTS-STARTPTS,scale=1920:1080:flags=lanczos,setsar=1'
  if edit and 'segments' in edit:
   parts=[]
   for k,e in enumerate(edit['segments']):
    piece=con/f"{j['id']}_{k}.mp4";factor=(e['sourceEndFrame']-e['sourceStartFrame'])/e['outputFrames']
    filt=f'trim=start_frame={e["sourceStartFrame"]}:end_frame={e["sourceEndFrame"]},setpts=(PTS-STARTPTS)/{factor},fps=24,trim=end_frame={e["outputFrames"]},setpts=PTS-STARTPTS,scale=1920:1080:flags=lanczos,setsar=1'
    run('ffmpeg','-y','-v','error','-i',source,'-an','-vf',filt,'-frames:v',e['outputFrames'],'-r','24','-c:v','libx264','-crf','16','-preset','fast','-pix_fmt','yuv420p','-video_track_timescale','24000',piece);parts.append(piece)
   listing=con/(j['id']+'_parts.txt');listing.write_text(''.join("file '"+str(p)+"'\n" for p in parts));run('ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',listing,'-an','-c','copy',target)
  else:
   run('ffmpeg','-y','-v','error','-i',source,'-an','-vf',vf,'-frames:v',j['frames'],'-r','24','-c:v','libx264','-crf','16','-preset','fast','-pix_fmt','yuv420p','-video_track_timescale','24000',target)
  pv=next(s for s in probe(target)['streams'] if s['codec_type']=='video');assert int(pv['nb_frames'])==j['frames']
  records.append({'shot':j['id'],'source':str(source),'sourceSha256':sha(source),'sourceFrames':n,'stretch':speed,'editOverride':edit,'targetFrames':j['frames'],'timelineStart':j['f0'],'timelineEnd':j['f1'],'nativeSize':[int(vs['width']),int(vs['height'])]})
  print('conformed',j['id'],j['frames'],flush=True)
 playlist=con/'concat.txt';playlist.write_text(''.join("file '"+str(con/(j['id']+'.mp4'))+"'\n" for j in plan['jobs']))
 title=out/'title-overlay.png';title_card(title);film=out/'rongboy-intro-ai-v1.mp4'
 run('ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',playlist,'-loop','1','-framerate','24','-i',title,'-i',args.score,'-filter_complex','[1:v]format=rgba,fade=t=in:st=26:d=0.4:alpha=1[title];[0:v][title]overlay=0:0:eof_action=repeat,format=yuv420p[v]','-map','[v]','-map','2:a:0','-frames:v','720','-t','30','-r','24','-c:v','libx264','-crf','18','-preset','medium','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',film)
 final=probe(film);v=next(s for s in final['streams'] if s['codec_type']=='video');assert int(v['nb_frames'])==720 and abs(float(final['format']['duration'])-30)<.05
 run('ffmpeg','-v','error','-i',film,'-f','null','-')
 for sec,name in [(10.2,'poster.jpg'),(28.4,'title-frame.jpg')]:run('ffmpeg','-y','-v','error','-ss',sec,'-i',film,'-frames:v','1','-q:v','2',out/name)
 # Every two seconds; use the final title frame as final cell.
 run('ffmpeg','-y','-v','error','-i',film,'-vf','fps=1/2,scale=480:270,tile=3x5:padding=6:margin=6:color=0x292f27','-frames:v','1','-q:v','2',out/'contact-sheet.jpg')
 receipt={'version':'v1','duration':30,'fps':24,'frames':720,'deliverySize':[1920,1080],'nativeGenerationSize':[1024,576],'upscale':'ffmpeg Lanczos; no synthesized detail or frame interpolation','audio':'Original 30-second procedural score reused; landing/bow/fuse foley retimed to the two-part reveal and one soft cloth cue added for the incoming grenade; all generated shot audio muted','title':'RONGBOY / 一颗毛球惹的祸; rasterized exact typography, 26–30s','scoreSha256':sha(args.score),'shots':records,'final':{'sha256':sha(film),'bytes':film.stat().st_size,'probe':final}}
 (out/'assembly-manifest.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2));print(film,flush=True)
if __name__=='__main__':main()
