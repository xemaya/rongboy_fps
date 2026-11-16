# 绒仔与僵尸手办 V2 · 2026-11-16

用户要求改进开场可见的绒仔杂色与僵尸细节。直接优化既有 Blender 原生手办，保留角色比例、帽子/围巾/背包、纽扣眼/歪牙和游戏动作轴。

- 色彩：绒仔暖燕麦脸、蜂蜜帽、砂色衣服、苔绿背包；僵尸干净鼠尾草绿、灰紫裤与栗褐背心。基础色为均匀 PBR 色块，取消脏斑式 albedo 噪声和拥挤的低分辨率色彩图集。
- 材质：共用 256 方形可平铺细绒法线，微弱凹凸和织物边缘柔光；保留少量更短细的轮廓绒毛。导入后以顶点色保留每种材料的基础色再合批，避免颜色串用。
- 几何：绒仔保持已认可外形，整理发梢/帽沿绒毛；僵尸加软眼窝，纽扣减薄、额头补丁圆边带厚度，嘴边细缝线、手掌和手指过渡更连贯。
- 拆解：原生 .blend、控制器、表情零件复用；新做材料/几何修订脚本、无色彩图集的 GLB 导出；`tools/rongboy-figures` 作为单独模型验收页。
- 镜头：中性纸色工作台，正面与三分之四全身；实际任务版开场保持同机位对照。原 v1 .blend / GLB 不覆盖，新源模型在 scout-v2 / walker-v2，运行模型在 runtime-v2。
- 验收：实际模型前后截图、原生关节和颜色/材质结构检查、运行时开场及伸手/跳跃。运行报错/性能与用户视觉认可分别记录。

## 实现与验收

- 新源文件：`assets/rongboy/scout-v2/rongboy-scout-v2.blend`、`assets/rongboy/walker-v2/rongboy-walker-v2.blend`。原 v1 文件和运行资产均未改写。新导出来自真实 Blender 网格，未用生成图替换人物。
- `scripts/blender/rongboy_refine_v2.py` 从 v1 派生，重建基础色与微法线、修整毛长、重做僵尸眼窝/补丁/嘴沿/手掌，并把浮在皮肤外的前臂缝线贴回表面。`--rebuild-normal` 可重建程序化细绒法线。native `.blend` 内保留贴图与姿态控制器。
- `scripts/blender/rongboy_export_clean.py` 不烘焙色彩图集，保留均匀的 PBR 基础色；闭合表面启用背面剔除、保持小零件平滑度；短绒毛单独导出。运行时将基础色写入顶点后合批，按相同纹理源和采样变换去重材质。不同 UV 重复方式不会误合批。
- 表面法线细节与轮廓绒毛分开处理。毛发三角形恢复生长方向，按视角淡出正面，降低脸、头发与衣服上的砂点感；actor 克隆保留 shader 回调。
- 新运行文件合计 6,755,656 bytes，原版为 11,980,916 bytes，减少约 44%。每个新 GLB 仅有一张 256px 微法线图，没有基础色色彩图集。
- 六项原生 V2 检查通过：合批保持色块、纹理采样差异不误合并、两模型的 PBR/纹理结构、精确网格世界坐标不变、11/6 个控制器及伸手转轴正常、毛发生长向量有效。原 v1 walker 关节检查也通过。25 项任务逻辑检查通过，任务版/工坊版/展示页均构建成功。
- 浏览器实际验收：正面、三分之四、背面与两人同台；动作按钮触发跳跃，记录 walker 离地约 .15m、手臂前伸角约 -1.16rad。开场同机位保存 before / after，页面与 shaderErrors 为 0；实际进入花园、移动、发射一枪（6→5）、R 开始换弹，仍为 3 心且无报错。
- 当前开场 medium / 内部 1469×826，约 121 draw calls / 348k triangles；这是当前机位诊断，不是同步 GPU 达标声明。精修后的视觉效果仍由用户判断。
- 截图与运行快照在 `scenes/rongboy-mission/review/figures-v2/`；原生 Cycles 参考图在各 v2 资产目录，与实时截图区分。

```bash
blender -b --python scripts/blender/rongboy_refine_v2.py -- scout --render
blender -b --python scripts/blender/rongboy_refine_v2.py -- walker --render
blender -b --python scripts/blender/rongboy_export_clean.py -- scout
blender -b --python scripts/blender/rongboy_export_clean.py -- walker
node scripts/tests/rongboy-figures-v2.mjs
node scripts/build.mjs rongboy-figures rongboy-mission rongboy-shooter-fps
```
