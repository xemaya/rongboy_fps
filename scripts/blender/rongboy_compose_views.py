from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,sys
b=Path(sys.argv[1]);catalog=Path(__file__).resolve().parents[2]/'assets/rongboy/zombies-v6/catalog.json';specs=json.loads(catalog.read_text())['models'];font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Songti.ttc',26);small=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',16)
for spec in specs:
 sheet=Image.new('RGB',(1440,960),'#e8deca');d=ImageDraw.Draw(sheet)
 for i,v in enumerate(['front','side','back']):
  with Image.open(b/f'{spec["id"]}-{v}.png') as im:sheet.paste(im.convert('RGB'),(i*480,0),im.getchannel('A') if im.mode=='RGBA' else None)
  d.text((i*480+240,930),spec['name']+' / '+v,font=font,fill='#344336',anchor='mm')
 sheet.save(b/f'{spec["id"]}-three-views.jpg',quality=94)
for g in range(3):
 sheet=Image.new('RGB',(960,1920),'#e8deca')
 for i,spec in enumerate(specs[g*3:g*3+3]):
  with Image.open(b/f'{spec["id"]}-three-views.jpg') as im:sheet.paste(im.resize((960,640)),(0,i*640))
 sheet.save(b/f'group-{g+1}.jpg',quality=94)
print('nine model sheets and three overview groups created')
