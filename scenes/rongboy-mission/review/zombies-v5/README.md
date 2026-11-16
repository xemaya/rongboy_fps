# V5 九类结构与攻击检查

用户指定原 V2 僵尸为风格锚点，否定 V4 光滑圆润娃娃与同体换装。当前九类：walker、leaper、heavy、crawler、shielded、bomber、archer、boss-warden、boss-leech。召唤巢移除，runner/weaver 仅作为旧数据兼容别名，归并到 leaper。

原始跳跳的六关节边界、网格顶点数和顶点色与 V2 自动核对一致。新八类分别建造头、躯干与四肢网格；共享布色与细绒法线，不共享同一具身体。V1/V2、历史 V3 与已弃用的 V4 文件保留。

`native-sheet-1/2/3.png`：原生 Blender 正、35 度、侧、背，以及对应黑剪影。检查中补上跃行者颈部、噬连兽肩部连接，按宽深修正爬行者取景。当前四向形体检查通过，审美仍待用户判断。

`*-front.png` / `*-detail.png`、`overview.png`、`style-and-weapons.png`：实际 cine-engine 图鉴截图；最后一张仅拼排三张舞台截图，没有生成或修饰模型。各单类进入时读取 ready=true、count=9、errors=[]、shaderErrors=0。弓手动作模式也读取到 moving=true 且无错误。

`runtime-verification.json`：真实键盘操作与页面只读诊断，未调用调试推进、传送或状态注入。

- 炸弹客在 1.675 秒进入投弹预告；3.608 秒的炸弹已经落地，余下约 0.89 秒引信；横移到 x=3.465 后在 4.717 秒读取三心、炸弹已爆开、投弹者仍活着。
- 弓手在 1.917 秒读取拉弓状态；后退后在 3.225 秒读取到飞行箭及三心。弓中心、弦端点、搭箭点和模型持弹手与规则释放位置均有检查。初次发现开场无瞄准坐标会使 lookAt 报错，已加有限值守卫和开场姿态回归，重新加载/拉弓/发箭通过。
- 九类混战进入、移动和开火后，九个本体 model==type，两只巨像守卫仍封存，11 个固定目标、三心、errors=[]、shaderErrors=0。未宣称人工打通混战或完成平衡。

检查命令：

```sh
node --test scripts/tests/rongboy-mission.mjs scripts/tests/rongboy-shooter-fps.mjs scripts/tests/rongboy-feedback.mjs scripts/tests/rongboy-yard.mjs scripts/tests/rongboy-figures-v2.mjs scripts/tests/rongboy-zombie-roster.mjs scripts/tests/rongboy-attacks.mjs scripts/tests/rongboy-walker-rig.mjs
node scripts/build.mjs rongboy-mission rongboy-zombies rongboy-shooter-fps rongboy-figures
/Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/blender/rongboy_zombies_v5.py -- --render
/Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/blender/rongboy_modelsheet.py -- v5 /tmp/rongboy-v5-sheets
```

最终 8 个检查脚本全部通过，共 99 项内部检查。绘制诊断只是观察数据，不是同步 GPU 帧预算结论。
