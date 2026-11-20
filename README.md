# Rongboy FPS

毛绒风的第一人称毛线球射击游戏：四张地图（家、博物馆、学校、奶奶家），任务制，键盘 / 手柄操作。全部用代码生成，构建出来每个页面是一个自带一切的 HTML 文件。

画面用 [cine-engine](https://github.com/xemaya/cine-engine) 渲染。引擎是这个仓库的子模块（`cine-engine/`），钉在一个确定的提交上。

## 运行

```bash
git clone --recurse-submodules <这个仓库>
npm ci
npm run build                                           # 生成 dist/*.html
node scripts/build.mjs --serve --port 5192 rongboy-mission   # 边改边看
npm test                                                # 23 套检查
node scripts/map.mjs                                    # 地图工具：出草图、检查、体检、俯视图（docs/map-guide.md）
```

已经克隆但 `cine-engine/` 是空的：`git submodule update --init`。

| 页面 | 内容 |
|---|---|
| `dist/rongboy-op.html` | 开场片《嘘——》（64 秒）。从这里进游戏：按任意键或手柄 ✕ 开始，Esc / 手柄任意键跳过，播完进主界面。默认放事先渲好的 `rongboy-op.mp4`，加 `?live=1` 实时渲染 |
| `dist/rongboy-mission.html` | 绒仔主菜单：选关、设置、练习、挑战簿。方向键或手柄十字键选，Enter / ✕ 确认，Esc / ○ 返回。挑战簿可直开三个短局，达标后在本浏览器盖章。`?level=house` 等直达选关，`?level=training` 直达兵种试战和模型招式预览 |
| `dist/rongboy-play.html` | 确认后的实际关卡页，先显示 loading，再直接进入第一人称；`?level=<id>` 选择关卡 |
| `dist/rongboy-play.html?level=weapon-range` | 练习里的武器试验场。键盘 1–6 试玩各把枪，3 探照灯炮、4 电网、6 毛衣针。G / 手柄十字键↓切换炸弹，E / L2 投掷。手柄 △ 切下一把试射武器。 |
| `dist/rongboy-zombies.html` | 九类僵尸手办图鉴 |
| `dist/rongboy-figures.html` | 主角和僵尸的手办预览 |
| `dist/rongboy-shooter-fps.html` | 工坊版：60 秒生存，任务版的前身 |
| `dist/rongboy-shooter.html`、`dist/rongboy.html` | 更早的斜俯视射击和跳棋样板，留作对照 |

操作（键盘）：WASD 移动，方向键转向和抬头低头，空格射击（按住：蓄力 / 连发 / 瞄准），Q 在两把枪之间换，E 扔毛线团（按住扔得更远），F 换脚边的枪，R 换弹，Shift 跳，Esc 暂停。结算页 Enter 再来一次、Esc 返回选图。

操作（PS5 手柄）：左摇杆移动，右摇杆转向 / 抬头低头，R2 射击（按住蓄力），L2 扔毛线团（按住扔得更远），R1 换弹，L1 换枪，□ 换地上的枪，✕ 跳，十字键左右直接选手枪 / 另一把，Options 暂停，✕ 确定 / 继续，○ 返回选图。结算页 ✕ 再来一次、○ 返回选图。选图页用十字键 / 左摇杆选，✕ 出发；开场片按 ✕ 开始，任意键跳过。

两套输入同时可用，屏幕提示会跟着最近用过的设备换。跳只是毛绒玩具蹦一下（镜头离地约 0.4 米），不替代枪和走位，也没有无敌帧。浏览器不把"按手柄"当成用户按键：只用手柄时，声音可能要先按一下键盘或点一下画面才出来（页面会提示）。

手柄连接：macOS 蓝牙里配对 "Wireless Controller"（按住 PS + Create 约 3 秒，灯条闪），或直接插 USB-C。Chrome / Safari 要等你按下手柄上的一个键，页面才拿得到它；按下后 HUD 的按键提示会换成手柄的。图鉴页也能用手柄（十字键切角色、✕ 动作、△ 细节、○ 全体）；手办预览工具和早期样板页仍是键盘。

## 目录

```
cine-engine/            引擎子模块：渲染管线、Kit、形状工具、光照体积，以及毛绒 / 博物馆 / 学校零件库
scenes/rongboy-mission/ 任务版：关卡数据、规则、场景搭建、画面和输入，菜单在 main.js，关卡在 play.js。设计和验证记录在 DESIGN.md
scenes/rongboy-op/      开场片：分镜和走位（film.js）、摆手办的工具、片名卡、声音。用的是任务版的场景、手办、枪和特效
scenes/rongboy-shooter-fps/  工坊版；任务版复用它的手办模型、声音和受击反馈
scenes/rongboy/、scenes/rongboy-shooter/   早期样板
tools/rongboy-zombies/、tools/rongboy-figures/   图鉴和手办预览页
library/games/          游戏自己的三维零件：手办运行时、武器和掩体、僵尸名录和姿势
assets/rongboy/         Blender 源文件和导出的 GLB（构建时内嵌进页面）；op/ 里是开场片的配乐和渲好的 mp4
scripts/blender/        生成和导出手办的 Blender 脚本
scripts/build.mjs       打包；scripts/tests/ 检查；scripts/op/ 生成配乐、导出开场片
vendor/combo-hopper/    跳棋样板用的原规则快照，见其中的 PROVENANCE.md
docs/figures.md         手办造型的规则和检查记录
docs/op-design.md       开场片和主界面：准则、分镜表、对照检查、怎么改和怎么导出
docs/readme-before-split.md   拆分前 cine-engine 的 README 里关于 Rongboy 的几节（各版本手办、图鉴、试战场的说明）
```

## 开场片

每一帧都由引擎画，没有用生视频模型。配乐是 MiniMax 生成的（`scripts/op/music.mjs`，要 `MINIMAX_API_KEY`），音效是程序合成的。

```bash
npm run build
scripts/op/export.sh          # 逐帧渲成 assets/rongboy/op/rongboy-op.mp4，约五分钟；要 ego-browser 和 ffmpeg
```

改分镜、换配乐、看某一刻的画面，见 `docs/op-design.md` 第 3.5 节。

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
- 开场片没有人看过成片、听过声音（做的时候只能看静帧）；主界面的小场景和出发过渡也只看过静帧。
- 2026-11-20 性能一轮（`scenes/rongboy-mission/DESIGN.md` 的"性能"）：房子的影子只画一次、墙后的小物件不画、游戏里的手办减面、僵尸并成刚性蒙皮（一只 16 次绘制 → 4 次）；着色器、僵尸模板、找路的图都在载入时做好，玩的时候不再现编现建；找路分摊到多帧；清晰度调节先争 60 帧，到不了再保 30 帧。四张图的绘制次数降了一半左右。全是工具量的、静帧看的，**没有人在前台实时玩过，也没有在差一点的机器上跑过**。影子缓存改在了子模块 `cine-engine/` 里，要走 cine-engine 的 PR。
- 清晰度调节器换成了游戏自己的（`scenes/rongboy-mission/governor.js`）：原来目标 30 帧（2026-11-20 起先争 60 帧），先减像素数、保住抗锯齿和环境遮蔽，画面轻了会加回去。逻辑有模拟测试（`scripts/tests/rongboy-governor.mjs`），**但没有在前台窗口里实际跑过**：自动化用的浏览器窗口在后台，出帧被压到每秒一帧，量不了。在 Intel Mac（Radeon Pro 5300M，Retina 屏）上按同步测速推算，重的画面会停在约 100 万像素（1300×740 上下）、30 帧。测量和原因见 `scenes/rongboy-mission/DESIGN.md` 的"清晰度调节"。
- 第一人称的手和枪永远画在场景前面，不会再被墙、楼梯、窗帘吞掉（上一轮只靠缩小，没解决）；追人的僵尸贴墙时会把手收回来（只改画面）。没管的：僵尸的头比碰撞半径大，正对墙时脸还会蹭进墙；侧身贴墙时垂着的手也可能碰到墙。
- 画面检查是在不出帧的隐藏面板里用同步推进的入口做的（`window.__rb`，见 `scenes/rongboy-mission/main.js` 末尾）；实时手感和帧率要在前台窗口确认。
- 九类僵尸里，弓手、炸弹客、持盾者已经摆进各张地图，守墓巨像在"家"的阁楼；爬行者和噬连兽仍只在试战庭院出现。
- 2026-11-17 守墓巨像进了"家"的阁楼：拿起毛线篮的那一刻现身，不用打倒，跑出阁楼就甩掉（`docs/fun-design.md` 第 10 节，`scripts/tests/rongboy-warden.mjs`）。"奶奶家"成了第四张地图。都**没有人玩过**。
- 2026-11-17 每张图加了一种"打一下就生效"的机关（家是闹钟、学校是颜料桶、博物馆是聚光灯）、墙上的拉链暗格，布景被毛球打到会有反应（`docs/fun-design.md` 第 9 节）。规则有测试（`scripts/tests/rongboy-gadgets.mjs`），画面只看过静帧，声音没有人听过，**没有人玩过**。
- 2026-11-17 加了给 agent 用的地图工具（`docs/map-guide.md`、`scripts/map.mjs`、`scenes/rongboy-mission/mapkit/`）：写一份草图，工具算坐标，再用硬性检查和体检报告来改。"奶奶家"是用它做的（后来成了第四张地图）：3D 画面只看过静帧，**没有人玩过**。体检里的阈值是照现有三张图定的初值。
- 2026-11-16 按玩法准则（`docs/fun-design.md`）改了一轮：手里两把枪（Q 换）加单独一个键的手雷、每把枪只管一件事、弓手会算提前量、受伤有方向和棉絮。数值是按枪表和两个机器人（`scripts/tests/rongboy-fun.mjs`）定的初值，**没有人实际玩过这一版**；受伤的动画和声音只看过静帧。

- 2026-11-18：菜单与关卡初始化分离，去掉双人出发演出；补齐切到空弹匣时自动换弹。九类模型以 `image_gen` 三视图为目标修复至 V6，原图、提示词与图模对照见 `assets/rongboy/zombies-v6/design/` 和 `rongboy-zombie-review.html`。菜单/加载/开局以工具验证，尚未人工打通四张地图。
