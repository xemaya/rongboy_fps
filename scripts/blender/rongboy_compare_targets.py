from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,base64,io,hashlib
R=Path(__file__).resolve().parents[2];B=R/'scenes/rongboy-mission/review/zombies-v6';OUT=B;OUT.mkdir(parents=True,exist_ok=True);specs=json.loads((R/'assets/rongboy/zombies-v6/catalog.json').read_text())['models']
notes={
'walker':['保留原V2头脸、四肢和整体轮廓','按目标增加衣领、衣边、后背的浅色缝合线','以目标羊毛纹理烘焙微法线，颜色保持恒定'],
'leaper':['按宽扁头比例调整头部并保留短颈','加深折膝/踝的折线，补连续连接与长脚掌','按图增加膝补片、交叉线、腿缝和软鞋底'],
'heavy':['按图改成前、侧、背包覆的鼓起绗缝格','浅燕麦/灰褐三排分色，边缘厚包条','保留小头、梨形躯干和短粗腿'],
'crawler':['缩短腹背，保持低伏四肢支撑的比例','补前臂缝补片，背缝改为贴面的浅色线','掌、肘、肩连接保持连续，避免漂浮线'],
'shielded':['校准长椭圆头比例，保持偏肩大盾结构','按图增加两道前臂绑带与盾后握持环','补肩部修补片，盾面缝线贴合实际曲面'],
'bomber':['按图改为水平三连携弹袋和真实支撑背板','保留圆腹短腿，增加肩带和腰带','弹体改金色多层绕线及浅色软引线'],
'archer':['缩短头部、显出长颈与细长身体比例','竖长箭袋、斜肩带和切片式箭羽','加长弓弧，保持弦端、搭箭点和拉弦手连接'],
'boss-warden':['校准肩宽与小头比例，保留沉肩巨臂','锁片加厚，补锁孔、绣边和厚软提环','前后片缝合与大补线按目标布置'],
'boss-leech':['按图修窄拉长头部，保留长身短腿','吸盘重做成中空杯壁和凹面，移除填满杯内的凸面','加粗卷边，补肩修片及贴面的纵向修补线']}
records=[];font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Songti.ttc',30)
def uri(path):
 with Image.open(path) as im:
  im=im.convert('RGB');im.thumbnail((1050,700));f=io.BytesIO();im.save(f,format='JPEG',quality=88)
 return 'data:image/jpeg;base64,'+base64.b64encode(f.getvalue()).decode()
for spec in specs:
 sid=spec['id'];target=R/'assets/rongboy/zombies-v6/design'/f'{sid}.png';actual=B/'after'/f'{sid}-three-views.jpg'
 notes[sid]=['本轮：按目标校正橄榄绿、暖棕与燕麦色；补贴面交叠短纤维。']+notes[sid]
 record={'id':sid,'name':spec['name'],'notes':notes[sid],'target':uri(target),'actual':uri(actual),'before':uri(B/'material-before'/f'{sid}-three-views.jpg')};records.append(record)
 c=Image.new('RGB',(1920,710),'#eee4cf');d=ImageDraw.Draw(c)
 for k,p in enumerate([target,actual]):
  with Image.open(p) as im:im=im.convert('RGB');im.thumbnail((960,640));c.paste(im,(k*960+(960-im.width)//2,50+(640-im.height)//2))
 d.text((480,25),spec['name']+' · AI 三视图目标',font=font,fill='#344b3e',anchor='mm');d.text((1440,25),spec['name']+' · 实际 3D 模型',font=font,fill='#344b3e',anchor='mm');c.save(OUT/(sid+'-comparison.jpg'),quality=93)
html='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>绒仔 · AI目标与模型对照</title><style>*{box-sizing:border-box}body{margin:0;background:#f3ecd9;color:#344b3e;font-family:Georgia,'Songti SC',serif}main{max-width:1450px;margin:auto;padding:28px;display:grid;grid-template-columns:190px 1fr;gap:25px}h1{font-weight:500;margin:0 0 15px}aside button{display:block;text-align:left;border:0;background:none;padding:11px;width:100%;font:17px Georgia,serif;color:inherit;cursor:pointer}aside button.active{background:#d9dfc4;border-left:3px solid #6a825d}.frame{background:#eee4cf;border:1px dashed #c8bea1;padding:14px;margin:16px 0}.frame img{width:100%;display:block;max-height:690px;object-fit:contain}.frame h2{font-size:15px;margin:5px 0 12px;font-weight:500}p,li{font-size:13px;line-height:1.8;color:#6c755f}ul{padding-left:20px}a{color:#63765a}button:focus-visible,a:focus-visible{outline:2px solid #bd974e;outline-offset:3px}.compare{display:grid;grid-template-columns:1fr 1fr;gap:12px}.compare.stack{display:block}#layout,#previous{font:12px Georgia,serif;color:#617355;border:1px solid #beb79a;background:transparent;padding:6px 12px;cursor:pointer}@media(max-width:760px){main{grid-template-columns:1fr;padding:16px}aside{display:block;border-bottom:1px solid #c8bea1;padding-bottom:12px}#choices{display:flex;flex-wrap:wrap;gap:5px}aside button{width:auto;font-size:13px;padding:7px}.compare{grid-template-columns:1fr}.frame{padding:7px}}</style><main><aside><h1>九类僵尸</h1><nav id="choices"></nav><p>先生成目标，再修模型。</p><a href="rongboy-zombies.html">旋转查看实际模型 ↗</a><p><a href="rongboy-mission.html">返回游戏 ↗</a></p></aside><section><h1 id="title"></h1><button id="layout">上下大图</button> <button id="previous">查看上一版模型</button><ul id="notes"></ul><div class="compare" id="compare"><div class="frame"><h2>AI 生图目标 · 正 / 侧 / 背</h2><img id="target"></div><div class="frame"><h2 id="actualLabel">本轮实际游戏模型 · 正 / 侧 / 背（展示姿势）</h2><img id="actual"></div></div><p>本轮新增贴面短纤维、专用毛毡纹理和逐只配色校准；精细针脚、布料褶皱与部分轮廓仍有差距。原图与原生模型均保留，等待审阅。</p></section></main><script>const rows=DATA;const $=id=>document.getElementById(id);$('layout').onclick=()=>{const stacked=$('compare').classList.toggle('stack');$('layout').textContent=stacked?'并排对照':'上下大图';};let selectedRow;function pick(id){const r=rows.find(x=>x.id===id)||rows[0];selectedRow=r;$('previous').textContent='查看上一版模型';$('actualLabel').textContent='本轮实际游戏模型 · 正 / 侧 / 背（展示姿势）';$('title').textContent=r.name;$('notes').replaceChildren(...r.notes.map(t=>{let e=document.createElement('li');e.textContent=t;return e;}));$('target').src=r.target;$('target').alt=r.name+'的AI正侧背目标图';$('actual').src=r.actual;$('actual').alt=r.name+'的实际3D正侧背视图';for(const b of $('choices').children)b.classList.toggle('active',b.dataset.id===r.id);history.replaceState(null,'','#'+r.id);}$('previous').onclick=()=>{const prev=$('previous').textContent==='查看上一版模型';$('actual').src=prev?selectedRow.before:selectedRow.actual;$('previous').textContent=prev?'返回本轮模型':'查看上一版模型';$('actualLabel').textContent=prev?'上一版模型 · 修毛绒与配色之前':'本轮实际游戏模型 · 正 / 侧 / 背（展示姿势）';};for(const r of rows){let b=document.createElement('button');b.textContent=r.name;b.dataset.id=r.id;b.onclick=()=>pick(r.id);$('choices').append(b);}pick(location.hash.slice(1)||rows[0].id);</script></html>'''.replace('const rows=DATA;','const rows='+json.dumps(records,ensure_ascii=False)+';')
(OUT/'rongboy-zombie-review.html').write_text(html)
(OUT/'fit-notes.json').write_text(json.dumps(notes,ensure_ascii=False,indent=2))
(OUT/'README.md').write_text('# AI 三视图 → 3D模型对照\n\n九类目标图先由内置 image_gen 生成，原图与实际提示词保存在 assets/rongboy/zombies-v6/design/。本目录的comparison图明确区分目标与实际3D。原始模型不是设计目标。\n\n本轮按图修改轮廓比例、接缝、护甲、携弹袋、弓箭与吸盘。精细绒毛和褶皱仍有差距，未宣称像素级一致或用户已认可。\n\n运行 tools/rongboy-zombies 的构建后打开 rongboy-zombie-review.html，可逐只查看。原生正侧背图片在 before/、after/，模型是游戏与图鉴实际共用的GLB。\n')
print('Target-versus-mesh gallery generated:',len(records),'models')
