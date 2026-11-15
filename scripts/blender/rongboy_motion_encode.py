"""Encode only the rendered Blender frames; retain editable native motion scene."""
from pathlib import Path
import subprocess,json
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[2];out=root/'assets/rongboy/scout-motion-v1'
frames=out/'frames'
for f in range(1,193):
 p=frames/f'{f:04d}.png'
 if not p.exists():raise SystemExit(f'Missing frame {f}')
 with Image.open(p) as im:
  if im.size!=(960,600):raise SystemExit(f'Unexpected dimensions in {p.name}: {im.size}')
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate','24','-start_number','1','-i',str(frames/'%04d.png'),'-frames:v','192','-c:v','libx264','-crf','18','-preset','medium','-pix_fmt','yuv420p','-movflags','+faststart',str(out/'rongboy-motion-v1.mp4')],check=True)
# Animated preview is secondary; primary MP4 retains all 24 frames per second.
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(out/'rongboy-motion-v1.mp4'),'-filter_complex','[0:v]fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse','-loop','0',str(out/'rongboy-motion-v1.gif')],check=True)
keys=[(12,'IDLE'),(20,'ANTICIPATE'),(28,'JUMP'),(39,'LAND'),(50,'CHAIN JUMP'),(60,'REBOUND'),(82,'SETTLE'),(125,'GAME CAMERA')]
w,h,header=480,300,34;sheet=Image.new('RGB',(w*4,(h+header)*2),(233,225,203));draw=ImageDraw.Draw(sheet);font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Georgia.ttf',17)
for i,(f,label) in enumerate(keys):
 x=(i%4)*w;y=(i//4)*(h+header)
 with Image.open(frames/f'{f:04d}.png') as im:sheet.paste(im.resize((w,h),Image.Resampling.LANCZOS).convert('RGB'),(x,y+header))
 draw.text((x+12,y+8),label,font=font,fill=(57,60,44))
sheet.save(out/'motion-keyposes.jpg',quality=94)
with Image.open(frames/'0028.png') as im:im.save(out/'poster.png')
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_name,width,height,r_frame_rate,nb_frames:format=duration','-of','json',str(out/'rongboy-motion-v1.mp4')]))
(out/'video-verification.json').write_text(json.dumps({'rendered_frames':192,'fps':24,'codec_probe':probe,'review':'Key poses inspected for frame bounds, planted boots, arm/hat/backpack attachment. Final aesthetic and motion feel await user feedback.'},indent=2))
print(json.dumps(probe,indent=2))
