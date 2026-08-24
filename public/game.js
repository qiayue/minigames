/* 机械防线 · 盲盒塔防
 * 植物大战僵尸式玩法：把盲盒放到战场上 → 落地开箱 → 随机机器就地服役
 * 纯 Canvas 绘制，无外部资源
 */
'use strict';

/* ========== 基础配置 ========== */
const COLS = 9, ROWS = 5;
const CELL_W = 96, CELL_H = 100;
const GRID_X = 64, GRID_Y = 14;
const W = GRID_X + COLS * CELL_W + 12;   // 940
const H = GRID_Y + ROWS * CELL_H + 12;   // 526
const TOTAL_WAVES = 10;
const BOX_COST = 50;
const BOX_HP = 150;
const BOX_OPEN_TIME = 0.9;
const TAU = Math.PI * 2;

const RARITY_NAME = { common: '普通', rare: '稀有', epic: '史诗', fusion: '合成' };
const RARITY_COLOR = { common: '#7fd08a', rare: '#4cc2ff', epic: '#c77bff', fusion: '#ff9d2e' };

const MACHINES = {
  turret:    { name: '自动炮台',   rarity: 'common', hp: 300,  desc: '向前方持续发射能量弹' },
  generator: { name: '能量发电机', rarity: 'common', hp: 300,  desc: '每 7 秒产出 25 能量' },
  barricade: { name: '装甲路障',   rarity: 'common', hp: 1600, desc: '高耐久，把敌人挡在身前' },
  puncher:   { name: '弹簧拳机',   rarity: 'common', hp: 380,  desc: '弹簧铁拳连续痛击身前的敌人（无视护盾）' },
  shredder:  { name: '碎纸机',     rarity: 'rare',   hp: 450,  desc: '把靠近的机器人整个粉碎，随后冷却 9 秒' },
  fan:       { name: '冷冻风扇',   rarity: 'rare',   hp: 300,  desc: '冰弹攻击并大幅减速敌人' },
  magnet:    { name: '磁力吊塔',   rarity: 'rare',   hp: 320,  desc: '定期把本行最靠近基地的敌人拖回后方' },
  tesla:     { name: '特斯拉线圈', rarity: 'epic',   hp: 350,  desc: '闪电链同时打击本行多个敌人' },
  railgun:   { name: '轨道激光炮', rarity: 'epic',   hp: 300,  desc: '激光贯穿本行所有敌人' },
  rocket:    { name: '火箭发射井', rarity: 'epic',   hp: 200,  desc: '发射火箭贯穿全行，随后自动装填 15 秒' },
  mine:      { name: '地雷布设器', rarity: 'common', hp: 260,  desc: '在本行前方埋设地雷，敌人踩中即爆炸' },
  flame:     { name: '火焰喷射器', rarity: 'rare',   hp: 340,  desc: '向前喷火，持续灼烧范围内的敌人' },
  poison:    { name: '毒液喷射塔', rarity: 'rare',   hp: 300,  desc: '毒液弹让敌人中毒，持续掉血' },
  mortar:    { name: '迫击炮台',   rarity: 'rare',   hp: 280,  desc: '曲射炮弹轰炸本行最远的敌人，范围溅射' },
  sniper:    { name: '狙击炮塔',   rarity: 'epic',   hp: 260,  desc: '跨行狙击全场血量最高的敌人，高额单体伤害' },
  repair:    { name: '维修工坊',   rarity: 'epic',   hp: 420,  desc: '持续修复周围 8 格内受损的机器' },
  // ---- 合成机型（只能通过合成获得，不进盲盒池） ----
  frostcannon: { name: '冰冻弹簧炮', rarity: 'fusion', hp: 420,  desc: '每 5 秒轰出冰冻炮弹，命中后冻结整行敌人 2 秒' },
  twinturret:  { name: '双管炮台',   rarity: 'fusion', hp: 420,  desc: '双管齐射，射速接近翻倍' },
  powerplant:  { name: '聚变电站',   rarity: 'fusion', hp: 400,  desc: '每 5 秒产出 40 能量' },
  arcturret:   { name: '电弧机炮',   rarity: 'fusion', hp: 380,  desc: '电弧弹命中后跳向后方最多 2 个敌人' },
  magshredder: { name: '磁力碎纸机', rarity: 'fusion', hp: 450,  desc: '隔空把本行最前的敌人拖进纸箱粉碎（冷却 11 秒）' },
  frostwall:   { name: '寒冰壁垒',   rarity: 'fusion', hp: 2000, desc: '高耐久寒冰墙，靠近的敌人被大幅减速' },
};

// 普通模式：卡槽顺序、价格与冷却（秒）
const CLASSIC_ORDER = [
  'generator', 'turret', 'barricade', 'puncher', 'mine', 'fan', 'shredder',
  'flame', 'poison', 'mortar', 'magnet', 'tesla', 'railgun', 'sniper', 'repair', 'rocket',
];
const CLASSIC_COST = {
  generator: 50, turret: 100, barricade: 50, puncher: 100, mine: 100, fan: 150,
  shredder: 150, flame: 175, poison: 175, mortar: 200, magnet: 175,
  tesla: 250, railgun: 250, sniper: 275, repair: 200, rocket: 200,
};
const CLASSIC_CD = {
  generator: 5, turret: 5, barricade: 15, puncher: 5, mine: 8, fan: 8,
  shredder: 12, flame: 10, poison: 10, mortar: 12, magnet: 12,
  tesla: 15, railgun: 15, sniper: 18, repair: 15, rocket: 20,
};

/* ========== 通用杂交系统 ==========
 * 每台机器由若干"模块"组成：{kind, lv}。
 * 任意两台机器都能杂交：同类模块等级相加，不同模块并存。
 * 能力数量与等级都没有上限——理论上可以无限叠加。
 */
const KIND_ORDER = [
  'shot', 'laser', 'sniper', 'zap', 'rocket', 'mortar', 'shred', 'mine',
  'flame', 'poison', 'magnet', 'melee', 'frost', 'armor', 'repair', 'energy',
];
// 单模块机器的进阶命名（1/2/3 级，3 级以上沿用 3 级名 + Lv 后缀）
const LADDER_NAME = {
  shot:   ['自动炮台', '双管炮台', '加特林炮台'],
  energy: ['能量发电机', '聚变电站', '核能核心'],
  armor:  ['装甲路障', '合金壁垒', '千钧堡垒'],
  melee:  ['弹簧拳机', '连环拳机', '狂怒拳机'],
  frost:  ['冷冻风扇', '暴风冰扇', '极寒涡轮'],
  shred:  ['碎纸机', '工业碎纸机', '湮灭粉碎机'],
  magnet: ['磁力吊塔', '重力吊塔', '引力发生器'],
  zap:    ['特斯拉线圈', '高压电塔', '雷暴中枢'],
  laser:  ['轨道激光炮', '相位激光炮', '歼星激光'],
  rocket: ['火箭发射井', '双联火箭井', '末日火箭井'],
  mine:   ['地雷布设器', '高爆布雷器', '湮灭雷区'],
  flame:  ['火焰喷射器', '烈焰喷射器', '地狱火炬'],
  poison: ['毒液喷射塔', '剧毒喷射塔', '瘟疫散布器'],
  mortar: ['迫击炮台', '重型迫击炮', '轨道轰炸台'],
  sniper: ['狙击炮塔', '磁轨狙击炮', '湮灭狙击炮'],
  repair: ['维修工坊', '纳米维修站', '奇迹熔炉'],
};
// 单模块机器的类型 id（1/2/3 级）
const LADDER_TYPE = {
  shot:   ['turret', 'twinturret', 'gatling'],
  energy: ['generator', 'powerplant', 'fusioncore'],
  armor:  ['barricade', 'barricade2', 'barricade3'],
  melee:  ['puncher', 'puncher2', 'puncher3'],
  frost:  ['fan', 'fan2', 'fan3'],
  shred:  ['shredder', 'shredder2', 'shredder3'],
  magnet: ['magnet', 'magnet2', 'magnet3'],
  zap:    ['tesla', 'tesla2', 'tesla3'],
  laser:  ['railgun', 'railgun2', 'railgun3'],
  rocket: ['rocket', 'rocket2', 'rocket3'],
  mine:   ['mine', 'mine2', 'mine3'],
  flame:  ['flame', 'flame2', 'flame3'],
  poison: ['poison', 'poison2', 'poison3'],
  mortar: ['mortar', 'mortar2', 'mortar3'],
  sniper: ['sniper', 'sniper2', 'sniper3'],
  repair: ['repair', 'repair2', 'repair3'],
};
// 作为副模块时的修饰词（用于自动命名混合机）
const KIND_ADJ = {
  shot: '机炮', energy: '充能', armor: '装甲', melee: '重拳', frost: '冰霜',
  shred: '绞碎', magnet: '磁暴', zap: '雷电', laser: '激光', rocket: '轰爆',
  mine: '布雷', flame: '烈焰', poison: '剧毒', mortar: '轰炸', sniper: '狙击', repair: '自愈',
};
const KIND_DESC = {
  shot: '发射能量弹', energy: '产出能量', armor: '高耐久装甲', melee: '近战铁拳（无视护盾）',
  frost: '冰弹减速敌人', shred: '粉碎靠近的敌人', magnet: '把敌人拖回后方',
  zap: '闪电链打击多个敌人', laser: '激光贯穿整行', rocket: '火箭轰击整行',
  mine: '前方埋设地雷', flame: '喷火灼烧近处敌人', poison: '毒液让敌人持续掉血',
  mortar: '曲射炮弹范围轰炸', sniper: '跨行狙击最肥的敌人', repair: '修复周围机器',
};
// 各模块对血量的加成
const KIND_HP = {
  shot: 0, energy: 0, armor: 1300, melee: 80, frost: 0,
  shred: 150, magnet: 20, zap: 50, laser: 0, rocket: -100,
  mine: 0, flame: 40, poison: 0, mortar: -20, sniper: -40, repair: 120,
};
// 经典组合的专属类型（保持原有名字和造型）
const PAIR_TYPE = [
  [['shot', 'zap'], 'arcturret', '电弧机炮'],
  [['shred', 'magnet'], 'magshredder', '磁力碎纸机'],
  [['armor', 'frost'], 'frostwall', '寒冰壁垒'],
  [['melee', 'frost'], 'frostcannon', '冰冻弹簧炮'],
];

// 等级超过 3 时沿用 3 级的名字与造型
function ladderName(kind, lv) { return LADDER_NAME[kind][Math.min(lv, 3) - 1]; }
function ladderType(kind, lv) { return LADDER_TYPE[kind][Math.min(lv, 3) - 1]; }

function modulesOfType(type) {
  for (const kind in LADDER_TYPE) {
    const i = LADDER_TYPE[kind].indexOf(type);
    if (i >= 0) return [{ kind, lv: i + 1 }];
  }
  const pair = PAIR_TYPE.find(p => p[1] === type);
  if (pair) return [{ kind: pair[0][0], lv: 1 }, { kind: pair[0][1], lv: 1 }];
  return null;
}
function sortModules(mods) {
  return mods.slice().sort((a, b) =>
    b.lv - a.lv || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}
// 杂交：合并两台机器的模块。能力数量与等级均无上限
function mergeModules(a, b) {
  const map = {};
  for (const mod of [...a, ...b]) {
    map[mod.kind] = (map[mod.kind] || 0) + mod.lv;
  }
  return sortModules(Object.keys(map).map(k => ({ kind: k, lv: map[k] })));
}
function typeOfModules(mods) {
  if (mods.length === 1) return ladderType(mods[0].kind, mods[0].lv);
  if (mods.length === 2 && mods[0].lv === 1 && mods[1].lv === 1) {
    const kinds = [mods[0].kind, mods[1].kind];
    const pair = PAIR_TYPE.find(p => p[0].every(k => kinds.includes(k)));
    if (pair) return pair[1];
  }
  return 'hybrid';
}
function totalLv(mods) { return mods.reduce((s, mod) => s + mod.lv, 0); }
function nameOfModules(mods) {
  const t = totalLv(mods);
  if (mods.length === 1) {
    const m0 = mods[0];
    return m0.lv <= 3 ? ladderName(m0.kind, m0.lv) : ladderName(m0.kind, 3) + ' Lv' + m0.lv;
  }
  if (mods.length === 2 && mods[0].lv === 1 && mods[1].lv === 1) {
    const kinds = [mods[0].kind, mods[1].kind];
    const pair = PAIR_TYPE.find(p => p[0].every(k => kinds.includes(k)));
    if (pair) return pair[2];
  }
  // 修饰词链 + 本体名：碎纸机+装甲=装甲碎纸机，再+电池=充能装甲碎纸机……
  const adjs = [];
  for (let i = mods.length - 1; i >= 1; i--) adjs.push(KIND_ADJ[mods[i].kind]);
  // 能力太多时用「全能」概括，只保留最强的两个修饰词
  const adj = adjs.length <= 4 ? adjs.join('') : '全能' + adjs.slice(-2).join('');
  const name = adj + ladderName(mods[0].kind, mods[0].lv);
  // 能力多或等级高时标出总等级，避免不同配置重名
  return (t > mods.length || mods.length > 4) ? name + ' Lv' + t : name;
}
function descOfModules(mods) {
  return mods.map(mod => KIND_DESC[mod.kind] + (mod.lv > 1 ? '×' + mod.lv : '')).join('，');
}
function hpOfModules(mods) {
  let hp = 300;
  for (const mod of mods) hp += KIND_HP[mod.kind] * mod.lv;
  hp += 60 * (totalLv(mods) - 1);
  return Math.max(Math.round(hp), 120);
}
function machineName(m) {
  if (m.type === 'box') return '盲盒';
  return m.modules ? nameOfModules(m.modules) : (MACHINES[m.type] ? MACHINES[m.type].name : m.type);
}
function hasKind(m, kind) {
  return !!(m.modules && m.modules.some(mod => mod.kind === kind));
}
function kindLv(m, kind) {
  const mod = m.modules && m.modules.find(x => x.kind === kind);
  return mod ? mod.lv : 0;
}

const ENEMIES = {
  scrap:     { name: '废铁机器人', hp: 100,  speed: 19, dmg: 45,  score: 10, w: 46 },
  armored:   { name: '装甲机器人', hp: 320,  speed: 15, dmg: 55,  score: 25, w: 50 },
  drone:     { name: '疾速无人机', hp: 70,   speed: 42, dmg: 30,  score: 15, w: 44, fly: true },
  bomber:    { name: '自爆无人蜂', hp: 90,   speed: 34, dmg: 300, score: 20, w: 44, fly: true },
  shieldbot: { name: '盾卫机器人', hp: 260,  speed: 13, dmg: 50,  score: 30, w: 52, shield: 220 },
  runner:    { name: '冲刺机器人', hp: 150,  speed: 20, dmg: 40,  score: 20, w: 46, dash: true },
  jumper:    { name: '弹跳机器人', hp: 170,  speed: 22, dmg: 45,  score: 30, w: 46, jumps: 2 },
  healer:    { name: '维修无人机', hp: 200,  speed: 18, dmg: 20,  score: 40, w: 46, fly: true, heal: true },
  crusher:   { name: '重型碾压车', hp: 1400, speed: 11, dmg: 240, score: 80, w: 86 },
  titan:     { name: '钢铁泰坦',   hp: 4200, speed: 8,  dmg: 420, score: 250, w: 104, shield: 600, boss: true, coldResist: 0.5 },
};

const BOX_POOL = {
  common: [['turret', 18], ['generator', 18], ['barricade', 9], ['puncher', 10], ['mine', 9]],
  rare:   [['shredder', 9], ['fan', 9], ['magnet', 8], ['flame', 8], ['poison', 8], ['mortar', 8]],
  epic:   [['tesla', 5], ['rocket', 4], ['railgun', 5], ['sniper', 4], ['repair', 4]],
};

/* ========== 工具 ========== */
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const $ = id => document.getElementById(id);

/* ========== DOM ========== */
const cv = $('cv');
const g = cv.getContext('2d');
const DPR = Math.min(window.devicePixelRatio || 1, 2);
cv.width = W * DPR;
cv.height = H * DPR;
cv.style.aspectRatio = W + ' / ' + H;

/* ========== 游戏状态 ========== */
let state = 'menu';        // menu | playing | paused | over | win
let mode = 'box';          // box（盲盒模式） | classic（普通模式） | creative（创造模式）
let classicCd = {};        // 普通模式各卡剩余冷却
let classicCardEls = {};   // 普通模式卡片 DOM 引用
let wavesOn = true;        // 创造模式的敌潮开关
const creative = () => mode === 'creative';
const moveCd = 0;          // 手套没有冷却
let energy, score, kills, wave, endless, pity, history;
let grid, enemies, bullets, orbs, parts, floats, zaps, beams, mines, shells, tracers;
let waveState, waveTimer, queue, spawnT, skyT, lastRows;
let bannerText, bannerSub, bannerT, shakeT, shakeAmp;
let sel = null;            // {mode:'box'} | {mode:'shovel'}
let mouse = { x: -1, y: -1 };
let submitted = false;
let time = 0;

function initGame() {
  energy = 150; score = 0; kills = 0; wave = 0;
  endless = false; pity = 0; history = [];
  grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  enemies = []; bullets = []; orbs = []; parts = []; floats = []; zaps = []; beams = [];
  mines = []; shells = []; tracers = [];
  waveState = 'pre'; waveTimer = 15; queue = []; spawnT = 0;
  skyT = 3; lastRows = [];
  bannerText = ''; bannerSub = ''; bannerT = 0; shakeT = 0; shakeAmp = 0;
  sel = null; submitted = false; time = 0;
  classicCd = {};
  renderTray();
  renderClassicTray();
  applyModeUI();
}

// 根据模式切换卡槽区域
function applyModeUI() {
  const cardTray = mode !== 'box';   // 普通/创造模式使用卡槽
  $('boxBtn').style.display = cardTray ? 'none' : '';
  $('trayInfo').style.display = cardTray ? 'none' : '';
  $('classicTray').style.display = cardTray ? '' : 'none';
  $('wavesBtn').style.display = creative() ? '' : 'none';
  $('brandMode').textContent = creative() ? '创造模式' : mode === 'classic' ? '普通模式' : '盲盒塔防';
}

// 卡槽：全部机器（普通模式明码标价；创造模式免费无冷却）
function renderClassicTray() {
  const holder = $('classicTray');
  holder.innerHTML = '';
  holder.classList.toggle('many', CLASSIC_ORDER.length > 10);
  classicCardEls = {};
  for (const type of CLASSIC_ORDER) {
    const info = MACHINES[type];
    const el = document.createElement('div');
    el.className = 'card r-' + info.rarity;
    el.title = creative()
      ? info.name + '（创造模式：免费）：' + info.desc
      : info.name + '（' + CLASSIC_COST[type] + '⚡ / 冷却 ' + CLASSIC_CD[type] + ' 秒）：' + info.desc;
    const mini = document.createElement('canvas');
    mini.width = 104; mini.height = 104;
    drawMachine(mini.getContext('2d'), type, 52, 58, 1.0, {});
    const nm = document.createElement('div');
    nm.className = 'nm';
    nm.textContent = info.name;
    const cost = document.createElement('div');
    cost.className = 'cost';
    cost.textContent = creative() ? '免费' : CLASSIC_COST[type] + '⚡';
    const cdOv = document.createElement('div');
    cdOv.className = 'cdOv';
    el.appendChild(mini); el.appendChild(nm); el.appendChild(cost); el.appendChild(cdOv);
    el.addEventListener('click', () => {
      if (state !== 'playing' || mode === 'box') return;
      if (sel && sel.mode === 'card' && sel.type === type) { sel = null; renderTray(); return; }
      if (!creative() && (energy < CLASSIC_COST[type] || (classicCd[type] || 0) > 0)) { sfx('error'); return; }
      sel = { mode: 'card', type };
      renderTray();
    });
    holder.appendChild(el);
    classicCardEls[type] = { el, cdOv };
  }
}

/* ========== 音效（WebAudio 合成） ========== */
let ac = null;
let muted = localStorage.getItem('mg_muted') === '1';
function ensureAc() {
  if (!ac) {
    const A = window.AudioContext || window.webkitAudioContext;
    if (A) ac = new A();
  }
  if (ac && ac.state === 'suspended') ac.resume();
}
function tone(f0, f1, dur, type, vol, delay) {
  if (!ac) return;
  const t0 = ac.currentTime + (delay || 0);
  const o = ac.createOscillator();
  const gn = ac.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
  gn.gain.setValueAtTime(vol, t0);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(gn).connect(ac.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function noiseBurst(dur, vol, freq, delay) {
  if (!ac) return;
  const t0 = ac.currentTime + (delay || 0);
  const n = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = freq || 1200;
  const gn = ac.createGain();
  gn.gain.setValueAtTime(vol, t0);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(gn).connect(ac.destination);
  src.start(t0);
}
function sfx(name) {
  if (muted) return;
  ensureAc();
  if (!ac) return;
  switch (name) {
    case 'coin':  tone(880, 1500, 0.12, 'sine', 0.18); break;
    case 'place': tone(300, 140, 0.1, 'square', 0.15); noiseBurst(0.06, 0.1, 2000); break;
    case 'box':   tone(500, 980, 0.16, 'triangle', 0.2); tone(1250, 1250, 0.14, 'sine', 0.16, 0.14); break;
    case 'shoot': tone(950, 560, 0.07, 'square', 0.08); break;
    case 'ice':   tone(1300, 850, 0.08, 'sine', 0.09); break;
    case 'zap':   tone(1600, 180, 0.13, 'sawtooth', 0.14); noiseBurst(0.1, 0.12, 3000); break;
    case 'laser': tone(1900, 240, 0.2, 'sawtooth', 0.12); tone(2500, 2500, 0.06, 'sine', 0.07); break;
    case 'punch': tone(240, 110, 0.09, 'square', 0.14); noiseBurst(0.05, 0.1, 1500); break;
    case 'grab':  tone(500, 1100, 0.18, 'triangle', 0.13); break;
    case 'fuse':
      tone(392, 392, 0.16, 'triangle', 0.16);
      tone(523, 523, 0.16, 'triangle', 0.16, 0.12);
      tone(784, 784, 0.24, 'triangle', 0.18, 0.24);
      noiseBurst(0.18, 0.1, 3200, 0.24);
      break;
    case 'freeze': tone(1800, 600, 0.3, 'sine', 0.12); tone(2400, 1100, 0.26, 'sine', 0.08, 0.05); break;
    case 'shred': noiseBurst(0.3, 0.28, 900); tone(160, 60, 0.25, 'square', 0.12); break;
    case 'boom':  noiseBurst(0.45, 0.4, 420); tone(120, 40, 0.35, 'sine', 0.3); break;
    case 'chomp': tone(150, 90, 0.08, 'square', 0.1); break;
    case 'break': noiseBurst(0.25, 0.25, 700); break;
    case 'gen':   tone(660, 990, 0.1, 'sine', 0.08); break;
    case 'horn':  tone(98, 98, 0.55, 'sawtooth', 0.2); tone(147, 147, 0.55, 'sawtooth', 0.14, 0.05); break;
    case 'error': tone(190, 150, 0.13, 'square', 0.12); break;
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.22, 'triangle', 0.2, i * 0.14));
      break;
    case 'lose':
      [392, 330, 262, 196].forEach((f, i) => tone(f, f * 0.94, 0.3, 'sawtooth', 0.16, i * 0.2));
      break;
  }
}

/* ========== 盲盒 ========== */
function rollType() {
  const r = Math.random() * 100;
  let rarity = r < 58 ? 'common' : r < 88 ? 'rare' : 'epic';
  if (pity >= 4 && rarity === 'common') {
    rarity = Math.random() < 0.75 ? 'rare' : 'epic';
  }
  pity = rarity === 'common' ? pity + 1 : 0;
  const pool = BOX_POOL[rarity];
  const total = pool.reduce((s, p) => s + p[1], 0);
  let x = Math.random() * total;
  for (const [type, wgt] of pool) {
    x -= wgt;
    if (x <= 0) return type;
  }
  return pool[pool.length - 1][0];
}

// 把未开封的盲盒放到场上
function placeBox(row, col) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS || grid[row][col]) return false;
  grid[row][col] = {
    type: 'box', row, col,
    hp: BOX_HP, maxHp: BOX_HP,
    openT: BOX_OPEN_TIME,
    t: 0, cd: 0, chew: 0, spin: 0,
    flash: 0, recoil: 0, pulse: 0, armed: true,
  };
  spawnParts(cellCx(col), cellCy(row) - 20, '#ffc531', 8, 80, 0.4, 'spark');
  sfx('place');
  return true;
}

// 盲盒在场上炸开，变成随机机器
function openBoxOnField(m) {
  const type = rollType();
  const info = MACHINES[type];
  history.unshift(type);
  if (history.length > 8) history.pop();
  const { row, col } = m;
  grid[row][col] = null;
  place(type, row, col);
  // 彩带 + 揭示
  spawnParts(cellCx(col), cellCy(row), '#ffc531', 10, 150, 0.6, 'paper');
  spawnParts(cellCx(col), cellCy(row), '#ff5d5d', 8, 140, 0.6, 'paper');
  spawnParts(cellCx(col), cellCy(row), RARITY_COLOR[info.rarity], 10, 160, 0.7, 'spark');
  addFloat(cellCx(col), cellCy(row) - 52, info.name + '！', RARITY_COLOR[info.rarity]);
  showReveal(type);
  renderTray();
  sfx('box');
}

/* ========== 状态栏（保底进度 + 最近开出） ========== */
function renderTray() {
  const dots = $('pityDots');
  if (dots) {
    dots.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const d = document.createElement('span');
      d.className = 'dot' + (i < pity ? ' on' : '');
      dots.appendChild(d);
    }
  }
  const pulls = $('pulls');
  if (pulls) {
    pulls.innerHTML = '';
    if (!history.length) {
      const s = document.createElement('span');
      s.className = 'histEmpty';
      s.textContent = '还没开过盲盒';
      pulls.appendChild(s);
    }
    for (const type of history) {
      const info = MACHINES[type];
      const mini = document.createElement('canvas');
      mini.width = 72; mini.height = 72;
      mini.className = 'hist';
      mini.title = info.name + '：' + info.desc;
      mini.style.borderColor = RARITY_COLOR[info.rarity];
      const mg = mini.getContext('2d');
      mg.scale(0.7, 0.7);
      drawMachine(mg, type, 51, 58, 1.0, {});
      pulls.appendChild(mini);
    }
  }
  $('shovelBtn').classList.toggle('sel', !!(sel && sel.mode === 'shovel'));
  $('boxBtn').classList.toggle('sel', !!(sel && sel.mode === 'box'));
  $('fuseBtn').classList.toggle('sel', !!(sel && sel.mode === 'fuse'));
  $('moveBtn').classList.toggle('sel', !!(sel && sel.mode === 'move'));
}

let revealTimer = null;
// 支持传类型 id（盲盒开出）或机器对象（杂交产物）
function showReveal(typeOrMachine) {
  const isMachine = typeof typeOrMachine === 'object';
  const type = isMachine ? typeOrMachine.type : typeOrMachine;
  const mods = isMachine ? typeOrMachine.modules : modulesOfType(type);
  const info = MACHINES[type];
  const rarity = isMachine && (typeOrMachine.modules.length > 1 || totalLv(typeOrMachine.modules) > 1)
    ? 'fusion'
    : (info ? info.rarity : 'fusion');
  const ov = $('reveal');
  const card = $('revealCard');
  card.className = 'r-' + (rarity === 'fusion' ? 'epic' : rarity);
  const ic = $('revealIcon');
  const rg = ic.getContext('2d');
  rg.setTransform(1, 0, 0, 1, 0, 0);
  rg.clearRect(0, 0, 192, 192);
  drawMachine(rg, type, 96, 104, 1.9, isMachine ? typeOrMachine : {});
  $('revealName').textContent = mods ? nameOfModules(mods) : (info ? info.name : type);
  $('revealRarity').textContent = '【' + RARITY_NAME[rarity] + '】';
  $('revealRarity').style.color = RARITY_COLOR[rarity];
  $('revealDesc').textContent = mods ? descOfModules(mods) : (info ? info.desc : '');
  ov.classList.add('show');
  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => ov.classList.remove('show'), 1000);
}

/* ========== 部署 ========== */
function place(type, row, col, modules) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS || grid[row][col]) return false;
  const mods = modules || modulesOfType(type);
  if (!mods) return false;
  const hp = hpOfModules(mods);
  grid[row][col] = {
    type, row, col,
    modules: sortModules(mods),
    hp, maxHp: hp,
    t: rand(0, 0.6), cd: 0, chew: 0, spin: rand(0, TAU),
    flash: 0, recoil: 0, pulse: 0, armed: true,
    mt: {}, mcd: {}, charge: 0, reload: 0,
  };
  spawnParts(cellCx(col), cellCy(row), '#9fb4c8', 10, 90, 0.4, 'spark');
  sfx('place');
  return true;
}
// 执行杂交：两台机器融合，产物出现在第二台的位置（任意组合皆可）
function doFuse(r1, c1, r2, c2) {
  const a = grid[r1][c1], b = grid[r2][c2];
  if (!a || !b) return null;
  const mods = mergeModules(a.modules, b.modules);
  const type = typeOfModules(mods);
  const x1 = cellCx(c1), y1 = cellCy(r1);
  const x2 = cellCx(c2), y2 = cellCy(r2);
  grid[r1][c1] = null;
  grid[r2][c2] = null;
  place(type, r2, c2, mods);
  const result = grid[r2][c2];
  zaps.push({ pts: [{ x: x1, y: y1 }, { x: x2, y: y2 }], t: 0.35, max: 0.35, color: '#ff9d2e' });
  spawnParts(x1, y1, '#ff9d2e', 12, 140, 0.6, 'spark');
  spawnParts(x2, y2, '#ffc531', 16, 170, 0.7, 'spark');
  spawnParts(x2, y2, '#c77bff', 10, 150, 0.6, 'paper');
  addFloat(x2, y2 - 52, '杂交：' + machineName(result) + '！', '#ff9d2e');
  showReveal(result);
  sfx('fuse');
  return result;
}

function removeMachine(row, col, silent) {
  const m = grid[row][col];
  if (!m) return;
  grid[row][col] = null;
  spawnParts(cellCx(col), cellCy(row), '#8fa1b8', 14, 120, 0.55, 'gear');
  if (!silent) sfx('break');
}
function damageMachine(m, d) {
  m.hp -= d;
  if (m.hp <= 0) removeMachine(m.row, m.col);
}

const cellCx = c => GRID_X + c * CELL_W + CELL_W / 2;
const cellCy = r => GRID_Y + r * CELL_H + CELL_H / 2;
function cellAt(x, y) {
  const c = Math.floor((x - GRID_X) / CELL_W);
  const r = Math.floor((y - GRID_Y) / CELL_H);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
  return { r, c };
}

/* ========== 敌人与波次 ========== */
function hpMult() { return wave <= TOTAL_WAVES ? 1 : 1 + (wave - TOTAL_WAVES) * 0.18; }

function spawnEnemy(type, row) {
  const info = ENEMIES[type];
  enemies.push({
    type, row,
    x: W + 30 + rand(0, 20),
    hp: Math.round(info.hp * hpMult()),
    maxHp: Math.round(info.hp * hpMult()),
    shield: info.shield ? Math.round(info.shield * hpMult()) : 0,
    maxShield: info.shield ? Math.round(info.shield * hpMult()) : 0,
    speed: info.speed, dmg: info.dmg, scoreVal: info.score, w: info.w,
    fly: !!info.fly, boss: !!info.boss,
    coldResist: info.coldResist || 0,
    dash: !!info.dash, dashT: rand(1.5, 3.5), dashing: 0,
    jumpsLeft: info.jumps || 0, jumpT: 0, jumpFrom: 0, jumpTo: 0,
    heal: !!info.heal, healT: rand(1, 3),
    burnT: 0, burnDps: 0, poisonT: 0, poisonDps: 0,
    hitT: 0, slowT: 0, frozenT: 0, anim: rand(0, TAU), flash: 0,
  });
}

function pickRow() {
  let r = Math.floor(Math.random() * ROWS);
  if (lastRows.length >= 2 && lastRows[0] === r && lastRows[1] === r) {
    r = Math.floor(Math.random() * ROWS);
  }
  lastRows.unshift(r);
  if (lastRows.length > 2) lastRows.pop();
  return r;
}

function waveEnemies(n) {
  const list = [];
  const push = (t, c) => { for (let i = 0; i < c; i++) list.push(t); };
  if (n === 1) { push('scrap', 2); }
  else if (n === 2) { push('scrap', 4); }
  else if (n === 3) { push('scrap', 4); push('armored', 2); push('runner', 1); }
  else if (n === 4) { push('scrap', 5); push('armored', 2); push('drone', 2); push('runner', 2); }
  else if (n === 5) { push('scrap', 5); push('armored', 3); push('drone', 2); push('bomber', 2); push('jumper', 1); }
  else if (n === 6) { push('scrap', 5); push('armored', 3); push('drone', 2); push('bomber', 2); push('shieldbot', 1); push('jumper', 2); }
  else if (n === 7) { push('scrap', 6); push('armored', 3); push('runner', 2); push('bomber', 2); push('shieldbot', 2); push('healer', 1); push('crusher', 1); }
  else if (n === 8) { push('scrap', 6); push('armored', 4); push('drone', 3); push('jumper', 2); push('shieldbot', 2); push('healer', 1); push('crusher', 1); }
  else if (n === 9) { push('scrap', 7); push('armored', 4); push('runner', 3); push('bomber', 3); push('shieldbot', 2); push('healer', 2); push('crusher', 2); }
  else if (n === 10) {
    push('scrap', 7); push('armored', 4); push('drone', 3); push('bomber', 3);
    push('runner', 3); push('jumper', 3); push('shieldbot', 3); push('healer', 2);
    push('crusher', 2); push('titan', 1);
  } else {
    const k = n - TOTAL_WAVES;
    push('scrap', 7 + k);
    push('armored', 4 + k);
    push('drone', 3 + Math.floor(k * 0.5));
    push('bomber', 3 + Math.floor(k * 0.5));
    push('runner', 3 + Math.floor(k * 0.5));
    push('jumper', 3 + Math.floor(k * 0.4));
    push('shieldbot', 3 + Math.floor(k * 0.5));
    push('healer', 2 + Math.floor(k * 0.3));
    push('crusher', 2 + Math.floor(k / 2));
    push('titan', 1 + Math.floor(k / 3));
  }
  // 洗牌，重型单位安排在后半段出场
  const isHeavy = t => t === 'crusher' || t === 'titan';
  const normal = shuffle(list.filter(t => !isHeavy(t)));
  const heavy = list.filter(isHeavy);
  for (const h of heavy) {
    const at = Math.floor(rand(normal.length * 0.55, normal.length + 1));
    normal.splice(at, 0, h);
  }
  return normal;
}

function startWave() {
  wave++;
  queue = waveEnemies(wave);
  waveState = 'spawn';
  spawnT = 0.6;
  if (!endless && wave === TOTAL_WAVES) banner('⚠️ 最终决战！', '钢铁泰坦压境——守住这一波就胜利了！');
  else if (wave === 3) banner('第 3 波来袭！', '冲刺机器人会突然加速冲锋！');
  else if (wave === 5) banner('第 5 波来袭！', '自爆无人蜂和弹跳机器人登场，弹跳者能跳过一台机器！');
  else if (wave === 6) banner('第 6 波来袭！', '盾卫机器人的护盾会挡住子弹，用近战机器对付它！');
  else if (wave === 7) banner('第 7 波来袭！', '维修无人机会治疗同伴，优先集火它！');
  else banner('第 ' + wave + ' 波来袭！', '');
  sfx('horn');
}

function banner(text, sub) {
  bannerText = text; bannerSub = sub || ''; bannerT = 2.4;
}

function updateWaves(dt) {
  if (waveState === 'pre') {
    waveTimer -= dt;
    if (waveTimer <= 0) startWave();
  } else if (waveState === 'spawn') {
    spawnT -= dt;
    if (spawnT <= 0 && queue.length) {
      spawnEnemy(queue.shift(), pickRow());
      spawnT = Math.max(0.9, 2.3 - wave * 0.09) + rand(0, 0.8);
    }
    if (!queue.length) waveState = 'clear';
  } else if (waveState === 'clear') {
    if (enemies.length === 0) {
      score += 100;
      addFloat(W / 2, GRID_Y + 40, '波次奖励 +100', '#58d68b');
      if (!endless && wave >= TOTAL_WAVES) { endGame(true); return; }
      waveState = 'pre';
      waveTimer = 6.5;
    }
  }
}

/* ========== 战斗 ========== */
// kind: 'ranged' 会先被护盾吸收；'melee' / 'true' 无视护盾
// noFlash: 持续伤害（灼烧/中毒）每帧都会调用，不能每帧触发受击白闪
function damageEnemy(e, d, kind, noFlash) {
  if (kind === 'ranged' && e.shield > 0) {
    const absorbed = Math.min(e.shield, d);
    e.shield -= absorbed;
    d -= absorbed;
    if (!noFlash) e.flash = 0.12;
    if (e.shield <= 0) {
      spawnParts(e.x - e.w / 2, rowCy(e), '#9fdcff', 12, 140, 0.5, 'gear');
      addFloat(e.x, rowCy(e) - 40, '护盾破碎！', '#4cc2ff');
      sfx('break');
    }
    if (d <= 0) return;
  }
  e.hp -= d;
  if (!noFlash) e.flash = 0.12;
  if (e.hp <= 0 && !e.dead) {
    e.dead = true;
    kills++;
    score += e.scoreVal;
    spawnParts(e.x, rowCy(e), '#c8935a', 12, 130, 0.6, 'gear');
    spawnParts(e.x, rowCy(e), '#ffd764', 6, 100, 0.4, 'spark');
    if (e.type === 'crusher' || e.boss) { shake(e.boss ? 0.6 : 0.35, e.boss ? 8 : 5); sfx('boom'); }
    if (e.boss) { addFloat(e.x, rowCy(e) - 60, '泰坦倒下！', '#ffc531'); }
  }
}
function rowCy(e) { return cellCy(e.row) + (e.fly ? -22 : 0); }
function shake(t, amp) { shakeT = t; shakeAmp = amp; }

function enemiesInRow(row) { return enemies.filter(e => e.row === row); }

// 模块参数表：每种模块 1/2/3 级的数值（更高等级由 modStat 外推，无上限）
const MOD_STAT = {
  shot:   { interval: [1.15, 0.6, 0.32], dmg: [25, 28, 30] },
  energy: { interval: [7, 5, 3.5], val: [25, 40, 60] },
  melee:  { interval: [0.9, 0.6, 0.42], dmg: [45, 55, 68] },
  frost:  { interval: [1.3, 0.9, 0.6], shellCd: [0, 6.5, 5], freeze: [0, 1.6, 2.2] },
  shred:  { cd: [9, 6.5, 4.5], dmg: [550, 650, 800] },
  magnet: { cd: [6.5, 5, 3.5] },
  zap:    { cd: [2.6, 1.9, 1.3], dmg: [55, 65, 75], targets: [4, 5, 6] },
  laser:  { cd: [3.8, 2.9, 2.1], dmg: [60, 72, 85] },
  rocket: { cd: [15, 11, 8] },
  mine:   { cd: [7, 5, 3.5], dmg: [220, 320, 450] },
  flame:  { interval: [0.28, 0.22, 0.16], dmg: [9, 13, 18], range: [1.6, 2.0, 2.4], burn: [10, 16, 24] },
  poison: { interval: [1.6, 1.2, 0.9], dmg: [14, 18, 24], dot: [16, 26, 38], dur: [4, 5, 6] },
  mortar: { cd: [3.2, 2.4, 1.8], dmg: [70, 95, 125], splash: [58, 68, 80] },
  sniper: { cd: [2.8, 2.1, 1.5], dmg: [150, 210, 300] },
  repair: { cd: [2.2, 1.6, 1.1], heal: [40, 70, 110] },
  armor:  {},
};
// 3 级以上的成长规则：等级无上限
const STAT_GROWTH = {
  interval: { mul: 0.86, min: 0.05 },
  cd:       { mul: 0.86, min: 0.25 },
  shellCd:  { mul: 0.88, min: 1.2 },
  dmg:      { mul: 1.3 },
  val:      { mul: 1.3 },
  heal:     { mul: 1.35 },
  dot:      { mul: 1.3 },
  burn:     { mul: 1.3 },
  targets:  { add: 1, max: 40 },
  freeze:   { add: 0.35, max: 10 },
  range:    { add: 0.35, max: 9 },
  splash:   { add: 10, max: 260 },
  dur:      { add: 0.8, max: 20 },
};
// 取某模块在任意等级下的数值（超过表长按成长规则外推）
function modStat(kind, prop, lv) {
  const table = MOD_STAT[kind];
  const arr = table && table[prop];
  if (!arr) return undefined;
  if (lv <= arr.length) return arr[lv - 1];
  const g = STAT_GROWTH[prop] || { mul: 1.2 };
  let v = arr[arr.length - 1];
  for (let i = arr.length; i < lv; i++) {
    if (g.mul !== undefined) v *= g.mul;
    if (g.add !== undefined) v += g.add;
    if (g.min !== undefined && v < g.min) { v = g.min; break; }
    if (g.max !== undefined && v > g.max) { v = g.max; break; }
  }
  return v;
}

function enemyAhead(r, cx) {
  return enemies.some(e => e.row === r && e.x > cx - CELL_W / 2 && e.x < W + 30);
}

function enemiesInRange(r, cx, cells) {
  const rng = CELL_W * cells;
  return enemies.filter(e => e.row === r && !e.dead && e.x > cx - CELL_W / 2 && e.x < cx + rng);
}

function updateMachines(dt) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const m = grid[r][c];
      if (!m) continue;
      const cx = cellCx(c);
      m.spin += dt * (m.type === 'box' ? 10 : hasKind(m, 'frost') ? 9 : 1.2);
      if (m.flash > 0) m.flash -= dt;
      if (m.recoil > 0) m.recoil -= dt;
      if (m.pulse > 0) m.pulse -= dt;
      if (m.chew > 0) m.chew -= dt;
      if (m.cd > 0) m.cd -= dt;
      if (m.flameT > 0) m.flameT -= dt;

      if (m.type === 'box') {
        m.openT -= dt;
        if (Math.random() < dt * 6) {
          spawnParts(cx + rand(-24, 24), cellCy(r) + rand(-30, 20), '#ffd764', 1, 40, 0.35, 'spark');
        }
        if (m.openT <= 0) openBoxOnField(m);
        continue;
      }

      for (const k in m.mcd) {
        if (m.mcd[k] > 0) m.mcd[k] -= dt;
      }

      for (const mod of m.modules) {
        const kind = mod.kind;
        const lv = mod.lv;
        const st = (prop) => modStat(kind, prop, lv);
        if (kind === 'shot') {
          m.mt.shot = (m.mt.shot || 0) + dt;
          if (m.mt.shot >= st('interval') && enemyAhead(r, cx)) {
            m.mt.shot = 0;
            m.recoil = 0.12;
            m.altBarrel = !m.altBarrel;
            // 模块协同：带雷电→电弧弹跳，带冰霜→冰弹减速
            const bk = hasKind(m, 'zap') ? 'arc' : hasKind(m, 'frost') ? 'ice' : 'shot';
            const dy = lv >= 2 ? (m.altBarrel ? -12 : 2) : 0;
            bullets.push({ kind: bk, row: r, x: cx + 34, dmg: st('dmg'), speed: 340, dy });
            sfx(bk === 'arc' ? 'zap' : bk === 'ice' ? 'ice' : 'shoot');
          }
        } else if (kind === 'energy') {
          m.mt.energy = (m.mt.energy || 0) + dt;
          if (m.mt.energy >= st('interval')) {
            m.mt.energy = 0;
            m.pulse = 0.5;
            orbs.push({
              x: cx + rand(-18, 22), y: cellCy(r) + rand(-8, 16),
              ty: 0, vy: 0, val: Math.round(st('val')), life: 10, falling: false,
            });
            sfx('gen');
          }
        } else if (kind === 'melee') {
          m.mt.melee = (m.mt.melee || 0) + dt;
          if (m.mt.melee >= st('interval')) {
            const left = GRID_X + c * CELL_W;
            const prey = enemies.find(e =>
              e.row === r && !e.dead &&
              e.x - e.w / 2 <= left + CELL_W + 26 &&
              e.x > left - 10
            );
            if (prey) {
              m.mt.melee = 0;
              m.recoil = 0.25;
              damageEnemy(prey, st('dmg'), 'melee');
              spawnParts(prey.x - 6, rowCy(prey), '#ffd764', 5, 100, 0.3, 'spark');
              sfx('punch');
            }
          }
        } else if (kind === 'frost') {
          m.mt.frost = (m.mt.frost || 0) + dt;
          if (m.mt.frost >= st('interval') && enemyAhead(r, cx)) {
            m.mt.frost = 0;
            bullets.push({ kind: 'ice', row: r, x: cx + 30, dmg: 12, speed: 320 });
            sfx('ice');
          }
          // 2 级起：定期轰出冻结整行的冰冻炮弹
          if (lv >= 2) {
            m.mt.frostShell = (m.mt.frostShell || 0) + dt;
            if (m.mt.frostShell >= st('shellCd') && enemyAhead(r, cx)) {
              m.mt.frostShell = 0;
              m.recoil = 0.25;
              bullets.push({ kind: 'frost', row: r, x: cx + 34, dmg: 60, speed: 300, freeze: st('freeze') });
              sfx('ice');
            }
          }
          // 寒气光环：2 级起、或与装甲组合（寒冰壁垒）
          if (lv >= 2 || hasKind(m, 'armor')) {
            for (const e of enemies) {
              if (e.row === r && !e.dead && Math.abs(e.x - cx) < CELL_W * 1.45) {
                e.slowT = Math.max(e.slowT, 0.6);
              }
            }
            if (Math.random() < dt * 2.5) {
              spawnParts(cx + rand(-30, 30), cellCy(r) + rand(-30, 20), '#bfe9ff', 1, 25, 0.6, 'smoke');
            }
          }
        } else if (kind === 'shred') {
          if ((m.mcd.shred || 0) <= 0) {
            const left = GRID_X + c * CELL_W;
            // 与磁力组合：隔空把整行最前的敌人拖进纸箱
            const magRange = hasKind(m, 'magnet');
            let prey = null;
            if (magRange) {
              const targets = enemiesInRow(r).filter(e =>
                !e.dead && !e.boss && e.type !== 'crusher' && e.x > cx + 20 && e.x < W + 20);
              if (targets.length) prey = targets.reduce((a, b) => (a.x < b.x ? a : b));
            } else {
              prey = enemies.find(e =>
                e.row === r && !e.dead &&
                e.x - e.w / 2 <= left + CELL_W - 24 &&
                e.x >= left - 8);
            }
            if (prey) {
              m.mcd.shred = st('cd');
              m.chew = 0.7;
              if (magRange) {
                zaps.push({
                  pts: [{ x: cx + 10, y: cellCy(r) - 34 }, { x: prey.x, y: rowCy(prey) }],
                  t: 0.3, max: 0.3, color: '#ff9d2e',
                });
                prey.x = cx + 12;
              }
              damageEnemy(prey, st('dmg'), 'true');
              spawnParts(cx + 20, cellCy(r), '#e8edf4', 16, 150, 0.7, 'paper');
              addFloat(cx, cellCy(r) - 46, magRange ? '隔空咔嚓！' : '咔嚓！', '#ff9d2e');
              sfx('shred');
            }
          }
        } else if (kind === 'magnet') {
          if ((m.mcd.magnet || 0) <= 0 && !hasKind(m, 'shred')) {
            const targets = enemiesInRow(r).filter(e =>
              !e.dead && !e.boss && e.type !== 'crusher' &&
              e.x > cx - 10 && e.x < cx + 5 * CELL_W
            );
            if (targets.length) {
              const prey = targets.reduce((a, b) => (a.x < b.x ? a : b));
              m.mcd.magnet = st('cd');
              m.flash = 0.3;
              const oldX = prey.x;
              prey.x = Math.min(prey.x + 2.2 * CELL_W, W - 12);
              damageEnemy(prey, 30, 'true');
              zaps.push({
                pts: [{ x: cx + 14, y: cellCy(r) - 30 }, { x: oldX, y: rowCy(prey) }],
                t: 0.25, max: 0.25, color: '#ffca6b',
              });
              spawnParts(oldX, rowCy(prey), '#ffca6b', 8, 90, 0.4, 'spark');
              spawnParts(prey.x, rowCy(prey), '#ffca6b', 8, 90, 0.4, 'spark');
              addFloat(prey.x, rowCy(prey) - 40, '被拖回！', '#ffca6b');
              sfx('grab');
            }
          }
        } else if (kind === 'zap') {
          m.mt.zap = (m.mt.zap || 0) + dt;
          if (m.mt.zap >= st('cd')) {
            const targets = enemiesInRow(r)
              .filter(e => e.x > cx - 20 && e.x < W + 20)
              .sort((a, b) => a.x - b.x)
              .slice(0, Math.round(st('targets')));
            if (targets.length) {
              m.mt.zap = 0;
              m.flash = 0.25;
              const pts = [{ x: cx, y: cellCy(r) - 26 }];
              for (const e of targets) {
                pts.push({ x: e.x, y: rowCy(e) });
                damageEnemy(e, st('dmg'), 'ranged');
              }
              zaps.push({ pts, t: 0.22, max: 0.22 });
              sfx('zap');
            }
          }
        } else if (kind === 'laser') {
          m.mt.laser = (m.mt.laser || 0) + dt;
          m.charge = clamp(m.mt.laser / st('cd'), 0, 1);
          if (m.mt.laser >= st('cd')) {
            const targets = enemiesInRow(r).filter(e => !e.dead && e.x > cx);
            if (targets.length) {
              m.mt.laser = 0;
              m.flash = 0.3;
              for (const e of targets) damageEnemy(e, st('dmg'), 'ranged');
              beams.push({ row: r, x0: cx + 26, t: 0.28, max: 0.28 });
              sfx('laser');
            }
          }
        } else if (kind === 'rocket') {
          if ((m.mcd.rocket || 0) <= 0) {
            if (enemyAhead(r, cx)) {
              m.mcd.rocket = st('cd');
              bullets.push({ kind: 'rocket', row: r, x: cx + 20, dmg: 900 * lv, speed: 430, hit: new Set() });
              spawnParts(cx, cellCy(r) + 10, '#aab7c4', 14, 90, 0.8, 'smoke');
              shake(0.25, 4);
              sfx('boom');
            }
          }
          m.reload = clamp((m.mcd.rocket || 0) / st('cd'), 0, 1);
        } else if (kind === 'mine') {
          // 在本行前方尚未布雷的格子埋设地雷
          if ((m.mcd.mine || 0) <= 0) {
            const cols = [];
            for (let cc = c + 1; cc < COLS; cc++) {
              if (!mines.some(mn => mn.row === r && mn.col === cc)) cols.push(cc);
            }
            if (cols.length && mines.length < 60) {
              const col = cols[Math.floor(rand(0, cols.length))];
              m.mcd.mine = st('cd');
              m.recoil = 0.2;
              mines.push({
                row: r, col, x: cellCx(col), y: cellCy(r) + 22,
                dmg: st('dmg'), t: 0, arm: 0.6,
              });
              spawnParts(cellCx(col), cellCy(r) + 20, '#8fa1b8', 5, 60, 0.35, 'smoke');
            }
          }
        } else if (kind === 'flame') {
          m.mt.flame = (m.mt.flame || 0) + dt;
          if (m.mt.flame >= st('interval')) {
            const targets = enemiesInRange(r, cx, st('range'));
            if (targets.length) {
              m.mt.flame = 0;
              // 火舌持续到下一次伤害判定，视觉上是一条不断的火焰
              m.flameT = st('interval') + 0.14;
              for (const e of targets) {
                damageEnemy(e, st('dmg'), 'melee', true);
                e.burnT = Math.max(e.burnT, 3);
                e.burnDps = Math.max(e.burnDps, st('burn'));
              }
              for (let i = 0; i < 3; i++) {
                spawnParts(cx + 30 + rand(0, CELL_W * st('range') * 0.7), cellCy(r) + rand(-14, 10),
                  i % 2 ? '#ff9d2e' : '#ffd764', 1, 60, 0.35, 'spark');
              }
            }
          }
        } else if (kind === 'poison') {
          m.mt.poison = (m.mt.poison || 0) + dt;
          if (m.mt.poison >= st('interval') && enemyAhead(r, cx)) {
            m.mt.poison = 0;
            m.recoil = 0.14;
            bullets.push({
              kind: 'poison', row: r, x: cx + 30, dmg: st('dmg'), speed: 300,
              dot: st('dot'), dur: st('dur'),
            });
            sfx('ice');
          }
        } else if (kind === 'mortar') {
          if ((m.mcd.mortar || 0) <= 0) {
            const targets = enemiesInRow(r).filter(e => !e.dead && e.x > cx);
            if (targets.length) {
              const prey = targets.reduce((a, b) => (a.x > b.x ? a : b));
              m.mcd.mortar = st('cd');
              m.recoil = 0.3;
              shells.push({
                row: r, x0: cx, y0: cellCy(r) - 18, tx: prey.x, t: 0, dur: 0.75,
                dmg: st('dmg'), splash: st('splash'),
              });
              sfx('shoot');
            }
          }
        } else if (kind === 'sniper') {
          if ((m.mcd.sniper || 0) <= 0) {
            // 跨行狙击：全场血量最高的敌人
            const alive = enemies.filter(e => !e.dead && e.x < W + 20);
            if (alive.length) {
              const prey = alive.reduce((a, b) => (b.hp + b.shield > a.hp + a.shield ? b : a));
              m.mcd.sniper = st('cd');
              m.flash = 0.3;
              m.recoil = 0.3;
              damageEnemy(prey, st('dmg'), 'ranged');
              tracers.push({
                x0: cx + 22, y0: cellCy(r) - 20, x1: prey.x, y1: rowCy(prey), t: 0.18, max: 0.18,
              });
              spawnParts(prey.x, rowCy(prey), '#ffe0a8', 8, 120, 0.4, 'spark');
              sfx('laser');
            }
          }
        } else if (kind === 'repair') {
          if ((m.mcd.repair || 0) <= 0) {
            let target = null;
            for (let rr2 = Math.max(0, r - 1); rr2 <= Math.min(ROWS - 1, r + 1); rr2++) {
              for (let cc = Math.max(0, c - 1); cc <= Math.min(COLS - 1, c + 1); cc++) {
                const o = grid[rr2][cc];
                if (!o || o.type === 'box' || o.hp >= o.maxHp) continue;
                if (!target || o.hp / o.maxHp < target.hp / target.maxHp) target = o;
              }
            }
            if (target) {
              m.mcd.repair = st('cd');
              m.pulse = 0.4;
              target.hp = Math.min(target.maxHp, target.hp + st('heal'));
              zaps.push({
                pts: [{ x: cx, y: cellCy(r) - 22 }, { x: cellCx(target.col), y: cellCy(target.row) - 10 }],
                t: 0.22, max: 0.22, color: '#58d68b',
              });
              spawnParts(cellCx(target.col), cellCy(target.row), '#58d68b', 5, 70, 0.4, 'spark');
            }
          }
        }
      }
      // 冰冻弹簧炮的招牌技：每 5 秒冻结整行的冰冻炮
      if (m.type === 'frostcannon') {
        m.mt.fcShell = (m.mt.fcShell || 0) + dt;
        if (m.mt.fcShell >= 5 && enemyAhead(r, cx)) {
          m.mt.fcShell = 0;
          m.recoil = 0.25;
          bullets.push({ kind: 'frost', row: r, x: cx + 34, dmg: 60, speed: 300, freeze: 2 });
          sfx('ice');
        }
      }
      // 供旧绘制代码读取的状态镜像
      if (hasKind(m, 'shred')) m.cd = Math.max(m.mcd.shred || 0, 0);
    }
  }
}

// 迫击炮弹（抛物线）与地雷
function updateShells(dt) {
  for (let i = shells.length - 1; i >= 0; i--) {
    const sh = shells[i];
    sh.t += dt;
    if (sh.t >= sh.dur) {
      const y = cellCy(sh.row);
      for (const e of enemies) {
        if (e.dead) continue;
        const d = Math.abs(e.x - sh.tx) + Math.abs(rowCy(e) - y) * 0.6;
        if (d < sh.splash) damageEnemy(e, sh.dmg * (d < sh.splash * 0.5 ? 1 : 0.6), 'ranged');
      }
      spawnParts(sh.tx, y, '#ff9d2e', 14, 150, 0.5, 'spark');
      spawnParts(sh.tx, y, '#6b7480', 8, 90, 0.7, 'smoke');
      shake(0.12, 2);
      sfx('boom');
      shells.splice(i, 1);
    }
  }
  for (let i = mines.length - 1; i >= 0; i--) {
    const mn = mines[i];
    mn.t += dt;
    if (mn.arm > 0) { mn.arm -= dt; continue; }
    const victim = enemies.find(e => !e.dead && !e.fly && e.row === mn.row && Math.abs(e.x - mn.x) < 30);
    if (victim) {
      for (const e of enemies) {
        if (!e.dead && e.row === mn.row && Math.abs(e.x - mn.x) < 60) {
          damageEnemy(e, mn.dmg, 'true');
        }
      }
      spawnParts(mn.x, mn.y, '#ff9d2e', 16, 170, 0.5, 'spark');
      spawnParts(mn.x, mn.y, '#6b7480', 8, 90, 0.7, 'smoke');
      shake(0.15, 3);
      sfx('boom');
      mines.splice(i, 1);
    }
  }
  for (let i = tracers.length - 1; i >= 0; i--) {
    tracers[i].t -= dt;
    if (tracers[i].t <= 0) tracers.splice(i, 1);
  }
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.speed * dt;
    if (b.kind === 'rocket') {
      for (const e of enemies) {
        if (e.row === b.row && !e.dead && !b.hit.has(e) && Math.abs(b.x - e.x) < e.w / 2 + 16) {
          b.hit.add(e);
          damageEnemy(e, b.dmg, 'ranged');
          spawnParts(e.x, rowCy(e), '#ff9d2e', 14, 160, 0.5, 'spark');
        }
      }
      if (b.x > W + 80) bullets.splice(i, 1);
      continue;
    }
    let hitEnemy = null;
    for (const e of enemies) {
      if (e.row === b.row && !e.dead && Math.abs(b.x - e.x) < e.w / 2 + 6) { hitEnemy = e; break; }
    }
    if (hitEnemy) {
      damageEnemy(hitEnemy, b.dmg, 'ranged');
      if (b.kind === 'ice') {
        hitEnemy.slowT = 3;
        spawnParts(b.x, rowCy(hitEnemy), '#9fdcff', 5, 80, 0.35, 'spark');
      } else if (b.kind === 'frost') {
        // 冰冻炮弹：冻结整行敌人
        const fdur = b.freeze || 2;
        for (const t of enemies) {
          if (t.row === b.row && !t.dead) {
            t.frozenT = Math.max(t.frozenT, fdur);
            spawnParts(t.x, rowCy(t), '#bfe9ff', 4, 60, 0.5, 'spark');
          }
        }
        beams.push({ row: b.row, x0: GRID_X, t: 0.5, max: 0.5, kind: 'frost' });
        spawnParts(b.x, rowCy(hitEnemy), '#e0f4ff', 16, 150, 0.6, 'spark');
        addFloat(b.x, rowCy(hitEnemy) - 44, '整行冻结！', '#7fd7ff');
        sfx('freeze');
      } else if (b.kind === 'poison') {
        hitEnemy.poisonT = Math.max(hitEnemy.poisonT, b.dur);
        hitEnemy.poisonDps = Math.max(hitEnemy.poisonDps, b.dot);
        spawnParts(b.x, rowCy(hitEnemy), '#8be04a', 7, 100, 0.4, 'spark');
      } else if (b.kind === 'arc') {
        // 电弧弹跳：跳向后方最多 2 个敌人
        const chain = enemies
          .filter(t => t.row === b.row && !t.dead && t !== hitEnemy && t.x > hitEnemy.x && t.x - hitEnemy.x < CELL_W * 2.5)
          .sort((a, c) => a.x - c.x)
          .slice(0, 2);
        if (chain.length) {
          const pts = [{ x: hitEnemy.x, y: rowCy(hitEnemy) }];
          for (const t of chain) {
            pts.push({ x: t.x, y: rowCy(t) });
            damageEnemy(t, 20, 'ranged');
          }
          zaps.push({ pts, t: 0.2, max: 0.2, color: '#9fdcff' });
        }
        spawnParts(b.x, rowCy(hitEnemy), '#b8e2ff', 6, 100, 0.35, 'spark');
      } else {
        spawnParts(b.x, rowCy(hitEnemy), '#ffd764', 5, 90, 0.3, 'spark');
      }
      bullets.splice(i, 1);
    } else if (b.x > W + 40) {
      bullets.splice(i, 1);
    }
  }
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.dead) { enemies.splice(i, 1); continue; }
    // 持续伤害：灼烧 / 中毒（冻结状态下依然生效）
    if (e.burnT > 0) {
      e.burnT -= dt;
      damageEnemy(e, e.burnDps * dt, 'true', true);
      if (Math.random() < dt * 5) spawnParts(e.x + rand(-10, 10), rowCy(e) - 10, '#ff9d2e', 1, 40, 0.4, 'smoke');
    }
    if (e.poisonT > 0) {
      e.poisonT -= dt;
      damageEnemy(e, e.poisonDps * dt, 'true', true);
      if (Math.random() < dt * 4) spawnParts(e.x + rand(-10, 10), rowCy(e) - 6, '#8be04a', 1, 30, 0.5, 'smoke');
    }
    if (e.dead) { enemies.splice(i, 1); continue; }
    if (e.frozenT > 0) {
      // 完全冻结：不移动、不攻击、动画停格（泰坦有抗性，冻结时间流逝更快）
      e.frozenT -= dt * (1 + (e.coldResist || 0));
      if (e.flash > 0) e.flash -= dt;
      continue;
    }
    e.anim += dt;
    if (e.flash > 0) e.flash -= dt;
    if (e.slowT > 0) e.slowT -= dt * (1 + (e.coldResist || 0));
    // 弹跳中：越过机器
    if (e.jumpT > 0) {
      e.jumpT -= dt;
      e.x = e.jumpTo + (e.jumpFrom - e.jumpTo) * clamp(e.jumpT / 0.55, 0, 1);
      if (e.jumpT <= 0) e.x = e.jumpTo;
      continue;
    }
    // 冲刺者：间歇性突进
    if (e.dash) {
      if (e.dashing > 0) {
        e.dashing -= dt;
        if (Math.random() < dt * 12) spawnParts(e.x + 16, rowCy(e), '#ffd764', 1, 50, 0.3, 'spark');
      } else {
        e.dashT -= dt;
        if (e.dashT <= 0) {
          e.dashT = rand(3.5, 5.5);
          e.dashing = 1.1;
          addFloat(e.x, rowCy(e) - 40, '冲刺！', '#ffd764');
        }
      }
    }
    // 维修无人机：定期治疗附近同伴
    if (e.heal) {
      e.healT -= dt;
      if (e.healT <= 0) {
        e.healT = 3.2;
        const friends = enemies.filter(o =>
          !o.dead && o !== e && o.hp < o.maxHp && Math.abs(o.x - e.x) < CELL_W * 2.2 &&
          Math.abs(o.row - e.row) <= 1);
        if (friends.length) {
          for (const o of friends.slice(0, 3)) {
            o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.12 + 25);
            zaps.push({
              pts: [{ x: e.x, y: rowCy(e) }, { x: o.x, y: rowCy(o) }],
              t: 0.25, max: 0.25, color: '#58d68b',
            });
            spawnParts(o.x, rowCy(o), '#58d68b', 5, 70, 0.4, 'spark');
          }
          addFloat(e.x, rowCy(e) - 42, '维修中', '#58d68b');
        }
      }
    }
    const mul = (e.slowT > 0 ? 0.45 : 1) * (e.dashing > 0 ? 3.4 : 1);
    const front = e.x - e.w / 2;
    const col = Math.floor((front - GRID_X) / CELL_W);
    let m = null;
    if (col >= 0 && col < COLS) {
      const cand = grid[e.row][col];
      if (cand && front <= GRID_X + col * CELL_W + CELL_W * 0.62) m = cand;
    }
    if (m) {
      if (e.type === 'bomber') {
        // 自爆：与机器同归于尽
        damageMachine(m, e.dmg);
        spawnParts(e.x, rowCy(e), '#ff9d2e', 18, 170, 0.6, 'spark');
        spawnParts(e.x, rowCy(e), '#5b6470', 10, 90, 0.7, 'smoke');
        shake(0.2, 3);
        sfx('boom');
        damageEnemy(e, e.hp + 1, 'true');
        continue;
      }
      // 弹跳机器人：跳过挡路的机器（次数有限）
      if (e.jumpsLeft > 0 && e.jumpT <= 0) {
        e.jumpsLeft--;
        e.jumpFrom = e.x;
        e.jumpTo = Math.max(GRID_X - 20, e.x - CELL_W * 1.1);
        e.jumpT = 0.55;
        spawnParts(e.x, rowCy(e) + 16, '#c8d4e0', 8, 90, 0.4, 'smoke');
        addFloat(e.x, rowCy(e) - 44, '跳过！', '#c8d4e0');
        continue;
      }
      e.hitT -= dt;
      if (e.hitT <= 0) {
        e.hitT = (e.type === 'crusher' || e.boss) ? 0.8 : 0.95;
        damageMachine(m, e.dmg);
        spawnParts(front + 6, rowCy(e), '#9fb4c8', 4, 70, 0.3, 'spark');
        sfx('chomp');
      }
    } else {
      e.x -= e.speed * mul * dt;
      e.hitT = 0;
    }
    if (front < GRID_X - 26) {
      endGame(false);
      return;
    }
  }
}

/* ========== 能量 ========== */
function updateOrbs(dt) {
  skyT -= dt;
  if (skyT <= 0) {
    skyT = 8 + rand(-1.5, 1.5);
    orbs.push({
      x: GRID_X + rand(24, COLS * CELL_W - 24),
      y: -22,
      ty: GRID_Y + rand(30, ROWS * CELL_H - 36),
      vy: 75, val: 25, life: 9, falling: true,
    });
  }
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    if (o.falling) {
      o.y += o.vy * dt;
      if (o.y >= o.ty) { o.y = o.ty; o.falling = false; }
    } else {
      o.life -= dt;
      if (o.life <= 0) orbs.splice(i, 1);
    }
  }
}
function tryCollectOrb(x, y) {
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    const dx = x - o.x, dy = y - o.y;
    if (dx * dx + dy * dy < 30 * 30) {
      energy += o.val;
      addFloat(o.x, o.y - 16, '+' + o.val, '#ffc531');
      orbs.splice(i, 1);
      sfx('coin');
      return true;
    }
  }
  return false;
}

/* ========== 特效 ========== */
function spawnParts(x, y, color, n, speed, life, shape) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU);
    const sp = rand(speed * 0.3, speed);
    parts.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 40,
      grav: shape === 'smoke' ? -30 : 260,
      t: life * rand(0.6, 1.3), max: life,
      color, shape,
      size: rand(2, shape === 'paper' ? 7 : 4.5),
      rot: rand(0, TAU), vr: rand(-6, 6),
    });
  }
}
function addFloat(x, y, txt, color) {
  floats.push({ x, y, txt, color, t: 1.3 });
}
function updateFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.t -= dt;
    if (p.t <= 0) { parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += p.grav * dt; p.rot += p.vr * dt;
    p.vx *= 0.98;
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.t -= dt; f.y -= 26 * dt;
    if (f.t <= 0) floats.splice(i, 1);
  }
  for (let i = zaps.length - 1; i >= 0; i--) {
    zaps[i].t -= dt;
    if (zaps[i].t <= 0) zaps.splice(i, 1);
  }
  for (let i = beams.length - 1; i >= 0; i--) {
    beams[i].t -= dt;
    if (beams[i].t <= 0) beams.splice(i, 1);
  }
  if (bannerT > 0) bannerT -= dt;
  if (shakeT > 0) shakeT -= dt;
}

/* ========== 主循环 ========== */
function update(dt) {
  time += dt;
  if (mode === 'classic') {
    for (const k in classicCd) {
      if (classicCd[k] > 0) classicCd[k] -= dt;
    }
  }
  if (!creativeNoWaves()) updateWaves(dt);
  updateMachines(dt);
  updateShells(dt);
  updateBullets(dt);
  updateEnemies(dt);
  updateOrbs(dt);
  updateFx(dt);
}
// 创造模式可以关掉敌潮，安心搭配机器
function creativeNoWaves() { return mode === 'creative' && !wavesOn; }

let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  if (state === 'playing') update(dt);
  draw();
  updateHud();
  requestAnimationFrame(frame);
}

function updateHud() {
  $('energyVal').textContent = creative() ? '∞' : energy;
  $('scoreVal').textContent = score;
  let wtxt;
  if (creativeNoWaves()) wtxt = '敌潮已暂停';
  else if (wave === 0) wtxt = '准备中';
  else if (endless || wave > TOTAL_WAVES) wtxt = '无尽 · 第' + wave + '波';
  else wtxt = '第' + wave + '/' + TOTAL_WAVES + '波';
  $('waveVal').textContent = wtxt;
  $('boxBtn').disabled = state !== 'playing' || (!creative() && energy < BOX_COST);
  if (mode !== 'box') {
    for (const type in classicCardEls) {
      const { el, cdOv } = classicCardEls[type];
      const cd = creative() ? 0 : (classicCd[type] || 0);
      el.classList.toggle('off', state !== 'playing' || (!creative() && (energy < CLASSIC_COST[type] || cd > 0)));
      el.classList.toggle('sel', !!(sel && sel.mode === 'card' && sel.type === type));
      cdOv.style.height = cd > 0 ? (cd / CLASSIC_CD[type] * 100) + '%' : '0';
    }
  }
}

/* ========== 游戏流程 ========== */
function startGame(m) {
  if (m === 'box' || m === 'classic' || m === 'creative') mode = m;
  wavesOn = true;
  $('wavesBtn').textContent = '🌊 敌潮：开';
  $('wavesBtn').classList.remove('off');
  initGame();
  state = 'playing';
  show('menu', false); show('end', false); show('pauseOv', false);
  if (creative()) {
    banner('🛠️ 创造模式', '能量无限、随便放、随便杂交 —— 敌潮可随时开关');
  } else if (mode === 'classic') {
    banner('准备布防！', '从卡槽选择机器，用能量按标价部署');
  } else {
    banner('准备布防！', '点"开盲盒"再点空格放置 —— 落地即开！');
  }
}
function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  show('pauseOv', true);
}
function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  show('pauseOv', false);
  last = performance.now();
}
function endGame(win) {
  if (state === 'over' || state === 'win') return;
  state = win ? 'win' : 'over';
  sel = null;
  renderTray();
  $('endTitle').innerHTML = win
    ? '🎉 <span class="gold">防线守住了！</span>'
    : '💥 防线失守…';
  const modeTag = creative() ? '（🛠️ 创造模式）' : mode === 'classic' ? '（🃏 普通模式）' : '（🎁 盲盒模式）';
  $('endSub').textContent = (win
    ? '你抵挡住了全部 ' + TOTAL_WAVES + ' 波进攻，机械基地安然无恙！'
    : '机器人冲进了基地，第 ' + Math.max(wave, 1) + ' 波未能守住。') + modeTag;
  $('endScore').textContent = score;
  $('endWave').textContent = wave;
  $('endKills').textContent = kills;
  $('endlessBtn').style.display = win ? '' : 'none';
  // 创造模式不计入排行榜
  $('submitRow').style.display = creative() ? 'none' : '';
  $('board').style.display = 'none';
  $('nameInput').value = localStorage.getItem('mg_playerName') || '';
  submitted = false;
  $('submitBtn').disabled = false;
  $('submitBtn').textContent = '提交成绩';
  show('end', true);
  sfx(win ? 'win' : 'lose');
  if (creative()) {
    renderBoard($('board'), [], '创造模式为自由玩法，成绩不计入排行榜。', null);
  } else {
    loadBoard($('board'));
  }
}
function continueEndless() {
  endless = true;
  state = 'playing';
  show('end', false);
  waveState = 'pre';
  waveTimer = 5;
  banner('♾️ 无尽模式启动！', '敌人会越来越强……');
  last = performance.now();
}
function show(id, on) {
  $(id).classList.toggle('show', !!on);
}

/* ========== 排行榜（两个模式分开记录） ========== */
const MODE_LABEL = { box: '🎁 盲盒模式', classic: '🃏 普通模式' };
function localKey(m) { return 'mg_localScores_' + m; }
function localScores(m) {
  try {
    let list = JSON.parse(localStorage.getItem(localKey(m)) || 'null');
    if (!list && m === 'box') {
      // 兼容分榜之前的旧记录
      list = JSON.parse(localStorage.getItem('mg_localScores') || 'null');
    }
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}
function saveLocalScore(entry, m) {
  const list = localScores(m);
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  localStorage.setItem(localKey(m), JSON.stringify(list.slice(0, 20)));
  return list.slice(0, 20);
}
function renderBoard(el, scores, note, mine, m) {
  el.innerHTML = '';
  el.style.display = '';
  if (m && MODE_LABEL[m]) {
    const h = document.createElement('div');
    h.className = 'bh';
    h.textContent = MODE_LABEL[m] + ' 排行榜';
    el.appendChild(h);
  }
  if (note) {
    const n = document.createElement('div');
    n.className = 'note';
    n.textContent = note;
    el.appendChild(n);
  }
  if (!scores.length) {
    const n = document.createElement('div');
    n.className = 'note';
    n.textContent = '暂时还没有成绩，快来创造第一个记录！';
    el.appendChild(n);
    return;
  }
  scores.slice(0, 10).forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'row';
    const rk = document.createElement('span');
    rk.className = 'rk';
    rk.textContent = (i + 1) + '.';
    const nm = document.createElement('span');
    nm.className = 'nm' + (mine && s.at === mine.at && s.name === mine.name ? ' me' : '');
    nm.textContent = s.name + '（第' + s.wave + '波）';
    const sc = document.createElement('span');
    sc.className = 'sc';
    sc.textContent = s.score;
    row.appendChild(rk); row.appendChild(nm); row.appendChild(sc);
    el.appendChild(row);
  });
}
async function loadBoard(el, m) {
  m = m || mode;
  try {
    const res = await fetch('/api/scores?mode=' + m);
    const data = await res.json();
    if (data.ok) { renderBoard(el, data.scores, '', null, m); return; }
    throw new Error('no_storage');
  } catch {
    renderBoard(el, localScores(m), '（云端排行榜未启用，以下为本机记录）', null, m);
  }
}
async function submitScore() {
  if (submitted) return;
  const name = ($('nameInput').value.trim() || '无名机械师').slice(0, 16);
  localStorage.setItem('mg_playerName', name);
  const m = mode;
  const entry = { name, score, wave, at: Date.now() };
  submitted = true;
  $('submitBtn').disabled = true;
  $('submitBtn').textContent = '提交中…';
  try {
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, score, wave, mode: m }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error('fail');
    $('submitBtn').textContent = data.rank > 0 ? '已提交 · 第' + data.rank + '名' : '已提交';
    renderBoard($('board'), data.scores, '', null, m);
  } catch {
    const list = saveLocalScore(entry, m);
    $('submitBtn').textContent = '已保存到本机';
    renderBoard($('board'), list, '（云端排行榜未启用，以下为本机记录）', entry, m);
  }
  $('submitRow').style.display = 'none';
  $('board').style.display = '';
}

/* ========== 输入 ========== */
function toGame(ev) {
  const rect = cv.getBoundingClientRect();
  return {
    x: (ev.clientX - rect.left) * W / rect.width,
    y: (ev.clientY - rect.top) * H / rect.height,
  };
}
cv.addEventListener('pointermove', ev => { mouse = toGame(ev); });
cv.addEventListener('pointerleave', () => { mouse = { x: -1, y: -1 }; });
cv.addEventListener('pointerdown', ev => {
  ensureAc();
  if (state !== 'playing') return;
  const p = toGame(ev);
  if (tryCollectOrb(p.x, p.y)) return;
  const cell = cellAt(p.x, p.y);
  if (!cell) return;
  if (sel && sel.mode === 'shovel') {
    if (grid[cell.r][cell.c]) {
      removeMachine(cell.r, cell.c);
      sel = null;
      renderTray();
    }
    return;
  }
  if (sel && sel.mode === 'move') {
    const m = grid[cell.r][cell.c];
    if (m) {
      if (m.type === 'box') {
        addFloat(cellCx(cell.c), cellCy(cell.r) - 30, '盲盒还没开封', '#ff5d5d');
        sfx('error');
        return;
      }
      if (sel.from && sel.from.r === cell.r && sel.from.c === cell.c) { sel.from = null; return; }
      sel.from = { r: cell.r, c: cell.c };
      sfx('place');
      return;
    }
    if (!sel.from) return;
    const src = grid[sel.from.r][sel.from.c];
    if (!src) { sel.from = null; return; }
    grid[sel.from.r][sel.from.c] = null;
    grid[cell.r][cell.c] = src;
    spawnParts(cellCx(sel.from.c), cellCy(sel.from.r) + 20, '#8fa1b8', 8, 70, 0.4, 'smoke');
    src.row = cell.r;
    src.col = cell.c;
    spawnParts(cellCx(cell.c), cellCy(cell.r) + 20, '#8fa1b8', 8, 70, 0.4, 'smoke');
    addFloat(cellCx(cell.c), cellCy(cell.r) - 40, '搬运完成', '#4cc2ff');
    sfx('place');
    // 手套没有冷却：保持搬运模式，可以连着搬
    sel.from = null;
    renderTray();
    return;
  }
  if (sel && sel.mode === 'fuse') {
    const m = grid[cell.r][cell.c];
    if (!m) { sel.first = null; return; }
    if (m.type === 'box') {
      addFloat(cellCx(cell.c), cellCy(cell.r) - 30, '盲盒还没开封', '#ff5d5d');
      sfx('error');
      return;
    }
    if (!sel.first) {
      sel.first = { r: cell.r, c: cell.c };
      sfx('place');
      return;
    }
    if (sel.first.r === cell.r && sel.first.c === cell.c) { sel.first = null; return; }
    const a = grid[sel.first.r][sel.first.c];
    if (!a) { sel.first = { r: cell.r, c: cell.c }; return; }
    doFuse(sel.first.r, sel.first.c, cell.r, cell.c);
    sel = null;
    renderTray();
    return;
  }
  if (sel && sel.mode === 'card') {
    // 普通模式：花能量放置选中的机器（创造模式免费且无冷却）
    const type = sel.type;
    if (grid[cell.r][cell.c]) {
      addFloat(cellCx(cell.c), cellCy(cell.r) - 30, '这里已有机器', '#ff5d5d');
      sfx('error');
      return;
    }
    if (creative()) {
      if (place(type, cell.r, cell.c)) renderTray();  // 保持选中，可连续放
      return;
    }
    if (energy < CLASSIC_COST[type] || (classicCd[type] || 0) > 0) {
      sel = null;
      renderTray();
      sfx('error');
      return;
    }
    if (place(type, cell.r, cell.c)) {
      energy -= CLASSIC_COST[type];
      classicCd[type] = CLASSIC_CD[type];
      sel = null;
      renderTray();
    }
    return;
  }
  if (sel && sel.mode === 'box') {
    if (grid[cell.r][cell.c]) {
      addFloat(cellCx(cell.c), cellCy(cell.r) - 30, '这里已有机器', '#ff5d5d');
      sfx('error');
      return;
    }
    if (!creative() && energy < BOX_COST) {
      sel = null;
      renderTray();
      sfx('error');
      return;
    }
    if (placeBox(cell.r, cell.c)) {
      if (!creative()) energy -= BOX_COST;
      // 能量足够时保持放置模式，可以连续放
      if (!creative() && energy < BOX_COST) {
        sel = null;
        renderTray();
      }
    }
  }
});
cv.addEventListener('contextmenu', ev => {
  ev.preventDefault();
  if (sel) { sel = null; renderTray(); }
});
window.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') {
    if (sel) { sel = null; renderTray(); return; }
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') pauseGame();
});

$('startBtn').addEventListener('click', () => { ensureAc(); startGame('box'); });
$('startClassicBtn').addEventListener('click', () => { ensureAc(); startGame('classic'); });
$('startCreativeBtn').addEventListener('click', () => { ensureAc(); startGame('creative'); });
$('wavesBtn').addEventListener('click', () => {
  if (!creative()) return;
  wavesOn = !wavesOn;
  $('wavesBtn').textContent = wavesOn ? '🌊 敌潮：开' : '⏹️ 敌潮：关';
  $('wavesBtn').classList.toggle('off', !wavesOn);
  banner(wavesOn ? '敌潮已开启' : '敌潮已暂停', wavesOn ? '机器人重新开始进攻' : '安心搭配你的机器吧');
});
$('againBtn').addEventListener('click', () => { ensureAc(); startGame(); });
$('endlessBtn').addEventListener('click', continueEndless);
$('boxBtn').addEventListener('click', () => {
  ensureAc();
  if (state !== 'playing') return;
  if (sel && sel.mode === 'box') {
    sel = null;
  } else if (energy >= BOX_COST) {
    sel = { mode: 'box' };
  } else {
    sfx('error');
  }
  renderTray();
});
$('shovelBtn').addEventListener('click', () => {
  if (state !== 'playing') return;
  sel = (sel && sel.mode === 'shovel') ? null : { mode: 'shovel' };
  renderTray();
});
$('fuseBtn').addEventListener('click', () => {
  if (state !== 'playing') return;
  sel = (sel && sel.mode === 'fuse') ? null : { mode: 'fuse', first: null };
  renderTray();
});
$('moveBtn').addEventListener('click', () => {
  if (state !== 'playing') return;
  sel = (sel && sel.mode === 'move') ? null : { mode: 'move', from: null };
  renderTray();
});
$('pauseBtn').addEventListener('click', () => {
  if (state === 'playing') pauseGame();
  else if (state === 'paused') resumeGame();
});
$('resumeBtn').addEventListener('click', resumeGame);
$('pauseRestartBtn').addEventListener('click', () => { startGame(); });
$('restartBtn').addEventListener('click', () => {
  initGame();
  state = 'menu';
  show('end', false); show('pauseOv', false); show('menu', true);
});
$('muteBtn').addEventListener('click', () => {
  muted = !muted;
  localStorage.setItem('mg_muted', muted ? '1' : '0');
  $('muteBtn').textContent = muted ? '🔇' : '🔊';
});
$('muteBtn').textContent = muted ? '🔇' : '🔊';
$('submitBtn').addEventListener('click', submitScore);
$('nameInput').addEventListener('keydown', ev => { if (ev.key === 'Enter') submitScore(); });
$('menuBoardBtn').addEventListener('click', () => {
  const el = $('menuBoard');
  if (el.style.display === 'none') {
    el.style.display = '';
    // 两个模式的榜单分开展示
    el.innerHTML = '<div class="menuBoards"></div>';
    const holder = el.firstChild;
    for (const m of ['box', 'classic']) {
      const b = document.createElement('div');
      b.className = 'board';
      b.style.display = 'block';
      b.style.marginBottom = '10px';
      holder.appendChild(b);
      loadBoard(b, m);
    }
  } else {
    el.style.display = 'none';
  }
});

/* ========== 绘制 ========== */
function draw() {
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.clearRect(0, 0, W, H);
  if (shakeT > 0) {
    g.translate(rand(-1, 1) * shakeAmp * shakeT * 3, rand(-1, 1) * shakeAmp * shakeT * 3);
  }
  if (!bgCanvas) buildBackground();
  g.drawImage(bgCanvas, 0, 0, W, H);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const m = grid[r][c];
      if (m) drawMachine(g, m.type, cellCx(c), cellCy(r) + 6, 1.0, m);
    }
    for (const e of enemies) {
      if (e.row === r) drawEnemy(e);
    }
  }
  drawFuseHints();
  drawMines();
  drawBeams();
  drawBullets();
  drawShells();
  drawTracers();
  drawZaps();
  drawParts();
  drawOrbs();
  drawFloats();
  drawHoverGhost();
  drawVignette();
  drawBanner();
}

/* ---- 背景（一次性预渲染到离屏画布，细节更足、每帧更省） ---- */
let bgCanvas = null;
let vignetteGrad = null;
function buildBackground() {
  bgCanvas = document.createElement('canvas');
  bgCanvas.width = W * DPR;
  bgCanvas.height = H * DPR;
  const b = bgCanvas.getContext('2d');
  b.setTransform(DPR, 0, 0, DPR, 0, 0);
  // 底色纵向渐变
  const bgGrad = b.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#161f2c');
  bgGrad.addColorStop(0.55, '#111823');
  bgGrad.addColorStop(1, '#0c1118');
  b.fillStyle = bgGrad;
  b.fillRect(0, 0, W, H);
  // 战场格子：交错色 + 内嵌斜面高光/阴影 + 角落铆钉
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = GRID_X + c * CELL_W, y = GRID_Y + r * CELL_H;
      const cellGrad = b.createLinearGradient(x, y, x, y + CELL_H);
      if ((r + c) % 2 === 0) {
        cellGrad.addColorStop(0, '#1d2735');
        cellGrad.addColorStop(1, '#18202c');
      } else {
        cellGrad.addColorStop(0, '#18212d');
        cellGrad.addColorStop(1, '#141c27');
      }
      b.fillStyle = cellGrad;
      b.fillRect(x, y, CELL_W, CELL_H);
      // 斜面：左上亮边、右下暗边
      b.strokeStyle = 'rgba(255,255,255,0.035)';
      b.beginPath();
      b.moveTo(x + 1, y + CELL_H - 1); b.lineTo(x + 1, y + 1); b.lineTo(x + CELL_W - 1, y + 1);
      b.stroke();
      b.strokeStyle = 'rgba(0,0,0,0.4)';
      b.beginPath();
      b.moveTo(x + CELL_W - 1, y + 1); b.lineTo(x + CELL_W - 1, y + CELL_H - 1); b.lineTo(x + 1, y + CELL_H - 1);
      b.stroke();
    }
  }
  // 格点铆钉
  b.fillStyle = 'rgba(90,115,145,0.35)';
  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c <= COLS; c++) {
      b.beginPath();
      b.arc(GRID_X + c * CELL_W, GRID_Y + r * CELL_H, 1.6, 0, TAU);
      b.fill();
    }
  }
  // 环境微尘/磨损斑点
  for (let i = 0; i < 90; i++) {
    b.fillStyle = 'rgba(255,255,255,' + rand(0.01, 0.04) + ')';
    b.beginPath();
    b.arc(GRID_X + rand(0, COLS * CELL_W), GRID_Y + rand(0, ROWS * CELL_H), rand(0.5, 2.2), 0, TAU);
    b.fill();
  }
  // 右侧入侵区域警示
  const gr = b.createLinearGradient(W - 110, 0, W, 0);
  gr.addColorStop(0, 'rgba(255,80,60,0)');
  gr.addColorStop(1, 'rgba(255,80,60,0.16)');
  b.fillStyle = gr;
  b.fillRect(W - 110, GRID_Y, 110, ROWS * CELL_H);
  b.strokeStyle = 'rgba(255,90,70,0.28)';
  b.lineWidth = 3;
  for (let r = 0; r < ROWS; r++) {
    const cy = GRID_Y + r * CELL_H + CELL_H / 2;
    for (let k = 0; k < 2; k++) {
      const x0 = W - 34 - k * 16;
      b.beginPath();
      b.moveTo(x0 + 9, cy - 9);
      b.lineTo(x0, cy);
      b.lineTo(x0 + 9, cy + 9);
      b.stroke();
    }
  }
  // 左侧基地墙
  const wallGrad = b.createLinearGradient(0, 0, GRID_X - 8, 0);
  wallGrad.addColorStop(0, '#222e42');
  wallGrad.addColorStop(1, '#182234');
  b.fillStyle = wallGrad;
  b.fillRect(0, 0, GRID_X - 8, H);
  // 立管
  b.fillStyle = '#2c3a52';
  b.fillRect(6, 0, 7, H);
  for (let y = 14; y < H; y += 34) {
    b.fillStyle = '#3a4b68';
    b.fillRect(4, y, 11, 5);
  }
  // 墙面铆钉
  b.fillStyle = 'rgba(120,145,175,0.4)';
  for (let y = 24; y < H; y += 46) {
    b.beginPath(); b.arc(48, y, 1.8, 0, TAU); b.fill();
    b.beginPath(); b.arc(22, y + 20, 1.8, 0, TAU); b.fill();
  }
  // 警戒条纹
  b.save();
  b.beginPath();
  b.rect(GRID_X - 8, 0, 8, H);
  b.clip();
  for (let y = -20; y < H + 20; y += 16) {
    b.fillStyle = (y / 16) % 2 === 0 ? '#ffc531' : '#20242c';
    b.save();
    b.translate(GRID_X - 4, y);
    b.rotate(-0.6);
    b.fillRect(-12, 0, 24, 8);
    b.restore();
  }
  b.restore();
  // 基地盾徽 + 文字
  b.save();
  b.shadowColor = 'rgba(76,194,255,0.7)';
  b.shadowBlur = 14;
  b.fillStyle = '#2a3850';
  b.beginPath();
  b.arc(31, H / 2 - 88, 17, 0, TAU);
  b.fill();
  b.restore();
  b.font = '900 17px sans-serif';
  b.textAlign = 'center';
  b.textBaseline = 'middle';
  b.fillText('🛡️', 31, H / 2 - 87);
  b.fillStyle = '#9db2c9';
  b.font = '800 20px "PingFang SC","Microsoft YaHei",sans-serif';
  b.fillText('基', 31, H / 2 - 40);
  b.fillText('地', 31, H / 2 - 12);
  b.fillStyle = 'rgba(143,161,184,0.5)';
  b.font = '10px sans-serif';
  b.fillText('DEFEND', 31, H / 2 + 66);
  // 顶部环境光
  const top = b.createLinearGradient(0, 0, 0, 90);
  top.addColorStop(0, 'rgba(140,180,230,0.05)');
  top.addColorStop(1, 'rgba(140,180,230,0)');
  b.fillStyle = top;
  b.fillRect(0, 0, W, 90);
}

function drawVignette() {
  if (!vignetteGrad) {
    vignetteGrad = g.createRadialGradient(W / 2, H / 2, H * 0.5, W / 2, H / 2, H * 0.92);
    vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vignetteGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
  }
  g.fillStyle = vignetteGrad;
  g.fillRect(0, 0, W, H);
}

/* ---- 机器绘制 ---- */
const EMBLEM_COLOR = {
  shot: '#ffd764', energy: '#ffc531', armor: '#8fb0cc', melee: '#e04848',
  frost: '#7fd7ff', shred: '#c8d4e0', magnet: '#ff9d2e', zap: '#c77bff',
  laser: '#ff8c50', rocket: '#ff5d5d',
  mine: '#b0783c', flame: '#ff7a2e', poison: '#8be04a', mortar: '#d0a56a',
  sniper: '#ffe0a8', repair: '#58d68b',
};
// 徽章位置：先右侧一列，再左侧，最后上下（超出则汇总为 +N）
const EMBLEM_POS = [
  [29, -36], [29, -11], [29, 14], [-29, -36],
  [-29, -11], [-29, 14], [0, -50], [16, 40],
];

/* ===== 材质与通用绘制助手 ===== */
// 三档材质：1 钢铁 / 2 合金 / 3 秘金
const TIERS = [
  { base: '#6d8296', dark: '#334254', light: '#a9bdd0', trim: '#8fa1b8', seam: 'rgba(255,255,255,0.10)', led: '#ffc531' },
  { base: '#7fa9cf', dark: '#2b587f', light: '#d3e9fb', trim: '#bfe3ff', seam: 'rgba(127,215,255,0.55)', led: '#7fd7ff' },
  { base: '#5a5170', dark: '#241f33', light: '#b6a6e6', trim: '#e8c877', seam: 'rgba(232,200,119,0.55)', led: '#ffd764' },
];
function pal(lv) { return TIERS[Math.min(Math.max(lv || 1, 1), 3) - 1]; }

// 斜面金属板：上亮下暗 + 描边
function panel(ctx, x, y, w, h, r, P, noEdge) {
  const gd = ctx.createLinearGradient(x, y, x, y + h);
  gd.addColorStop(0, P.light);
  gd.addColorStop(0.42, P.base);
  gd.addColorStop(1, P.dark);
  ctx.fillStyle = gd;
  rr(ctx, x, y, w, h, r); ctx.fill();
  if (!noEdge) {
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.4;
    rr(ctx, x, y, w, h, r); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    rr(ctx, x + 2, y + 1.5, Math.max(w * 0.28, 5), Math.max(h - 4, 3), Math.min(r, 4)); ctx.fill();
  }
}
// 铆钉
function bolt(ctx, x, y, P, rad) {
  const R = rad || 2;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.arc(x, y + 0.6, R, 0, TAU); ctx.fill();
  ctx.fillStyle = P.light;
  ctx.beginPath(); ctx.arc(x, y, R * 0.75, 0, TAU); ctx.fill();
}
// 发光包装
function emissive(ctx, color, blur, fn) {
  ctx.save();
  ctx.shadowBlur = blur;
  ctx.shadowColor = color;
  fn();
  ctx.restore();
}
// 警戒斜纹条
function hazard(ctx, x, y, w, h, r) {
  ctx.save();
  rr(ctx, x, y, w, h, r || 3);
  ctx.clip();
  const n = Math.ceil(w / 11) + 3;
  for (let i = -2; i < n; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#ffc531' : '#25292f';
    ctx.save();
    ctx.translate(x + i * 11, y + h / 2);
    ctx.rotate(-0.55);
    ctx.fillRect(-5, -h, 10, h * 2.6);
    ctx.restore();
  }
  ctx.restore();
}
// 底盘（多数机器共用）
function pedestal(ctx, P, w, lv) {
  const half = (w || 42) / 2;
  panel(ctx, -half, 16, half * 2, 20, 6, P);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  rr(ctx, -half + 5, 20, half * 2 - 10, 4, 2); ctx.fill();
  bolt(ctx, -half + 6, 30, P);
  bolt(ctx, half - 6, 30, P);
  if (lv >= 2) { hazard(ctx, -half, 32, half * 2, 5, 2); }
  if (lv >= 3) {
    ctx.fillStyle = P.trim;
    rr(ctx, -half - 3, 14, half * 2 + 6, 4, 2); ctx.fill();
  }
}

function drawMachine(ctx, type, x, y, s, m) {
  const mods = (m && m.modules) ? m.modules : (modulesOfType(type) || []);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(0, 36, 30, 7, 0, 0, TAU);
  ctx.fill();
  if (type === 'box') {
    drawGiftBox(ctx, m);
    ctx.restore();
    if (m && m.maxHp && m.hp < m.maxHp) {
      drawBar(ctx, x, y - 52 * s, 44 * s, 5, clamp(m.hp / m.maxHp, 0, 1));
    }
    return;
  }
  const pri = mods[0];
  if (pri) drawLevelDecor(ctx, totalLv(mods));
  drawChassis(ctx, type, pri, m);
  // 副能力徽章：环绕机体排布，数量不限（超过 8 个显示 +N）
  const extra = mods.length - 1;
  const shown = Math.min(extra, EMBLEM_POS.length);
  for (let i = 1; i <= shown; i++) {
    const pos = EMBLEM_POS[i - 1];
    drawEmblem(ctx, mods[i], pos[0], pos[1]);
  }
  if (extra > shown) {
    ctx.save();
    ctx.translate(0, 46);
    ctx.fillStyle = 'rgba(14,20,28,0.94)';
    rr(ctx, -16, -9, 32, 18, 8); ctx.fill();
    ctx.strokeStyle = '#ffc531';
    ctx.lineWidth = 1.6;
    rr(ctx, -16, -9, 32, 18, 8); ctx.stroke();
    ctx.fillStyle = '#ffc531';
    ctx.font = '800 12px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+' + (extra - shown), 0, 0);
    ctx.restore();
  }
  ctx.restore();
  // 血条
  if (m && m.maxHp && m.hp < m.maxHp) {
    drawBar(ctx, x, y - 52 * s, 44 * s, 5, clamp(m.hp / m.maxHp, 0, 1));
  }
}

// 机体造型分发：经典组合有专属造型，其余按主模块 + 等级（1/2/3 各有专属外观）
function drawChassis(ctx, type, pri, m) {
  switch (type) {
    case 'arcturret': return drawArcturret(ctx, m);
    case 'magshredder': return drawMagshredder(ctx, m);
    case 'frostwall': return drawFrostwall(ctx, m);
    case 'frostcannon': return drawFrostcannon(ctx, m);
  }
  if (!pri) return;
  const lv = Math.min(pri.lv, 3);
  switch (pri.kind) {
    case 'shot': return lv >= 3 ? drawGatling(ctx, m) : lv === 2 ? drawTwinturret(ctx, m) : drawTurret(ctx, m);
    case 'energy': return lv >= 3 ? drawFusionCore(ctx, m) : lv === 2 ? drawPowerplant(ctx, m) : drawGenerator(ctx, m);
    case 'armor': return lv >= 3 ? drawFortress(ctx, m) : lv === 2 ? drawAlloyWall(ctx, m) : drawBarricade(ctx, m);
    case 'melee': return drawPuncher(ctx, m, lv);
    case 'frost': return drawFan(ctx, m, lv);
    case 'shred': return drawShredder(ctx, m, lv);
    case 'magnet': return drawMagnet(ctx, m, lv);
    case 'zap': return drawTesla(ctx, m, lv);
    case 'laser': return drawRailgun(ctx, m, lv);
    case 'rocket': return drawRocket(ctx, m, lv);
    case 'mine': return drawMineLayer(ctx, m, lv);
    case 'flame': return drawFlamer(ctx, m, lv);
    case 'poison': return drawPoison(ctx, m, lv);
    case 'mortar': return drawMortar(ctx, m, lv);
    case 'sniper': return drawSniper(ctx, m, lv);
    case 'repair': return drawRepair(ctx, m, lv);
  }
}

// 等级光环：合成度越高越华丽
function drawLevelDecor(ctx, tl) {
  if (tl <= 1) return;
  const pulse = Math.sin(time * 4) * 0.05;
  if (tl >= 7) {
    ctx.fillStyle = 'rgba(127,215,255,' + (0.15 + pulse) + ')';
    ctx.beginPath(); ctx.ellipse(0, 34, 40, 11, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(200,240,255,' + (0.65 + pulse) + ')';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(0, 34, 40, 11, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(127,215,255,' + (0.45 + pulse) + ')';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, 34, 33, 8.5, 0, 0, TAU); ctx.stroke();
  } else if (tl >= 4) {
    ctx.fillStyle = 'rgba(199,123,255,' + (0.14 + pulse) + ')';
    ctx.beginPath(); ctx.ellipse(0, 34, 36, 10, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(199,123,255,' + (0.55 + pulse) + ')';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(0, 34, 36, 10, 0, 0, TAU); ctx.stroke();
  } else if (tl === 3) {
    ctx.fillStyle = 'rgba(255,157,46,' + (0.12 + pulse) + ')';
    ctx.beginPath(); ctx.ellipse(0, 34, 34, 9, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,157,46,' + (0.5 + pulse) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 34, 34, 9, 0, 0, TAU); ctx.stroke();
  } else {
    ctx.strokeStyle = 'rgba(255,197,49,' + (0.45 + pulse) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 34, 32, 8, 0, 0, TAU); ctx.stroke();
  }
}

// 副模块徽章
function drawEmblem(ctx, mod, px, py) {
  const col = EMBLEM_COLOR[mod.kind] || '#8fa1b8';
  ctx.save();
  ctx.translate(px === undefined ? 29 : px, py === undefined ? -36 : py);
  ctx.fillStyle = 'rgba(14,20,28,0.94)';
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.stroke();
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = 1.8;
  switch (mod.kind) {
    case 'shot':
      ctx.beginPath(); ctx.arc(-2, 0, 3.4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(7, 0); ctx.stroke();
      break;
    case 'energy':
    case 'zap':
      ctx.beginPath();
      ctx.moveTo(2, -6); ctx.lineTo(-3, 1); ctx.lineTo(0, 1); ctx.lineTo(-2, 6); ctx.lineTo(3, -1); ctx.lineTo(0, -1);
      ctx.closePath(); ctx.fill();
      break;
    case 'armor':
      ctx.beginPath();
      ctx.moveTo(0, -6); ctx.lineTo(5, -3); ctx.lineTo(5, 2); ctx.quadraticCurveTo(5, 6, 0, 7);
      ctx.quadraticCurveTo(-5, 6, -5, 2); ctx.lineTo(-5, -3); ctx.closePath(); ctx.stroke();
      break;
    case 'melee':
      ctx.beginPath(); ctx.arc(1, 0, 4.2, 0, TAU); ctx.fill();
      ctx.fillRect(-7, -2, 5, 4);
      break;
    case 'frost':
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(-Math.cos(a) * 6, -Math.sin(a) * 6);
        ctx.lineTo(Math.cos(a) * 6, Math.sin(a) * 6);
        ctx.stroke();
      }
      break;
    case 'shred':
      ctx.beginPath();
      ctx.moveTo(-6, -2);
      for (let i = 0; i < 4; i++) {
        ctx.lineTo(-4.5 + i * 3, 3);
        ctx.lineTo(-3 + i * 3, -2);
      }
      ctx.stroke();
      break;
    case 'magnet':
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 1, 4.5, Math.PI, 0); ctx.stroke();
      ctx.fillRect(-6, 1, 3, 4); ctx.fillRect(3, 1, 3, 4);
      break;
    case 'laser':
      ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(6, -2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-6, 2); ctx.lineTo(6, 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(6, 0, 2, 0, TAU); ctx.fill();
      break;
    case 'rocket':
      ctx.beginPath();
      ctx.moveTo(0, -7); ctx.lineTo(4, 3); ctx.lineTo(0, 1); ctx.lineTo(-4, 3);
      ctx.closePath(); ctx.fill();
      break;
    case 'mine':
      ctx.beginPath(); ctx.ellipse(0, 2, 6, 3.4, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(0, -6); ctx.stroke();
      break;
    case 'flame':
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.quadraticCurveTo(5, -1, 3, 3);
      ctx.quadraticCurveTo(0, 7, -3, 3);
      ctx.quadraticCurveTo(-5, -1, 0, -7);
      ctx.closePath(); ctx.fill();
      break;
    case 'poison':
      ctx.beginPath(); ctx.arc(0, -1, 4.4, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -1, 1.6, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-4, 5); ctx.lineTo(4, 5); ctx.stroke();
      break;
    case 'mortar':
      ctx.save();
      ctx.rotate(-0.6);
      ctx.fillRect(-2.5, -7, 5, 12);
      ctx.restore();
      ctx.beginPath(); ctx.arc(0, 6, 2.2, 0, TAU); ctx.fill();
      break;
    case 'sniper':
      ctx.beginPath(); ctx.arc(0, 0, 5.2, 0, TAU); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-7, 0); ctx.lineTo(7, 0);
      ctx.moveTo(0, -7); ctx.lineTo(0, 7);
      ctx.stroke();
      break;
    case 'repair':
      ctx.fillRect(-1.8, -6, 3.6, 12);
      ctx.fillRect(-6, -1.8, 12, 3.6);
      break;
  }
  if (mod.lv > 1) {
    ctx.fillStyle = '#ffc531';
    const dots = Math.min(mod.lv, 5);
    for (let i = 0; i < dots; i++) {
      ctx.beginPath(); ctx.arc(-((dots - 1) * 3) + i * 6, 14, 2, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

// 圆角血条
function drawBar(ctx, cx, by, bw, bh, ratio, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  rr(ctx, cx - bw / 2 - 1, by - 1, bw + 2, bh + 2, 3);
  ctx.fill();
  if (ratio > 0) {
    ctx.fillStyle = color || (ratio > 0.4 ? '#58d68b' : '#ff5d5d');
    rr(ctx, cx - bw / 2, by, Math.max(bw * ratio, 2), bh, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    rr(ctx, cx - bw / 2, by, Math.max(bw * ratio, 2), bh / 2.4, 2);
    ctx.fill();
  }
}

function drawGiftBox(ctx, m) {
  const spin = m && m.spin ? m.spin : 0;
  const progress = m && m.openT !== undefined ? 1 - m.openT / BOX_OPEN_TIME : 0;
  const wob = Math.sin(spin * 4) * (0.06 + progress * 0.18);
  ctx.rotate(wob);
  const pop = 1 + progress * 0.12;
  ctx.scale(pop, pop);
  const bodyG = ctx.createLinearGradient(-24, -12, 24, 28);
  bodyG.addColorStop(0, '#ffb14d');
  bodyG.addColorStop(1, '#e2820f');
  ctx.fillStyle = bodyG;
  rr(ctx, -24, -12, 48, 40, 6); ctx.fill();
  ctx.fillStyle = '#d1760c';
  rr(ctx, -24, 16, 48, 12, 5); ctx.fill();
  ctx.fillStyle = '#ff5d5d';
  ctx.fillRect(-5, -12, 10, 40);
  const lidG = ctx.createLinearGradient(0, -24, 0, -10);
  lidG.addColorStop(0, '#ffe08a');
  lidG.addColorStop(1, '#f0ac1c');
  ctx.fillStyle = lidG;
  rr(ctx, -28, -24, 56, 14, 5); ctx.fill();
  ctx.fillStyle = '#ff5d5d';
  ctx.fillRect(-5, -24, 10, 14);
  ctx.fillStyle = '#ff5d5d';
  ctx.beginPath(); ctx.ellipse(-9, -29, 7, 5, -0.4, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(9, -29, 7, 5, 0.4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#d94343';
  ctx.beginPath(); ctx.arc(0, -28, 3.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff7e6';
  ctx.font = '900 20px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 12, 6);
}

/* ===== 射击线：自动炮台 → 双管炮台 → 加特林炮台 ===== */
function drawTurret(ctx, m) {
  const P = pal(1);
  const rec = (m && m.recoil > 0) ? m.recoil * 30 : 0;
  pedestal(ctx, P, 40, 1);
  panel(ctx, -14, 4, 28, 16, 5, P);
  // 炮管
  panel(ctx, 2 - rec, -16, 36, 12, 4, P);
  ctx.fillStyle = P.dark;
  rr(ctx, 30 - rec, -18, 9, 16, 3); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.ellipse(38 - rec, -10, 2, 5, 0, 0, TAU); ctx.fill();
  // 炮塔球
  const dome = ctx.createRadialGradient(-9, -14, 2, -4, -8, 20);
  dome.addColorStop(0, '#b7cade');
  dome.addColorStop(0.5, P.base);
  dome.addColorStop(1, P.dark);
  ctx.fillStyle = dome;
  ctx.beginPath(); ctx.arc(-4, -8, 17, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(-4, -8, 17, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath(); ctx.ellipse(-10, -15, 6, 4, -0.6, 0, TAU); ctx.fill();
  bolt(ctx, -14, -2, P, 1.8);
  bolt(ctx, 4, -2, P, 1.8);
  emissive(ctx, 'rgba(255,197,49,0.9)', 7, () => {
    ctx.fillStyle = P.led;
    ctx.beginPath(); ctx.arc(-4, -22, 3, 0, TAU); ctx.fill();
  });
  if (rec > 0) {
    emissive(ctx, 'rgba(255,210,110,0.95)', 12, () => {
      ctx.fillStyle = 'rgba(255,225,150,0.9)';
      ctx.beginPath(); ctx.arc(42 - rec, -10, 4 + rec * 0.3, 0, TAU); ctx.fill();
    });
  }
}

function drawTwinturret(ctx, m) {
  const P = pal(2);
  const rec = (m && m.recoil > 0) ? m.recoil * 28 : 0;
  const up = m && m.altBarrel;
  pedestal(ctx, P, 44, 2);
  panel(ctx, -15, 2, 30, 18, 5, P);
  // 双炮管 + 冷却环
  for (const [oy, r0] of [[-24, up ? rec : 0], [-10, up ? 0 : rec]]) {
    panel(ctx, 2 - r0, oy, 36, 10, 4, P);
    ctx.fillStyle = P.dark;
    rr(ctx, 30 - r0, oy - 2, 9, 14, 3); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    for (let i = 0; i < 3; i++) { rr(ctx, 8 + i * 7 - r0, oy - 1, 2.5, 12, 1); ctx.fill(); }
  }
  // 炮塔
  const dome = ctx.createRadialGradient(-9, -18, 2, -4, -10, 22);
  dome.addColorStop(0, '#e4f3ff');
  dome.addColorStop(0.45, P.base);
  dome.addColorStop(1, P.dark);
  ctx.fillStyle = dome;
  ctx.beginPath(); ctx.arc(-4, -10, 18, 0, TAU); ctx.fill();
  ctx.strokeStyle = P.seam;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(-4, -10, 14, -0.6, 2.2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.beginPath(); ctx.ellipse(-11, -17, 6, 4, -0.6, 0, TAU); ctx.fill();
  emissive(ctx, 'rgba(127,215,255,0.9)', 8, () => {
    ctx.fillStyle = P.led;
    ctx.beginPath(); ctx.arc(-10, -26, 2.8, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-1, -28, 2.8, 0, TAU); ctx.fill();
  });
}

function drawGatling(ctx, m) {
  const P = pal(3);
  const rec = (m && m.recoil > 0) ? m.recoil * 22 : 0;
  const spin = (m && m.spin ? m.spin : 0) * 7;
  pedestal(ctx, P, 48, 3);
  panel(ctx, -16, 2, 32, 18, 5, P);
  // 弹链箱
  panel(ctx, -32, -18, 15, 28, 4, P);
  ctx.fillStyle = '#ffc531';
  for (let i = 0; i < 4; i++) { rr(ctx, -29, -14 + i * 6, 9, 3.6, 1.4); ctx.fill(); }
  ctx.strokeStyle = P.trim;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-17, -6); ctx.lineTo(-8, -6); ctx.stroke();
  // 旋转三管
  for (let i = 0; i < 3; i++) {
    const a = spin + i * TAU / 3;
    const dy = Math.sin(a) * 6;
    const front = Math.cos(a) > 0;
    ctx.fillStyle = front ? P.light : P.dark;
    rr(ctx, 6 - rec, -14 + dy, 36, 6.5, 3); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    rr(ctx, 34 - rec, -14 + dy, 6, 6.5, 2); ctx.fill();
  }
  // 管束箍环
  ctx.fillStyle = P.trim;
  rr(ctx, 18 - rec, -20, 6, 24, 3); ctx.fill();
  rr(ctx, 36 - rec, -19, 5, 22, 2.5); ctx.fill();
  // 炮塔（暗金）
  const dome = ctx.createRadialGradient(-10, -18, 2, -4, -10, 22);
  dome.addColorStop(0, '#cbb8f5');
  dome.addColorStop(0.45, P.base);
  dome.addColorStop(1, P.dark);
  ctx.fillStyle = dome;
  ctx.beginPath(); ctx.arc(-4, -10, 18, 0, TAU); ctx.fill();
  ctx.strokeStyle = P.trim;
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(-4, -10, 18, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath(); ctx.ellipse(-11, -17, 6, 4, -0.6, 0, TAU); ctx.fill();
  emissive(ctx, 'rgba(255,157,46,0.95)', 10, () => {
    ctx.fillStyle = '#ff9d2e';
    ctx.beginPath(); ctx.arc(-4, -26, 3.2, 0, TAU); ctx.fill();
  });
  if (rec > 0) {
    emissive(ctx, 'rgba(255,200,90,0.95)', 16, () => {
      ctx.fillStyle = 'rgba(255,230,160,0.95)';
      ctx.beginPath(); ctx.arc(48 - rec, -10, 6 + rec * 0.4, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,180,60,0.6)';
      ctx.beginPath();
      ctx.moveTo(42 - rec, -16); ctx.lineTo(58 - rec, -10); ctx.lineTo(42 - rec, -4);
      ctx.closePath(); ctx.fill();
    });
  }
}

/* ===== 能量线：发电机 → 聚变电站 → 核能核心 ===== */
function drawGenerator(ctx, m) {
  const P = pal(1);
  const glow = m && m.pulse > 0 ? m.pulse * 2 : 0;
  if (glow > 0) {
    ctx.fillStyle = 'rgba(255,197,49,' + (0.25 * glow) + ')';
    ctx.beginPath(); ctx.arc(0, 0, 40, 0, TAU); ctx.fill();
  }
  const shell = ctx.createLinearGradient(-20, 0, 20, 0);
  shell.addColorStop(0, '#243342');
  shell.addColorStop(0.32, '#41586e');
  shell.addColorStop(0.58, '#2b3a4a');
  shell.addColorStop(1, '#1f2c39');
  ctx.fillStyle = shell;
  rr(ctx, -20, -24, 40, 58, 8); ctx.fill();
  ctx.strokeStyle = '#546a80';
  ctx.lineWidth = 2;
  rr(ctx, -20, -24, 40, 58, 8); ctx.stroke();
  const cap = ctx.createLinearGradient(0, -32, 0, -23);
  cap.addColorStop(0, '#ffe084');
  cap.addColorStop(1, '#e8a20f');
  ctx.fillStyle = cap;
  rr(ctx, -8, -32, 16, 9, 3); ctx.fill();
  const win = ctx.createLinearGradient(-13, -16, 13, 26);
  win.addColorStop(0, '#46648a');
  win.addColorStop(1, '#2e415a');
  ctx.fillStyle = win;
  rr(ctx, -13, -16, 26, 42, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  rr(ctx, -11, -14, 8, 38, 3); ctx.fill();
  emissive(ctx, 'rgba(255,197,49,0.8)', 8 + glow * 8, () => {
    ctx.fillStyle = '#ffc531';
    ctx.beginPath();
    ctx.moveTo(4, -12); ctx.lineTo(-8, 6); ctx.lineTo(-1, 6);
    ctx.lineTo(-4, 20); ctx.lineTo(9, 0); ctx.lineTo(2, 0);
    ctx.closePath(); ctx.fill();
  });
  bolt(ctx, -15, -20, P, 1.7);
  bolt(ctx, 15, -20, P, 1.7);
}

function drawPowerplant(ctx, m) {
  const P = pal(2);
  const glow = m && m.pulse > 0 ? m.pulse * 2 : 0;
  ctx.fillStyle = 'rgba(255,197,49,' + (0.12 + 0.25 * glow) + ')';
  ctx.beginPath(); ctx.arc(0, -2, 42, 0, TAU); ctx.fill();
  panel(ctx, -24, -26, 48, 60, 9, P);
  // 双正极
  ctx.fillStyle = '#ffc531';
  rr(ctx, -17, -34, 14, 9, 3); ctx.fill();
  rr(ctx, 3, -34, 14, 9, 3); ctx.fill();
  // 反应窗
  const win = ctx.createLinearGradient(-17, -18, 17, 28);
  win.addColorStop(0, '#31536f');
  win.addColorStop(1, '#1d3247');
  ctx.fillStyle = win;
  rr(ctx, -17, -18, 34, 46, 5); ctx.fill();
  emissive(ctx, 'rgba(255,197,49,0.85)', 9, () => {
    ctx.fillStyle = '#ffc531';
    for (const ox of [-9, 7]) {
      ctx.beginPath();
      ctx.moveTo(ox + 3, -12); ctx.lineTo(ox - 5, 4); ctx.lineTo(ox, 4);
      ctx.lineTo(ox - 2, 18); ctx.lineTo(ox + 6, 0); ctx.lineTo(ox + 1, 0);
      ctx.closePath(); ctx.fill();
    }
  });
  // 电子轨道
  ctx.strokeStyle = 'rgba(255,215,100,0.75)';
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.ellipse(0, 2, 30, 11, -0.5, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 2, 30, 11, 0.5, 0, TAU); ctx.stroke();
  bolt(ctx, -19, -21, P, 1.8);
  bolt(ctx, 19, -21, P, 1.8);
}

function drawFusionCore(ctx, m) {
  const P = pal(3);
  const glow = m && m.pulse > 0 ? m.pulse * 2 : 0;
  const t = time;
  ctx.fillStyle = 'rgba(255,197,49,' + (0.14 + 0.28 * glow) + ')';
  ctx.beginPath(); ctx.arc(0, -2, 48, 0, TAU); ctx.fill();
  // 底座与支柱
  pedestal(ctx, P, 46, 3);
  panel(ctx, -10, -6, 20, 26, 4, P);
  // 环形磁笼
  ctx.strokeStyle = P.trim;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, -14, 26, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -14, 26, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  ctx.fillStyle = P.dark;
  rr(ctx, -30, -18, 9, 10, 3); ctx.fill();
  rr(ctx, 21, -18, 9, 10, 3); ctx.fill();
  // 核心球
  const core = ctx.createRadialGradient(0, -16, 2, 0, -14, 18);
  core.addColorStop(0, '#fffbe8');
  core.addColorStop(0.4, '#ffd764');
  core.addColorStop(1, '#e06a12');
  emissive(ctx, 'rgba(255,190,70,0.95)', 18 + glow * 10, () => {
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(0, -14, 13 + Math.sin(t * 4) * 0.8 + glow * 2, 0, TAU); ctx.fill();
  });
  // 旋转轨道
  ctx.strokeStyle = 'rgba(255,224,150,0.85)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.translate(0, -14);
    ctx.rotate(t * 1.1 + i * TAU / 3);
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 7, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#fff2c4';
    ctx.beginPath(); ctx.arc(22, 0, 2.6, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

/* ===== 装甲线：装甲路障 → 合金壁垒 → 千钧堡垒 ===== */
function drawBarricade(ctx, m) {
  const P = pal(1);
  const dmg = m && m.maxHp ? 1 - m.hp / m.maxHp : 0;
  panel(ctx, -26, -34, 52, 70, 7, P);
  hazard(ctx, -26, -34, 52, 13, 6);
  ctx.fillStyle = P.dark;
  rr(ctx, -26, -8, 52, 8, 3); ctx.fill();
  rr(ctx, -26, 14, 52, 8, 3); ctx.fill();
  for (const py of [-4, 18]) for (const px of [-19, 0, 19]) bolt(ctx, px, py, P, 2.2);
  if (dmg > 0.35) {
    ctx.strokeStyle = 'rgba(15,20,26,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-10, -30); ctx.lineTo(-2, -12); ctx.lineTo(-12, 2); ctx.stroke();
  }
  if (dmg > 0.7) {
    ctx.strokeStyle = 'rgba(15,20,26,0.9)';
    ctx.beginPath(); ctx.moveTo(16, -26); ctx.lineTo(8, -4); ctx.lineTo(20, 10); ctx.lineTo(10, 28); ctx.stroke();
  }
}

// 合金壁垒：切角合金板 + 发光能量缝 + 六角螺栓
function drawAlloyWall(ctx, m) {
  const P = pal(2);
  const dmg = m && m.maxHp ? 1 - m.hp / m.maxHp : 0;
  const w = 56, h = 74, x = -w / 2, y = -36, ch = 11; // ch=切角
  // 切角外形
  ctx.beginPath();
  ctx.moveTo(x + ch, y);
  ctx.lineTo(x + w - ch, y);
  ctx.lineTo(x + w, y + ch);
  ctx.lineTo(x + w, y + h - ch);
  ctx.lineTo(x + w - ch, y + h);
  ctx.lineTo(x + ch, y + h);
  ctx.lineTo(x, y + h - ch);
  ctx.lineTo(x, y + ch);
  ctx.closePath();
  const gd = ctx.createLinearGradient(x, y, x + w, y + h);
  gd.addColorStop(0, '#d3e9fb');
  gd.addColorStop(0.35, P.base);
  gd.addColorStop(0.62, '#5d89ae');
  gd.addColorStop(1, P.dark);
  ctx.fillStyle = gd;
  ctx.fill();
  ctx.strokeStyle = '#1e3d59';
  ctx.lineWidth = 2;
  ctx.stroke();
  // 竖向合金肋
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + ch, y); ctx.lineTo(x + w - ch, y); ctx.lineTo(x + w, y + ch);
  ctx.lineTo(x + w, y + h - ch); ctx.lineTo(x + w - ch, y + h); ctx.lineTo(x + ch, y + h);
  ctx.lineTo(x, y + h - ch); ctx.lineTo(x, y + ch); ctx.closePath();
  ctx.clip();
  for (const rx of [-15, 1, 15]) {
    const rg = ctx.createLinearGradient(rx - 6, 0, rx + 6, 0);
    rg.addColorStop(0, 'rgba(255,255,255,0.22)');
    rg.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    rg.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = rg;
    ctx.fillRect(rx - 6, y, 12, h);
  }
  // 能量缝
  emissive(ctx, 'rgba(127,215,255,0.9)', 8, () => {
    ctx.strokeStyle = P.seam;
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(x + 3, -12); ctx.lineTo(x + w - 3, -12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 3, 14); ctx.lineTo(x + w - 3, 14); ctx.stroke();
  });
  // 斜向高光扫过
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.moveTo(x - 4, y + h * 0.72); ctx.lineTo(x + w * 0.62, y - 4);
  ctx.lineTo(x + w * 0.78, y - 4); ctx.lineTo(x + 6, y + h * 0.86);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  // 上下加固梁
  ctx.fillStyle = '#27506f';
  rr(ctx, x + 2, y + 2, w - 4, 9, 4); ctx.fill();
  rr(ctx, x + 2, y + h - 11, w - 4, 9, 4); ctx.fill();
  ctx.fillStyle = P.trim;
  for (let i = 0; i < 5; i++) { rr(ctx, x + 6 + i * 10, y + 4.5, 6, 4, 1.6); ctx.fill(); }
  // 六角螺栓
  const hexBolt = (bx, by) => {
    ctx.fillStyle = '#1d3a52';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6 + 0.5;
      ctx[i ? 'lineTo' : 'moveTo'](bx + Math.cos(a) * 4.4, by + Math.sin(a) * 4.4);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9fc9e8';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6 + 0.5;
      ctx[i ? 'lineTo' : 'moveTo'](bx + Math.cos(a) * 2.6, by + Math.sin(a) * 2.6);
    }
    ctx.closePath(); ctx.fill();
  };
  hexBolt(x + 9, y + ch + 6); hexBolt(x + w - 9, y + ch + 6);
  hexBolt(x + 9, y + h - ch - 6); hexBolt(x + w - 9, y + h - ch - 6);
  // 中央徽记
  emissive(ctx, 'rgba(127,215,255,0.8)', 7, () => {
    ctx.strokeStyle = '#bfe3ff';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(8, -1); ctx.lineTo(8, 5);
    ctx.quadraticCurveTo(8, 11, 0, 14);
    ctx.quadraticCurveTo(-8, 11, -8, 5);
    ctx.lineTo(-8, -1); ctx.closePath();
    ctx.stroke();
  });
  if (dmg > 0.4) {
    ctx.strokeStyle = 'rgba(10,25,38,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-8, -26); ctx.lineTo(0, -8); ctx.lineTo(-10, 6); ctx.stroke();
  }
  if (dmg > 0.75) {
    ctx.beginPath(); ctx.moveTo(14, -20); ctx.lineTo(6, 0); ctx.lineTo(18, 16); ctx.stroke();
  }
}

// 千钧堡垒：城垛 + 侧翼扶壁 + 能量核心 + 护盾波纹
function drawFortress(ctx, m) {
  const P = pal(3);
  const dmg = m && m.maxHp ? 1 - m.hp / m.maxHp : 0;
  const t = time;
  // 护盾波纹
  ctx.strokeStyle = 'rgba(255,215,100,' + (0.22 + Math.sin(t * 3) * 0.07) + ')';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, -2, 38, 44, 0, 0, TAU); ctx.stroke();
  // 侧翼扶壁
  for (const sx of [-30, 22]) {
    panel(ctx, sx, -20, 12, 56, 4, P);
    ctx.fillStyle = P.trim;
    rr(ctx, sx - 1, -24, 14, 6, 2); ctx.fill();
    // 尖刺
    ctx.fillStyle = P.light;
    ctx.beginPath();
    ctx.moveTo(sx + 6, -26); ctx.lineTo(sx + 10, -38); ctx.lineTo(sx + 2, -38);
    ctx.closePath(); ctx.fill();
  }
  // 主墙体
  const gd = ctx.createLinearGradient(-24, -30, 24, 36);
  gd.addColorStop(0, '#6e6488');
  gd.addColorStop(0.45, P.base);
  gd.addColorStop(1, P.dark);
  ctx.fillStyle = gd;
  rr(ctx, -24, -30, 48, 66, 6); ctx.fill();
  ctx.strokeStyle = '#16121f';
  ctx.lineWidth = 2;
  rr(ctx, -24, -30, 48, 66, 6); ctx.stroke();
  // 城垛
  for (let i = 0; i < 4; i++) {
    const bx = -24 + i * 13;
    ctx.fillStyle = P.base;
    rr(ctx, bx, -40, 9, 12, 2); ctx.fill();
    ctx.fillStyle = P.trim;
    rr(ctx, bx, -41, 9, 3, 1.5); ctx.fill();
  }
  // 金色横带
  ctx.fillStyle = P.trim;
  rr(ctx, -26, -14, 52, 5, 2.5); ctx.fill();
  rr(ctx, -26, 20, 52, 5, 2.5); ctx.fill();
  // 石纹分块
  ctx.strokeStyle = 'rgba(20,16,30,0.5)';
  ctx.lineWidth = 1.2;
  for (const ly of [-2, 8]) {
    ctx.beginPath(); ctx.moveTo(-22, ly); ctx.lineTo(22, ly); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, -2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-11, -2); ctx.lineTo(-11, 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(11, -2); ctx.lineTo(11, 8); ctx.stroke();
  // 能量核心
  emissive(ctx, 'rgba(255,215,110,0.95)', 14, () => {
    const core = ctx.createRadialGradient(0, 3, 1, 0, 3, 11);
    core.addColorStop(0, '#fff6d8');
    core.addColorStop(1, '#e8a020');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(0, 3, 8 + Math.sin(t * 4) * 0.8, 0, TAU); ctx.fill();
  });
  ctx.strokeStyle = P.trim;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 3, 12, 0, TAU); ctx.stroke();
  // 铆钉
  for (const py of [-22, 30]) for (const px of [-17, 0, 17]) bolt(ctx, px, py, P, 2.2);
  if (dmg > 0.5) {
    ctx.strokeStyle = 'rgba(12,10,18,0.85)';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-14, -26); ctx.lineTo(-6, -10); ctx.lineTo(-16, 4); ctx.stroke();
  }
}

/* ===== 近战线：弹簧拳机 → 连环拳机 → 狂怒拳机 ===== */
function drawPuncher(ctx, m, lv) {
  const P = pal(lv);
  let ext = 0;
  if (m && m.recoil > 0) ext = Math.sin((1 - m.recoil / 0.25) * Math.PI) * (14 + lv * 4);
  pedestal(ctx, P, 40, lv);
  panel(ctx, -16, 2, 24, 20, 5, P);
  panel(ctx, -18, -24, 26, 30, 6, P);
  emissive(ctx, 'rgba(255,197,49,0.85)', 7, () => {
    ctx.fillStyle = P.led;
    ctx.beginPath(); ctx.arc(-6, -16, 3, 0, TAU); ctx.fill();
  });
  const fists = Math.min(lv, 3);
  const rowY = fists === 1 ? [-8] : fists === 2 ? [-18, 2] : [-24, -4, 14];
  for (let i = 0; i < fists; i++) {
    const fy = rowY[i];
    const off = ext * (i === 0 ? 1 : i === 1 ? 0.82 : 0.66);
    // 弹簧
    ctx.strokeStyle = P.light;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const sx = 8, len = 11 + off;
    ctx.moveTo(sx, fy);
    for (let k = 0; k <= 5; k++) ctx.lineTo(sx + (k + 0.5) * len / 6, fy + (k % 2 === 0 ? -5.5 : 5.5));
    ctx.lineTo(sx + len, fy);
    ctx.stroke();
    // 拳套
    const fx = sx + len + 9;
    const fg = ctx.createRadialGradient(fx - 3, fy - 4, 1, fx, fy, 12);
    fg.addColorStop(0, lv >= 3 ? '#ffd2a0' : '#f07a6d');
    fg.addColorStop(1, lv >= 3 ? '#c23a1c' : '#b93434');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(fx, fy, 10 - (fists > 2 ? 1.5 : 0), 0, TAU); ctx.fill();
    ctx.fillStyle = lv >= 3 ? '#8f2a12' : '#932828';
    rr(ctx, fx - 11, fy - 7, 8, 14, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(fx + 3, fy - 4, 3, 0, TAU); ctx.fill();
    // 三级：拳头拖尾火花
    if (lv >= 3 && off > 3) {
      emissive(ctx, 'rgba(255,150,60,0.9)', 10, () => {
        ctx.fillStyle = 'rgba(255,180,90,0.75)';
        ctx.beginPath();
        ctx.moveTo(sx + 4, fy - 5); ctx.lineTo(sx - 8, fy); ctx.lineTo(sx + 4, fy + 5);
        ctx.closePath(); ctx.fill();
      });
    }
  }
}

/* ===== 冰霜线：冷冻风扇 → 暴风冰扇 → 极寒涡轮 ===== */
function drawFan(ctx, m, lv) {
  const P = pal(lv);
  const spin = m && m.spin ? m.spin : 0;
  const R = lv >= 3 ? 27 : lv === 2 ? 25 : 24;
  // 支架
  panel(ctx, -6, 8, 12, 26, 3, P);
  panel(ctx, -17, 28, 34, 9, 4, P);
  // 外框
  emissive(ctx, 'rgba(127,215,255,0.75)', lv >= 3 ? 14 : 8, () => {
    ctx.strokeStyle = lv >= 3 ? '#e0f4ff' : '#7fd7ff';
    ctx.lineWidth = lv >= 3 ? 4 : 3;
    ctx.beginPath(); ctx.arc(0, -8, R, 0, TAU); ctx.stroke();
  });
  const glass = ctx.createRadialGradient(-8, -16, 2, 0, -8, R);
  glass.addColorStop(0, 'rgba(120,175,210,0.9)');
  glass.addColorStop(1, 'rgba(24,48,70,0.92)');
  ctx.fillStyle = glass;
  ctx.beginPath(); ctx.arc(0, -8, R - 2, 0, TAU); ctx.fill();
  // 扇叶
  const blades = lv >= 3 ? 6 : lv === 2 ? 4 : 3;
  ctx.fillStyle = lv >= 3 ? '#dff4ff' : '#a8e6ff';
  for (let i = 0; i < blades; i++) {
    ctx.save();
    ctx.translate(0, -8);
    ctx.rotate(spin + i * TAU / blades);
    ctx.beginPath();
    ctx.ellipse(0, -(R * 0.46), R * 0.22, R * 0.5, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  // 中心
  ctx.fillStyle = '#e8f7ff';
  ctx.beginPath(); ctx.arc(0, -8, lv >= 2 ? 6 : 5, 0, TAU); ctx.fill();
  // 栅格
  ctx.strokeStyle = 'rgba(127,215,255,0.45)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 6, -8 + Math.sin(a) * 6);
    ctx.lineTo(Math.cos(a) * (R - 3), -8 + Math.sin(a) * (R - 3));
    ctx.stroke();
  }
  // 二级：侧挂冰晶储罐
  if (lv === 2) {
    ctx.fillStyle = '#cfeeff';
    for (const sx of [-26, 26]) {
      ctx.beginPath();
      ctx.moveTo(sx, 2); ctx.lineTo(sx + 5, 10); ctx.lineTo(sx, 18); ctx.lineTo(sx - 5, 10);
      ctx.closePath(); ctx.fill();
    }
  }
  // 三级：涡轮环 + 冰晶卫星 + 寒雾
  if (lv >= 3) {
    ctx.strokeStyle = 'rgba(200,240,255,0.7)';
    ctx.lineWidth = 2;
    ctx.save();
    ctx.translate(0, -8);
    ctx.rotate(-spin * 0.4);
    ctx.beginPath(); ctx.ellipse(0, 0, R + 8, (R + 8) * 0.34, 0, 0, TAU); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3;
      const px = Math.cos(a) * (R + 8), py = Math.sin(a) * (R + 8) * 0.34;
      ctx.fillStyle = '#e8f9ff';
      ctx.beginPath();
      ctx.moveTo(px, py - 5); ctx.lineTo(px + 4, py); ctx.lineTo(px, py + 5); ctx.lineTo(px - 4, py);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(190,235,255,0.14)';
    ctx.beginPath(); ctx.arc(0, -8, R + 16, 0, TAU); ctx.fill();
  }
}

/* ===== 粉碎线：碎纸机 → 工业碎纸机 → 湮灭粉碎机 ===== */
function drawShredder(ctx, m, lv) {
  const P = pal(lv);
  const chew = m && m.chew > 0 ? m.chew : 0;
  const ready = !m || !m.cd || m.cd <= 0;
  const jx = chew > 0 ? rand(-2, 2) : 0;
  const jy = chew > 0 ? rand(-1.5, 1.5) : 0;
  const void3 = lv >= 3;
  ctx.save();
  ctx.translate(jx, jy);
  // 收集桶
  panel(ctx, -23, -4, 46, 40, 6, P);
  // 观察窗
  ctx.fillStyle = void3 ? '#180f28' : '#1b2733';
  rr(ctx, -15, 2, 30, 28, 4); ctx.fill();
  if (void3) {
    emissive(ctx, 'rgba(199,123,255,0.85)', 10, () => {
      ctx.strokeStyle = '#c77bff';
      ctx.lineWidth = 2.4;
      for (const px of [-8, 0, 8]) {
        ctx.beginPath();
        ctx.moveTo(px, 6);
        ctx.quadraticCurveTo(px + 4, 16, px, 27);
        ctx.stroke();
      }
    });
  } else {
    ctx.strokeStyle = '#dfe7ef';
    ctx.lineWidth = 2.4;
    for (const px of [-9, -3, 3, 9]) {
      ctx.beginPath();
      ctx.moveTo(px, 6);
      ctx.quadraticCurveTo(px + 3, 16, px, 27);
      ctx.stroke();
    }
  }
  // 进料口
  const mouthW = lv >= 2 ? 60 : 56;
  panel(ctx, -mouthW / 2, -26 - chew * 8, mouthW, 24, 6, P);
  ctx.fillStyle = void3 ? '#0d0716' : '#141b25';
  rr(ctx, -mouthW / 2 + 6, -17 - chew * 8, mouthW - 12, 7, 3); ctx.fill();
  // 牙齿
  const teeth = lv >= 3 ? 8 : lv === 2 ? 7 : 6;
  ctx.fillStyle = void3 ? '#d9b8ff' : '#c8d4e0';
  for (let i = 0; i < teeth; i++) {
    const step = (mouthW - 14) / teeth;
    const px = -mouthW / 2 + 7 + i * step;
    ctx.beginPath();
    ctx.moveTo(px, -17 - chew * 8);
    ctx.lineTo(px + step * 0.45, -10 - chew * 4);
    ctx.lineTo(px + step * 0.9, -17 - chew * 8);
    ctx.closePath();
    ctx.fill();
  }
  // 二级：侧置滚轮马达
  if (lv === 2) {
    for (const sx of [-30, 22]) {
      panel(ctx, sx, 4, 9, 20, 3, P);
      ctx.fillStyle = P.dark;
      ctx.beginPath(); ctx.arc(sx + 4.5, 14, 3.4, 0, TAU); ctx.fill();
    }
  }
  // 三级：虚空环 + 吸入粒子
  if (void3) {
    ctx.strokeStyle = 'rgba(199,123,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -22 - chew * 8, 34, 9, 0, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(216,180,255,0.75)';
    for (let i = 0; i < 3; i++) {
      const a = time * 2.2 + i * 2.1;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 28, -22 - chew * 8 + Math.sin(a) * 7, 2, 0, TAU);
      ctx.fill();
    }
  }
  // 状态灯
  emissive(ctx, ready ? 'rgba(88,214,139,0.9)' : 'rgba(255,93,93,0.9)', 7, () => {
    ctx.fillStyle = ready ? '#58d68b' : '#ff5d5d';
    ctx.beginPath(); ctx.arc(mouthW / 2 - 8, -30 - chew * 8, 3.4, 0, TAU); ctx.fill();
  });
  ctx.restore();
}

/* ===== 磁力线：磁力吊塔 → 重力吊塔 → 引力发生器 ===== */
function drawMagnet(ctx, m, lv) {
  const P = pal(lv);
  const flash = m && m.flash > 0 ? m.flash : 0;
  if (lv >= 3) {
    // 引力发生器：悬浮黑洞球 + 双环
    pedestal(ctx, P, 40, 3);
    panel(ctx, -9, -8, 18, 26, 4, P);
    const hover = Math.sin(time * 2) * 3;
    emissive(ctx, 'rgba(255,157,46,0.9)', 16, () => {
      const core = ctx.createRadialGradient(0, -24 + hover, 1, 0, -24 + hover, 15);
      core.addColorStop(0, '#1b1020');
      core.addColorStop(0.55, '#7a3a12');
      core.addColorStop(1, '#ff9d2e');
      ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(0, -24 + hover, 13, 0, TAU); ctx.fill();
    });
    ctx.strokeStyle = 'rgba(255,190,110,0.85)';
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 2; i++) {
      ctx.save();
      ctx.translate(0, -24 + hover);
      ctx.rotate(time * (i ? -0.9 : 1.3) + i);
      ctx.beginPath(); ctx.ellipse(0, 0, 22 - i * 4, 8 - i * 2, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    if (flash > 0) {
      ctx.strokeStyle = 'rgba(255,202,107,' + flash * 2.5 + ')';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const a = rand(0, TAU);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 14, -24 + hover + Math.sin(a) * 14);
        ctx.lineTo(Math.cos(a) * 26, -24 + hover + Math.sin(a) * 26);
        ctx.stroke();
      }
    }
    return;
  }
  // 吊塔（1/2 级）
  panel(ctx, -22, 24, 44, 12, 4, P);
  panel(ctx, -20, -30, 9, 56, 3, P);
  ctx.strokeStyle = P.dark;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-18, 16); ctx.lineTo(-13, 2); ctx.moveTo(-13, 16); ctx.lineTo(-18, 2); ctx.stroke();
  panel(ctx, -22, -34, 48, 8, 3, P);
  ctx.strokeStyle = P.light;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(18, -26); ctx.lineTo(18, -14); ctx.stroke();
  // 磁铁（2 级为双磁铁）
  const mags = lv === 2 ? [[13, -8], [24, -4]] : [[18, -8]];
  for (const [mx, my] of mags) {
    emissive(ctx, 'rgba(224,72,72,0.6)', 6, () => {
      ctx.strokeStyle = '#e04848';
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(mx, my, 9, Math.PI, 0); ctx.stroke();
    });
    ctx.fillStyle = '#dbe6ef';
    ctx.fillRect(mx - 12, my, 7, 8);
    ctx.fillRect(mx + 5, my, 7, 8);
  }
  if (flash > 0) {
    ctx.strokeStyle = 'rgba(255,202,107,' + flash * 2.5 + ')';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(10 + i * 8, 2);
      ctx.lineTo(12 + i * 8 + rand(-3, 3), 12 + rand(0, 6));
      ctx.stroke();
    }
  }
  emissive(ctx, 'rgba(255,197,49,0.8)', 6, () => {
    ctx.fillStyle = P.led;
    ctx.beginPath(); ctx.arc(-16, -38, 3, 0, TAU); ctx.fill();
  });
}

/* ===== 雷电线：特斯拉线圈 → 高压电塔 → 雷暴中枢 ===== */
function drawTesla(ctx, m, lv) {
  const P = pal(lv);
  const flash = m && m.flash > 0 ? m.flash * 4 : 0;
  pedestal(ctx, P, lv >= 3 ? 46 : 38, lv);
  if (lv >= 3) {
    // 雷暴中枢
    ctx.fillStyle = P.dark;
    ctx.beginPath();
    ctx.moveTo(-18, 20); ctx.lineTo(-10, -14); ctx.lineTo(10, -14); ctx.lineTo(18, 20);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = P.trim;
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 5; i++) {
      const yy = 14 - i * 7, ww = 15 - i * 1.2;
      ctx.beginPath(); ctx.moveTo(-ww, yy); ctx.lineTo(ww, yy); ctx.stroke();
    }
    // 环形加速器
    ctx.strokeStyle = 'rgba(199,123,255,0.8)';
    ctx.lineWidth = 3;
    ctx.save();
    ctx.translate(0, -28);
    ctx.rotate(time * 0.8);
    ctx.beginPath(); ctx.ellipse(0, 0, 26, 9, 0, 0, TAU); ctx.stroke();
    ctx.restore();
    emissive(ctx, 'rgba(199,123,255,0.95)', 18 + flash * 8, () => {
      const grd = ctx.createRadialGradient(0, -30, 2, 0, -28, 17);
      grd.addColorStop(0, '#fbf3ff');
      grd.addColorStop(1, flash > 0 ? '#d99cff' : '#8d63c9');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(0, -28, 14 + flash * 2, 0, TAU); ctx.fill();
    });
    ctx.strokeStyle = 'rgba(220,180,255,0.85)';
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 5; i++) {
      const a = time * 3 + i * 1.3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 15, -28 + Math.sin(a) * 15);
      ctx.lineTo(Math.cos(a) * (24 + rand(0, 5)), -28 + Math.sin(a) * (24 + rand(0, 5)));
      ctx.stroke();
    }
    return;
  }
  // 1/2 级线圈塔
  ctx.fillStyle = lv === 2 ? '#3f5a86' : '#4d3f68';
  ctx.beginPath();
  ctx.moveTo(-14, 22); ctx.lineTo(-7, -18); ctx.lineTo(7, -18); ctx.lineTo(14, 22);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = lv === 2 ? '#8fc0e8' : '#8f7ab5';
  ctx.lineWidth = 2.2;
  for (let i = 0; i < (lv === 2 ? 7 : 5); i++) {
    const yy = 16 - i * (lv === 2 ? 6 : 8), ww = 13 - i * (lv === 2 ? 1 : 1.4);
    ctx.beginPath(); ctx.moveTo(-ww, yy); ctx.lineTo(ww, yy); ctx.stroke();
  }
  const spheres = lv === 2 ? [[-9, -28], [9, -28]] : [[0, -26]];
  for (const [sx, sy] of spheres) {
    emissive(ctx, lv === 2 ? 'rgba(127,215,255,0.9)' : 'rgba(199,123,255,0.85)', 10 + flash * 14, () => {
      const grd = ctx.createRadialGradient(sx, sy, 2, sx, sy, 13);
      grd.addColorStop(0, '#f2e8ff');
      grd.addColorStop(1, flash > 0 ? (lv === 2 ? '#8fd8ff' : '#c77bff') : (lv === 2 ? '#4f87b5' : '#7e5bb5'));
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(sx, sy, (lv === 2 ? 9 : 11) + flash * 2, 0, TAU); ctx.fill();
    });
  }
  if (flash > 0) {
    ctx.strokeStyle = lv === 2 ? 'rgba(150,220,255,0.8)' : 'rgba(210,160,255,0.8)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = rand(0, TAU);
      const s0 = spheres[i % spheres.length];
      ctx.beginPath();
      ctx.moveTo(s0[0] + Math.cos(a) * 11, s0[1] + Math.sin(a) * 11);
      ctx.lineTo(s0[0] + Math.cos(a) * 19, s0[1] + Math.sin(a) * 19);
      ctx.stroke();
    }
  }
}

/* ===== 激光线：轨道激光炮 → 相位激光炮 → 歼星激光 ===== */
function drawRailgun(ctx, m, lv) {
  const P = pal(lv);
  const charge = m && m.charge !== undefined ? clamp(m.charge, 0, 1) : 0.6;
  const flash = m && m.flash > 0 ? m.flash : 0;
  const hot = lv >= 3 ? '#ff6a2e' : lv === 2 ? '#8be0ff' : '#ff8c50';
  pedestal(ctx, P, lv >= 3 ? 50 : 44, lv);
  panel(ctx, -18, 6, 32, 16, 4, P);
  // 双轨
  const rails = lv >= 3 ? 3 : 2;
  for (let i = 0; i < rails; i++) {
    const oy = -18 + i * (lv >= 3 ? 11 : 14);
    panel(ctx, -14, oy, lv >= 3 ? 58 : 50, 7, 3, P);
  }
  // 能量线圈
  const coils = lv >= 3 ? 4 : 3;
  for (let i = 0; i < coils; i++) {
    const cxp = -4 + i * (lv >= 3 ? 15 : 13);
    ctx.strokeStyle = flash > 0 ? '#fff0e0' : hot;
    ctx.globalAlpha = 0.35 + charge * 0.6;
    ctx.lineWidth = lv >= 3 ? 4 : 3;
    ctx.beginPath(); ctx.arc(cxp, -5.5, lv >= 3 ? 12 : 9, -Math.PI * 0.68, Math.PI * 0.68); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // 聚焦透镜（2 级起）
  if (lv >= 2) {
    ctx.fillStyle = 'rgba(20,30,42,0.9)';
    ctx.beginPath(); ctx.ellipse(lv >= 3 ? 48 : 42, -5.5, 5, 13, 0, 0, TAU); ctx.fill();
    emissive(ctx, hot, 12, () => {
      ctx.fillStyle = hot;
      ctx.globalAlpha = 0.5 + charge * 0.5;
      ctx.beginPath(); ctx.ellipse(lv >= 3 ? 48 : 42, -5.5, 3, 10, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    });
  }
  // 炮口辉光
  emissive(ctx, hot, 12 + flash * 20, () => {
    ctx.fillStyle = flash > 0 ? '#fff4e6' : hot;
    ctx.globalAlpha = flash > 0 ? 1 : 0.3 + charge * 0.7;
    ctx.beginPath(); ctx.arc(lv >= 3 ? 56 : 44, -5.5, 4 + charge * 3 + flash * 9, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  });
  // 尾部机箱与散热片
  panel(ctx, -26, -22, 14, 34, 4, P);
  ctx.fillStyle = P.dark;
  for (let i = 0; i < 3; i++) { rr(ctx, -30, -16 + i * 9, 5, 6, 2); ctx.fill(); }
  emissive(ctx, hot, 8, () => {
    ctx.fillStyle = hot;
    ctx.beginPath(); ctx.arc(-19, -26, 3, 0, TAU); ctx.fill();
  });
}

/* ===== 火箭线：火箭发射井 → 双联火箭井 → 末日火箭井 ===== */
function drawRocket(ctx, m, lv) {
  const P = pal(lv);
  const blink = Math.sin((m && m.spin ? m.spin : 0) * 5) > 0;
  const reload = m && m.reload ? clamp(m.reload, 0, 1) : 0;
  const sink = reload * 30;
  const silos = Math.min(lv, 3);
  panel(ctx, -26, -14, 52, 50, 8, P);
  const spacing = silos === 1 ? 0 : silos === 2 ? 13 : 15;
  for (let i = 0; i < silos; i++) {
    const ox = silos === 1 ? 0 : -spacing * (silos - 1) / 2 + i * spacing;
    ctx.fillStyle = P.dark;
    rr(ctx, ox - 9, -10, 18, 40, 5); ctx.fill();
    // 火箭（装填时下沉）
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox - 10, -42, 20, 72);
    ctx.clip();
    ctx.translate(0, sink);
    const bw = silos >= 3 ? 5.5 : 7;
    ctx.fillStyle = '#dde5ee';
    rr(ctx, ox - bw, -18, bw * 2, 28, 3); ctx.fill();
    ctx.fillStyle = lv >= 3 ? '#ff9d2e' : '#ff5d5d';
    ctx.beginPath();
    ctx.moveTo(ox - bw, -18); ctx.lineTo(ox, -33); ctx.lineTo(ox + bw, -18);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4cc2ff';
    ctx.beginPath(); ctx.arc(ox, -8, 2.6, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // 井口前板
  panel(ctx, -26, 14, 52, 22, 6, P);
  // 舱门
  ctx.fillStyle = P.light;
  rr(ctx, -28, -22, 20, 10, 3); ctx.fill();
  rr(ctx, 8, -22, 20, 10, 3); ctx.fill();
  // 三级：侧挂导弹与目标天线
  if (lv >= 3) {
    ctx.fillStyle = P.trim;
    rr(ctx, -34, -6, 8, 26, 3); ctx.fill();
    rr(ctx, 26, -6, 8, 26, 3); ctx.fill();
    ctx.strokeStyle = P.trim;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(20, -22); ctx.lineTo(26, -36); ctx.stroke();
    emissive(ctx, 'rgba(255,93,93,0.9)', 8, () => {
      ctx.fillStyle = '#ff5d5d';
      ctx.beginPath(); ctx.arc(26, -38, 2.8, 0, TAU); ctx.fill();
    });
  }
  emissive(ctx, reload > 0 ? 'rgba(255,93,93,0.8)' : 'rgba(255,197,49,0.8)', 7, () => {
    ctx.fillStyle = reload > 0 ? '#ff5d5d' : (blink ? '#ffc531' : '#6b5514');
    ctx.beginPath(); ctx.arc(20, -8, 3, 0, TAU); ctx.fill();
  });
  hazard(ctx, -26, 30, 52, 5, 2);
}

/* ===== 地雷线 ===== */
function drawMineLayer(ctx, m, lv) {
  const P = pal(lv);
  const rec = (m && m.recoil > 0) ? m.recoil * 20 : 0;
  // 履带
  ctx.fillStyle = lv >= 3 ? '#2b2438' : '#2b352f';
  rr(ctx, -25, 12, 50, 24, 8); ctx.fill();
  ctx.fillStyle = lv >= 3 ? '#4a4160' : '#3d4a42';
  for (let i = 0; i < 6; i++) { rr(ctx, -22 + i * 8, 15, 5, 18, 2); ctx.fill(); }
  ctx.fillStyle = P.dark;
  ctx.beginPath(); ctx.arc(-17, 24, 6, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(17, 24, 6, 0, TAU); ctx.fill();
  // 弹仓
  panel(ctx, -19, -20, 38, 32, 6, P);
  // 顶部地雷架
  const count = Math.min(lv + 1, 4);
  for (let i = 0; i < count; i++) {
    const mx = -((count - 1) * 9) / 2 + i * 9;
    ctx.fillStyle = lv >= 3 ? '#6b4a8a' : '#7a5a34';
    ctx.beginPath(); ctx.ellipse(mx, -24, 6, 4, 0, 0, TAU); ctx.fill();
    emissive(ctx, 'rgba(255,93,93,0.8)', 5, () => {
      ctx.fillStyle = '#ff5d5d';
      ctx.beginPath(); ctx.arc(mx, -27, 1.8, 0, TAU); ctx.fill();
    });
  }
  // 投放滑道
  panel(ctx, 14 + rec, -6, 20, 9, 3, P);
  ctx.fillStyle = P.trim;
  ctx.beginPath();
  ctx.moveTo(30 + rec, -7); ctx.lineTo(38 + rec, 2); ctx.lineTo(30 + rec, 4);
  ctx.closePath(); ctx.fill();
  hazard(ctx, -25, 33, 50, 4, 2);
}

/* ===== 火焰线：连续喷火，不发射子弹 ===== */
function drawFlamer(ctx, m, lv) {
  const P = pal(lv);
  const firing = m && m.flameT > 0;
  const nozzles = Math.min(lv, 3);
  // 燃料罐
  const tank = ctx.createLinearGradient(-28, 0, -8, 0);
  tank.addColorStop(0, lv >= 3 ? '#4a2740' : '#7a3b2a');
  tank.addColorStop(1, lv >= 3 ? '#a3462f' : '#b0522f');
  ctx.fillStyle = tank;
  rr(ctx, -28, -20, 21, 48, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.4;
  rr(ctx, -28, -20, 21, 48, 10); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  rr(ctx, -26, -17, 6, 42, 3); ctx.fill();
  ctx.fillStyle = '#ffc531';
  rr(ctx, -26, -13, 17, 5, 2); ctx.fill();
  rr(ctx, -26, 18, 17, 5, 2); ctx.fill();
  // 底座 + 软管
  panel(ctx, -14, 16, 34, 20, 5, P);
  ctx.strokeStyle = '#3a4652';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-8, 2); ctx.quadraticCurveTo(0, 10, 6, 0);
  ctx.stroke();
  // 喷枪主体
  panel(ctx, -8, -14, 30, 15, 5, P);
  // 喷嘴
  for (let i = 0; i < nozzles; i++) {
    const ny = nozzles === 1 ? -6.5 : nozzles === 2 ? -12 + i * 11 : -14 + i * 8;
    ctx.fillStyle = P.dark;
    rr(ctx, 20, ny - 4, 12, 8, 3); ctx.fill();
    ctx.fillStyle = P.trim;
    rr(ctx, 30, ny - 5, 4, 10, 2); ctx.fill();
  }
  // 火焰
  const rangeCells = modStat('flame', 'range', lv) || 1.6;
  const len = CELL_W * rangeCells * 0.78;
  for (let i = 0; i < nozzles; i++) {
    const ny = nozzles === 1 ? -6.5 : nozzles === 2 ? -12 + i * 11 : -14 + i * 8;
    // 常燃小火苗
    emissive(ctx, 'rgba(255,140,50,0.9)', 8, () => {
      ctx.fillStyle = lv >= 3 ? '#bfe4ff' : '#ffb347';
      ctx.beginPath();
      ctx.ellipse(36, ny, 3.4 + Math.sin(time * 14 + i) * 1, 5, 0, 0, TAU);
      ctx.fill();
    });
    if (!firing) continue;
    // 喷射火舌（多层叠加 + 抖动）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const layers = [
      { l: len, w: 26, c0: 'rgba(255,90,20,0.55)', c1: 'rgba(255,60,10,0)' },
      { l: len * 0.78, w: 18, c0: 'rgba(255,170,50,0.72)', c1: 'rgba(255,120,30,0)' },
      { l: len * 0.5, w: 11, c0: lv >= 3 ? 'rgba(180,225,255,0.95)' : 'rgba(255,235,160,0.95)', c1: 'rgba(255,200,90,0)' },
    ];
    for (const L of layers) {
      const gd = ctx.createLinearGradient(34, ny, 34 + L.l, ny);
      gd.addColorStop(0, L.c0);
      gd.addColorStop(1, L.c1);
      ctx.fillStyle = gd;
      ctx.beginPath();
      ctx.moveTo(34, ny - 4);
      const j1 = Math.sin(time * 22 + i * 2) * 4;
      const j2 = Math.cos(time * 18 + i) * 4;
      ctx.quadraticCurveTo(34 + L.l * 0.5, ny - L.w + j1, 34 + L.l, ny + j2 * 0.4);
      ctx.quadraticCurveTo(34 + L.l * 0.5, ny + L.w + j2, 34, ny + 4);
      ctx.closePath();
      ctx.fill();
    }
    // 飞散的火星
    ctx.fillStyle = 'rgba(255,210,120,0.8)';
    for (let k = 0; k < 3; k++) {
      const px = 40 + ((time * 260 + k * 47 + i * 23) % len);
      ctx.beginPath();
      ctx.arc(px, ny + Math.sin(px * 0.14 + time * 9) * 7, 1.8, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

/* ===== 毒液线 ===== */
function drawPoison(ctx, m, lv) {
  const P = pal(lv);
  const bub = Math.sin(time * 3) * 2;
  panel(ctx, -21, 18, 42, 18, 5, P);
  if (lv >= 3) {
    // 瘟疫散布器：坩埚 + 扩散毒雾
    ctx.fillStyle = 'rgba(139,224,74,0.13)';
    ctx.beginPath(); ctx.arc(0, -4, 40 + Math.sin(time * 2) * 3, 0, TAU); ctx.fill();
    const cauldron = ctx.createLinearGradient(0, -14, 0, 20);
    cauldron.addColorStop(0, '#4a5a3c');
    cauldron.addColorStop(1, '#22301c');
    ctx.fillStyle = cauldron;
    ctx.beginPath();
    ctx.moveTo(-22, -12);
    ctx.quadraticCurveTo(-26, 18, 0, 20);
    ctx.quadraticCurveTo(26, 18, 22, -12);
    ctx.closePath(); ctx.fill();
    emissive(ctx, 'rgba(139,224,74,0.9)', 12, () => {
      ctx.fillStyle = '#8be04a';
      ctx.beginPath(); ctx.ellipse(0, -12, 22, 6, 0, 0, TAU); ctx.fill();
    });
    ctx.fillStyle = 'rgba(200,255,160,0.75)';
    for (let i = 0; i < 4; i++) {
      const a = time * 1.6 + i * 1.7;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 16, -18 - ((time * 20 + i * 12) % 24), 2.4 + i * 0.3, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = P.trim;
    rr(ctx, -26, -16, 52, 5, 2); ctx.fill();
    return;
  }
  // 药剂罐
  const glass = ctx.createLinearGradient(-17, -26, 17, 20);
  glass.addColorStop(0, 'rgba(150,230,120,0.9)');
  glass.addColorStop(1, 'rgba(50,120,45,0.92)');
  ctx.fillStyle = glass;
  rr(ctx, -17, -26, 34, 46, 11); ctx.fill();
  ctx.strokeStyle = '#8be04a';
  ctx.lineWidth = 2;
  rr(ctx, -17, -26, 34, 46, 11); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  rr(ctx, -14, -22, 7, 38, 3); ctx.fill();
  ctx.fillStyle = 'rgba(220,255,190,0.7)';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(-9 + i * 6, 6 - ((time * 22 + i * 13) % 28) + bub, 2 + i * 0.3, 0, TAU);
    ctx.fill();
  }
  // 喷嘴（2 级双喷口）
  const noz = lv === 2 ? [-14, 2] : [-8];
  for (const ny of noz) {
    panel(ctx, 13, ny, 22, 10, 4, P);
    emissive(ctx, 'rgba(139,224,74,0.85)', 7, () => {
      ctx.fillStyle = '#8be04a';
      ctx.beginPath(); ctx.arc(36, ny + 5, 3.4, 0, TAU); ctx.fill();
    });
  }
  ctx.fillStyle = '#12200f';
  ctx.font = '900 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('☠', 0, -4);
  if (lv === 2) {
    ctx.fillStyle = P.trim;
    rr(ctx, -20, -30, 40, 6, 3); ctx.fill();
  }
}

/* ===== 迫击炮线 ===== */
function drawMortar(ctx, m, lv) {
  const P = pal(lv);
  const rec = (m && m.recoil > 0) ? m.recoil * 16 : 0;
  const tubes = Math.min(lv, 3);
  // 支架
  ctx.strokeStyle = P.dark;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-18, 32); ctx.lineTo(-3, 6);
  ctx.moveTo(18, 32); ctx.lineTo(3, 6);
  ctx.stroke();
  panel(ctx, -24, 26, 48, 11, 4, P);
  // 炮管
  for (let i = 0; i < tubes; i++) {
    const spread = tubes === 1 ? 0 : (i - (tubes - 1) / 2) * (tubes === 2 ? 11 : 13);
    ctx.save();
    ctx.translate(spread, 4 + rec);
    ctx.rotate(-0.72 + (tubes > 1 ? spread * 0.012 : 0));
    const tw = tubes >= 3 ? 7 : 9;
    const tube = ctx.createLinearGradient(-tw, 0, tw, 0);
    tube.addColorStop(0, P.light);
    tube.addColorStop(1, P.dark);
    ctx.fillStyle = tube;
    rr(ctx, -tw, -42, tw * 2, 46, 5); ctx.fill();
    ctx.fillStyle = P.dark;
    rr(ctx, -tw - 2, -44, tw * 2 + 4, 8, 4); ctx.fill();
    if (lv >= 2) {
      ctx.fillStyle = '#d0a56a';
      ctx.beginPath(); ctx.ellipse(0, -46, 4.5, 6.5, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  // 三级：目标计算阵列
  if (lv >= 3) {
    panel(ctx, -32, -6, 12, 20, 4, P);
    emissive(ctx, 'rgba(255,157,46,0.85)', 8, () => {
      ctx.fillStyle = '#ff9d2e';
      ctx.beginPath(); ctx.arc(-26, 2, 3.4, 0, TAU); ctx.fill();
    });
    ctx.strokeStyle = P.trim;
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(-26, 2, 9, -1.2, 1.2); ctx.stroke();
  }
  // 弹药箱
  panel(ctx, 14, 10, 20, 16, 3, P);
  ctx.fillStyle = '#ffc531';
  rr(ctx, 17, 14, 14, 3.4, 1.5); ctx.fill();
  ctx.fillStyle = '#d0a56a';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.ellipse(19 + i * 5, 21, 2, 3, 0, 0, TAU); ctx.fill();
  }
}

/* ===== 狙击线 ===== */
function drawSniper(ctx, m, lv) {
  const P = pal(lv);
  const rec = (m && m.recoil > 0) ? m.recoil * 24 : 0;
  const charged = !m || !m.mcd || (m.mcd.sniper || 0) <= 0.35;
  const len = lv >= 3 ? 72 : lv === 2 ? 64 : 58;
  pedestal(ctx, P, 42, lv);
  panel(ctx, -13, 4, 26, 18, 4, P);
  // 主枪管
  panel(ctx, -18 - rec, -12, len, 9, 4, P);
  // 制退器
  ctx.fillStyle = P.dark;
  rr(ctx, len - 24 - rec, -15, 11, 15, 3); ctx.fill();
  if (lv >= 2) {
    ctx.fillStyle = P.trim;
    for (let i = 0; i < 3; i++) { rr(ctx, len - 40 - rec + i * 7, -14, 3, 13, 1.5); ctx.fill(); }
  }
  // 机匣
  panel(ctx, -22 - rec, -19, 28, 22, 5, P);
  // 三级：能量导轨与充能环
  if (lv >= 3) {
    ctx.strokeStyle = charged ? '#ffe0a8' : '#6b5a3a';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const cxp = 4 + i * 18 - rec;
      ctx.beginPath(); ctx.arc(cxp, -7.5, 10, -Math.PI * 0.6, Math.PI * 0.6); ctx.stroke();
    }
    panel(ctx, -34 - rec, -8, 12, 18, 4, P);
  } else if (lv === 2) {
    panel(ctx, -16 - rec, -1, len - 14, 6, 3, P);
  }
  // 瞄准镜
  panel(ctx, -14 - rec, -32, 30, 11, 5, P);
  emissive(ctx, 'rgba(255,224,168,0.95)', charged ? 12 : 0, () => {
    ctx.fillStyle = charged ? '#ffe0a8' : '#6b5a3a';
    ctx.beginPath(); ctx.arc(14 - rec, -26.5, 3.4, 0, TAU); ctx.fill();
  });
  // 两脚架
  ctx.strokeStyle = P.dark;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(14 - rec, -2); ctx.lineTo(10, 18);
  ctx.moveTo(14 - rec, -2); ctx.lineTo(22, 18);
  ctx.stroke();
}

/* ===== 维修线 ===== */
function drawRepair(ctx, m, lv) {
  const P = pal(lv);
  const pulse = m && m.pulse > 0 ? m.pulse * 2 : 0;
  const spin = (m && m.spin ? m.spin : 0) * 1.6;
  if (pulse > 0) {
    ctx.fillStyle = 'rgba(88,214,139,' + (0.2 * pulse) + ')';
    ctx.beginPath(); ctx.arc(0, -2, 46, 0, TAU); ctx.fill();
  }
  if (lv >= 3) {
    // 奇迹熔炉：熔炉 + 光环 + 悬浮工具
    const body = ctx.createLinearGradient(0, -24, 0, 32);
    body.addColorStop(0, '#3d6b52');
    body.addColorStop(1, '#1d3a2b');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-26, 32); ctx.lineTo(-20, -20); ctx.lineTo(20, -20); ctx.lineTo(26, 32);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = P.trim;
    rr(ctx, -28, -24, 56, 7, 3); ctx.fill();
    // 熔炉口
    emissive(ctx, 'rgba(140,255,180,0.9)', 16, () => {
      const fire = ctx.createRadialGradient(0, 8, 2, 0, 8, 16);
      fire.addColorStop(0, '#ffffff');
      fire.addColorStop(0.4, '#8ff2b6');
      fire.addColorStop(1, 'rgba(60,190,120,0)');
      ctx.fillStyle = fire;
      ctx.beginPath(); ctx.arc(0, 8, 14 + Math.sin(time * 5) * 1.4, 0, TAU); ctx.fill();
    });
    // 光环
    ctx.strokeStyle = 'rgba(143,242,182,0.8)';
    ctx.lineWidth = 2.4;
    ctx.save();
    ctx.translate(0, -30);
    ctx.rotate(time * 0.9);
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 7, 0, 0, TAU); ctx.stroke();
    ctx.restore();
    // 悬浮扳手
    ctx.save();
    ctx.translate(0, -30);
    ctx.rotate(-time * 1.4);
    ctx.strokeStyle = '#dbe6ef';
    ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(13, 0); ctx.stroke();
    ctx.fillStyle = '#dbe6ef';
    ctx.beginPath(); ctx.arc(14, 0, 4.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-14, 0, 4.2, 0, TAU); ctx.fill();
    ctx.restore();
    emissive(ctx, 'rgba(88,214,139,0.9)', 10, () => {
      ctx.fillStyle = '#8ff2b6';
      rr(ctx, -4, -14, 8, 20, 2); ctx.fill();
      rr(ctx, -11, -7, 22, 8, 2); ctx.fill();
    });
    return;
  }
  // 1/2 级工坊
  const body = ctx.createLinearGradient(0, -22, 0, 30);
  body.addColorStop(0, lv === 2 ? '#48806a' : '#3f6b52');
  body.addColorStop(1, '#22402f');
  ctx.fillStyle = body;
  rr(ctx, -24, -20, 48, 50, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  rr(ctx, -24, -20, 48, 50, 8); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  rr(ctx, -22, -18, 10, 44, 5); ctx.fill();
  // 旋转扳手
  const arms = lv === 2 ? 2 : 1;
  for (let i = 0; i < arms; i++) {
    ctx.save();
    ctx.translate(0, -4);
    ctx.rotate(spin + i * Math.PI / 2);
    ctx.strokeStyle = '#c8d4e0';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke();
    ctx.fillStyle = '#c8d4e0';
    ctx.beginPath(); ctx.arc(15, 0, 4.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-15, 0, 4.5, 0, TAU); ctx.fill();
    ctx.restore();
  }
  emissive(ctx, 'rgba(88,214,139,0.9)', 8 + pulse * 10, () => {
    ctx.fillStyle = '#8ff2b6';
    rr(ctx, -4, -30, 8, 22, 2); ctx.fill();
    rr(ctx, -11, -23, 22, 8, 2); ctx.fill();
  });
  ctx.fillStyle = '#58d68b';
  for (let i = 0; i < Math.min(3, lv); i++) {
    ctx.beginPath(); ctx.arc(-14 + i * 14, 24, 2.6, 0, TAU); ctx.fill();
  }
}

/* ---- 合成机型绘制 ---- */
function drawFrostcannon(ctx, m) {
  const P = pal(2);
  let ext = 0;
  if (m && m.recoil > 0) ext = Math.sin((1 - m.recoil / 0.25) * Math.PI) * 14;
  pedestal(ctx, P, 40, 2);
  panel(ctx, -16, 2, 24, 20, 5, P);
  panel(ctx, -18, -22, 26, 28, 6, P);
  emissive(ctx, 'rgba(127,215,255,0.85)', 7, () => {
    ctx.fillStyle = '#7fd7ff';
    ctx.beginPath(); ctx.arc(-6, -14, 3, 0, TAU); ctx.fill();
  });
  ctx.strokeStyle = '#a8d8ee';
  ctx.lineWidth = 3;
  ctx.beginPath();
  const sx = 8, len = 12 + ext;
  ctx.moveTo(sx, -8);
  for (let i = 0; i <= 5; i++) ctx.lineTo(sx + (i + 0.5) * len / 6, -8 + (i % 2 === 0 ? -6 : 6));
  ctx.lineTo(sx + len, -8);
  ctx.stroke();
  const bx = sx + len + 9;
  emissive(ctx, 'rgba(150,220,255,0.9)', 12, () => {
    ctx.fillStyle = 'rgba(191,233,255,0.4)';
    ctx.beginPath(); ctx.arc(bx, -8, 14, 0, TAU); ctx.fill();
    ctx.fillStyle = '#dff2ff';
    ctx.beginPath(); ctx.arc(bx, -8, 11, 0, TAU); ctx.fill();
  });
  ctx.strokeStyle = '#5fb8e8';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI / 3;
    ctx.beginPath();
    ctx.moveTo(bx - Math.cos(a) * 8, -8 - Math.sin(a) * 8);
    ctx.lineTo(bx + Math.cos(a) * 8, -8 + Math.sin(a) * 8);
    ctx.stroke();
  }
}

function drawArcturret(ctx, m) {
  const P = pal(2);
  const rec = (m && m.recoil > 0) ? m.recoil * 30 : 0;
  const spark = m && m.recoil > 0;
  pedestal(ctx, P, 40, 2);
  panel(ctx, -14, 4, 28, 16, 4, P);
  ctx.fillStyle = '#6a5f8c';
  rr(ctx, 2 - rec, -14, 36, 12, 4); ctx.fill();
  ctx.fillStyle = '#514873';
  rr(ctx, 30 - rec, -16, 9, 16, 3); ctx.fill();
  const dome = ctx.createRadialGradient(-8, -14, 2, -4, -8, 18);
  dome.addColorStop(0, '#cbb8f5');
  dome.addColorStop(1, '#6a5f8c');
  ctx.fillStyle = dome;
  ctx.beginPath(); ctx.arc(-4, -8, 16, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#8f7ab5';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-4, -22); ctx.lineTo(-4, -28); ctx.stroke();
  emissive(ctx, 'rgba(199,123,255,0.9)', spark ? 16 : 8, () => {
    const grd = ctx.createRadialGradient(-4, -33, 1, -4, -33, 9);
    grd.addColorStop(0, '#f2e8ff');
    grd.addColorStop(1, spark ? '#c77bff' : '#7e5bb5');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(-4, -33, 7.5, 0, TAU); ctx.fill();
  });
  if (spark) {
    ctx.strokeStyle = 'rgba(210,160,255,0.85)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      const a = rand(0, TAU);
      ctx.beginPath();
      ctx.moveTo(-4 + Math.cos(a) * 7, -33 + Math.sin(a) * 7);
      ctx.lineTo(-4 + Math.cos(a) * 14, -33 + Math.sin(a) * 14);
      ctx.stroke();
    }
  }
}

function drawMagshredder(ctx, m) {
  drawShredder(ctx, m, 2);
  const hover = Math.sin((m && m.spin ? m.spin : 0) * 2) * 2;
  ctx.strokeStyle = '#8ba1b8';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(10, -34); ctx.lineTo(10, -42 + hover); ctx.stroke();
  emissive(ctx, 'rgba(224,72,72,0.6)', 7, () => {
    ctx.strokeStyle = '#e04848';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(10, -44 + hover, 7, Math.PI, 0); ctx.stroke();
  });
  ctx.fillStyle = '#dbe6ef';
  ctx.fillRect(1, -44 + hover, 5.5, 6);
  ctx.fillRect(13.5, -44 + hover, 5.5, 6);
}

function drawFrostwall(ctx, m) {
  const dmg = m && m.maxHp ? 1 - m.hp / m.maxHp : 0;
  ctx.fillStyle = 'rgba(127,215,255,0.09)';
  ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill();
  const ice = ctx.createLinearGradient(-26, -34, 26, 36);
  ice.addColorStop(0, '#d7eefb');
  ice.addColorStop(0.4, '#8fc0da');
  ice.addColorStop(1, '#4c7f9e');
  ctx.fillStyle = ice;
  rr(ctx, -26, -34, 52, 70, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(20,50,70,0.5)';
  ctx.lineWidth = 1.6;
  rr(ctx, -26, -34, 52, 70, 7); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  rr(ctx, -24, -32, 9, 66, 4); ctx.fill();
  ctx.fillStyle = '#5a86a3';
  rr(ctx, -26, -8, 52, 8, 3); ctx.fill();
  rr(ctx, -26, 14, 52, 8, 3); ctx.fill();
  emissive(ctx, 'rgba(200,240,255,0.7)', 8, () => {
    ctx.fillStyle = '#e8f9ff';
    for (const [px, len] of [[-18, 11], [-6, 16], [7, 10], [17, 14]]) {
      ctx.beginPath();
      ctx.moveTo(px - 4.5, -20); ctx.lineTo(px, -20 + len); ctx.lineTo(px + 4.5, -20);
      ctx.closePath(); ctx.fill();
    }
  });
  if (dmg > 0.5) {
    ctx.strokeStyle = 'rgba(30,60,80,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(10, -28); ctx.lineTo(2, -6); ctx.lineTo(14, 12); ctx.stroke();
  }
}

/* ---- 敌人绘制 ---- */
function drawEnemy(e) {
  const y = cellCy(e.row);
  const bob = Math.sin(e.anim * 7) * 2.5;
  g.save();
  if (e.fly) {
    g.translate(e.x, y - 22 + Math.sin(e.anim * 3) * 4);
  } else {
    g.translate(e.x, y + bob * 0.4);
  }
  const flash = e.flash > 0;
  const frozen = e.slowT > 0;
  switch (e.type) {
    case 'scrap': drawScrap(e, bob); break;
    case 'armored': drawArmored(e, bob); break;
    case 'drone': drawDrone(e); break;
    case 'bomber': drawBomber(e); break;
    case 'shieldbot': drawShieldbot(e, bob); break;
    case 'runner': drawRunner(e, bob); break;
    case 'jumper': drawJumper(e, bob); break;
    case 'healer': drawHealer(e); break;
    case 'crusher': drawCrusher(e); break;
    case 'titan': drawTitan(e); break;
  }
  if (flash) {
    g.globalAlpha = 0.34;
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(0, -4, e.w * 0.42, e.w * 0.46, 0, 0, TAU);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }
  if (e.frozenT > 0) {
    // 冰块封印（尺寸随体型）
    const hw = e.w / 2 + 5;
    const top = e.boss ? -58 : -34;
    const hgt = e.boss ? 100 : 60;
    g.globalAlpha = 0.42;
    g.fillStyle = '#a8dcf5';
    rr(g, -hw, top, hw * 2, hgt, 8);
    g.fill();
    g.globalAlpha = 0.75;
    g.strokeStyle = '#e0f4ff';
    g.lineWidth = 2;
    rr(g, -hw, top, hw * 2, hgt, 8);
    g.stroke();
    g.beginPath();
    g.moveTo(-hw * 0.5, top + 4); g.lineTo(-hw * 0.1, top + hgt * 0.4);
    g.moveTo(hw * 0.4, top + 8); g.lineTo(hw * 0.1, top + hgt * 0.55);
    g.stroke();
    g.globalAlpha = 1;
  } else if (frozen) {
    g.globalAlpha = 0.35;
    g.fillStyle = '#7fd7ff';
    g.beginPath();
    g.arc(0, -6, e.w / 2 + 3, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
  }
  // 灼烧：暖色轮廓 + 向上跳动的火苗（不铺满机体，避免多个敌人叠成白团）
  if (e.burnT > 0) {
    const rw = e.w * 0.4, rh = e.w * 0.46;
    g.globalAlpha = 0.5 + Math.sin(time * 12) * 0.15;
    g.strokeStyle = '#ff8a3c';
    g.lineWidth = 2;
    g.beginPath(); g.ellipse(0, -4, rw, rh, 0, 0, TAU); g.stroke();
    for (let i = 0; i < 3; i++) {
      const fx = -rw * 0.55 + i * rw * 0.55;
      const ph = (time * 5 + i * 1.7) % 1;
      g.globalAlpha = (1 - ph) * 0.9;
      g.fillStyle = i === 1 ? '#ffe08a' : '#ff9d2e';
      g.beginPath();
      g.ellipse(fx + Math.sin(time * 9 + i) * 2, -rh - ph * 16, 3 - ph * 1.6, 6.5 - ph * 3, 0, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  // 中毒：绿色轮廓 + 上浮气泡
  if (e.poisonT > 0) {
    const rw = e.w * 0.4, rh = e.w * 0.46;
    g.globalAlpha = 0.45 + Math.sin(time * 5) * 0.12;
    g.strokeStyle = '#8be04a';
    g.lineWidth = 2;
    g.beginPath(); g.ellipse(0, -4, rw, rh, 0, 0, TAU); g.stroke();
    g.fillStyle = '#c8f59a';
    for (let i = 0; i < 3; i++) {
      const ph = (time * 3 + i * 0.9) % 1;
      g.globalAlpha = (1 - ph) * 0.85;
      g.beginPath();
      g.arc(-rw * 0.5 + i * rw * 0.5, -rh * 0.4 - ph * 20, 2.4 - ph, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  g.restore();
  // 血条 + 护盾条
  if (e.hp < e.maxHp || (e.maxShield && e.shield < e.maxShield)) {
    const bw = e.boss ? 80 : e.type === 'crusher' ? 64 : 40;
    const by = rowCy(e) - (e.boss ? 72 : e.type === 'crusher' ? 52 : 46);
    drawBar(g, e.x, by, bw, 4.5, clamp(e.hp / e.maxHp, 0, 1));
    if (e.maxShield && e.shield > 0) {
      drawBar(g, e.x, by - 6.5, bw, 3.5, clamp(e.shield / e.maxShield, 0, 1), '#4cc2ff');
    }
  }
}

function drawScrap(e, bob) {
  const leg = Math.sin(e.anim * 9) * 5;
  // 腿
  g.fillStyle = '#4a4038';
  rr(g, -12, 20, 8, 14 + leg * 0.4, 3); g.fill();
  rr(g, 4, 20, 8, 14 - leg * 0.4, 3); g.fill();
  // 身体
  g.fillStyle = '#7a6a52';
  rr(g, -16, -8, 32, 32, 5); g.fill();
  // 补丁
  g.fillStyle = '#8f7d61';
  rr(g, -10, 2, 10, 8, 2); g.fill();
  g.fillStyle = '#5d5142';
  rr(g, 4, 10, 8, 7, 2); g.fill();
  // 前臂（攻击摆动）
  const arm = Math.sin(e.anim * 9) * 0.4 - 0.5;
  g.save();
  g.translate(-14, 0);
  g.rotate(arm);
  g.fillStyle = '#665845';
  rr(g, -16, -3, 18, 7, 3); g.fill();
  g.fillStyle = '#4a4038';
  g.beginPath(); g.arc(-16, 0, 5, 0, TAU); g.fill();
  g.restore();
  // 头
  g.fillStyle = '#8a795f';
  g.beginPath();
  g.arc(0, -20, 13, 0, TAU);
  g.fill();
  // 独眼
  g.fillStyle = '#1a1410';
  g.beginPath(); g.arc(-4, -21, 6, 0, TAU); g.fill();
  g.fillStyle = '#ff5d5d';
  g.beginPath(); g.arc(-4, -21, 3, 0, TAU); g.fill();
  // 天线
  g.strokeStyle = '#5d5142';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(6, -31); g.lineTo(9, -40);
  g.stroke();
  g.fillStyle = '#ff9d2e';
  g.beginPath(); g.arc(9, -41, 2.5, 0, TAU); g.fill();
}

function drawArmored(e, bob) {
  const leg = Math.sin(e.anim * 8) * 5;
  g.fillStyle = '#39434f';
  rr(g, -13, 20, 9, 15 + leg * 0.4, 3); g.fill();
  rr(g, 4, 20, 9, 15 - leg * 0.4, 3); g.fill();
  // 身体（钢板）
  g.fillStyle = '#5c6e84';
  rr(g, -18, -10, 36, 34, 6); g.fill();
  g.fillStyle = '#6e8199';
  rr(g, -18, -10, 36, 12, 6); g.fill();
  // 肩甲
  g.fillStyle = '#46566a';
  rr(g, -24, -12, 10, 16, 4); g.fill();
  rr(g, 14, -12, 10, 16, 4); g.fill();
  // 铆钉
  g.fillStyle = '#33404f';
  for (const px of [-12, 0, 12]) {
    g.beginPath(); g.arc(px, 8, 2, 0, TAU); g.fill();
  }
  // 前臂
  const arm = Math.sin(e.anim * 8) * 0.35 - 0.5;
  g.save();
  g.translate(-16, -2);
  g.rotate(arm);
  g.fillStyle = '#46566a';
  rr(g, -18, -4, 20, 8, 3); g.fill();
  g.restore();
  // 头盔
  g.fillStyle = '#7b8fa6';
  g.beginPath();
  g.arc(0, -24, 14, Math.PI, 0);
  g.lineTo(14, -16);
  g.lineTo(-14, -16);
  g.closePath();
  g.fill();
  // 目镜缝
  g.fillStyle = '#0d1117';
  rr(g, -11, -24, 16, 5, 2); g.fill();
  g.fillStyle = '#ffc531';
  rr(g, -9, -23, 5, 3, 1); g.fill();
}

function drawDrone(e) {
  const spin = e.anim * 40;
  // 旋翼臂
  g.strokeStyle = '#5a6774';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(-16, -10); g.lineTo(-26, -18);
  g.moveTo(16, -10); g.lineTo(26, -18);
  g.stroke();
  // 旋翼（模糊椭圆）
  g.fillStyle = 'rgba(180,200,215,0.4)';
  for (const px of [-26, 26]) {
    g.save();
    g.translate(px, -20);
    g.scale(1, 0.25);
    g.beginPath();
    g.arc(0, 0, 12 + Math.sin(spin) * 1.5, 0, TAU);
    g.fill();
    g.restore();
  }
  // 机身
  g.fillStyle = '#4a5568';
  g.beginPath();
  g.ellipse(0, -4, 18, 13, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#5d6b80';
  g.beginPath();
  g.ellipse(0, -8, 13, 8, 0, 0, TAU);
  g.fill();
  // 扫描眼
  g.fillStyle = '#ff5d5d';
  g.beginPath();
  g.arc(-8, -4, 4.5, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,93,93,0.35)';
  g.beginPath();
  g.arc(-8, -4, 7.5, 0, TAU);
  g.fill();
  // 挂爪
  g.strokeStyle = '#39434f';
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(-5, 8); g.lineTo(-8, 16);
  g.moveTo(5, 8); g.lineTo(8, 16);
  g.stroke();
}

function drawBomber(e) {
  const spin = e.anim * 45;
  const blink = Math.sin(e.anim * 12) > 0;
  // 顶部旋翼
  g.strokeStyle = '#5a6774';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, -16); g.lineTo(0, -22);
  g.stroke();
  g.fillStyle = 'rgba(180,200,215,0.45)';
  g.save();
  g.translate(0, -24);
  g.scale(1, 0.22);
  g.beginPath();
  g.arc(0, 0, 16 + Math.sin(spin) * 2, 0, TAU);
  g.fill();
  g.restore();
  // 蜂体（黄黑条纹）
  g.save();
  g.beginPath();
  g.arc(0, -2, 14, 0, TAU);
  g.clip();
  for (let i = -3; i < 4; i++) {
    g.fillStyle = i % 2 === 0 ? '#ffc531' : '#2a2622';
    g.save();
    g.translate(i * 7, -2);
    g.rotate(-0.5);
    g.fillRect(-4, -18, 7, 36);
    g.restore();
  }
  g.restore();
  g.strokeStyle = '#1c1a14';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(0, -2, 14, 0, TAU);
  g.stroke();
  // 眼睛（朝基地方向）
  g.fillStyle = '#0d1117';
  g.beginPath(); g.arc(-8, -6, 5, 0, TAU); g.fill();
  g.fillStyle = '#ff5d5d';
  g.beginPath(); g.arc(-9, -6, 2.5, 0, TAU); g.fill();
  // 尾刺（炸弹引信）
  g.fillStyle = '#c8d4e0';
  g.beginPath();
  g.moveTo(12, 2); g.lineTo(20, 7); g.lineTo(12, 9);
  g.closePath();
  g.fill();
  // 警示灯
  g.fillStyle = blink ? '#ff5d5d' : '#5b2020';
  g.beginPath();
  g.arc(0, -18, 3, 0, TAU);
  g.fill();
}

function drawShieldbot(e, bob) {
  const leg = Math.sin(e.anim * 7) * 4;
  const hasShield = e.shield > 0;
  // 腿
  g.fillStyle = '#39434f';
  rr(g, -10, 20, 9, 15 + leg * 0.4, 3); g.fill();
  rr(g, 5, 20, 9, 15 - leg * 0.4, 3); g.fill();
  // 身体
  g.fillStyle = '#55707c';
  rr(g, -14, -10, 32, 34, 6); g.fill();
  g.fillStyle = '#68858f';
  rr(g, -14, -10, 32, 12, 6); g.fill();
  // 头
  g.fillStyle = '#78959e';
  g.beginPath();
  g.arc(2, -20, 12, 0, TAU);
  g.fill();
  g.fillStyle = '#0d1117';
  rr(g, -8, -24, 14, 6, 3); g.fill();
  g.fillStyle = '#4cc2ff';
  rr(g, -6, -23, 5, 4, 1); g.fill();
  // 持盾臂
  g.fillStyle = '#46566a';
  rr(g, -22, -6, 12, 8, 3); g.fill();
  if (hasShield) {
    // 塔盾（面向基地）
    g.fillStyle = '#3f5d78';
    rr(g, -32, -30, 14, 58, 6); g.fill();
    g.fillStyle = '#54789a';
    rr(g, -32, -30, 14, 16, 6); g.fill();
    g.strokeStyle = '#7fd7ff';
    g.lineWidth = 2;
    rr(g, -30, -28, 10, 54, 5); g.stroke();
    // 观察缝
    g.fillStyle = '#101820';
    rr(g, -29, -14, 8, 5, 2); g.fill();
    // 盾面铆钉
    g.fillStyle = '#2c4257';
    for (const py of [-24, 2, 20]) {
      g.beginPath(); g.arc(-25, py, 1.8, 0, TAU); g.fill();
    }
  } else {
    // 破盾后残余把手
    g.fillStyle = '#39434f';
    rr(g, -26, -6, 6, 10, 2); g.fill();
  }
}

function drawRunner(e, bob) {
  const leg = Math.sin(e.anim * (e.dashing > 0 ? 22 : 11)) * 7;
  const lean = e.dashing > 0 ? 0.32 : 0.12;
  g.save();
  g.rotate(lean);
  // 速度线
  if (e.dashing > 0) {
    g.strokeStyle = 'rgba(255,215,100,0.55)';
    g.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(20 + i * 9, -16 + i * 12);
      g.lineTo(40 + i * 11, -16 + i * 12);
      g.stroke();
    }
  }
  // 腿（细长）
  g.fillStyle = '#4a4a56';
  rr(g, -12, 18, 7, 16 + leg * 0.5, 3); g.fill();
  rr(g, 5, 18, 7, 16 - leg * 0.5, 3); g.fill();
  // 流线型身体
  const body = g.createLinearGradient(0, -12, 0, 22);
  body.addColorStop(0, '#8a6f4a');
  body.addColorStop(1, '#5e4c34');
  g.fillStyle = body;
  g.beginPath();
  g.ellipse(0, 6, 15, 18, 0, 0, TAU);
  g.fill();
  // 推进背包
  g.fillStyle = '#3b3b45';
  rr(g, 8, -6, 12, 18, 4); g.fill();
  if (e.dashing > 0) {
    g.save();
    g.shadowBlur = 12;
    g.shadowColor = 'rgba(255,180,60,0.9)';
    g.fillStyle = '#ffb347';
    g.beginPath();
    g.ellipse(22, 3, 6 + rand(0, 3), 4, 0, 0, TAU);
    g.fill();
    g.restore();
  }
  // 头
  g.fillStyle = '#9a7f57';
  g.beginPath();
  g.ellipse(-3, -18, 12, 10, -0.2, 0, TAU);
  g.fill();
  // 单眼护目镜
  g.fillStyle = '#12100c';
  rr(g, -13, -22, 16, 7, 3); g.fill();
  g.fillStyle = e.dashing > 0 ? '#ffd764' : '#ff8c50';
  rr(g, -11, -21, 6, 4, 2); g.fill();
  g.restore();
}

function drawJumper(e, bob) {
  const inAir = e.jumpT > 0;
  const compress = inAir ? 1 : 1 + Math.sin(e.anim * 8) * 0.06;
  g.save();
  g.translate(0, inAir ? -Math.sin((1 - e.jumpT / 0.55) * Math.PI) * 42 : 0);
  g.scale(1, compress);
  // 弹簧腿
  g.strokeStyle = '#8ba1b8';
  g.lineWidth = 3;
  g.beginPath();
  const legLen = inAir ? 22 : 14;
  g.moveTo(0, 14);
  for (let i = 0; i <= 4; i++) {
    g.lineTo((i % 2 === 0 ? -7 : 7), 14 + (i + 1) * legLen / 5);
  }
  g.stroke();
  // 弹簧脚垫
  g.fillStyle = '#39434f';
  rr(g, -12, 14 + legLen, 24, 6, 3); g.fill();
  // 身体
  const body = g.createLinearGradient(0, -18, 0, 14);
  body.addColorStop(0, '#7d8a63');
  body.addColorStop(1, '#4e5940');
  g.fillStyle = body;
  rr(g, -16, -14, 32, 28, 8); g.fill();
  // 减震器
  g.fillStyle = '#c8d4e0';
  rr(g, -20, -6, 6, 14, 3); g.fill();
  rr(g, 14, -6, 6, 14, 3); g.fill();
  // 头
  g.fillStyle = '#8e9c72';
  g.beginPath(); g.arc(0, -22, 11, 0, TAU); g.fill();
  g.fillStyle = '#12140e';
  g.beginPath(); g.arc(-4, -23, 5, 0, TAU); g.fill();
  g.fillStyle = '#ffd764';
  g.beginPath(); g.arc(-4, -23, 2.4, 0, TAU); g.fill();
  // 剩余跳跃次数
  g.fillStyle = '#ffd764';
  for (let i = 0; i < e.jumpsLeft; i++) {
    g.beginPath(); g.arc(-6 + i * 7, -36, 2.2, 0, TAU); g.fill();
  }
  g.restore();
}

function drawHealer(e) {
  const spin = e.anim * 38;
  const glow = e.healT < 0.6;
  // 旋翼
  g.strokeStyle = '#5a6774';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(-14, -8); g.lineTo(-24, -16);
  g.moveTo(14, -8); g.lineTo(24, -16);
  g.stroke();
  g.fillStyle = 'rgba(180,230,200,0.45)';
  for (const px of [-24, 24]) {
    g.save();
    g.translate(px, -18);
    g.scale(1, 0.24);
    g.beginPath();
    g.arc(0, 0, 11 + Math.sin(spin) * 1.5, 0, TAU);
    g.fill();
    g.restore();
  }
  // 机身（白绿医疗涂装）
  const body = g.createLinearGradient(0, -14, 0, 10);
  body.addColorStop(0, '#e6f2ea');
  body.addColorStop(1, '#7fa892');
  g.fillStyle = body;
  g.beginPath();
  g.ellipse(0, -3, 17, 13, 0, 0, TAU);
  g.fill();
  // 医疗十字
  g.save();
  if (glow) { g.shadowBlur = 10; g.shadowColor = 'rgba(88,214,139,0.9)'; }
  g.fillStyle = '#3fbf74';
  g.fillRect(-2.5, -11, 5, 15);
  g.fillRect(-7.5, -6, 15, 5);
  g.restore();
  // 修理臂
  g.strokeStyle = '#5a6774';
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(-8, 9); g.lineTo(-12, 18);
  g.moveTo(8, 9); g.lineTo(12, 18);
  g.stroke();
  g.fillStyle = '#c8d4e0';
  g.beginPath(); g.arc(-12, 19, 3, 0, TAU); g.fill();
  g.beginPath(); g.arc(12, 19, 3, 0, TAU); g.fill();
  // 治疗光环
  if (glow) {
    g.strokeStyle = 'rgba(88,214,139,0.5)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, -3, 26 + Math.sin(time * 8) * 3, 0, TAU);
    g.stroke();
  }
}

function drawTitan(e) {
  const step = Math.sin(e.anim * 4) * 6;
  const hasShield = e.shield > 0;
  // 双腿
  g.fillStyle = '#3a4048';
  rr(g, -22, 16, 18, 26 + step * 0.4, 5); g.fill();
  rr(g, 6, 16, 18, 26 - step * 0.4, 5); g.fill();
  g.fillStyle = '#2b3037';
  rr(g, -24, 38, 22, 8, 3); g.fill();
  rr(g, 4, 38, 22, 8, 3); g.fill();
  // 躯干（重装甲）
  const torso = g.createLinearGradient(-30, -30, 30, 20);
  torso.addColorStop(0, '#8a5a4a');
  torso.addColorStop(0.5, '#6d4438');
  torso.addColorStop(1, '#4a2e26');
  g.fillStyle = torso;
  rr(g, -32, -34, 64, 54, 10); g.fill();
  // 胸口散热格栅
  g.fillStyle = '#2a1f1a';
  rr(g, -18, -20, 36, 24, 5); g.fill();
  g.fillStyle = '#ff7a2e';
  for (let i = 0; i < 4; i++) {
    rr(g, -15, -17 + i * 6, 30, 3, 1.5); g.fill();
  }
  // 肩甲
  g.fillStyle = '#7b8fa6';
  rr(g, -46, -36, 18, 26, 7); g.fill();
  rr(g, 28, -36, 18, 26, 7); g.fill();
  g.fillStyle = '#ffc531';
  rr(g, -44, -32, 14, 4, 2); g.fill();
  rr(g, 30, -32, 14, 4, 2); g.fill();
  // 头部
  g.fillStyle = '#5c6e84';
  rr(g, -14, -54, 28, 22, 6); g.fill();
  g.fillStyle = '#0d1117';
  rr(g, -10, -48, 20, 8, 3); g.fill();
  g.save();
  g.shadowBlur = 10;
  g.shadowColor = 'rgba(255,80,60,0.9)';
  g.fillStyle = '#ff5d5d';
  rr(g, -8, -47, 7, 6, 2); g.fill();
  rr(g, 2, -47, 7, 6, 2); g.fill();
  g.restore();
  // 背部排气
  g.fillStyle = '#33292a';
  rr(g, 26, -56, 9, 22, 3); g.fill();
  rr(g, 36, -50, 9, 16, 3); g.fill();
  // 能量护盾
  if (hasShield) {
    g.strokeStyle = 'rgba(127,215,255,' + (0.5 + Math.sin(time * 5) * 0.15) + ')';
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(-4, -12, 54, 52, 0, 0, TAU);
    g.stroke();
    g.fillStyle = 'rgba(127,215,255,0.08)';
    g.beginPath();
    g.ellipse(-4, -12, 54, 52, 0, 0, TAU);
    g.fill();
  }
}

function drawCrusher(e) {
  const roll = e.anim * 3;
  // 车身
  g.fillStyle = '#7c4a3c';
  rr(g, -14, -28, 56, 44, 7); g.fill();
  g.fillStyle = '#8f5748';
  rr(g, -14, -28, 56, 14, 7); g.fill();
  // 驾驶舱
  g.fillStyle = '#33414e';
  rr(g, 8, -24, 26, 18, 4); g.fill();
  g.fillStyle = '#ffc531';
  rr(g, 12, -20, 8, 8, 2); g.fill();
  // 排气管
  g.fillStyle = '#3a3128';
  rr(g, 32, -40, 7, 18, 3); g.fill();
  // 警示条纹
  g.save();
  rr(g, -14, 8, 56, 8, 3);
  g.clip();
  for (let i = -2; i < 8; i++) {
    g.fillStyle = i % 2 === 0 ? '#ffc531' : '#2a2622';
    g.save();
    g.translate(-14 + i * 10, 12);
    g.rotate(-0.55);
    g.fillRect(-4, -8, 8, 18);
    g.restore();
  }
  g.restore();
  // 前滚筒
  g.fillStyle = '#55606c';
  g.beginPath();
  g.arc(-26, 12, 22, 0, TAU);
  g.fill();
  g.fillStyle = '#414b56';
  g.beginPath();
  g.arc(-26, 12, 15, 0, TAU);
  g.fill();
  // 滚筒钉
  g.fillStyle = '#78848f';
  for (let i = 0; i < 8; i++) {
    const a = roll + i * TAU / 8;
    g.beginPath();
    g.arc(-26 + Math.cos(a) * 19, 12 + Math.sin(a) * 19, 3, 0, TAU);
    g.fill();
  }
  // 支架
  g.fillStyle = '#5d4437';
  rr(g, -18, -6, 12, 22, 3); g.fill();
}

/* ---- 其它绘制 ---- */
// 地雷
function drawMines() {
  for (const mn of mines) {
    const armed = mn.arm <= 0;
    const blink = armed && Math.sin(time * 6 + mn.x) > 0.2;
    g.save();
    g.translate(mn.x, mn.y);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.ellipse(0, 6, 13, 4, 0, 0, TAU); g.fill();
    // 雷体
    const body = g.createLinearGradient(0, -8, 0, 6);
    body.addColorStop(0, '#8d6a3f');
    body.addColorStop(1, '#5a4326');
    g.fillStyle = body;
    g.beginPath(); g.ellipse(0, 0, 12, 7, 0, 0, TAU); g.fill();
    g.strokeStyle = '#3c2d1a';
    g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(0, 0, 12, 7, 0, 0, TAU); g.stroke();
    // 触发柱
    g.fillStyle = '#c8d4e0';
    rr(g, -1.6, -12, 3.2, 6, 1.5); g.fill();
    // 指示灯
    g.save();
    if (blink) { g.shadowBlur = 8; g.shadowColor = 'rgba(255,93,93,0.9)'; }
    g.fillStyle = armed ? (blink ? '#ff5d5d' : '#7a2c2c') : '#8fa1b8';
    g.beginPath(); g.arc(0, -13, 2.4, 0, TAU); g.fill();
    g.restore();
    g.restore();
  }
}

// 迫击炮弹（抛物线飞行）
function drawShells() {
  for (const sh of shells) {
    const p = clamp(sh.t / sh.dur, 0, 1);
    const x = sh.x0 + (sh.tx - sh.x0) * p;
    const y = sh.y0 - Math.sin(p * Math.PI) * 130 + p * 12;
    g.save();
    g.translate(x, y);
    g.rotate(Math.atan2(Math.cos(p * Math.PI) * -1.2, 1) + 1.2);
    g.fillStyle = 'rgba(120,130,140,0.35)';
    g.beginPath(); g.arc(-7, 0, 5, 0, TAU); g.fill();
    g.fillStyle = '#d0a56a';
    g.beginPath(); g.ellipse(0, 0, 5.5, 8, 0, 0, TAU); g.fill();
    g.fillStyle = '#8b6a3e';
    rr(g, -4, 4, 8, 5, 2); g.fill();
    g.restore();
    // 落点标记
    g.strokeStyle = 'rgba(255,157,46,' + (0.25 + p * 0.5) + ')';
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(sh.tx, cellCy(sh.row) + 16, sh.splash * 0.45 * (0.5 + p * 0.5), 9 * (0.5 + p * 0.5), 0, 0, TAU);
    g.stroke();
  }
}

// 狙击弹道
function drawTracers() {
  for (const t of tracers) {
    const a = t.t / t.max;
    g.save();
    g.shadowBlur = 8;
    g.shadowColor = 'rgba(255,224,168,0.9)';
    g.strokeStyle = 'rgba(255,240,205,' + (0.9 * a) + ')';
    g.lineWidth = 2.4 * a + 0.6;
    g.beginPath();
    g.moveTo(t.x0, t.y0);
    g.lineTo(t.x1, t.y1);
    g.stroke();
    g.restore();
  }
}

function drawBeams() {
  for (const b of beams) {
    const alpha = b.t / b.max;
    const y = cellCy(b.row) - 8;
    if (b.kind === 'frost') {
      // 整行冰封闪光
      g.fillStyle = 'rgba(159,220,255,' + (0.22 * alpha) + ')';
      g.fillRect(b.x0, cellCy(b.row) - CELL_H / 2 + 4, W - b.x0, CELL_H - 8);
      g.fillStyle = 'rgba(224,244,255,' + (0.5 * alpha) + ')';
      g.fillRect(b.x0, y - 2, W - b.x0, 4);
    } else {
      g.fillStyle = 'rgba(255,140,80,' + (0.3 * alpha) + ')';
      g.fillRect(b.x0, y - 6, W - b.x0, 12);
      g.fillStyle = 'rgba(255,220,190,' + (0.85 * alpha) + ')';
      g.fillRect(b.x0, y - 1.8, W - b.x0, 3.6);
    }
  }
}

function drawBullets() {
  g.save();
  for (const b of bullets) {
    const y = cellCy(b.row) - 8 + (b.dy || 0);
    // 弹体光晕
    g.shadowBlur = b.kind === 'rocket' ? 14 : 10;
    g.shadowColor = b.kind === 'ice' || b.kind === 'frost' ? 'rgba(140,215,255,0.9)'
      : b.kind === 'arc' ? 'rgba(199,123,255,0.9)'
      : b.kind === 'rocket' ? 'rgba(255,140,60,0.9)'
      : 'rgba(255,205,80,0.9)';
    if (b.kind === 'rocket') {
      // 尾焰
      g.fillStyle = 'rgba(255,157,46,0.7)';
      g.beginPath();
      g.moveTo(b.x - 18, y);
      g.lineTo(b.x - 38 - rand(0, 8), y + rand(-4, 4));
      g.lineTo(b.x - 18, y + 6);
      g.closePath();
      g.fill();
      // 弹体
      g.fillStyle = '#d5dde6';
      rr(g, b.x - 18, y - 5, 26, 10, 4); g.fill();
      g.fillStyle = '#ff5d5d';
      g.beginPath();
      g.moveTo(b.x + 8, y - 5);
      g.lineTo(b.x + 18, y);
      g.lineTo(b.x + 8, y + 5);
      g.closePath();
      g.fill();
    } else if (b.kind === 'ice') {
      g.fillStyle = 'rgba(159,220,255,0.35)';
      g.beginPath(); g.arc(b.x - 6, y, 7, 0, TAU); g.fill();
      g.fillStyle = '#bfe9ff';
      g.beginPath(); g.arc(b.x, y, 5, 0, TAU); g.fill();
    } else if (b.kind === 'frost') {
      // 大冰弹：雪球 + 雪花纹 + 冷雾尾迹
      g.fillStyle = 'rgba(159,220,255,0.25)';
      g.beginPath(); g.arc(b.x - 12, y, 11, 0, TAU); g.fill();
      g.fillStyle = 'rgba(191,233,255,0.4)';
      g.beginPath(); g.arc(b.x, y, 12, 0, TAU); g.fill();
      g.fillStyle = '#dff2ff';
      g.beginPath(); g.arc(b.x, y, 9, 0, TAU); g.fill();
      g.strokeStyle = '#5fb8e8';
      g.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI / 3 + time * 3;
        g.beginPath();
        g.moveTo(b.x - Math.cos(a) * 6, y - Math.sin(a) * 6);
        g.lineTo(b.x + Math.cos(a) * 6, y + Math.sin(a) * 6);
        g.stroke();
      }
    } else if (b.kind === 'arc') {
      g.fillStyle = 'rgba(199,123,255,0.3)';
      g.beginPath(); g.arc(b.x - 7, y, 7, 0, TAU); g.fill();
      g.fillStyle = '#d9b8ff';
      g.beginPath(); g.arc(b.x, y, 4.5, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(217,184,255,0.7)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(b.x - 4, y - 5 + rand(-2, 2));
      g.lineTo(b.x + 4, y + 5 + rand(-2, 2));
      g.stroke();
    } else {
      g.fillStyle = 'rgba(255,197,49,0.3)';
      g.beginPath(); g.arc(b.x - 7, y, 6.5, 0, TAU); g.fill();
      g.fillStyle = '#ffd764';
      g.beginPath(); g.arc(b.x, y, 4.5, 0, TAU); g.fill();
    }
  }
  g.restore();
}

function drawZaps() {
  for (const z of zaps) {
    const alpha = z.t / z.max;
    const base = z.color || '#c896ff';
    g.strokeStyle = hexA(base, 0.85 * alpha);
    g.lineWidth = 2.5;
    g.beginPath();
    for (let i = 0; i < z.pts.length - 1; i++) {
      const a = z.pts[i], b = z.pts[i + 1];
      g.moveTo(a.x, a.y);
      const mx = (a.x + b.x) / 2 + rand(-8, 8);
      const my = (a.y + b.y) / 2 + rand(-8, 8);
      g.lineTo(mx, my);
      g.lineTo(b.x, b.y);
    }
    g.stroke();
    g.strokeStyle = 'rgba(240,235,255,' + (0.5 * alpha) + ')';
    g.lineWidth = 1;
    g.stroke();
  }
}
function hexA(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const gg = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + gg + ',' + b + ',' + a + ')';
}

function drawParts() {
  for (const p of parts) {
    const alpha = clamp(p.t / p.max, 0, 1);
    g.save();
    g.globalAlpha = alpha;
    g.translate(p.x, p.y);
    g.rotate(p.rot);
    g.fillStyle = p.color;
    if (p.shape === 'paper') {
      g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    } else if (p.shape === 'smoke') {
      g.globalAlpha = alpha * 0.5;
      g.beginPath(); g.arc(0, 0, p.size * 2.2, 0, TAU); g.fill();
    } else if (p.shape === 'gear') {
      g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    } else {
      g.beginPath(); g.arc(0, 0, p.size / 1.6, 0, TAU); g.fill();
    }
    g.restore();
  }
}

function drawOrbs() {
  for (const o of orbs) {
    const fade = o.falling ? 1 : clamp(o.life / 2, 0, 1);
    const pulse = 1 + Math.sin(time * 5 + o.x) * 0.07;
    g.save();
    g.globalAlpha = fade;
    g.translate(o.x, o.y);
    g.scale(pulse, pulse);
    // 光晕
    g.shadowBlur = 16;
    g.shadowColor = 'rgba(255,197,49,0.85)';
    g.fillStyle = 'rgba(255,197,49,0.22)';
    g.beginPath(); g.arc(0, 0, 24, 0, TAU); g.fill();
    g.shadowBlur = 0;
    // 电池
    g.fillStyle = '#ffc531';
    rr(g, -6, -13, 12, 5, 2); g.fill();
    g.fillStyle = '#2b3644';
    rr(g, -11, -9, 22, 24, 5); g.fill();
    g.strokeStyle = '#ffc531';
    g.lineWidth = 2;
    rr(g, -11, -9, 22, 24, 5); g.stroke();
    g.fillStyle = '#ffc531';
    g.beginPath();
    g.moveTo(3, -5);
    g.lineTo(-5, 3);
    g.lineTo(-1, 3);
    g.lineTo(-3, 11);
    g.lineTo(5, 2);
    g.lineTo(1, 2);
    g.closePath();
    g.fill();
    g.restore();
  }
}

function drawFloats() {
  for (const f of floats) {
    const alpha = clamp(f.t, 0, 1);
    g.globalAlpha = alpha;
    g.fillStyle = f.color;
    g.font = '800 17px "PingFang SC","Microsoft YaHei",sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 3;
    g.strokeText(f.txt, f.x, f.y);
    g.fillText(f.txt, f.x, f.y);
    g.globalAlpha = 1;
  }
}

// 合成/移动模式下高亮已选机器
function drawFuseHints() {
  if (state !== 'playing' || !sel) return;
  if (sel.mode === 'move' && sel.from) {
    const src = grid[sel.from.r][sel.from.c];
    if (!src) { sel.from = null; return; }
    const pulse2 = 0.55 + Math.sin(time * 6) * 0.25;
    g.strokeStyle = 'rgba(76,194,255,' + pulse2 + ')';
    g.lineWidth = 3;
    g.strokeRect(GRID_X + sel.from.c * CELL_W + 2, GRID_Y + sel.from.r * CELL_H + 2, CELL_W - 4, CELL_H - 4);
    return;
  }
  if (sel.mode !== 'fuse' || !sel.first) return;
  const a = grid[sel.first.r][sel.first.c];
  if (!a) { sel.first = null; return; }
  const pulse = 0.55 + Math.sin(time * 6) * 0.25;
  const fx = GRID_X + sel.first.c * CELL_W, fy = GRID_Y + sel.first.r * CELL_H;
  g.strokeStyle = 'rgba(255,197,49,' + pulse + ')';
  g.lineWidth = 3;
  g.strokeRect(fx + 2, fy + 2, CELL_W - 4, CELL_H - 4);
  // 任意机器都可杂交：其余机器全部亮绿框
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const m = grid[r][c];
      if (!m || m.type === 'box') continue;
      if (r === sel.first.r && c === sel.first.c) continue;
      g.strokeStyle = 'rgba(88,214,139,' + pulse + ')';
      g.strokeRect(GRID_X + c * CELL_W + 2, GRID_Y + r * CELL_H + 2, CELL_W - 4, CELL_H - 4);
    }
  }
}

function drawHoverGhost() {
  if (state !== 'playing' || !sel || mouse.x < 0) return;
  const cell = cellAt(mouse.x, mouse.y);
  if (!cell) return;
  const x = GRID_X + cell.c * CELL_W, y = GRID_Y + cell.r * CELL_H;
  const occupied = !!grid[cell.r][cell.c];
  if (sel.mode === 'shovel') {
    g.fillStyle = occupied ? 'rgba(255,93,93,0.25)' : 'rgba(255,255,255,0.06)';
    g.fillRect(x, y, CELL_W, CELL_H);
    return;
  }
  if (sel.mode === 'fuse') {
    g.fillStyle = occupied ? 'rgba(199,123,255,0.18)' : 'rgba(255,255,255,0.05)';
    g.fillRect(x, y, CELL_W, CELL_H);
    return;
  }
  if (sel.mode === 'move') {
    if (sel.from && !occupied) {
      const src = grid[sel.from.r][sel.from.c];
      g.fillStyle = 'rgba(76,194,255,0.14)';
      g.fillRect(x, y, CELL_W, CELL_H);
      g.strokeStyle = 'rgba(76,194,255,0.7)';
      g.lineWidth = 2;
      g.strokeRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);
      if (src) {
        g.globalAlpha = 0.5;
        drawMachine(g, src.type, cellCx(cell.c), cellCy(cell.r) + 6, 1.0, src);
        g.globalAlpha = 1;
      }
    } else {
      g.fillStyle = occupied ? 'rgba(76,194,255,0.16)' : 'rgba(255,255,255,0.05)';
      g.fillRect(x, y, CELL_W, CELL_H);
    }
    return;
  }
  if (sel.mode === 'card') {
    // 普通模式：选中机器的放置预览
    g.fillStyle = occupied ? 'rgba(255,93,93,0.22)' : 'rgba(88,214,139,0.16)';
    g.fillRect(x, y, CELL_W, CELL_H);
    g.strokeStyle = occupied ? 'rgba(255,93,93,0.7)' : 'rgba(88,214,139,0.7)';
    g.lineWidth = 2;
    g.strokeRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);
    if (!occupied) {
      g.globalAlpha = 0.55;
      drawMachine(g, sel.type, cellCx(cell.c), cellCy(cell.r) + 6, 1.0, {});
      g.globalAlpha = 1;
    }
    return;
  }
  // 盲盒放置模式
  g.fillStyle = occupied ? 'rgba(255,93,93,0.22)' : 'rgba(255,197,49,0.14)';
  g.fillRect(x, y, CELL_W, CELL_H);
  g.strokeStyle = occupied ? 'rgba(255,93,93,0.7)' : 'rgba(255,197,49,0.7)';
  g.lineWidth = 2;
  g.strokeRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);
  if (!occupied) {
    g.globalAlpha = 0.55;
    drawMachine(g, 'box', cellCx(cell.c), cellCy(cell.r) + 6, 1.0, {});
    g.globalAlpha = 1;
  }
}

function drawBanner() {
  if (bannerT <= 0) return;
  const alpha = bannerT > 2 ? (2.4 - bannerT) / 0.4 : clamp(bannerT / 0.5, 0, 1);
  g.globalAlpha = clamp(alpha, 0, 1);
  g.fillStyle = 'rgba(8,12,18,0.6)';
  const y = GRID_Y + ROWS * CELL_H * 0.32;
  rr(g, W / 2 - 250, y - 34, 500, bannerSub ? 84 : 62, 14);
  g.fill();
  g.strokeStyle = 'rgba(255,197,49,0.35)';
  g.lineWidth = 1.5;
  rr(g, W / 2 - 250, y - 34, 500, bannerSub ? 84 : 62, 14);
  g.stroke();
  const titleGrad = g.createLinearGradient(0, y - 18, 0, y + 14);
  titleGrad.addColorStop(0, '#ffe9a8');
  titleGrad.addColorStop(1, '#ffb52e');
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.7)';
  g.shadowBlur = 6;
  g.shadowOffsetY = 2;
  g.fillStyle = titleGrad;
  g.font = '900 30px "PingFang SC","Microsoft YaHei",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(bannerText, W / 2, y);
  g.restore();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (bannerSub) {
    g.fillStyle = '#dce6f2';
    g.font = '600 15px "PingFang SC","Microsoft YaHei",sans-serif';
    g.fillText(bannerSub, W / 2, y + 30);
  }
  g.globalAlpha = 1;
}

/* ========== 调试接口（供自动化测试） ========== */
window.__game = {
  start: m => startGame(m),
  addEnergy: n => { energy += n; },
  playCard: (t, r, c) => {
    if (mode !== 'classic' || state !== 'playing') return false;
    if (CLASSIC_COST[t] === undefined) return false;
    if (energy < CLASSIC_COST[t] || (classicCd[t] || 0) > 0) return false;
    if (!place(t, r, c)) return false;
    energy -= CLASSIC_COST[t];
    classicCd[t] = CLASSIC_CD[t];
    return true;
  },
  get mode() { return mode; },
  get cooldowns() { return { ...classicCd }; },
  get moveCooldown() { return 0; },   // 手套已取消冷却
  move: (r1, c1, r2, c2) => {
    const src = grid[r1][c1];
    if (!src || src.type === 'box' || grid[r2][c2]) return false;
    grid[r1][c1] = null;
    grid[r2][c2] = src;
    src.row = r2; src.col = c2;
    return true;
  },
  get wavesOn() { return wavesOn; },
  toggleWaves: () => { wavesOn = !wavesOn; return wavesOn; },
  // 花能量在场上放一个盲盒（模拟真实购买）
  buyBox: (r, c) => {
    if (state !== 'playing' || (!creative() && energy < BOX_COST)) return false;
    if (!placeBox(r, c)) return false;
    if (!creative()) energy -= BOX_COST;
    return true;
  },
  placeBox: (r, c) => placeBox(r, c),
  placeAt: (t, r, c) => place(t, r, c),
  spawn: (t, r) => spawnEnemy(t, r),
  advance: sec => {
    const steps = Math.round(sec * 60);
    for (let i = 0; i < steps; i++) {
      if (state !== 'playing') break;
      update(1 / 60);
    }
  },
  machineAt: (r, c) => (grid[r][c] ? grid[r][c].type : null),
  fuse: (r1, c1, r2, c2) => {
    const a = grid[r1][c1], b = grid[r2][c2];
    if (!a || !b || a === b || a.type === 'box' || b.type === 'box') return false;
    const result = doFuse(r1, c1, r2, c2);
    return result ? result.type : false;
  },
  nameAt: (r, c) => (grid[r][c] ? machineName(grid[r][c]) : null),
  machineHp: (r, c) => (grid[r][c] ? Math.round(grid[r][c].hp) : null),
  damageMachine: (r, c, d) => { if (grid[r][c]) damageMachine(grid[r][c], d); },
  damageEnemyAt: (row, d) => {
    const e = enemies.find(x => x.row === row && !x.dead);
    if (e) damageEnemy(e, d, 'true');
  },
  clear: () => {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) grid[r][c] = null;
    enemies.length = 0; bullets.length = 0; mines.length = 0;
    shells.length = 0; tracers.length = 0; orbs.length = 0;
  },
  get mineCount() { return mines.length; },
  get shellCount() { return shells.length; },
  modulesAt: (r, c) => (grid[r][c] && grid[r][c].modules ? grid[r][c].modules.map(x => x.kind + x.lv) : null),
  collectAll: () => {
    let got = 0;
    for (let i = orbs.length - 1; i >= 0; i--) {
      if (!orbs[i].falling) { got += orbs[i].val; energy += orbs[i].val; orbs.splice(i, 1); }
    }
    return got;
  },
  get state() { return state; },
  get energy() { return energy; },
  get history() { return history.slice(); },
  get pity() { return pity; },
  get enemyCount() { return enemies.length; },
  get enemyList() {
    return enemies.map(e => ({
      type: e.type, row: e.row, x: e.x, hp: e.hp, shield: e.shield, boss: !!e.boss,
      frozen: e.frozenT > 0, slowed: e.slowT > 0,
      burning: e.burnT > 0, poisoned: e.poisonT > 0,
      dashing: e.dashing > 0, jumping: e.jumpT > 0,
    }));
  },
  get score() { return score; },
  get kills() { return kills; },
  get wave() { return wave; },
};

/* ========== 启动 ========== */
initGame();
requestAnimationFrame(frame);
