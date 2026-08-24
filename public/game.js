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
  // ---- 合成机型（只能通过合成获得，不进盲盒池） ----
  frostcannon: { name: '冰冻弹簧炮', rarity: 'fusion', hp: 420,  desc: '每 5 秒轰出冰冻炮弹，命中后冻结整行敌人 2 秒' },
  twinturret:  { name: '双管炮台',   rarity: 'fusion', hp: 420,  desc: '双管齐射，射速接近翻倍' },
  powerplant:  { name: '聚变电站',   rarity: 'fusion', hp: 400,  desc: '每 5 秒产出 40 能量' },
  arcturret:   { name: '电弧机炮',   rarity: 'fusion', hp: 380,  desc: '电弧弹命中后跳向后方最多 2 个敌人' },
  magshredder: { name: '磁力碎纸机', rarity: 'fusion', hp: 450,  desc: '隔空把本行最前的敌人拖进纸箱粉碎（冷却 11 秒）' },
  frostwall:   { name: '寒冰壁垒',   rarity: 'fusion', hp: 2000, desc: '高耐久寒冰墙，靠近的敌人被大幅减速' },
};

// 普通模式：卡槽顺序、价格与冷却（秒）
const CLASSIC_ORDER = ['generator', 'turret', 'barricade', 'puncher', 'fan', 'shredder', 'magnet', 'tesla', 'railgun', 'rocket'];
const CLASSIC_COST = {
  generator: 50, turret: 100, barricade: 50, puncher: 100, fan: 150,
  shredder: 150, magnet: 175, tesla: 250, railgun: 250, rocket: 200,
};
const CLASSIC_CD = {
  generator: 5, turret: 5, barricade: 15, puncher: 5, fan: 8,
  shredder: 12, magnet: 12, tesla: 15, railgun: 15, rocket: 20,
};

/* ========== 通用杂交系统 ==========
 * 每台机器由 1~2 个"模块"组成：{kind, lv}，lv 1~3。
 * 任意两台机器都能杂交：同类模块等级相加（上限 3 级），
 * 不同模块并存（最多保留 2 个最强模块）。
 */
const KIND_ORDER = ['shot', 'laser', 'zap', 'rocket', 'shred', 'magnet', 'melee', 'frost', 'armor', 'energy'];
// 单模块机器的进阶命名（1/2/3 级）
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
};
// 作为副模块时的修饰词（用于自动命名混合机）
const KIND_ADJ = {
  shot: '机炮', energy: '充能', armor: '装甲', melee: '重拳', frost: '冰霜',
  shred: '绞碎', magnet: '磁暴', zap: '雷电', laser: '激光', rocket: '轰爆',
};
const KIND_DESC = {
  shot: '发射能量弹', energy: '产出能量', armor: '高耐久装甲', melee: '近战铁拳（无视护盾）',
  frost: '冰弹减速敌人', shred: '粉碎靠近的敌人', magnet: '把敌人拖回后方',
  zap: '闪电链打击多个敌人', laser: '激光贯穿整行', rocket: '火箭轰击整行',
};
// 各模块对血量的加成
const KIND_HP = {
  shot: 0, energy: 0, armor: 1300, melee: 80, frost: 0,
  shred: 150, magnet: 20, zap: 50, laser: 0, rocket: -100,
};
// 经典组合的专属类型（保持原有名字和造型）
const PAIR_TYPE = [
  [['shot', 'zap'], 'arcturret', '电弧机炮'],
  [['shred', 'magnet'], 'magshredder', '磁力碎纸机'],
  [['armor', 'frost'], 'frostwall', '寒冰壁垒'],
  [['melee', 'frost'], 'frostcannon', '冰冻弹簧炮'],
];

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
// 杂交：合并两台机器的模块
function mergeModules(a, b) {
  const map = {};
  for (const mod of [...a, ...b]) {
    map[mod.kind] = Math.min(3, (map[mod.kind] || 0) + mod.lv);
  }
  const merged = sortModules(Object.keys(map).map(k => ({ kind: k, lv: map[k] })));
  return merged.slice(0, 2); // 最多保留 2 个最强模块
}
function typeOfModules(mods) {
  if (mods.length === 1) return LADDER_TYPE[mods[0].kind][mods[0].lv - 1];
  if (mods[0].lv === 1 && mods[1].lv === 1) {
    const kinds = [mods[0].kind, mods[1].kind];
    const pair = PAIR_TYPE.find(p => p[0].every(k => kinds.includes(k)));
    if (pair) return pair[1];
  }
  return 'hybrid';
}
function totalLv(mods) { return mods.reduce((s, mod) => s + mod.lv, 0); }
function nameOfModules(mods) {
  if (mods.length === 1) return LADDER_NAME[mods[0].kind][mods[0].lv - 1];
  if (mods[0].lv === 1 && mods[1].lv === 1) {
    const kinds = [mods[0].kind, mods[1].kind];
    const pair = PAIR_TYPE.find(p => p[0].every(k => kinds.includes(k)));
    if (pair) return pair[2];
  }
  const name = KIND_ADJ[mods[1].kind] + LADDER_NAME[mods[0].kind][mods[0].lv - 1];
  const t = totalLv(mods);
  return t > 2 ? name + ' Lv' + t : name;
}
function descOfModules(mods) {
  return mods.map(mod => KIND_DESC[mod.kind] + (mod.lv > 1 ? '×' + mod.lv : '')).join('，');
}
function hpOfModules(mods) {
  let hp = 300;
  for (const mod of mods) hp += KIND_HP[mod.kind] * mod.lv;
  hp += 60 * (totalLv(mods) - 1);
  return Math.max(hp, 120);
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
  crusher:   { name: '重型碾压车', hp: 1400, speed: 11, dmg: 240, score: 80, w: 86 },
};

const BOX_POOL = {
  common: [['turret', 20], ['generator', 20], ['barricade', 10], ['puncher', 12]],
  rare:   [['shredder', 12], ['fan', 12], ['magnet', 10]],
  epic:   [['tesla', 6], ['rocket', 5], ['railgun', 6]],
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
let mode = 'box';          // box（盲盒模式） | classic（普通模式）
let classicCd = {};        // 普通模式各卡剩余冷却
let classicCardEls = {};   // 普通模式卡片 DOM 引用
let moveCd = 0;            // 手套（搬运）冷却
const MOVE_CD = 5;
let energy, score, kills, wave, endless, pity, history;
let grid, enemies, bullets, orbs, parts, floats, zaps, beams;
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
  waveState = 'pre'; waveTimer = 15; queue = []; spawnT = 0;
  skyT = 3; lastRows = [];
  bannerText = ''; bannerSub = ''; bannerT = 0; shakeT = 0; shakeAmp = 0;
  sel = null; submitted = false; time = 0;
  classicCd = {}; moveCd = 0;
  renderTray();
  renderClassicTray();
  applyModeUI();
}

// 根据模式切换卡槽区域
function applyModeUI() {
  const classic = mode === 'classic';
  $('boxBtn').style.display = classic ? 'none' : '';
  $('trayInfo').style.display = classic ? 'none' : '';
  $('classicTray').style.display = classic ? '' : 'none';
}

// 普通模式卡槽：全部机器明码标价
function renderClassicTray() {
  const holder = $('classicTray');
  holder.innerHTML = '';
  classicCardEls = {};
  for (const type of CLASSIC_ORDER) {
    const info = MACHINES[type];
    const el = document.createElement('div');
    el.className = 'card r-' + info.rarity;
    el.title = info.name + '（' + CLASSIC_COST[type] + '⚡ / 冷却 ' + CLASSIC_CD[type] + ' 秒）：' + info.desc;
    const mini = document.createElement('canvas');
    mini.width = 104; mini.height = 104;
    drawMachine(mini.getContext('2d'), type, 52, 58, 1.0, {});
    const nm = document.createElement('div');
    nm.className = 'nm';
    nm.textContent = info.name;
    const cost = document.createElement('div');
    cost.className = 'cost';
    cost.textContent = CLASSIC_COST[type] + '⚡';
    const cdOv = document.createElement('div');
    cdOv.className = 'cdOv';
    el.appendChild(mini); el.appendChild(nm); el.appendChild(cost); el.appendChild(cdOv);
    el.addEventListener('click', () => {
      if (state !== 'playing' || mode !== 'classic') return;
      if (sel && sel.mode === 'card' && sel.type === type) { sel = null; renderTray(); return; }
      if (energy < CLASSIC_COST[type] || (classicCd[type] || 0) > 0) { sfx('error'); return; }
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
    fly: !!info.fly,
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
  else if (n === 3) { push('scrap', 5); push('armored', 2); }
  else if (n === 4) { push('scrap', 6); push('armored', 2); push('drone', 2); }
  else if (n === 5) { push('scrap', 6); push('armored', 3); push('drone', 2); push('bomber', 2); }
  else if (n === 6) { push('scrap', 6); push('armored', 3); push('drone', 3); push('bomber', 2); push('shieldbot', 1); }
  else if (n === 7) { push('scrap', 7); push('armored', 4); push('drone', 2); push('bomber', 2); push('shieldbot', 2); push('crusher', 1); }
  else if (n === 8) { push('scrap', 7); push('armored', 4); push('drone', 3); push('bomber', 3); push('shieldbot', 2); push('crusher', 1); }
  else if (n === 9) { push('scrap', 8); push('armored', 5); push('drone', 3); push('bomber', 3); push('shieldbot', 3); push('crusher', 2); }
  else if (n === 10) { push('scrap', 9); push('armored', 5); push('drone', 4); push('bomber', 4); push('shieldbot', 3); push('crusher', 3); }
  else {
    const k = n - TOTAL_WAVES;
    push('scrap', 9 + k);
    push('armored', 5 + k);
    push('drone', 4 + Math.floor(k * 0.6));
    push('bomber', 4 + Math.floor(k * 0.6));
    push('shieldbot', 3 + Math.floor(k * 0.5));
    push('crusher', 3 + Math.floor(k / 2));
  }
  // 洗牌，重型碾压车安排在后半段出场
  const normal = shuffle(list.filter(t => t !== 'crusher'));
  const heavy = list.filter(t => t === 'crusher');
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
  if (!endless && wave === TOTAL_WAVES) banner('⚠️ 最终决战！', '守住这一波就胜利了！');
  else if (wave === 5) banner('第 5 波来袭！', '一大波机器人正在接近……小心自爆无人蜂！');
  else if (wave === 6) banner('第 6 波来袭！', '盾卫机器人登场：护盾会挡住子弹，用近战机器对付它！');
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
function damageEnemy(e, d, kind) {
  if (kind === 'ranged' && e.shield > 0) {
    const absorbed = Math.min(e.shield, d);
    e.shield -= absorbed;
    d -= absorbed;
    e.flash = 0.12;
    if (e.shield <= 0) {
      spawnParts(e.x - e.w / 2, rowCy(e), '#9fdcff', 12, 140, 0.5, 'gear');
      addFloat(e.x, rowCy(e) - 40, '护盾破碎！', '#4cc2ff');
      sfx('break');
    }
    if (d <= 0) return;
  }
  e.hp -= d;
  e.flash = 0.12;
  if (e.hp <= 0 && !e.dead) {
    e.dead = true;
    kills++;
    score += e.scoreVal;
    spawnParts(e.x, rowCy(e), '#c8935a', 12, 130, 0.6, 'gear');
    spawnParts(e.x, rowCy(e), '#ffd764', 6, 100, 0.4, 'spark');
    if (e.type === 'crusher') { shake(0.35, 5); sfx('boom'); }
  }
}
function rowCy(e) { return cellCy(e.row) + (e.fly ? -22 : 0); }
function shake(t, amp) { shakeT = t; shakeAmp = amp; }

function enemiesInRow(row) { return enemies.filter(e => e.row === row); }

// 模块参数表：每种模块 1/2/3 级的数值
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
  armor:  {},
};

function enemyAhead(r, cx) {
  return enemies.some(e => e.row === r && e.x > cx - CELL_W / 2 && e.x < W + 30);
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
        const S = MOD_STAT[mod.kind];
        const i = mod.lv - 1;
        if (mod.kind === 'shot') {
          m.mt.shot = (m.mt.shot || 0) + dt;
          if (m.mt.shot >= S.interval[i] && enemyAhead(r, cx)) {
            m.mt.shot = 0;
            m.recoil = 0.12;
            m.altBarrel = !m.altBarrel;
            // 模块协同：带雷电→电弧弹跳，带冰霜→冰弹减速
            const kind = hasKind(m, 'zap') ? 'arc' : hasKind(m, 'frost') ? 'ice' : 'shot';
            const dy = mod.lv >= 2 ? (m.altBarrel ? -12 : 2) : 0;
            bullets.push({ kind, row: r, x: cx + 34, dmg: S.dmg[i], speed: 340, dy });
            sfx(kind === 'arc' ? 'zap' : kind === 'ice' ? 'ice' : 'shoot');
          }
        } else if (mod.kind === 'energy') {
          m.mt.energy = (m.mt.energy || 0) + dt;
          if (m.mt.energy >= S.interval[i]) {
            m.mt.energy = 0;
            m.pulse = 0.5;
            orbs.push({
              x: cx + rand(-18, 22), y: cellCy(r) + rand(-8, 16),
              ty: 0, vy: 0, val: S.val[i], life: 10, falling: false,
            });
            sfx('gen');
          }
        } else if (mod.kind === 'melee') {
          m.mt.melee = (m.mt.melee || 0) + dt;
          if (m.mt.melee >= S.interval[i]) {
            const left = GRID_X + c * CELL_W;
            const prey = enemies.find(e =>
              e.row === r && !e.dead &&
              e.x - e.w / 2 <= left + CELL_W + 26 &&
              e.x > left - 10
            );
            if (prey) {
              m.mt.melee = 0;
              m.recoil = 0.25;
              damageEnemy(prey, S.dmg[i], 'melee');
              spawnParts(prey.x - 6, rowCy(prey), '#ffd764', 5, 100, 0.3, 'spark');
              sfx('punch');
            }
          }
        } else if (mod.kind === 'frost') {
          m.mt.frost = (m.mt.frost || 0) + dt;
          if (m.mt.frost >= S.interval[i] && enemyAhead(r, cx)) {
            m.mt.frost = 0;
            bullets.push({ kind: 'ice', row: r, x: cx + 30, dmg: 12, speed: 320 });
            sfx('ice');
          }
          // 2 级起：定期轰出冻结整行的冰冻炮弹
          if (mod.lv >= 2) {
            m.mt.frostShell = (m.mt.frostShell || 0) + dt;
            if (m.mt.frostShell >= S.shellCd[i] && enemyAhead(r, cx)) {
              m.mt.frostShell = 0;
              m.recoil = 0.25;
              bullets.push({ kind: 'frost', row: r, x: cx + 34, dmg: 60, speed: 300, freeze: S.freeze[i] });
              sfx('ice');
            }
          }
          // 寒气光环：2 级起、或与装甲组合（寒冰壁垒）
          if (mod.lv >= 2 || hasKind(m, 'armor')) {
            for (const e of enemies) {
              if (e.row === r && !e.dead && Math.abs(e.x - cx) < CELL_W * 1.45) {
                e.slowT = Math.max(e.slowT, 0.6);
              }
            }
            if (Math.random() < dt * 2.5) {
              spawnParts(cx + rand(-30, 30), cellCy(r) + rand(-30, 20), '#bfe9ff', 1, 25, 0.6, 'smoke');
            }
          }
        } else if (mod.kind === 'shred') {
          if ((m.mcd.shred || 0) <= 0) {
            const left = GRID_X + c * CELL_W;
            // 与磁力组合：隔空把整行最前的敌人拖进纸箱
            const magRange = hasKind(m, 'magnet');
            let prey = null;
            if (magRange) {
              const targets = enemiesInRow(r).filter(e =>
                !e.dead && e.type !== 'crusher' && e.x > cx + 20 && e.x < W + 20);
              if (targets.length) prey = targets.reduce((a, b) => (a.x < b.x ? a : b));
            } else {
              prey = enemies.find(e =>
                e.row === r && !e.dead &&
                e.x - e.w / 2 <= left + CELL_W - 24 &&
                e.x >= left - 8);
            }
            if (prey) {
              m.mcd.shred = S.cd[i];
              m.chew = 0.7;
              if (magRange) {
                zaps.push({
                  pts: [{ x: cx + 10, y: cellCy(r) - 34 }, { x: prey.x, y: rowCy(prey) }],
                  t: 0.3, max: 0.3, color: '#ff9d2e',
                });
                prey.x = cx + 12;
              }
              damageEnemy(prey, S.dmg[i], 'true');
              spawnParts(cx + 20, cellCy(r), '#e8edf4', 16, 150, 0.7, 'paper');
              addFloat(cx, cellCy(r) - 46, magRange ? '隔空咔嚓！' : '咔嚓！', '#ff9d2e');
              sfx('shred');
            }
          }
        } else if (mod.kind === 'magnet') {
          if ((m.mcd.magnet || 0) <= 0 && !hasKind(m, 'shred')) {
            const targets = enemiesInRow(r).filter(e =>
              !e.dead && e.type !== 'crusher' &&
              e.x > cx - 10 && e.x < cx + 5 * CELL_W
            );
            if (targets.length) {
              const prey = targets.reduce((a, b) => (a.x < b.x ? a : b));
              m.mcd.magnet = S.cd[i];
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
        } else if (mod.kind === 'zap') {
          m.mt.zap = (m.mt.zap || 0) + dt;
          if (m.mt.zap >= S.cd[i]) {
            const targets = enemiesInRow(r)
              .filter(e => e.x > cx - 20 && e.x < W + 20)
              .sort((a, b) => a.x - b.x)
              .slice(0, S.targets[i]);
            if (targets.length) {
              m.mt.zap = 0;
              m.flash = 0.25;
              const pts = [{ x: cx, y: cellCy(r) - 26 }];
              for (const e of targets) {
                pts.push({ x: e.x, y: rowCy(e) });
                damageEnemy(e, S.dmg[i], 'ranged');
              }
              zaps.push({ pts, t: 0.22, max: 0.22 });
              sfx('zap');
            }
          }
        } else if (mod.kind === 'laser') {
          m.mt.laser = (m.mt.laser || 0) + dt;
          m.charge = clamp(m.mt.laser / S.cd[i], 0, 1);
          if (m.mt.laser >= S.cd[i]) {
            const targets = enemiesInRow(r).filter(e => !e.dead && e.x > cx);
            if (targets.length) {
              m.mt.laser = 0;
              m.flash = 0.3;
              for (const e of targets) damageEnemy(e, S.dmg[i], 'ranged');
              beams.push({ row: r, x0: cx + 26, t: 0.28, max: 0.28 });
              sfx('laser');
            }
          }
        } else if (mod.kind === 'rocket') {
          if ((m.mcd.rocket || 0) <= 0) {
            if (enemyAhead(r, cx)) {
              m.mcd.rocket = S.cd[i];
              bullets.push({ kind: 'rocket', row: r, x: cx + 20, dmg: 900, speed: 430, hit: new Set() });
              spawnParts(cx, cellCy(r) + 10, '#aab7c4', 14, 90, 0.8, 'smoke');
              shake(0.25, 4);
              sfx('boom');
            }
          }
          m.reload = clamp((m.mcd.rocket || 0) / S.cd[i], 0, 1);
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
    if (e.frozenT > 0) {
      // 完全冻结：不移动、不攻击、动画停格
      e.frozenT -= dt;
      if (e.flash > 0) e.flash -= dt;
      continue;
    }
    e.anim += dt;
    if (e.flash > 0) e.flash -= dt;
    if (e.slowT > 0) e.slowT -= dt;
    const mul = e.slowT > 0 ? 0.45 : 1;
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
      e.hitT -= dt;
      if (e.hitT <= 0) {
        e.hitT = e.type === 'crusher' ? 0.8 : 0.95;
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
  if (moveCd > 0) moveCd -= dt;
  updateWaves(dt);
  updateMachines(dt);
  updateBullets(dt);
  updateEnemies(dt);
  updateOrbs(dt);
  updateFx(dt);
}

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
  $('energyVal').textContent = energy;
  $('scoreVal').textContent = score;
  let wtxt;
  if (wave === 0) wtxt = '准备中';
  else if (endless || wave > TOTAL_WAVES) wtxt = '无尽 · 第' + wave + '波';
  else wtxt = '第' + wave + '/' + TOTAL_WAVES + '波';
  $('waveVal').textContent = wtxt;
  $('boxBtn').disabled = state !== 'playing' || energy < BOX_COST;
  $('moveBtn').classList.toggle('cooling', moveCd > 0);
  if (mode === 'classic') {
    for (const type in classicCardEls) {
      const { el, cdOv } = classicCardEls[type];
      const cd = classicCd[type] || 0;
      el.classList.toggle('off', state !== 'playing' || energy < CLASSIC_COST[type] || cd > 0);
      el.classList.toggle('sel', !!(sel && sel.mode === 'card' && sel.type === type));
      cdOv.style.height = cd > 0 ? (cd / CLASSIC_CD[type] * 100) + '%' : '0';
    }
  }
}

/* ========== 游戏流程 ========== */
function startGame(m) {
  if (m === 'box' || m === 'classic') mode = m;
  initGame();
  state = 'playing';
  show('menu', false); show('end', false); show('pauseOv', false);
  if (mode === 'classic') {
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
  const modeTag = mode === 'classic' ? '（🃏 普通模式）' : '（🎁 盲盒模式）';
  $('endSub').textContent = (win
    ? '你抵挡住了全部 ' + TOTAL_WAVES + ' 波进攻，机械基地安然无恙！'
    : '机器人冲进了基地，第 ' + Math.max(wave, 1) + ' 波未能守住。') + modeTag;
  $('endScore').textContent = score;
  $('endWave').textContent = wave;
  $('endKills').textContent = kills;
  $('endlessBtn').style.display = win ? '' : 'none';
  $('submitRow').style.display = '';
  $('board').style.display = 'none';
  $('nameInput').value = localStorage.getItem('mg_playerName') || '';
  submitted = false;
  $('submitBtn').disabled = false;
  $('submitBtn').textContent = '提交成绩';
  show('end', true);
  sfx(win ? 'win' : 'lose');
  loadBoard($('board'));
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
    if (moveCd > 0) {
      addFloat(cellCx(cell.c), cellCy(cell.r) - 30, '手套冷却中', '#ff5d5d');
      sfx('error');
      return;
    }
    const src = grid[sel.from.r][sel.from.c];
    if (!src) { sel.from = null; return; }
    grid[sel.from.r][sel.from.c] = null;
    grid[cell.r][cell.c] = src;
    spawnParts(cellCx(sel.from.c), cellCy(sel.from.r) + 20, '#8fa1b8', 8, 70, 0.4, 'smoke');
    src.row = cell.r;
    src.col = cell.c;
    moveCd = MOVE_CD;
    spawnParts(cellCx(cell.c), cellCy(cell.r) + 20, '#8fa1b8', 8, 70, 0.4, 'smoke');
    addFloat(cellCx(cell.c), cellCy(cell.r) - 40, '搬运完成', '#4cc2ff');
    sfx('place');
    sel = null;
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
    // 普通模式：花能量放置选中的机器
    const type = sel.type;
    if (grid[cell.r][cell.c]) {
      addFloat(cellCx(cell.c), cellCy(cell.r) - 30, '这里已有机器', '#ff5d5d');
      sfx('error');
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
    if (energy < BOX_COST) {
      sel = null;
      renderTray();
      sfx('error');
      return;
    }
    if (placeBox(cell.r, cell.c)) {
      energy -= BOX_COST;
      // 能量足够时保持放置模式，可以连续放
      if (energy < BOX_COST) {
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
  drawBeams();
  drawBullets();
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
};

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
  const pri = mods[0], sec = mods[1];
  if (pri) drawLevelDecor(ctx, totalLv(mods));
  drawChassis(ctx, type, pri, m);
  if (sec) drawEmblem(ctx, sec);
  ctx.restore();
  // 血条
  if (m && m.maxHp && m.hp < m.maxHp) {
    drawBar(ctx, x, y - 52 * s, 44 * s, 5, clamp(m.hp / m.maxHp, 0, 1));
  }
}

// 机体造型分发：经典组合有专属造型，其余按主模块+等级
function drawChassis(ctx, type, pri, m) {
  switch (type) {
    case 'arcturret': return drawArcturret(ctx, m);
    case 'magshredder': return drawMagshredder(ctx, m);
    case 'frostwall': return drawFrostwall(ctx, m);
    case 'frostcannon': return drawFrostcannon(ctx, m);
  }
  if (!pri) return;
  switch (pri.kind) {
    case 'shot': return pri.lv >= 3 ? drawGatling(ctx, m) : pri.lv === 2 ? drawTwinturret(ctx, m) : drawTurret(ctx, m);
    case 'energy': return pri.lv >= 2 ? drawPowerplant(ctx, m) : drawGenerator(ctx, m);
    case 'armor': return drawBarricade(ctx, m);
    case 'melee': return drawPuncher(ctx, m);
    case 'frost': return drawFan(ctx, m);
    case 'shred': return drawShredder(ctx, m);
    case 'magnet': return drawMagnet(ctx, m);
    case 'zap': return drawTesla(ctx, m);
    case 'laser': return drawRailgun(ctx, m);
    case 'rocket': return drawRocket(ctx, m);
  }
}

// 等级光环：合成度越高越华丽
function drawLevelDecor(ctx, tl) {
  if (tl <= 1) return;
  const pulse = Math.sin(time * 4) * 0.05;
  if (tl >= 4) {
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

// 副模块徽章（机体右上角小圆标）
function drawEmblem(ctx, mod) {
  const col = EMBLEM_COLOR[mod.kind] || '#8fa1b8';
  ctx.save();
  ctx.translate(29, -36);
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
  }
  // 等级点
  if (mod.lv > 1) {
    ctx.fillStyle = '#ffc531';
    for (let i = 0; i < mod.lv; i++) {
      ctx.beginPath(); ctx.arc(-6 + i * 6, 14, 2, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

// 圆角血条（带底槽和描边）
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

// 加特林炮台：旋转三管机炮
function drawGatling(ctx, m) {
  const rec = (m && m.recoil > 0) ? m.recoil * 22 : 0;
  const spin = (m && m.spin ? m.spin : 0) * 7;
  // 重型底座
  const ped = ctx.createLinearGradient(0, 10, 0, 38);
  ped.addColorStop(0, '#3d4d61');
  ped.addColorStop(1, '#25313f');
  ctx.fillStyle = ped;
  rr(ctx, -24, 14, 48, 22, 6); ctx.fill();
  ctx.fillStyle = '#243141';
  rr(ctx, -16, 4, 32, 16, 5); ctx.fill();
  // 弹链箱
  ctx.fillStyle = '#4c5b6d';
  rr(ctx, -30, -18, 14, 26, 4); ctx.fill();
  ctx.fillStyle = '#ffc531';
  for (let i = 0; i < 3; i++) {
    rr(ctx, -27, -14 + i * 7, 8, 4, 1.5); ctx.fill();
  }
  // 炮塔主体
  const dome = ctx.createRadialGradient(-8, -16, 3, -4, -10, 22);
  dome.addColorStop(0, '#93a9c0');
  dome.addColorStop(1, '#5a6c80');
  ctx.fillStyle = dome;
  ctx.beginPath();
  ctx.arc(-4, -10, 18, 0, TAU);
  ctx.fill();
  // 旋转三管
  for (let i = 0; i < 3; i++) {
    const dy = Math.sin(spin + i * TAU / 3) * 5.5;
    const front = Math.cos(spin + i * TAU / 3) > 0;
    ctx.fillStyle = front ? '#6d8095' : '#49596b';
    rr(ctx, 6 - rec, -14 + dy, 34, 6, 3); ctx.fill();
  }
  // 炮管箍环
  ctx.fillStyle = '#38465699';
  rr(ctx, 20 - rec, -18, 6, 20, 2); ctx.fill();
  ctx.fillStyle = '#2f3b49';
  rr(ctx, 36 - rec, -17, 6, 18, 2); ctx.fill();
  // 开火焰光
  if (rec > 0) {
    ctx.save();
    ctx.shadowBlur = 14;
    ctx.shadowColor = 'rgba(255,200,90,0.9)';
    ctx.fillStyle = 'rgba(255,220,130,0.9)';
    ctx.beginPath();
    ctx.arc(46 - rec, -8, 5 + rec * 0.4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  // 指示灯
  ctx.fillStyle = '#ff9d2e';
  ctx.beginPath(); ctx.arc(-4, -26, 3, 0, TAU); ctx.fill();
}

function drawGiftBox(ctx, m) {
  const spin = m && m.spin ? m.spin : 0;
  const progress = m && m.openT !== undefined ? 1 - m.openT / BOX_OPEN_TIME : 0;
  const wob = Math.sin(spin * 4) * (0.06 + progress * 0.18);
  ctx.rotate(wob);
  const pop = 1 + progress * 0.12;
  ctx.scale(pop, pop);
  // 盒身
  ctx.fillStyle = '#ff9d2e';
  rr(ctx, -24, -12, 48, 40, 6); ctx.fill();
  ctx.fillStyle = '#e2820f';
  rr(ctx, -24, 16, 48, 12, 5); ctx.fill();
  // 竖缎带
  ctx.fillStyle = '#ff5d5d';
  ctx.fillRect(-5, -12, 10, 40);
  // 盒盖
  ctx.fillStyle = '#ffc531';
  rr(ctx, -28, -24, 56, 14, 5); ctx.fill();
  ctx.fillStyle = '#ff5d5d';
  ctx.fillRect(-5, -24, 10, 14);
  // 蝴蝶结
  ctx.fillStyle = '#ff5d5d';
  ctx.beginPath(); ctx.ellipse(-9, -29, 7, 5, -0.4, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(9, -29, 7, 5, 0.4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#d94343';
  ctx.beginPath(); ctx.arc(0, -28, 3.5, 0, TAU); ctx.fill();
  // 问号
  ctx.fillStyle = '#fff7e6';
  ctx.font = '900 20px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 12, 6);
}

function drawTurret(ctx, m) {
  const rec = (m && m.recoil > 0) ? m.recoil * 30 : 0;
  // 底座（金属渐变）
  const ped = ctx.createLinearGradient(0, 6, 0, 36);
  ped.addColorStop(0, '#3b4a5d');
  ped.addColorStop(1, '#232f3d');
  ctx.fillStyle = ped;
  rr(ctx, -20, 16, 40, 20, 5); ctx.fill();
  ctx.fillStyle = '#243141';
  rr(ctx, -14, 6, 28, 14, 4); ctx.fill();
  // 炮管（上亮下暗）
  const barrel = ctx.createLinearGradient(0, -16, 0, -4);
  barrel.addColorStop(0, '#6e8296');
  barrel.addColorStop(1, '#48586a');
  ctx.fillStyle = barrel;
  rr(ctx, 2 - rec, -16, 36, 12, 4); ctx.fill();
  ctx.fillStyle = '#3c4b5d';
  rr(ctx, 30 - rec, -18, 8, 16, 3); ctx.fill();
  // 炮塔（球面高光）
  const dome = ctx.createRadialGradient(-9, -14, 2, -4, -8, 19);
  dome.addColorStop(0, '#a3b8cd');
  dome.addColorStop(0.55, '#71859b');
  dome.addColorStop(1, '#54677c');
  ctx.fillStyle = dome;
  ctx.beginPath();
  ctx.arc(-4, -8, 17, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.ellipse(-9, -14, 6, 4, -0.6, 0, TAU);
  ctx.fill();
  // 指示灯
  ctx.fillStyle = '#ffc531';
  ctx.beginPath();
  ctx.arc(-4, -22, 3, 0, TAU);
  ctx.fill();
  // 铆钉
  ctx.fillStyle = '#22303f';
  for (const px of [-14, -6, 2, 10]) {
    ctx.beginPath(); ctx.arc(px, 26, 1.8, 0, TAU); ctx.fill();
  }
}

function drawGenerator(ctx, m) {
  const glow = m && m.pulse > 0 ? m.pulse * 2 : 0;
  if (glow > 0) {
    ctx.fillStyle = 'rgba(255,197,49,' + (0.25 * glow) + ')';
    ctx.beginPath(); ctx.arc(0, 0, 40, 0, TAU); ctx.fill();
  }
  // 电池外壳（圆柱高光）
  const shell = ctx.createLinearGradient(-20, 0, 20, 0);
  shell.addColorStop(0, '#243342');
  shell.addColorStop(0.3, '#3a4d61');
  shell.addColorStop(0.55, '#2b3a4a');
  shell.addColorStop(1, '#1f2c39');
  ctx.fillStyle = shell;
  rr(ctx, -20, -24, 40, 58, 8); ctx.fill();
  ctx.strokeStyle = '#4a5c70';
  ctx.lineWidth = 2;
  rr(ctx, -20, -24, 40, 58, 8); ctx.stroke();
  // 正极头
  const cap = ctx.createLinearGradient(0, -32, 0, -23);
  cap.addColorStop(0, '#ffe084');
  cap.addColorStop(1, '#e8a20f');
  ctx.fillStyle = cap;
  rr(ctx, -8, -32, 16, 9, 3); ctx.fill();
  // 电量窗（玻璃感）
  const win = ctx.createLinearGradient(-13, -16, 13, 26);
  win.addColorStop(0, '#46648a');
  win.addColorStop(1, '#2e415a');
  ctx.fillStyle = win;
  rr(ctx, -13, -16, 26, 42, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  rr(ctx, -11, -14, 8, 38, 3); ctx.fill();
  // 闪电标
  ctx.fillStyle = '#ffc531';
  ctx.beginPath();
  ctx.moveTo(4, -12);
  ctx.lineTo(-8, 6);
  ctx.lineTo(-1, 6);
  ctx.lineTo(-4, 20);
  ctx.lineTo(9, 0);
  ctx.lineTo(2, 0);
  ctx.closePath();
  ctx.fill();
}

function drawBarricade(ctx, m) {
  const dmg = m && m.maxHp ? 1 - m.hp / m.maxHp : 0;
  // 主体钢板（拉丝金属渐变）
  const plate = ctx.createLinearGradient(-26, -34, 26, 36);
  plate.addColorStop(0, '#71879e');
  plate.addColorStop(0.5, '#5d7186');
  plate.addColorStop(1, '#4a5c70');
  ctx.fillStyle = plate;
  rr(ctx, -26, -34, 52, 70, 7); ctx.fill();
  ctx.fillStyle = '#6d8299';
  rr(ctx, -26, -34, 52, 14, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  rr(ctx, -24, -32, 10, 66, 5); ctx.fill();
  // 警戒条
  ctx.save();
  rr(ctx, -26, -34, 52, 12, 6);
  ctx.clip();
  for (let i = -3; i < 5; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#ffc531' : '#2a323c';
    ctx.save();
    ctx.translate(i * 14, -28);
    ctx.rotate(-0.5);
    ctx.fillRect(-6, -10, 12, 24);
    ctx.restore();
  }
  ctx.restore();
  // 横梁
  ctx.fillStyle = '#4c5f73';
  rr(ctx, -26, -8, 52, 8, 3); ctx.fill();
  rr(ctx, -26, 14, 52, 8, 3); ctx.fill();
  // 铆钉
  ctx.fillStyle = '#33404f';
  for (const py of [-4, 18]) {
    for (const px of [-19, 0, 19]) {
      ctx.beginPath(); ctx.arc(px, py, 2.2, 0, TAU); ctx.fill();
    }
  }
  // 裂纹
  if (dmg > 0.35) {
    ctx.strokeStyle = 'rgba(20,26,34,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, -30); ctx.lineTo(-2, -12); ctx.lineTo(-12, 2);
    ctx.stroke();
  }
  if (dmg > 0.7) {
    ctx.strokeStyle = 'rgba(20,26,34,0.9)';
    ctx.beginPath();
    ctx.moveTo(16, -26); ctx.lineTo(8, -4); ctx.lineTo(20, 10); ctx.lineTo(10, 28);
    ctx.stroke();
  }
}

function drawPuncher(ctx, m) {
  // 出拳动画：recoil 从 0.25 递减，拳头先伸出再收回
  let ext = 0;
  if (m && m.recoil > 0) {
    const p = 1 - m.recoil / 0.25;
    ext = Math.sin(p * Math.PI) * 18;
  }
  // 底座
  ctx.fillStyle = '#2f3d4e';
  rr(ctx, -20, 18, 40, 18, 5); ctx.fill();
  ctx.fillStyle = '#3c4b5d';
  rr(ctx, -16, 2, 24, 20, 5); ctx.fill();
  // 机身
  ctx.fillStyle = '#71859b';
  rr(ctx, -18, -22, 26, 28, 6); ctx.fill();
  ctx.fillStyle = '#ffc531';
  ctx.beginPath(); ctx.arc(-6, -14, 3, 0, TAU); ctx.fill();
  // 弹簧（锯齿线）
  ctx.strokeStyle = '#8ba1b8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  const sx = 8, len = 12 + ext;
  ctx.moveTo(sx, -8);
  for (let i = 0; i <= 5; i++) {
    ctx.lineTo(sx + (i + 0.5) * len / 6, -8 + (i % 2 === 0 ? -6 : 6));
  }
  ctx.lineTo(sx + len, -8);
  ctx.stroke();
  // 拳套
  ctx.fillStyle = '#e04848';
  ctx.beginPath();
  ctx.arc(sx + len + 9, -8, 11, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#c23636';
  rr(ctx, sx + len - 2, -16, 8, 16, 3); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(sx + len + 12, -12, 3.5, 0, TAU);
  ctx.fill();
}

function drawShredder(ctx, m) {
  const chew = m && m.chew > 0 ? m.chew : 0;
  const ready = !m || !m.cd || m.cd <= 0;
  const jx = chew > 0 ? rand(-2, 2) : 0;
  const jy = chew > 0 ? rand(-1.5, 1.5) : 0;
  ctx.save();
  ctx.translate(jx, jy);
  // 纸箱主体（收集桶，金属渐变）
  const bin = ctx.createLinearGradient(-22, 0, 22, 0);
  bin.addColorStop(0, '#425468');
  bin.addColorStop(0.5, '#37475a');
  bin.addColorStop(1, '#2c3a4b');
  ctx.fillStyle = bin;
  rr(ctx, -22, -4, 44, 40, 6); ctx.fill();
  // 透明窗 + 纸条
  ctx.fillStyle = '#22303f';
  rr(ctx, -15, 2, 30, 28, 4); ctx.fill();
  ctx.strokeStyle = '#dfe7ef';
  ctx.lineWidth = 2.4;
  for (const px of [-9, -3, 3, 9]) {
    ctx.beginPath();
    ctx.moveTo(px, 6);
    ctx.quadraticCurveTo(px + 3, 16, px, 27);
    ctx.stroke();
  }
  // 上方进纸口（嘴）
  ctx.fillStyle = '#5d7186';
  rr(ctx, -28, -26 - chew * 8, 56, 24, 6); ctx.fill();
  ctx.fillStyle = '#141b25';
  rr(ctx, -22, -17 - chew * 8, 44, 7, 3); ctx.fill();
  // 牙齿
  ctx.fillStyle = '#c8d4e0';
  for (let i = 0; i < 6; i++) {
    const px = -19 + i * 7.4;
    ctx.beginPath();
    ctx.moveTo(px, -17 - chew * 8);
    ctx.lineTo(px + 3.2, -10.5 - chew * 4);
    ctx.lineTo(px + 6.4, -17 - chew * 8);
    ctx.closePath();
    ctx.fill();
  }
  // 状态灯：绿=就绪 红=冷却
  ctx.fillStyle = ready ? '#58d68b' : '#ff5d5d';
  ctx.beginPath();
  ctx.arc(20, -30 - chew * 8, 3.4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawFan(ctx, m) {
  const spin = m && m.spin ? m.spin : 0;
  // 支架
  ctx.fillStyle = '#31414f';
  rr(ctx, -5, 8, 10, 26, 3); ctx.fill();
  rr(ctx, -16, 30, 32, 7, 3); ctx.fill();
  // 外框
  ctx.save();
  ctx.shadowBlur = 8;
  ctx.shadowColor = 'rgba(127,215,255,0.6)';
  ctx.strokeStyle = '#7fd7ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, -8, 24, 0, TAU);
  ctx.stroke();
  ctx.restore();
  const glass = ctx.createRadialGradient(-7, -15, 2, 0, -8, 24);
  glass.addColorStop(0, 'rgba(90,140,175,0.9)');
  glass.addColorStop(1, 'rgba(30,55,76,0.9)');
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.arc(0, -8, 22, 0, TAU);
  ctx.fill();
  // 扇叶
  ctx.fillStyle = '#a8e6ff';
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.translate(0, -8);
    ctx.rotate(spin + i * TAU / 3);
    ctx.beginPath();
    ctx.ellipse(0, -11, 5.5, 12, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  // 中心
  ctx.fillStyle = '#e8f7ff';
  ctx.beginPath();
  ctx.arc(0, -8, 5, 0, TAU);
  ctx.fill();
  // 防护栅格
  ctx.strokeStyle = 'rgba(127,215,255,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 6, -8 + Math.sin(a) * 6);
    ctx.lineTo(Math.cos(a) * 23, -8 + Math.sin(a) * 23);
    ctx.stroke();
  }
}

function drawMagnet(ctx, m) {
  const flash = m && m.flash > 0 ? m.flash : 0;
  // 底座
  ctx.fillStyle = '#33414e';
  rr(ctx, -22, 24, 44, 12, 4); ctx.fill();
  // 塔架
  ctx.fillStyle = '#4c5b6d';
  rr(ctx, -20, -30, 9, 56, 3); ctx.fill();
  ctx.strokeStyle = '#3a4756';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-18, 16); ctx.lineTo(-13, 2);
  ctx.moveTo(-13, 16); ctx.lineTo(-18, 2);
  ctx.stroke();
  // 横臂
  ctx.fillStyle = '#5d7186';
  rr(ctx, -22, -34, 48, 8, 3); ctx.fill();
  // 吊索
  ctx.strokeStyle = '#8ba1b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(18, -26);
  ctx.lineTo(18, -14);
  ctx.stroke();
  // 马蹄形磁铁
  ctx.strokeStyle = '#e04848';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(18, -8, 9, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = '#c8d4e0';
  ctx.fillRect(6, -8, 7, 8);
  ctx.fillRect(23, -8, 7, 8);
  // 吸附电弧
  if (flash > 0) {
    ctx.strokeStyle = 'rgba(255,202,107,' + (flash * 2.5) + ')';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(10 + i * 8, 2);
      ctx.lineTo(12 + i * 8 + rand(-3, 3), 12 + rand(0, 6));
      ctx.stroke();
    }
  }
  // 指示灯
  ctx.fillStyle = '#ffc531';
  ctx.beginPath();
  ctx.arc(-16, -38, 3, 0, TAU);
  ctx.fill();
}

function drawTesla(ctx, m) {
  const flash = m && m.flash > 0 ? m.flash * 4 : 0;
  // 底座
  ctx.fillStyle = '#33414e';
  rr(ctx, -18, 20, 36, 16, 4); ctx.fill();
  // 线圈塔
  ctx.fillStyle = '#4d3f68';
  ctx.beginPath();
  ctx.moveTo(-14, 22);
  ctx.lineTo(-7, -18);
  ctx.lineTo(7, -18);
  ctx.lineTo(14, 22);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#8f7ab5';
  ctx.lineWidth = 2.2;
  for (let i = 0; i < 5; i++) {
    const y = 16 - i * 8;
    const w = 13 - i * 1.4;
    ctx.beginPath();
    ctx.moveTo(-w, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // 顶球
  const grd = ctx.createRadialGradient(0, -26, 2, 0, -26, 13);
  grd.addColorStop(0, '#f2e8ff');
  grd.addColorStop(1, flash > 0 ? '#c77bff' : '#7e5bb5');
  ctx.save();
  ctx.shadowBlur = 10 + flash * 14;
  ctx.shadowColor = 'rgba(199,123,255,0.85)';
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(0, -26, 11 + flash * 2, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (flash > 0) {
    ctx.strokeStyle = 'rgba(210,160,255,' + (0.7 * flash) + ')';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = rand(0, TAU);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 12, -26 + Math.sin(a) * 12);
      ctx.lineTo(Math.cos(a) * 19, -26 + Math.sin(a) * 19);
      ctx.stroke();
    }
  }
}

function drawRailgun(ctx, m) {
  const charge = m && m.charge !== undefined ? clamp(m.charge, 0, 1) : 0.6;
  const flash = m && m.flash > 0 ? m.flash : 0;
  // 平台
  ctx.fillStyle = '#2f3d4e';
  rr(ctx, -22, 18, 44, 18, 5); ctx.fill();
  ctx.fillStyle = '#3c4b5d';
  rr(ctx, -18, 8, 30, 14, 4); ctx.fill();
  // 双轨炮身
  ctx.fillStyle = '#57687c';
  rr(ctx, -14, -16, 50, 7, 3); ctx.fill();
  rr(ctx, -14, -2, 50, 7, 3); ctx.fill();
  // 能量线圈
  for (let i = 0; i < 3; i++) {
    const cxp = -4 + i * 13;
    ctx.strokeStyle = flash > 0 ? '#ffd0a8' : 'rgba(255,140,80,' + (0.35 + charge * 0.6) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cxp, -5.5, 9, -Math.PI * 0.65, Math.PI * 0.65);
    ctx.stroke();
  }
  // 炮口发光
  ctx.fillStyle = flash > 0 ? '#fff1e0' : 'rgba(255,140,80,' + (0.3 + charge * 0.7) + ')';
  ctx.beginPath();
  ctx.arc(38, -5.5, 4 + charge * 2 + flash * 8, 0, TAU);
  ctx.fill();
  // 尾部机箱
  ctx.fillStyle = '#71859b';
  rr(ctx, -24, -20, 12, 30, 4); ctx.fill();
  ctx.fillStyle = '#ff8c50';
  ctx.beginPath();
  ctx.arc(-18, -24, 3, 0, TAU);
  ctx.fill();
}

function drawRocket(ctx, m) {
  const blink = Math.sin((m && m.spin ? m.spin : 0) * 5) > 0;
  const reload = m && m.reload ? clamp(m.reload, 0, 1) : 0; // 1=刚发射
  const sink = reload * 30; // 装填时火箭下沉
  // 发射井
  ctx.fillStyle = '#3a4656';
  rr(ctx, -24, -14, 48, 50, 8); ctx.fill();
  ctx.fillStyle = '#2b3543';
  rr(ctx, -18, -10, 36, 40, 6); ctx.fill();
  // 火箭（装填时缓缓升起）
  ctx.save();
  ctx.beginPath();
  ctx.rect(-18, -40, 36, 70);
  ctx.clip();
  ctx.translate(0, sink);
  ctx.fillStyle = '#d5dde6';
  rr(ctx, -7, -18, 14, 30, 4); ctx.fill();
  ctx.fillStyle = '#ff5d5d';
  ctx.beginPath();
  ctx.moveTo(-7, -18);
  ctx.lineTo(0, -34);
  ctx.lineTo(7, -18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4cc2ff';
  ctx.beginPath();
  ctx.arc(0, -8, 3.6, 0, TAU);
  ctx.fill();
  ctx.restore();
  // 井口前板（遮住下沉的火箭底部）
  ctx.fillStyle = '#3a4656';
  rr(ctx, -24, 14, 48, 22, 6); ctx.fill();
  // 舱门（打开状态）
  ctx.fillStyle = '#4c5b6d';
  rr(ctx, -26, -22, 20, 10, 3); ctx.fill();
  rr(ctx, 6, -22, 20, 10, 3); ctx.fill();
  // 状态灯：装填中红色常亮，就绪黄色闪烁
  ctx.fillStyle = reload > 0 ? '#ff5d5d' : (blink ? '#ffc531' : '#6b5514');
  ctx.beginPath();
  ctx.arc(19, -8, 3, 0, TAU);
  ctx.fill();
  // 警戒条
  ctx.fillStyle = '#ffc531';
  ctx.fillRect(-24, 30, 48, 4);
}

/* ---- 合成机型绘制 ---- */
function drawFrostcannon(ctx, m) {
  // 出炮动画
  let ext = 0;
  if (m && m.recoil > 0) {
    const p = 1 - m.recoil / 0.25;
    ext = Math.sin(p * Math.PI) * 14;
  }
  // 底座（弹簧拳机同款）
  ctx.fillStyle = '#2f3d4e';
  rr(ctx, -20, 18, 40, 18, 5); ctx.fill();
  ctx.fillStyle = '#3c4b5d';
  rr(ctx, -16, 2, 24, 20, 5); ctx.fill();
  // 机身（冰蓝配色）
  ctx.fillStyle = '#5a7d96';
  rr(ctx, -18, -22, 26, 28, 6); ctx.fill();
  ctx.fillStyle = '#7fd7ff';
  ctx.beginPath(); ctx.arc(-6, -14, 3, 0, TAU); ctx.fill();
  // 弹簧
  ctx.strokeStyle = '#a8d8ee';
  ctx.lineWidth = 3;
  ctx.beginPath();
  const sx = 8, len = 12 + ext;
  ctx.moveTo(sx, -8);
  for (let i = 0; i <= 5; i++) {
    ctx.lineTo(sx + (i + 0.5) * len / 6, -8 + (i % 2 === 0 ? -6 : 6));
  }
  ctx.lineTo(sx + len, -8);
  ctx.stroke();
  // 冰弹（雪球 + 雪花纹）
  const bx = sx + len + 9;
  ctx.fillStyle = 'rgba(191,233,255,0.35)';
  ctx.beginPath(); ctx.arc(bx, -8, 14, 0, TAU); ctx.fill();
  ctx.fillStyle = '#cfeeff';
  ctx.beginPath(); ctx.arc(bx, -8, 11, 0, TAU); ctx.fill();
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

function drawTwinturret(ctx, m) {
  const rec = (m && m.recoil > 0) ? m.recoil * 30 : 0;
  const up = m && m.altBarrel;
  // 底座
  ctx.fillStyle = '#2f3d4e';
  rr(ctx, -20, 16, 40, 20, 5); ctx.fill();
  ctx.fillStyle = '#243141';
  rr(ctx, -14, 6, 28, 14, 4); ctx.fill();
  // 双炮管
  ctx.fillStyle = '#57687c';
  rr(ctx, 2 - (up ? rec : 0), -24, 36, 10, 4); ctx.fill();
  rr(ctx, 2 - (up ? 0 : rec), -10, 36, 10, 4); ctx.fill();
  ctx.fillStyle = '#3c4b5d';
  rr(ctx, 30 - (up ? rec : 0), -26, 8, 14, 3); ctx.fill();
  rr(ctx, 30 - (up ? 0 : rec), -12, 8, 14, 3); ctx.fill();
  // 炮塔
  ctx.fillStyle = '#71859b';
  ctx.beginPath();
  ctx.arc(-4, -10, 18, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#8ba1b8';
  ctx.beginPath();
  ctx.arc(-7, -13, 9, 0, TAU);
  ctx.fill();
  // 双指示灯
  ctx.fillStyle = '#ffc531';
  ctx.beginPath(); ctx.arc(-9, -26, 3, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -28, 3, 0, TAU); ctx.fill();
}

function drawPowerplant(ctx, m) {
  const glow = m && m.pulse > 0 ? m.pulse * 2 : 0;
  ctx.fillStyle = 'rgba(255,197,49,' + (0.12 + 0.25 * glow) + ')';
  ctx.beginPath(); ctx.arc(0, -2, 42, 0, TAU); ctx.fill();
  // 主体
  ctx.fillStyle = '#2b3a4a';
  rr(ctx, -24, -26, 48, 60, 9); ctx.fill();
  ctx.strokeStyle = '#5a6f85';
  ctx.lineWidth = 2;
  rr(ctx, -24, -26, 48, 60, 9); ctx.stroke();
  // 双正极头
  ctx.fillStyle = '#ffc531';
  rr(ctx, -17, -34, 14, 9, 3); ctx.fill();
  rr(ctx, 3, -34, 14, 9, 3); ctx.fill();
  // 反应窗
  ctx.fillStyle = '#39506b';
  rr(ctx, -17, -18, 34, 46, 5); ctx.fill();
  // 双闪电
  ctx.fillStyle = '#ffc531';
  for (const ox of [-9, 7]) {
    ctx.beginPath();
    ctx.moveTo(ox + 3, -12);
    ctx.lineTo(ox - 5, 4);
    ctx.lineTo(ox, 4);
    ctx.lineTo(ox - 2, 18);
    ctx.lineTo(ox + 6, 0);
    ctx.lineTo(ox + 1, 0);
    ctx.closePath();
    ctx.fill();
  }
  // 电子轨道环
  ctx.strokeStyle = 'rgba(255,215,100,0.7)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.ellipse(0, 2, 30, 11, -0.5, 0, TAU);
  ctx.stroke();
}

function drawArcturret(ctx, m) {
  const rec = (m && m.recoil > 0) ? m.recoil * 30 : 0;
  const spark = m && m.recoil > 0;
  // 底座
  ctx.fillStyle = '#33414e';
  rr(ctx, -20, 16, 40, 20, 5); ctx.fill();
  ctx.fillStyle = '#2b3444';
  rr(ctx, -14, 6, 28, 14, 4); ctx.fill();
  // 炮管（紫调）
  ctx.fillStyle = '#6a5f8c';
  rr(ctx, 2 - rec, -14, 36, 12, 4); ctx.fill();
  ctx.fillStyle = '#514873';
  rr(ctx, 30 - rec, -16, 8, 16, 3); ctx.fill();
  // 炮塔
  ctx.fillStyle = '#7d6fa8';
  ctx.beginPath();
  ctx.arc(-4, -8, 16, 0, TAU);
  ctx.fill();
  // 顶部迷你线圈球
  ctx.strokeStyle = '#8f7ab5';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, -22); ctx.lineTo(-4, -28);
  ctx.stroke();
  const grd = ctx.createRadialGradient(-4, -33, 1, -4, -33, 8);
  grd.addColorStop(0, '#f2e8ff');
  grd.addColorStop(1, spark ? '#c77bff' : '#7e5bb5');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(-4, -33, 7, 0, TAU);
  ctx.fill();
  if (spark) {
    ctx.strokeStyle = 'rgba(210,160,255,0.8)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      const a = rand(0, TAU);
      ctx.beginPath();
      ctx.moveTo(-4 + Math.cos(a) * 7, -33 + Math.sin(a) * 7);
      ctx.lineTo(-4 + Math.cos(a) * 13, -33 + Math.sin(a) * 13);
      ctx.stroke();
    }
  }
}

function drawMagshredder(ctx, m) {
  drawShredder(ctx, m);
  // 顶部悬浮磁铁吊臂
  const hover = Math.sin((m && m.spin ? m.spin : 0) * 2) * 2;
  ctx.strokeStyle = '#8ba1b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(10, -34);
  ctx.lineTo(10, -42 + hover);
  ctx.stroke();
  ctx.strokeStyle = '#e04848';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(10, -44 + hover, 7, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = '#c8d4e0';
  ctx.fillRect(1, -44 + hover, 5.5, 6);
  ctx.fillRect(13.5, -44 + hover, 5.5, 6);
}

function drawFrostwall(ctx, m) {
  const dmg = m && m.maxHp ? 1 - m.hp / m.maxHp : 0;
  // 寒气微光
  ctx.fillStyle = 'rgba(127,215,255,0.08)';
  ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill();
  // 冰墙主体
  ctx.fillStyle = '#6f9ab5';
  rr(ctx, -26, -34, 52, 70, 7); ctx.fill();
  ctx.fillStyle = '#8fc0da';
  rr(ctx, -26, -34, 52, 14, 7); ctx.fill();
  // 冰纹横梁
  ctx.fillStyle = '#5a86a3';
  rr(ctx, -26, -8, 52, 8, 3); ctx.fill();
  rr(ctx, -26, 14, 52, 8, 3); ctx.fill();
  // 冰锥
  ctx.fillStyle = '#cfeeff';
  for (const [px, len] of [[-18, 10], [-6, 15], [7, 9], [17, 13]]) {
    ctx.beginPath();
    ctx.moveTo(px - 4, -20);
    ctx.lineTo(px, -20 + len);
    ctx.lineTo(px + 4, -20);
    ctx.closePath();
    ctx.fill();
  }
  // 高光
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-18, -28); ctx.lineTo(-8, -14);
  ctx.stroke();
  // 裂纹
  if (dmg > 0.5) {
    ctx.strokeStyle = 'rgba(30,60,80,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, -28); ctx.lineTo(2, -6); ctx.lineTo(14, 12);
    ctx.stroke();
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
    case 'crusher': drawCrusher(e); break;
  }
  if (flash) {
    g.globalAlpha = 0.55;
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(0, -6, e.w / 2 + 4, 0, TAU);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }
  if (e.frozenT > 0) {
    // 冰块封印
    const hw = e.w / 2 + 5;
    g.globalAlpha = 0.45;
    g.fillStyle = '#a8dcf5';
    rr(g, -hw, -34, hw * 2, 60, 8);
    g.fill();
    g.globalAlpha = 0.75;
    g.strokeStyle = '#e0f4ff';
    g.lineWidth = 2;
    rr(g, -hw, -34, hw * 2, 60, 8);
    g.stroke();
    g.beginPath();
    g.moveTo(-hw * 0.5, -30); g.lineTo(-hw * 0.1, -12);
    g.moveTo(hw * 0.4, -26); g.lineTo(hw * 0.1, -4);
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
  g.restore();
  // 血条 + 护盾条
  if (e.hp < e.maxHp || (e.maxShield && e.shield < e.maxShield)) {
    const bw = e.type === 'crusher' ? 64 : 40;
    const by = rowCy(e) - (e.type === 'crusher' ? 52 : 46);
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
  get moveCooldown() { return moveCd; },
  move: (r1, c1, r2, c2) => {
    const src = grid[r1][c1];
    if (!src || src.type === 'box' || grid[r2][c2] || moveCd > 0) return false;
    grid[r1][c1] = null;
    grid[r2][c2] = src;
    src.row = r2; src.col = c2;
    moveCd = MOVE_CD;
    return true;
  },
  // 花能量在场上放一个盲盒（模拟真实购买）
  buyBox: (r, c) => {
    if (state !== 'playing' || energy < BOX_COST) return false;
    if (!placeBox(r, c)) return false;
    energy -= BOX_COST;
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
  get enemyList() { return enemies.map(e => ({ type: e.type, row: e.row, x: e.x, hp: e.hp, frozen: e.frozenT > 0, slowed: e.slowT > 0 })); },
  get score() { return score; },
  get kills() { return kills; },
  get wave() { return wave; },
};

/* ========== 启动 ========== */
initGame();
requestAnimationFrame(frame);
