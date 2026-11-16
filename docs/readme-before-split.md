# 拆分前 README 里关于 Rongboy 的部分

下面是 2026-11-16 拆分时 `xemaya/cine-engine` 的 README 里 Rongboy 的几节，原样保存。里面的命令和路径在这个仓库里仍然可用；
提到 `library/games/` 以外的 `library/...`、`engine/...` 的地方，现在在 `cine-engine/` 下面。当前的说明以根目录的 README 为准。

---

## Rongboy 单关展现样板（视觉候选）

原 Combo Hopper / Rongboy 第 7 关，固定长脚道具，沿用原规则快照，新增三维拼布舞台、程序化玩偶、行动和敌方回合预览。生成的目标图与实际运行截图分别保存；目前玩偶造型低于目标图精度，等待视觉与手感评价。

```bash
node scripts/build-rongboy.mjs rongboy
PORT=5188 node scripts/build.mjs --serve rongboy
node scripts/tests/rongboy.mjs
```

产物 `dist/rongboy.html`。原版同关对照、规则验证与性能测量条件见 [样板设计与验收](scenes/rongboy/DESIGN.md)。新零件候选位于 `library/games/rongboy.js`，适用于 1 米格距的高位战术镜头，尚未声明为通用人物系统。

## Rongboy 毛绒球射击试玩

当前版本为纯键盘第一人称：WASD 相对视角移动，方向键转动视线，空格点射/长按蓄力松开发射，Enter 开始或继续，Esc 暂停，R 重开。无需鼠标、指针锁定或触摸板。

```bash
node scripts/build.mjs rongboy-shooter-fps
PORT=5192 node scripts/build.mjs --serve rongboy-shooter-fps
node scripts/tests/rongboy-shooter-fps.mjs
```

单文件 `dist/rongboy-shooter-fps.html` 已内嵌 Blender 原模型的实时副本和烘焙纹理。原斜俯视射击 `rongboy-shooter`、跳棋 `rongboy` 及离线手办版本保留。玩法与验证范围见 [设计记录](scenes/rongboy-shooter-fps/DESIGN.md)。实时与 Cycles 离线画面分别评价，当前仍为手感样板。


射击当前包含三种蹦跳僵尸、七处高低掩体、三把不同声效/后坐/击退的毛球枪。1 / 2 / 3 选择武器，Q 轮换；所有球弹持续反弹，每次有效接触扣 1 血。

```bash
npm ci
node scripts/tests/rongboy-shooter-fps.mjs
node scripts/tests/rongboy-feedback.mjs
node scripts/tests/rongboy-walker-rig.mjs
```

手办原生 Blender 文件、生成/导出脚本与内嵌 GLB 一起保存在仓库中；渲染帧缓存不提交。源文件位于 `assets/rongboy/`，三维道具位于 `library/games/rongboy-workshop.js`。新页面的 `dist/rongboy*.html` 由构建脚本生成。


### Rongboy 大工坊更新（2026-11-16）

地图扩大到 19.2 × 14.4m，14 处高低掩体；初始 6 只、最多 14 只僵尸，新增侧跳型和带预告/可打断的扑击型。毛球最多反弹三次，第三次结算伤害后散开。三把武器、第一人称和纯键盘操作保持；动作与碰撞测试运行 `node scripts/tests/rongboy-yard.mjs`，当前规则见 `scenes/rongboy-shooter-fps/DESIGN.md`。

### 原生角色手办 V2（2026-11-16）

`assets/rongboy/scout-v2/` / `walker-v2/` 保存派生 Blender 源模型，`runtime-v2/` 保存干净基础色与微绒纹的 GLB；旧版保留。任务版和工坊版复用这套模型；独立预览 `node scripts/build.mjs rongboy-figures` 后打开 `dist/rongboy-figures.html`，1/2/3/4 切换双人/绒仔/僵尸/背面，空格看动作。6 项新资产检查：`node scripts/tests/rongboy-figures-v2.mjs`。细节见 `tools/rongboy-figures/DESIGN.md`。


### 僵尸模型名录 V5（2026-11-16）

当前为 V5 九类原生针毡僵尸：跳跳、跃行者、棉甲、爬行者、持盾者、炸弹客、弓手、守墓巨像、噬连兽。以原 V2 跳跳为风格基准，其余八类分别制作身体结构；召唤巢移除，快跳/侧跳/扑扑合并。图鉴 `rongboy-zombies.html` 支持正侧背和动作；Blender 全员源与 GLB 在 `assets/rongboy/zombies-v5/`，生成器 `scripts/blender/rongboy_zombies_v5.py`，旧版本保留。

`rongboy-mission.html?level=training` 为九类试战庭院，含巨像两只封存守卫共 11 个固定目标；图鉴可进入单类练习。炸弹客抛投毛线炸弹、落地延时爆炸；弓手搭箭/拉弦并发射实体软头箭。仍用 WASD、方向键、空格与 R 换弹。构建 `node scripts/build.mjs rongboy-mission rongboy-zombies`；模型/攻击检查见 `scripts/tests/rongboy-zombie-roster.mjs`、`scripts/tests/rongboy-attacks.mjs`。当前为视觉与攻击候选，尚待审美和数值反馈。
