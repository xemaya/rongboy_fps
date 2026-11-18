"""Pack the new and preceding native render sheets into the offline comparison page."""
import base64
import io
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root=Path(__file__).resolve().parents[2]
old=root/'scenes/rongboy-mission/review/zombies-v6/after'
out=root/'scenes/rongboy-mission/review/zombies-v7'
out.mkdir(exist_ok=True)
renders=Path(sys.argv[1])
roster=json.loads((root/'assets/rongboy/zombies-v7/catalog.json').read_text())['models']
def embed(path):
    with Image.open(path) as image:
        image.thumbnail((1000,700))
        buf=io.BytesIO()
        image.save(buf,'JPEG',quality=88)
        return 'data:image/jpeg;base64,'+base64.b64encode(buf.getvalue()).decode()
rows=[]
lineup=Image.new('RGB',(1470,476),'#e8deca')
draw=ImageDraw.Draw(lineup)
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Songti.ttc',23)
for i,spec in enumerate(roster):
    kind=spec['id']
    sheet=f'{kind}-three-views.jpg'
    rows.append(dict(id=kind,name=spec['name'],role=spec['role'],current=embed(renders/sheet),previous=embed(old/sheet)))
    if i<7:
        with Image.open(renders/f'{kind}-front.png') as frame:
            crop=frame.crop(frame.getbbox());target_h=int(378*spec['height']/1.76)
            crop.thumbnail((200,target_h),Image.Resampling.LANCZOS)
            lineup.paste(crop,(i*210+(210-crop.width)//2,408-crop.height),crop)
        draw.text((i*210+105,444),spec['name'],font=font,fill='#344336',anchor='mm')
lineup.save(out/'walker-family.jpg',quality=92)
page="""<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>跳跳家族与独立 Boss</title>
<style>*{box-sizing:border-box}body{margin:auto;padding:24px;max-width:1480px;color:#344438;background:#f4eddf;font-family:Georgia,'Songti SC',serif}h1{font-size:26px}nav{display:flex;gap:5px;flex-wrap:wrap}button,select,a{font:inherit;color:inherit}button,select{background:#faf5e9;border:1px solid #bdb9a5;padding:6px 10px;border-radius:4px}button[aria-pressed=true]{background:#667559;color:white}section{display:grid;grid-template-columns:1fr 1fr;gap:12px}figure{margin:0}figcaption{margin:10px 0}img{display:block;width:100%}p{line-height:1.6}@media(max-width:750px){section{grid-template-columns:1fr}}</style>
<h1>跳跳家族与独立 Boss</h1><nav aria-label="选择角色"></nav><h2></h2><p id="role"></p>
<section><figure><figcaption><select aria-label="对照来源"><option value="previous">上一版模型</option><option value="walker">跳跳母型</option></select></figcaption><img id="ref" alt="参考模型三视图"></figure>
<figure><figcaption>本轮游戏模型</figcaption><img id="now" alt="当前模型正面、侧面和背面"></figure></section><p><a id="live">查看实际模型与动作 ↗</a></p>
<script>const rows=DATA;const $=s=>document.querySelector(s);let row;function pick(id){row=rows.find(x=>x.id===id)||rows[0];location.hash=row.id;$('h2').textContent=row.name;$('#role').textContent=row.role;$('#now').src=row.current;$('#ref').src=$('select').value==='walker'?rows[0].current:row.previous;$('#live').href='rongboy-zombies.html#'+row.id;for(const b of $('nav').children)b.setAttribute('aria-pressed',String(b.dataset.id===row.id));}for(const r of rows){const b=document.createElement('button');b.textContent=r.name;b.dataset.id=r.id;b.onclick=()=>pick(r.id);$('nav').append(b);}$('select').onchange=()=>pick(row.id);onhashchange=()=>pick(location.hash.slice(1));pick(location.hash.slice(1));</script></html>"""
(out/'rongboy-zombie-review.html').write_text(page.replace('const rows=DATA','const rows='+json.dumps(rows,ensure_ascii=False)))
