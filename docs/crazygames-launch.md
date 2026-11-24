# 绒仔 · CrazyGames 桌面首发计划

2026-11-19 · Basic Launch。目标是用现有四张正式地图参加平台测试，让第一次玩的人尽快开枪、理解毛球反弹，并愿意开始第二局。

## 第一轮范围

| 顺序 | 交付 | 验收 |
|---|---|---|
| 1 | 英文花园首局。复用花园和木板，依次安排易命中的跳跳、可借墙打的跳跳、持盾者。每段只给当前动作提示。 | 加载完成后直接能玩。第一只敌人开场可见，第二段能实际借墙命中，盾牌仍可用蓄力或绕后解决。首次命中目标 10 秒内，首局目标 2–3 分钟。 |
| 2 | 桌面鼠标、键盘和手柄。点击场地锁定鼠标，左键按既有点射及蓄力规则开火，Esc 释放并暂停。 | 键盘仍能用 WASD、方向键和空格独立走完整局。切屏、暂停和失去鼠标锁时清空按住的操作。平台版由宿主提供全屏。 |
| 3 | 首局到正式关卡的衔接。胜利后结算页给出下一关，失败可原地重开。英文覆盖菜单、操作提示、战斗提示、结果、设置以及跟进关卡。 | 首局胜利后下一次确认能进学校，再走现有四关。平台版默认英文。普通本地入口沿用中文。 |
| 4 | 独立 HTML5 发布包。根入口进花园，首玩只下载所需模型。接 v3 SDK 的加载与玩法生命周期。 | 能从非根路径部署。首次可操作前目标低于 20 MB。离线或 SDK 加载失败时可本地试玩。用 821×462 和 907×510 嵌入窗验证 UI、键鼠和结算。 |

首发为桌面横屏。首轮完成后补主线最佳星级及继续游戏，再准备三尺寸封面、横竖两版实机预览、英文简介及操作说明。提交之前用正式平台预览和至少一位第一次玩的玩家复查以上目标；低配 Chromebook 和 Edge 单独验证。

## 平台和变现

- Basic Launch 看首分钟转化、平均游玩时长、次日留存。从 2026-11-23 起开启或重启的测试也看封面点击率。开发者后台更新后，按玩家在哪里离开的线索决定下一次调整。 [Basic Launch 指标](https://docs.crazygames.com/resources/basic-launch-metrics/)
- Basic Launch 使用最小 SDK，不请求广告。Full Launch 有资格后，先在已经完成一关、玩家选择继续的时候接中途广告。游戏暂停、声音暂停和继续游戏应当跟随真实广告回调。奖励广告留待看完数据后评估。 [发布流程](https://docs.crazygames.com/) · [广告要求](https://docs.crazygames.com/requirements/ads/)
- 发布包核对英文、相对资源路径和全屏入口。上传先走 Developer Portal 的 Preview，再单独提交审核。 [技术要求](https://docs.crazygames.com/requirements/technical/) · [玩法要求](https://docs.crazygames.com/requirements/gameplay/)
- 封面横版 1920×1080、竖版 800×1200、方版 800×800。预览横竖各一版，15–20 秒，第一段优先拍借墙弹球。 [封面与预览规格](https://docs.crazygames.com/requirements/game-covers/)
- 收款走 Developer Portal 的 Account → Billing。累计未付收入达到 €100 才会付款。 [付款说明](https://docs.crazygames.com/payouts/)

## 构建与验收记录

运行 `npm run build:crazygames`。输出为 `dist/rongboy-crazygames.zip`，压缩包根目录的 `index.html` 打开主菜单。Play 进入选关，确认后才加载 `rongboy-play.html`。花园首战仍可在选关中选到。同一份包可解压到任意相对路径测试。日常本地构建仍用 `npm run build`。

首轮压测使用 ZIP 解压后的文件。在 Chrome 的 821×462 和 907×510 嵌入窗口测试首局。开局只加载花园模型、播放页、加载背景和界面 CSS，四项合计约 10.8 MB，另有 SDK 请求。其他关卡共用一个角色模型包。托管平台以首次 `gameplayStart` 为首包计量点。

Chrome 自动化检查覆盖鼠标锁定、转身、左键射击和释放后的暂停，另用键盘验证了首局两只跳跳、木板反弹、蓄力打盾和胜利后进入学校。SDK 正式脚本已在 localhost 初始化，生命周期用测试替身核对了调用顺序。平台正式 Preview、低配 Chromebook、Edge 和首次玩家盲测仍需验收。

## 完整版语言

设置的语言选项为自动、简体中文、English。同一份包包含两种语言，手动选择保存在本机设置中，沿用原存档。CrazyGames 的自动选项读取 SDK 的 `user.systemInfo.locale`，中文地区显示简体中文，其他未支持的语言回退英文。本地自动选项参考浏览器语言。兵种模型页继承菜单语言。 [CrazyGames 语言要求](https://docs.crazygames.com/requirements/gameplay/)
