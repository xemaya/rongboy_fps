import { crazyGames, crazyGamesLocale } from './platform.js';
import { LANGUAGE_CHOICES, readPreferences } from './preferences.js';

export function urlLanguage() {
  const value = new URLSearchParams(globalThis.location?.search).get('lang');
  return LANGUAGE_CHOICES.includes(value) ? value : null;
}

export function resolveLanguage(preference, {platform = false, locale} = {}) {
  if (preference === 'zh-CN' || preference === 'en') return preference;
  const base = typeof locale === 'string' ? locale.trim().toLowerCase().split(/[-_]/)[0] : '';
  if (base === 'zh') return 'zh-CN';
  if (base === 'en' || platform) return 'en';
  return 'zh-CN';
}

const languagePreference = () => urlLanguage() ?? readPreferences().language;
const browserLocale = () => !crazyGames && globalThis.document ? globalThis.navigator?.language : undefined;
export let language = resolveLanguage('auto', {platform:crazyGames});
let staticMarkup;

function paintLanguage() {
  document.documentElement.lang = language;
  // Capture the authored markup before application components render. It can
  // then be repainted when the platform locale arrives during loading.
  staticMarkup ??= (() => {
    const nodes = [], attributes = [];
    const walker = document.createTreeWalker(document.documentElement,NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const value = node.nodeValue.trim();
      if (!value || node.parentElement.closest('script,style') || english(value) === value) continue;
      nodes.push([node,node.nodeValue,value]);
    }
    for (const node of document.querySelectorAll('[aria-label],[title],[alt],[placeholder]')) {
      for (const name of ['aria-label','title','alt','placeholder']) {
        const value = node.getAttribute(name);
        if (value && english(value) !== value) attributes.push([node,name,value]);
      }
    }
    return {nodes,attributes};
  })();
  for (const [node,raw,value] of staticMarkup.nodes) node.nodeValue = raw.replace(value,() => t(value));
  for (const [node,name,value] of staticMarkup.attributes) node.setAttribute(name,t(value));
}

export async function initializeLanguage({platformLocale = true, waitForPlatformLocale = false} = {}) {
  const preference = languagePreference();
  const usePlatformLocale = crazyGames && platformLocale && preference === 'auto';
  if (!usePlatformLocale || !waitForPlatformLocale) {
    language = resolveLanguage(preference, {platform:crazyGames, locale:browserLocale()});
    paintLanguage();
  }
  if (usePlatformLocale) {
    const locale = await crazyGamesLocale();
    if (preference !== languagePreference()) return;
    language = resolveLanguage(preference, {platform:true, locale});
    paintLanguage();
  }
}

const words = {
  '布偶游乐园':'Plushwood Park',
  '布偶游乐场':'Plushwood Park','马戏帐篷':'Big Top','嬉笑小丑':'Giggles the Clown',
  '售票广场':'Ticket Plaza','过山车区':'Coaster','木马广场':'Carousel Plaza','游戏摊街':'Midway','后台仓库':'Backstage',
  '逐区夺回游乐场，最后挑战嬉笑小丑':'Reclaim the park and face Giggles in the big top',
  '从售票口开始。清完每区的守卫，完成当地的机关目标，下一道门就会打开。':
    'Start at the ticket plaza. Clear each area and complete its objective to open the next gate.',
  '游乐场重新亮灯了！':'The park lights are back!','操作设施':'Use ride',
  '重打嬉笑小丑':'Retry Giggles','从当前区域重试':'Retry this area','已开的闸门会保留。':'Open gates stay open.','可从帐篷入口重试':'Retry from the big top entrance',
  '上车后可以边坐边打。':'You can fire while riding.',
  '院子里的三波': 'Three waves in the yard', '院子里的对照局': 'All at once in the yard',
  '院子波次': 'Yard waves', '院子对照局': 'All at once',
  '果园波次': 'Orchard waves', '果树行': 'Orchard Rows', '晾晒场': 'Drying Yard', '果料仓': 'Fruit Barn',
  '奶奶家 · 果园保卫战': 'Grandma’s Place · Orchard Defense', '清理果园的三波僵尸': 'Clear three waves in the orchard',
  '先清果树行，再去晾晒场，最后到果料仓迎战噬连兽。两波之间有时间换弹。': 'Clear the orchard rows, then the drying yard. Face the Chain Eater in the fruit barn. Take time to reload between waves.',
  '果园守住了！': 'Orchard secured!', '进入果园': 'Enter the orchard',
  '三波僵尸会从树篱两侧出来。打完一波，有三秒换弹或挪位置。': 'Clear three waves in the yard. Take three seconds to reload or move between waves.',
  '这局的九只僵尸开场就会行动。院子、补给和敌人与三波版相同。': 'All nine zombies are active from the start, with the same yard, supplies, and enemy roster as the wave trial.',
  '打完院子里的三波僵尸': 'Clear all three waves in the yard', '打倒院子里的九只僵尸': 'Knock out all nine zombies in the yard',
  '三波都打完了！': 'All three waves cleared!', '院子清理完毕！': 'Yard cleared!',
  '当前任务': 'Objective', '出发前': 'Before you go', '出发': 'Go',
  '从门厅尽头上楼，到三楼藏宝间拿回毛线篮，再带回院门。途中可以绕过僵尸。': 'Take the stairs at the end of the hall. Find the yarn basket in the attic and bring it back to the gate. You can sneak past the zombies.',
  '去三楼藏宝间找毛线篮 · 楼梯在门厅尽头': 'Find the attic yarn basket · Stairs at the end of the hall',
  '守墓巨像醒了 · 躲开震地，带篮子下楼': 'The Grave Guardian is awake · Dodge the slam and take the basket downstairs',
  '常用操作': 'Quick controls', '全部按键': 'All controls', '返回暂停': 'Back to pause',
  '开火': 'Fire', '开火 / 蓄力': 'Fire / charge', '左键': 'LMB',
  '语言': 'Language', '开始游戏': 'Play', '下一关': 'Next level',
  '花园首战': 'The Garden', '清空花园': 'Clear the garden', '花园清理完毕！': 'Garden cleared!',
  '左键开火': 'Left click to fire', '按 R2 开火': 'Tap R2 to fire',
  'WASD 移动 · 点击用鼠标瞄准，或用方向键和空格': 'WASD to move · Click to aim, or use arrows + Space',
  '瞄准墙板上的圆环，让毛球反弹': 'Aim at the ring on the board to bank a woolball',
  '按住开火蓄力破盾，或绕到背后': 'Hold fire to break the shield, or circle behind it',
  '反弹命中！': 'Bank shot!', '无法锁定鼠标 · 可用方向键和空格': 'Mouse capture unavailable · Use arrow keys and Space',
  '鼠标': 'Mouse', '鼠标左键': 'LMB',
  '切到原手感': 'Switch to original feel', '切到新手感': 'Switch to revised feel',
  '模型文件未找到': 'Figure file not found',
  'Rongboy 第一人称毛球射击。WASD 或左摇杆移动，方向键或右摇杆转向，空格或 R2 射击，按住蓄力，Q 或 L1 换枪，E 或 L2 投掷，G 或十字键下切换炸弹，F 或 □ 换地上的枪，R 或 R1 换弹，Shift 或 ✕ 跳。': 'Rongboy. Move with WASD. Look with the mouse or arrow keys. Fire with left click or Space, and hold to charge. Gamepad supported.',
  '扑抓': 'Pounce', '盾冲': 'Charge', '投弹': 'Bomb', '瞄准': 'Aim', '要射了': 'Arrow ready',
  '震地': 'Slam', '召援': 'Summon', '吸引': 'Pull', '弹药包': 'Ammo pack',
  '九类试战庭院': 'Enemy Yard', '试战庭院': 'Enemy Yard', '试验走廊': 'Firing Lane',
  '试射武器，击倒走廊里的僵尸': 'Test the weapons on the zombies in the firing lane',
  '清空九类僵尸与限定援兵': 'Clear each enemy type and its reinforcements',
  '绒仔被击倒了，再试一次。': 'Rongboy was knocked out. Try again.',
  '这局挨了一箭。等红线定住再横移。': 'An arrow hit you. Sidestep when the red line stops.',
  '时间到了，再试一次。': 'Time is up. Try again.',
  '持盾者已倒下。要用墙板反弹打中后背才能盖章。': 'Bank a shot off the board into the shield zombie’s back to earn the stamp.',
  '弓手已倒下。留它射完三箭。': 'Keep the archer up until it fires three shots.',
  '要趁同一张电网还定着两只，用手枪先后击倒。': 'Catch both with one net, then use the pistol before they recover.',
  '绒仔': 'Rongboy', '绒仔 RONGBOY': 'Rongboy', '绒仔 · RONGBOY': 'Rongboy',
  '绒仔 · 模型预览': 'Rongboy · Figure preview', 'Rongboy · 加载地图': 'Rongboy · Loading',
  '敌人模型': 'Enemy figure', '已选敌人的 3D 模型': 'Selected enemy figure',
  '主菜单': 'Main menu', '选关': 'Levels', '选择地图': 'Choose a level', '设置': 'Settings',
  '按键': 'Controls', '查看按键': 'View controls', '练习': 'Practice', '选择练习': 'Choose a practice mode',
  '兵种试战': 'Enemy drills', '选择敌人': 'Choose an enemy', '模型和招式预览': 'Figure and attack preview',
  '模型角度': 'View angle', '挑战簿': 'Challenge', '选择挑战': 'Choose a challenge', '已盖章': 'Stamp earned',
  '暂停': 'Paused', '操作': 'Controls', '继续': 'Resume', '重玩关卡': 'Restart level', '全屏': 'Fullscreen',
  '返回': 'Back', '返回主菜单': 'Main menu', '返回设置': 'Back to settings', '返回练习': 'Back to practice',
  '返回挑战簿': 'Back to challenges', '返回兵种试战': 'Back to enemy drills', '返回选关': 'Back to levels',
  '返回选图': 'Back to levels', '结算': 'Results', '挑战印章': 'Challenge stamp',
  '击倒': 'Knockouts', '用时': 'Time', '背后 / 偷袭命中': 'Back / sneak hits',
  '再来一次': 'Play again', '再挑战': 'Try again', '再次挑战': 'Try again', '开始挑战': 'Start challenge',
  '挑战完成': 'Challenge complete', '挑战未完成': 'Challenge failed', '被扑倒了': 'Knocked out',
  '全部清空！': 'All clear!', '清空了！': 'All clear!', '花园安静了。': 'The garden is clear.',
  '准备出发': 'Get ready', '正在打开地图…': 'Opening the level…', '地图加载进度': 'Level loading progress',
  '正在准备关卡…': 'Preparing the level…', '加载失败，请返回后重试。': 'Could not load. Go back and try again.',
  '加载失败，请返回菜单重试。': 'Could not load. Return to the menu and try again.',
  '正在加载毛绒模型…': 'Loading plush figures…', '正在收拾房间…': 'Setting up the scene…',
  '正在准备绒仔和毛绒伙伴…': 'Getting the toys ready…', '正在准备第一帧…': 'Getting ready to play…',
  '正在摆好手办…': 'Setting up the figure…', '模型暂时无法载入': 'Could not load the figure',
  '当前设备无法显示 3D 模型': 'This device could not display the 3D figure',
  '装填进度': 'Reload progress', '首领生命值': 'Boss health', '弹药': 'Ammo', '3 颗心': '3 hearts',
  '声音 开': 'Sound on', '声音 关': 'Sound off', '声音': 'Sound', '背景音乐': 'Music',
  '开': 'On', '关': 'Off', '画质': 'Graphics', '自动': 'Auto', '清晰': 'High', '流畅': 'Low',
  '镜头晃动': 'Camera motion', '标准': 'Standard', '减弱': 'Reduced',
  '正面': 'Front', '侧面': 'Side', '背面': 'Back',
  '手柄': 'Gamepad', '键盘': 'Keyboard', '左摇杆': 'Left stick', '右摇杆': 'Right stick', '十字↓': 'D-pad ↓',
  '方向键': 'Arrow keys', '空格': 'Space', '移动': 'Move', '转向': 'Look', '转动视角': 'Look',
  '射击 / 蓄力': 'Fire / charge', '射击 / 按住使用枪械特性': 'Fire / hold for weapon ability',
  '换弹': 'Reload', '换枪': 'Switch weapon', '跳跃': 'Jump', '投掷': 'Throw', '切换炸弹': 'Switch throwable',
  '拾取 / 换地上的枪': 'Pick up / swap weapon', '拾取地上的枪': 'Pick up weapon',
  '选择': 'Select', '进入': 'Enter', '确认': 'Confirm', '调整': 'Adjust', '切换地图': 'Change level',
  '切换设备': 'Change input', '切换练习': 'Change drill', '切换对手': 'Change opponent',
  '切换角度': 'Change view', '切换挑战': 'Change challenge', '进入花园': 'Enter the garden',
  '开始练习': 'Start practice', '选择对手': 'Choose opponent', '开始试射': 'Enter range',
  '开打': 'Start', '准备迎战': 'Get ready', '花园练习': 'Garden practice', '花园 · 一面墙': 'Garden practice',
  '借墙破盾': 'Bank shots & shields', '拆解招式': 'Read enemy attacks', '走廊试射': 'Test the arsenal',
  '武器试验场': 'Firing range', '走进武器试验场': 'Enter firing range',
  '借墙打背': 'Bank Shot', '静电接力': 'Net Combo', '三箭全躲': 'Dodge Three Arrows',
  '巧': 'BANK', '连': 'COMBO', '闪': 'DODGE',
  '借墙反弹，打中持盾者的后背': 'Bank a shot into the shield zombie’s back',
  '瞄持盾者右侧的青色墙板，让毛球绕过盾面。': 'Aim at the teal board to the right of the shield zombie.',
  '盾后命中': 'Back hits', '接力击倒': 'Combo knockouts', '躲过的箭': 'Arrows dodged',
  '一张飞网定住两只，切手枪击倒这两只': 'Catch two zombies in one net, then take them out with the pistol',
  '用静电枪瞄准两只之间，让飞网一起罩住它们。趁两只还定着，切手枪各补一发。': 'Aim the net between both zombies, then switch to the pistol while they’re stunned.',
  '无伤躲过弓手三支箭': 'Dodge three arrows without taking a hit',
  '瞄准线变红才换方向。让三支箭都落空，留着弓手继续出招。': 'Change direction when the aim line turns red. Leave the archer up to shoot again.',
  '用线轴手枪练蓄力破盾，也可以让毛球借墙打到盾后。': 'Charge the spool pistol to break shields, or bank a shot into a zombie’s back.',
  '挑一个对手，看准它的起手，练躲避和反击。': 'Choose an opponent and practice dodging and countering its attack.',
  '试探照灯炮、电网和 4× 毛衣针，也能对比小丑盒和蒸笼的伤害。': 'Try the searchlight cannon, net launcher, 4× needle rifle, and both throwables.',
  '蓄满力打盾面，或让毛球从墙上弹回盾后。': 'Charge a shot to break the shield, or bank a woolball into its back.',
  '清掉花园里的两只僵尸': 'Clear both zombies from the garden',
  '绒仔家': 'Rongboy’s House', '学校': 'The School', '博物馆': 'The Museum', '奶奶家': 'Grandma’s Place',
  '绒仔家 · 三层楼与花园': 'Rongboy’s House', '博物馆 · 奇妙夜': 'The Museum After Dark',
  '学校 · 三间教室和小操场': 'The School', '奶奶家 · 果园与阁楼': 'Grandma’s Place · Orchard and Loft',
  '上阁楼找回毛线篮，带回院门': 'Find the yarn basket in the attic and return it to the gate',
  '找回三件被拿走的展品，送回恐龙面前': 'Bring all three missing exhibits back to the dinosaur',
  '一楼埃及厅找面具，自然厅找恐龙蛋。走北走廊上二楼珍宝库取蓝宝石，再把三件展品送回恐龙面前。': 'Find the mask and dinosaur egg downstairs. Take the north stairs to the sapphire vault, then bring all three exhibits back to the dinosaur.',
  '把学校里的僵尸全部清走': 'Clear the zombies from the school',
  '把奶奶家里的僵尸全部清走': 'Clear the zombies from Grandma’s place',
  '带着毛线篮回到院门': 'Bring the yarn basket back to the gate',
  '三件都齐了 · 送回中央大厅的恐龙面前': 'All three found · Return them to the dinosaur',
  '拿到篮子后整层楼都醒了：先把楼梯口清出来再拿。': 'Clear the route to the stairs before picking up the basket.',
  '东西都齐了却没送到：回大厅前先把路上的清掉。': 'Clear a path back to the dinosaur before collecting the final exhibit.',
  '带回来了！': 'Basket recovered!', '展品都回来了！': 'Exhibits recovered!',
  '花园': 'Garden', '门厅': 'Entrance Hall', '客厅': 'Living Room', '厨房': 'Kitchen', '卧室': 'Bedroom',
  '书房': 'Study', '楼梯间': 'Stairwell', '二楼走廊': 'Upstairs Hall', '主卧': 'Main Bedroom',
  '浴室': 'Bathroom', '儿童房': 'Kids’ Room', '游戏室': 'Playroom', '阁楼走廊': 'Attic Hall',
  '储藏间': 'Storage', '缝纫间': 'Sewing Room', '藏宝间': 'Treasure Room', '菜园': 'Vegetable Garden',
  '果园': 'Orchard', '布料间': 'Linen Room', '旧玩具房': 'Old Toy Room',
  '纪念品店': 'Gift Shop', '咖啡厅': 'Café', '中央大厅': 'Main Hall', '埃及厅': 'Egypt Gallery',
  '自然厅': 'Natural History', '画廊': 'Art Gallery', '北走廊': 'North Hall', '珍宝馆': 'Gem Gallery',
  '档案室': 'Archive', '修复工坊': 'Restoration Studio', '织物展厅': 'Textile Gallery', '二楼展廊': 'Upper Gallery',
  '二楼门厅': 'Upper Landing', '珍宝库': 'Sapphire Vault', '课间活动区': 'Recess Yard',
  '操场': 'Playground', '走廊': 'Hallway', '一班教室': 'Classroom One', '美术教室': 'Art Room', '科学教室': 'Science Room',
  '毛线篮': 'Yarn Basket', '黄金面具': 'Golden Mask', '恐龙蛋': 'Dinosaur Egg', '蓝宝石': 'Sapphire',
  '手枪': 'Pistol', '线轴手枪': 'Spool Pistol', '霰弹': 'Scattergun', '绒球霰弹': 'Garden Scattergun',
  '探照灯炮': 'Searchlight Cannon', '静电枪': 'Net Launcher', '订书机': 'Stapler', '订书机枪': 'Rapid Stapler',
  '毛衣针': 'Needle Rifle', '蒸笼': 'Steamer', '折叠蒸笼': 'Folding Steamer', '小丑盒': 'Jack-in-the-box',
  '弹簧小丑盒': 'Spring Jack-in-the-box',
  '跳跳': 'Hopper', '跃行者': 'Leaper', '爬行者': 'Crawler', '持盾者': 'Shield Zombie',
  '炸弹客': 'Bomber', '弓手': 'Archer', '守墓巨像': 'Grave Guardian', '噬连兽': 'Chain Eater', '棉甲': 'Cotton Guard',
  '蹦跳追击': 'Hopping chase', '保持距离、用反弹与击退拉开': 'Keep your distance. Bank shots can knock it back.',
  '敏捷扑击': 'Leaping lunge', '看到金圈后侧移，开枪打断': 'Sidestep the gold ring or shoot to interrupt.',
  '棉甲推进': 'Armored advance', '正面减伤，绕后打': 'The front is armored. Circle behind.',
  '贴地扑抓': 'Low pounce', '低头瞄准，避开短扑；命中会缠线减速': 'Aim low and dodge the pounce. Its hit slows you.',
  '格挡盾冲': 'Shield charge', '绕后，或用探照灯炮/蓄力球破防': 'Circle behind, or break the shield with the cannon or a charged shot.',
  '抛掷毛线炸弹': 'Wool bomb toss', '看到举弹后移动，避开落地延时爆圈': 'Move when the bomb is raised. Stay out of its blast ring.',
  '拉弓射箭': 'Aimed arrow', '瞄准线变红后换个方向走，或躲到掩体后；打中它会打断': 'Change direction when the line turns red, take cover, or shoot to interrupt.',
  '震地与召援': 'Ground slam & summons', '退离震地圈、利用掩体，重弹打断': 'Get out of the ring, use cover, or interrupt with a heavy shot.',
  '吸引扇区': 'Pull cone', '侧移或找掩体，重弹/蓄力打断': 'Sidestep, use cover, or interrupt with a heavy or charged shot.',
  '破防': 'Guard broken', '盾挡了 · 绕后或蓄力破盾': 'Blocked · Circle behind or charge a shot',
  '盾已破': 'Shield broken', '盾冲 · 横移': 'Shield charge · Sidestep',
  '红线定住后横移': 'Sidestep when the red line stops', '离开炸弹落点': 'Clear the blast zone',
  '扑抓 · 拉开距离': 'Pounce · Back away', '远离震地圈': 'Leave the slam ring', '被吸引时侧移': 'Sidestep the pull',
  '援兵出来了 · 优先击破召唤源': 'Reinforcements · Focus the summoner',
  '炸弹落地 · 离开红圈': 'Bomb landed · Get out of the red ring',
  '被吸取了 · 侧移或找掩体': 'Pulled · Sidestep or take cover',
  '打断了攻击！': 'Attack interrupted!', '护甲减伤 · 绕后或用毛衣针': 'Armored · Circle behind or use the needle rifle',
  '被绒球箭击中！': 'Hit by a plush arrow!', '震地！退离范围': 'Ground slam! Get clear',
  '线团爆开了！': 'Wool bomb blast!', '被吸取了！': 'Caught in the pull!',
  '被扑到了！拉开距离': 'Hit! Make some room', '捡到棉花包 · ♥ +1': 'Cotton patch · ♥ +1',
  '装填完成': 'Reloaded', '吸引中 · 侧移或找掩体': 'Being pulled · Sidestep or take cover',
  '瞄稳了 · 松手发射': 'Steady · Release to fire', '瞄准中': 'Aiming',
  '松手发射电网': 'Release to fire net', '蓄满 · 松手发射': 'Charged · Release to fire', '蓄力中': 'Charging',
  '第二把枪还空着 · 屋里能捡到': 'Second slot empty · Find a weapon inside',
  '手柄断开了 · 改用键盘': 'Gamepad disconnected · Keyboard available',
  '手柄已连接 · 左摇杆走 · R2 开火': 'Gamepad connected · Left stick to move · R2 to fire',
  '浏览器要按一下键盘才放出声音 · 手柄照常能用': 'Press any keyboard key to enable audio',
  '武器试验场 · 暂停可查看操作': 'Firing range · Pause to view controls',
  '被发现的僵尸越多越危险：先打落单的，从背后下手。': 'Start with isolated zombies. Try hitting them from behind.',
  '开始试战': 'Start drill', '一只一只打，先看清它的招式': 'Watch each attack and practice your counter.',
  '下一把枪': 'Next weapon', '灯炮': 'Cannon', '电网': 'Net', '4× 毛衣针': '4× Needle',
};

export function english(text) {
  if (Object.hasOwn(words,text)) return words[text];
  if (typeof text !== 'string') return text;
  const drill = /^(.+)试战$/.exec(text);
  if (drill && Object.hasOwn(words,drill[1])) return words[drill[1]]+' Drill';
  const target = /^应对(.+)，击倒它(及限定援兵)?$/.exec(text);
  if (target && Object.hasOwn(words,target[1])) return 'Defeat '+words[target[1]]+(target[2] ? ' and its reinforcements' : '');
  return text;
}
export const t = text => language === 'en' ? english(text) : text;
export const copy = (zh, en) => language === 'en' ? en : zh;

export function localizeFields(record, fields) {
  if (!record || language !== 'en') return record;
  const result = { ...record };
  for (const key of fields) if (typeof result[key] === 'string') result[key] = t(result[key]);
  return result;
}

export function localizeLevel(def) {
  if (language !== 'en') return def;
  const part = section => ({
    ...section,
    rooms: section.rooms.map(room => localizeFields(room,['name'])),
    pickups: section.pickups?.map(item => localizeFields(item,['name'])),
  });
  return {
    ...part(def), name:t(def.name), mission:localizeFields(def.mission,['title']),
    texts:localizeFields(def.texts,['short','carry','emerge','got','won','lostCarrying']),
    upper:def.upper?.map(part),
  };
}
