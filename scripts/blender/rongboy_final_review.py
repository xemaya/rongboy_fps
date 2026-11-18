from pathlib import Path
from PIL import Image,ImageFont,ImageDraw
import base64,sys
out=Path('assets/rongboy/final-trio');v=Path(sys.argv[1])
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Songti.ttc',27)
heights=[1.70,2.03,2.07]
sheet=Image.new('RGB',(1200,535),'#eee4d2');d=ImageDraw.Draw(sheet);sections=[]
for i,(kind,name) in enumerate([('archer','弓手'),('boss-warden','守墓巨像'),('boss-leech','噬连兽')]):
    panel=Image.new('RGB',(1680,613),'#eee4d2');text=ImageDraw.Draw(panel)
    for x,t in [(420,name+' · 新定妆图'),(1260,'实际游戏模型')]:text.text((x,26),t,anchor='mm',font=font,fill='#384737')
    target=Image.open(out/'design'/f'{kind}.png').convert('RGB');target.thumbnail((832,540))
    panel.paste(target,((840-target.width)//2,54+(540-target.height)//2))
    for j,side in enumerate(['front','side','back']):
        im=Image.open(v/f'{kind}-{side}.png').convert('RGBA');im=im.crop(im.getbbox())
        if j==0:
            front=im.copy();front.thumbnail((386,int(heights[i]*208)),Image.Resampling.LANCZOS)
            sheet.paste(front,(400*i+(400-front.width)//2,458-front.height),front)
            d.text((400*i+200,494),name,font=font,anchor='mm',fill='#384737')
        im.thumbnail((274,520),Image.Resampling.LANCZOS);panel.paste(im,(840+280*j+(280-im.width)//2,578-im.height),im)
    path=out/f'{kind}-comparison.jpg';panel.save(path,quality=94)
    uri=base64.b64encode(path.read_bytes()).decode()
    sections.append(f'<section id="{kind}"><h2>{name}</h2><img alt="{name}的定妆与实模三视图" src="data:image/jpeg;base64,{uri}"><p><a href="rongboy-zombies.html?study=final&motion=1#{kind}">查看动作 ↗</a>　<a href="rongboy-play.html?level=training&study=final&type={kind}">进入试战 ↗</a></p></section>')
sheet.save(out/'front-lineup.jpg',quality=94)
(out/'rongboy-final-review.html').write_text('''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>弓手与两位 Boss</title><style>body{background:#f3ebde;color:#374636;margin:auto;max-width:1500px;padding:24px;font-family:Georgia,"Songti SC",serif}h1,h2{font-weight:500}img{width:100%;display:block}a{color:inherit}section{margin:32px 0}</style><h1>弓手与两位 Boss</h1><a href="rongboy-zombies.html?study=final&pair=1&motion=1">双 Boss 同屏动作 ↗</a>'''+''.join(sections)+'</html>')
