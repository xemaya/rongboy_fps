# AI 三视图 → 3D模型对照

九类目标图先由内置 image_gen 生成，原图与实际提示词保存在 assets/rongboy/zombies-v6/design/。本目录的comparison图明确区分目标与实际3D。原始模型不是设计目标。

本轮按图修改轮廓比例、接缝、护甲、携弹袋、弓箭与吸盘。精细绒毛和褶皱仍有差距，未宣称像素级一致或用户已认可。

运行 tools/rongboy-zombies 的构建后打开 rongboy-zombie-review.html，可逐只查看。原生正侧背图片在 before/、after/，模型是游戏与图鉴实际共用的GLB。
