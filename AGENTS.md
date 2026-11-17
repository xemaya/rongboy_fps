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

## 想改玩法

先看 `docs/fun-design.md`（僵尸出题，枪是答案），改完跑 `node scripts/tests/rongboy-fun.mjs`。

## 通用

- 准则文档先于产出：`docs/` 下的三份准则（地图、玩法、开场片）改之前先看，改完把学到的写回各自的修订记录。
- `npm test` 要全过。规则层（`scenes/rongboy-mission/game.js`、`level.js`、`mapkit/`）不依赖 DOM，测试直接在 Node 里跑。
- 看 3D 画面：`node scripts/build.mjs --serve --port 5193 rongboy-mission`，打开 `rongboy-mission.html?level=<id>`。
- 交付时写清楚哪些是人看过、玩过的，哪些只有工具查过。工具查不出好不好看、好不好玩。
