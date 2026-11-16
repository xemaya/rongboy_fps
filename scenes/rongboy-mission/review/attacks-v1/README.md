# 十二类攻击初版验证

2026-11-16。`runtime-verification.json` 为页面 `#diagnostics` 的只读快照；操作均使用浏览器真实键盘和可见图鉴链接，没有调用调试推进、传送或状态注入。

- 弓手：预瞄后横移，箭经过旧位置，仍三心。
- 持盾者：普通球被挡，棉被炮破防，HP 7 → 2。
- 召唤巢：固定三个目标中，一只援兵激活，另一只仍封存。
- 巨像：震地蓄势后后退，恢复阶段仍三心。
- 炸弹客：蓄爆后后退，无伤清场；等待结果时最初匹配了旧标题，读取实际页面确认结果为「清空了！」。
- 噬连兽：实际发生拉近，横移脱离；`leech-warning.png` 展示最终加深的扇区边界。
- 混合场：十二个启用本体均绑定对应模型，四个封存援兵未建可见模型；移动开火后仍三心，16 个固定威胁。`mixed-court.png` 为该次暂停状态。

以上页面均读取到 errors=[]、shaderErrors=0。浏览器结果是单项机制与加载验证，未宣称人工打通混合场或完成数值平衡。绘制次数与三角面数为页面诊断，不是同步 GPU 性能基准。

回归命令（8 个脚本，共 97 项内部检查通过）：

```sh
node --test scripts/tests/rongboy-mission.mjs scripts/tests/rongboy-shooter-fps.mjs scripts/tests/rongboy-feedback.mjs scripts/tests/rongboy-yard.mjs scripts/tests/rongboy-figures-v2.mjs scripts/tests/rongboy-zombie-roster.mjs scripts/tests/rongboy-attacks.mjs scripts/tests/rongboy-walker-rig.mjs
node scripts/build.mjs rongboy-mission rongboy-zombies rongboy-shooter-fps rongboy-figures
```

之后仅加深预告颜色、为吸引扇区添加边界线，并在浏览器重新加载检查通过。规则与伤害未再修改。
