# Rongboy FPS

毛绒风的第一人称毛线球射击游戏：三张地图（家、博物馆、学校），任务制，纯键盘操作。全部用代码生成，构建出来每个页面是一个自带一切的 HTML 文件。

画面用 [cine-engine](https://github.com/xemaya/cine-engine) 渲染。引擎是这个仓库的子模块（`cine-engine/`），钉在一个确定的提交上。

## 运行

```bash
git clone --recurse-submodules <这个仓库>
npm ci
npm run build                                           # 生成 dist/*.html
node scripts/build.mjs --serve --port 5192 rongboy-mission   # 边改边看
npm test                                                # 13 套检查
```

已经克隆但 `cine-engine/` 是空的：`git submodule update --init`。

| 页面 | 内容 |
|---|---|
| `dist/rongboy-mission.html` | 任务版，主体。`?level=house`（默认）、`museum`、`school`；`?level=training` 是九类僵尸的试战庭院，加 `&type=<兵种>` 只练一种 |
| `dist/rongboy-zombies.html` | 九类僵尸手办图鉴 |
| `dist/rongboy-figures.html` | 主角和僵尸的手办预览 |
| `dist/rongboy-shooter-fps.html` | 工坊版：60 秒生存，任务版的前身 |
| `dist/rongboy-shooter.html`、`dist/rongboy.html` | 更早的斜俯视射击和跳棋样板，留作对照 |

操作：WASD 移动，方向键转向和抬头低头，空格射击（按住：蓄力 / 连发 / 瞄准），数字键选枪，Q 轮换，R 换弹，Esc 暂停。

## 目录

```
cine-engine/            引擎子模块：渲染管线、Kit、形状工具、光照体积，以及毛绒 / 博物馆 / 学校零件库
scenes/rongboy-mission/ 任务版：关卡数据、规则、场景搭建、画面和输入。设计和验证记录在 DESIGN.md
scenes/rongboy-shooter-fps/  工坊版；任务版复用它的手办模型、声音和受击反馈
scenes/rongboy/、scenes/rongboy-shooter/   早期样板
tools/rongboy-zombies/、tools/rongboy-figures/   图鉴和手办预览页
library/games/          游戏自己的三维零件：手办运行时、武器和掩体、僵尸名录和姿势
assets/rongboy/         Blender 源文件和导出的 GLB（构建时内嵌进页面）
scripts/blender/        生成和导出手办的 Blender 脚本
scripts/build.mjs       打包；scripts/tests/ 检查
vendor/combo-hopper/    跳棋样板用的原规则快照，见其中的 PROVENANCE.md
docs/figures.md         手办造型的规则和检查记录
docs/readme-before-split.md   拆分前 cine-engine 的 README 里关于 Rongboy 的几节（各版本手办、图鉴、试战场的说明）
```

## 和引擎的分工

- **游戏仓库**：规则（感知、武器、弹药、伤害、任务结算）、关卡数据、手办和它们的动作、界面和声音。
- **引擎仓库**：怎么画（材质烘焙、阴影、后期）、怎么造（`Kit`、旋转体 / 变径管 / 融球）、怎么打光（光照体积），以及不含游戏规则的零件——沙发、展柜、课桌这些都在 `cine-engine/library/`。

游戏里引用引擎的写法是相对路径：`../../cine-engine/engine/index.js`、`../../cine-engine/library/structures/plush.js`。

**给游戏加一件新家具或新展品**：零件写在引擎仓库的 `library/` 里，补预览条目，在引擎仓库单独提交；然后回到这里 `git add cine-engine` 把子模块指到新提交。只在这里临时改子模块里的文件而不提交到引擎仓库，别人拉下来会对不上。

**升级引擎**：

```bash
git -C cine-engine fetch && git -C cine-engine checkout <提交>
npm run build && npm test
git add cine-engine && git commit
```

## 历史

这个仓库是 2026-11-16 从 `xemaya/cine-engine` 的 `codex/rongboy-woolball-fps` 分支拆出来的，历史按路径过滤后保留（`git log --follow` 可以追到拆分之前）。早期提交的说明里提到的 `engine/`、`library/surfaces/` 等路径，现在在 `cine-engine/` 下面。DESIGN.md 里引用引擎文件的地方同理。

## 已知状态

- 没有人完整打通过任何一张图，数值都是初值。
- 画面检查是在不出帧的隐藏面板里用同步推进的入口做的（`window.__rb`，见 `scenes/rongboy-mission/main.js` 末尾）；实时手感和帧率要在前台窗口确认。
- 九类僵尸里，爬行者、持盾者、炸弹客、弓手和两个首领目前只在试战庭院出现，三张地图里还没摆。
