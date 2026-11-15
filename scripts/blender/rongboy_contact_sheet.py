"""Layout only: assemble four unchanged Blender renders for visual review."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
root=Path(__file__).resolve().parents[2]/'assets/rongboy/scout-v1/renders'
w=660;header=56
sheet=Image.new('RGB',(w*2,(w+header)*2),(235,228,210));draw=ImageDraw.Draw(sheet)
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Georgia.ttf',25)
for i,(name,label) in enumerate([('front','01 / FRONT'),('side','02 / PROFILE'),('rear','03 / REAR'),('game','04 / GAME CAMERA')]):
 x=(i%2)*w;y=(i//2)*(w+header)
 with Image.open(root/(name+'.png')) as im:sheet.paste(im.convert('RGB').resize((w,w),Image.Resampling.LANCZOS),(x,y+header))
 draw.text((x+22,y+15),label,font=font,fill=(65,67,48))
sheet.save(root/'views.jpg',quality=94,subsampling=0)
print(root/'views.jpg')
