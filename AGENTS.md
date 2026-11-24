# 给在这个仓库里干活的 agent

绒仔（Rongboy）：毛绒风第一人称毛线球射击，纯键盘，核心用户是轻度休闲玩家。引擎是子模块 `cine-engine/`，不要改它。

## 想加一张地图

看 `docs/map-guide.md`。你只写一份草图，坐标由工具算：

```
node scripts/map.mjs draft <id> --theme school --rooms 5 --seed 3   # 出初稿
node scripts/map.mjs check <id>                                    # 硬性检查，有 ERR 不能合入
node scripts/map.mjs review <id>                                   # 体检：数字、机器人、带坐标的建议
node scripts/map.mjs preview <id>                                  # 俯视图
```

示例：`scenes/rongboy-mission/levels/cottage.js`（奶奶家，第四张地图，整张图是用这套工具写的）。新图先不进游戏里的地图列表，进不进由项目负责人定。

## 想做分段推进的关卡（一段一件事、门、首领）

看 `docs/park-design.md` 第 1 节和现成的那一关 `scenes/rongboy-mission/amusement.js`（布偶游乐园）。能直接用的：

- `stages.js`：一关分几段、路上的门、从这一段重来。`mech.js`：能被急冻枪定住的机关（门栓、阀门、靶子）。
- `track.js`：轨道（`planTrack` 用直线和圆弧算控制点，`trackSchedule` 照坡度和弯道算车速）；`node scripts/track.mjs` 体检。
- `node scripts/map.mjs check amusement`：小径地图的硬性检查（关卡里写 `path`）。

## 用脚本看画面、量开销

开发页（`node scripts/build.mjs --serve --port 5193 rongboy-play`，打开 `rongboy-play.html?level=<id>&debug=1`）里有 `window.__rb`，用任何能在页面里跑 JS 的工具都行：

```js
__rb.start(); __rb.hold = true;                 // 开局；之后时间只由 advance() 推进
__rb.teleport(x, z, yaw, pitch); __rb.advance(1 / 60); __rb.interact(); __rb.lookAt(x, y, z); __rb.shoot();
await __rb.shot('name');                        // 存成 shots/name.jpg（玩家的眼睛）
await __rb.shot('name', { pos: [x, y, z], look: [x, y, z] });   // 自由机位
__rb.cost();                                    // 沿路站一遍找最重的视角；返回 { at, of } 就再调，直到返回 { views, worstCalls, worstTris }
__rb.costParts();                               // 眼前这一帧是谁占的
__rb.snapshot();                                // 规则层的状态
```

布偶游乐园加 `&checkpoint=N`（0–9）从第 N 站开局。一次调用别超过十来秒（有的工具会当成卡死）：截图一次两张以内，`cost()` 自己会分段。

## 想改玩法

先看 `docs/fun-design.md`（僵尸出题，枪是答案），改完跑 `node scripts/tests/rongboy-fun.mjs`。

## 通用

- 准则文档先于产出：`docs/` 下的三份准则（地图、玩法、开场片）改之前先看，改完把学到的写回各自的修订记录。
- `npm test` 要全过。规则层（`scenes/rongboy-mission/game.js`、`level.js`、`mapkit/`）不依赖 DOM，测试直接在 Node 里跑。
- 看 3D 画面：`node scripts/build.mjs --serve --port 5193 rongboy-mission`，打开 `rongboy-mission.html?level=<id>`。
- 交付时写清楚哪些是人看过、玩过的，哪些只有工具查过。工具查不出好不好看、好不好玩。
