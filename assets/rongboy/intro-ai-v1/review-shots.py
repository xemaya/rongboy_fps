from pathlib import Path
import subprocess,json,argparse
from PIL import Image,ImageDraw,ImageFont
b=Path(__file__).resolve().parent;d=b/'review';d.mkdir(exist_ok=True)
a=argparse.ArgumentParser();a.add_argument('shots',nargs='*');a.add_argument('--count',type=int,default=9);a.add_argument('--seed',type=int,default=7);args=a.parse_args()
plan=json.loads((b/'shot-plan.json').read_text());font=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',14)
for j in plan['jobs']:
 sid=j['id']
 if args.shots and sid not in args.shots:continue
 src=b/'clips'/f'{sid}_seed{args.seed}.mp4'
 if not src.exists():continue
 nsrc=int(next(s for s in json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',str(src)]))['streams'] if s['codec_type']=='video')['nb_frames']);end=min(round(j['frames']*j['stretch']),nsrc)
 points=[round(i*(end-1)/(args.count-1)) for i in range(args.count)];canvas=Image.new('RGB',(3*384,((args.count+2)//3)*238),(40,41,32));draw=ImageDraw.Draw(canvas)
 for k,n in enumerate(points):
  p=d/f'{sid}_{n:03}.png';subprocess.run(['ffmpeg','-y','-v','error','-i',str(src),'-vf',f'select=eq(n\\,{n}),scale=384:216','-fps_mode','vfr','-frames:v','1',str(p)],check=True)
  with Image.open(p) as im:canvas.paste(im,(k%3*384,k//3*238))
  draw.text((k%3*384+6,k//3*238+218),f'{sid} frame {n}',font=font,fill='#f5e5c3')
 canvas.save(d/f'{sid}_seed{args.seed}_dense.jpg');print(sid,'reviewed frames',points)
