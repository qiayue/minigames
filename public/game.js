/* 机械防线 · 盲盒塔防
 * 植物大战僵尸式玩法：开盲盒抽机器 → 布防 → 抵御一波波机器人进攻
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
const HAND_MAX = 6;
const TAU = Math.PI * 2;

const RARITY_NAME = { common: '普通', rare: '稀有', epic: '史诗' };
const RARITY_COLOR = { common: '#7fd08a', rare: '#4cc2ff', epic: '#c77bff' };

const MACHINES = {
  turret:    { name: '自动炮台',   rarity: 'common', hp: 300,  desc: '向前方持续发射能量弹' },
  generator: { name: '能量发电机', rarity: 'common', hp: 300,  desc: '每 7 秒产出 25 能量' },
  barricade: { name: '装甲路障',   rarity: 'common', hp: 1600, desc: '高耐久，把敌人挡在身前' },
  shredder:  { name: '碎纸机',     rarity: 'rare',   hp: 450,  desc: '把靠近的机器人整个粉碎，随后冷却 9 秒' },
  fan:       { name: '冷冻风扇',   rarity: 'rare',   hp: 300,  desc: '冰弹攻击并大幅减速敌人' },
  tesla:     { name: '特斯拉线圈', rarity: 'epic',   hp: 350,  desc: '闪电链同时打击本行多个敌人' },
  rocket:    { name: '火箭发射井', rarity: 'epic',   hp: 200,  desc: '敌人进入本行时发射火箭，贯穿全行（一次性）' },
};

const ENEMIES = {
  scrap:   { name: '废铁机器人', hp: 100,  speed: 19, dmg: 45,  score: 10, w: 46 },
  armored: { name: '装甲机器人', hp: 320,  speed: 15, dmg: 55,  score: 25, w: 50 },
  drone:   { name: '疾速无人机', hp: 70,   speed: 42, dmg: 30,  score: 15, w: 44 },
  crusher: { name: '重型碾压车', hp: 1400, speed: 11, dmg: 240, score: 80, w: 86 },
};

const BOX_POOL = {
  common: [['turret', 24], ['generator', 22], ['barricade', 12]],
  rare:   [['shredder', 15], ['fan', 15]],
  epic:   [['tesla', 7], ['rocket', 5]],
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
let energy, score, kills, wave, endless, pity;
let grid, hand, enemies, bullets, orbs, parts, floats, zaps;
let waveState, waveTimer, queue, spawnT, skyT, lastRows;
let bannerText, bannerSub, bannerT, shakeT, shakeAmp;
let sel = null;            // {mode:'card', idx} | {mode:'shovel'}
let mouse = { x: -1, y: -1 };
let submitted = false;
let time = 0;

function initGame() {
  energy = 100; score = 0; kills = 0; wave = 0;
  endless = false; pity = 0;
  grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  hand = [];
  enemies = []; bullets = []; orbs = []; parts = []; floats = []; zaps = [];
  waveState = 'pre'; waveTimer = 15; queue = []; spawnT = 0;
  skyT = 3; lastRows = [];
  bannerText = ''; bannerSub = ''; bannerT = 0; shakeT = 0; shakeAmp = 0;
  sel = null; submitted = false; time = 0;
  renderTray();
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
function canOpenBox() {
  return state === 'playing' && energy >= BOX_COST && hand.length < HAND_MAX;
}
function openBox() {
  if (!canOpenBox()) { sfx('error'); return; }
  energy -= BOX_COST;
  const type = rollType();
  hand.push(type);
  renderTray();
  showReveal(type);
  sfx('box');
}

/* ========== 卡槽 / 选择 ========== */
function renderTray() {
  const holder = $('cards');
  holder.innerHTML = '';
  for (let i = 0; i < HAND_MAX; i++) {
    const type = hand[i];
    const el = document.createElement('div');
    if (!type) {
      el.className = 'card empty';
      el.textContent = '空';
      el.style.justifyContent = 'center';
      el.style.fontSize = '12px';
      el.style.color = 'var(--dim)';
      el.style.minHeight = '74px';
      holder.appendChild(el);
      continue;
    }
    const info = MACHINES[type];
    el.className = 'card r-' + info.rarity + (sel && sel.mode === 'card' && sel.idx === i ? ' sel' : '');
    el.title = info.name + '：' + info.desc;
    const mini = document.createElement('canvas');
    mini.width = 104; mini.height = 104;
    const mg = mini.getContext('2d');
    drawMachine(mg, type, 52, 58, 1.0, {});
    const nm = document.createElement('div');
    nm.className = 'nm';
    nm.textContent = info.name;
    const tag = document.createElement('div');
    tag.className = 'tag ' + info.rarity;
    tag.textContent = RARITY_NAME[info.rarity];
    el.appendChild(mini); el.appendChild(nm); el.appendChild(tag);
    el.addEventListener('click', () => {
      if (state !== 'playing') return;
      sel = (sel && sel.mode === 'card' && sel.idx === i) ? null : { mode: 'card', idx: i };
      renderTray();
    });
    holder.appendChild(el);
  }
  $('shovelBtn').classList.toggle('sel', !!(sel && sel.mode === 'shovel'));
}

let revealTimer = null;
function showReveal(type) {
  const info = MACHINES[type];
  const ov = $('reveal');
  const card = $('revealCard');
  card.className = 'r-' + info.rarity;
  const ic = $('revealIcon');
  const rg = ic.getContext('2d');
  rg.clearRect(0, 0, 192, 192);
  drawMachine(rg, type, 96, 104, 1.9, {});
  $('revealName').textContent = info.name;
  $('revealRarity').textContent = '【' + RARITY_NAME[info.rarity] + '】';
  $('revealRarity').style.color = RARITY_COLOR[info.rarity];
  $('revealDesc').textContent = info.desc;
  ov.classList.add('show');
  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => ov.classList.remove('show'), 1000);
}

/* ========== 部署 ========== */
function place(type, row, col) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS || grid[row][col]) return false;
  const info = MACHINES[type];
  grid[row][col] = {
    type, row, col,
    hp: info.hp, maxHp: info.hp,
    t: rand(0, 0.6), cd: 0, chew: 0, spin: rand(0, TAU),
    flash: 0, recoil: 0, pulse: 0, armed: true,
  };
  spawnParts(cellCx(col), cellCy(row), '#9fb4c8', 10, 90, 0.4, 'spark');
  sfx('place');
  return true;
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
    speed: info.speed, dmg: info.dmg, scoreVal: info.score, w: info.w,
    hitT: 0, slowT: 0, anim: rand(0, TAU), flash: 0,
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
  if (n === 1) { push('scrap', 3); }
  else if (n === 2) { push('scrap', 5); }
  else if (n === 3) { push('scrap', 5); push('armored', 2); }
  else if (n === 4) { push('scrap', 6); push('armored', 2); push('drone', 2); }
  else if (n === 5) { push('scrap', 7); push('armored', 3); push('drone', 2); }
  else if (n === 6) { push('scrap', 7); push('armored', 3); push('drone', 4); }
  else if (n === 7) { push('scrap', 8); push('armored', 4); push('drone', 3); push('crusher', 1); }
  else if (n === 8) { push('scrap', 8); push('armored', 5); push('drone', 4); push('crusher', 1); }
  else if (n === 9) { push('scrap', 9); push('armored', 5); push('drone', 4); push('crusher', 2); }
  else if (n === 10) { push('scrap', 10); push('armored', 6); push('drone', 5); push('crusher', 3); }
  else {
    const k = n - TOTAL_WAVES;
    push('scrap', 10 + k);
    push('armored', 6 + k);
    push('drone', 5 + Math.floor(k * 0.8));
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
  else if (wave === 5) banner('第 5 波来袭！', '一大波机器人正在接近……');
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
function damageEnemy(e, d, pierceArmor) {
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
function rowCy(e) { return cellCy(e.row) + (e.type === 'drone' ? -22 : 0); }
function shake(t, amp) { shakeT = t; shakeAmp = amp; }

function enemiesInRow(row) { return enemies.filter(e => e.row === row); }

function updateMachines(dt) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const m = grid[r][c];
      if (!m) continue;
      const cx = cellCx(c);
      m.spin += dt * (m.type === 'fan' ? 9 : 1.2);
      if (m.flash > 0) m.flash -= dt;
      if (m.recoil > 0) m.recoil -= dt;
      if (m.pulse > 0) m.pulse -= dt;
      if (m.chew > 0) m.chew -= dt;
      if (m.cd > 0) m.cd -= dt;

      if (m.type === 'turret') {
        m.t += dt;
        if (m.t >= 1.15) {
          const target = enemies.some(e => e.row === r && e.x > cx - CELL_W / 2 && e.x < W + 30);
          if (target) {
            m.t = 0; m.recoil = 0.12;
            bullets.push({ kind: 'shot', row: r, x: cx + 34, dmg: 25, speed: 340 });
            sfx('shoot');
          }
        }
      } else if (m.type === 'fan') {
        m.t += dt;
        if (m.t >= 1.3) {
          const target = enemies.some(e => e.row === r && e.x > cx - CELL_W / 2 && e.x < W + 30);
          if (target) {
            m.t = 0;
            bullets.push({ kind: 'ice', row: r, x: cx + 30, dmg: 12, speed: 320 });
            sfx('ice');
          }
        }
      } else if (m.type === 'generator') {
        m.t += dt;
        if (m.t >= 7) {
          m.t = 0; m.pulse = 0.5;
          orbs.push({
            x: cx + rand(-18, 22), y: cellCy(r) + rand(-8, 16),
            ty: 0, vy: 0, val: 25, life: 10, falling: false,
          });
          sfx('gen');
        }
      } else if (m.type === 'tesla') {
        m.t += dt;
        if (m.t >= 2.6) {
          const targets = enemiesInRow(r)
            .filter(e => e.x > cx - 20 && e.x < W + 20)
            .sort((a, b) => a.x - b.x)
            .slice(0, 4);
          if (targets.length) {
            m.t = 0; m.flash = 0.25;
            const pts = [{ x: cx, y: cellCy(r) - 26 }];
            for (const e of targets) {
              pts.push({ x: e.x, y: rowCy(e) });
              damageEnemy(e, 55);
            }
            zaps.push({ pts, t: 0.22, max: 0.22 });
            sfx('zap');
          }
        }
      } else if (m.type === 'shredder') {
        if (m.cd <= 0) {
          const left = GRID_X + c * CELL_W;
          const prey = enemies.find(e =>
            e.row === r && !e.dead &&
            e.x - e.w / 2 <= left + CELL_W - 24 &&
            e.x >= left - 8
          );
          if (prey) {
            m.cd = 9; m.chew = 0.7;
            damageEnemy(prey, 550, true);
            spawnParts(cx + 20, cellCy(r), '#e8edf4', 16, 150, 0.7, 'paper');
            addFloat(cx, cellCy(r) - 46, '咔嚓！', '#ff9d2e');
            sfx('shred');
          }
        }
      } else if (m.type === 'rocket') {
        if (m.armed) {
          const incoming = enemies.some(e => e.row === r && e.x > cx - CELL_W / 2);
          if (incoming) {
            m.armed = false;
            bullets.push({ kind: 'rocket', row: r, x: cx + 20, dmg: 900, speed: 430, hit: new Set() });
            spawnParts(cx, cellCy(r) + 10, '#aab7c4', 14, 90, 0.8, 'smoke');
            removeMachine(r, c, true);
            shake(0.25, 4);
            sfx('boom');
          }
        }
      }
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
          damageEnemy(e, b.dmg);
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
      damageEnemy(hitEnemy, b.dmg);
      if (b.kind === 'ice') {
        hitEnemy.slowT = 3;
        spawnParts(b.x, rowCy(hitEnemy), '#9fdcff', 5, 80, 0.35, 'spark');
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
  if (bannerT > 0) bannerT -= dt;
  if (shakeT > 0) shakeT -= dt;
}

/* ========== 主循环 ========== */
function update(dt) {
  time += dt;
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
  $('boxBtn').disabled = !canOpenBox();
}

/* ========== 游戏流程 ========== */
function startGame() {
  initGame();
  state = 'playing';
  show('menu', false); show('end', false); show('pauseOv', false);
  banner('准备布防！', '15 秒后第一波进攻开始');
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
  $('endSub').textContent = win
    ? '你抵挡住了全部 ' + TOTAL_WAVES + ' 波进攻，机械基地安然无恙！'
    : '机器人冲进了基地，第 ' + Math.max(wave, 1) + ' 波未能守住。';
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

/* ========== 排行榜 ========== */
function localScores() {
  try { return JSON.parse(localStorage.getItem('mg_localScores') || '[]'); }
  catch { return []; }
}
function saveLocalScore(entry) {
  const list = localScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  localStorage.setItem('mg_localScores', JSON.stringify(list.slice(0, 20)));
  return list.slice(0, 20);
}
function renderBoard(el, scores, note, mine) {
  el.innerHTML = '';
  el.style.display = '';
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
async function loadBoard(el) {
  try {
    const res = await fetch('/api/scores');
    const data = await res.json();
    if (data.ok) { renderBoard(el, data.scores); return; }
    throw new Error('no_storage');
  } catch {
    renderBoard(el, localScores(), '（云端排行榜未启用，以下为本机记录）');
  }
}
async function submitScore() {
  if (submitted) return;
  const name = ($('nameInput').value.trim() || '无名机械师').slice(0, 16);
  localStorage.setItem('mg_playerName', name);
  const entry = { name, score, wave, at: Date.now() };
  submitted = true;
  $('submitBtn').disabled = true;
  $('submitBtn').textContent = '提交中…';
  try {
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, score, wave }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error('fail');
    $('submitBtn').textContent = data.rank > 0 ? '已提交 · 第' + data.rank + '名' : '已提交';
    renderBoard($('board'), data.scores, '', null);
  } catch {
    const list = saveLocalScore(entry);
    $('submitBtn').textContent = '已保存到本机';
    renderBoard($('board'), list, '（云端排行榜未启用，以下为本机记录）', entry);
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
  if (sel && sel.mode === 'card') {
    const type = hand[sel.idx];
    if (!type) { sel = null; renderTray(); return; }
    if (grid[cell.r][cell.c]) {
      addFloat(cellCx(cell.c), cellCy(cell.r) - 30, '这里已有机器', '#ff5d5d');
      sfx('error');
      return;
    }
    if (place(type, cell.r, cell.c)) {
      hand.splice(sel.idx, 1);
      sel = null;
      renderTray();
    }
  }
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

$('startBtn').addEventListener('click', () => { ensureAc(); startGame(); });
$('againBtn').addEventListener('click', () => { ensureAc(); startGame(); });
$('endlessBtn').addEventListener('click', continueEndless);
$('boxBtn').addEventListener('click', () => { ensureAc(); openBox(); });
$('shovelBtn').addEventListener('click', () => {
  if (state !== 'playing') return;
  sel = (sel && sel.mode === 'shovel') ? null : { mode: 'shovel' };
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
    el.innerHTML = '<div id="board" style="display:block;"></div>';
    loadBoard(el.firstChild);
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
  drawBackground();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const m = grid[r][c];
      if (m) drawMachine(g, m.type, cellCx(c), cellCy(r) + 6, 1.0, m);
    }
    for (const e of enemies) {
      if (e.row === r) drawEnemy(e);
    }
  }
  drawBullets();
  drawZaps();
  drawParts();
  drawOrbs();
  drawFloats();
  drawHoverGhost();
  drawBanner();
}

function drawBackground() {
  g.fillStyle = '#10151c';
  g.fillRect(-10, -10, W + 20, H + 20);
  // 战场网格
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = GRID_X + c * CELL_W, y = GRID_Y + r * CELL_H;
      g.fillStyle = (r + c) % 2 === 0 ? '#1a2330' : '#161e29';
      g.fillRect(x, y, CELL_W, CELL_H);
      g.strokeStyle = 'rgba(70,90,115,0.16)';
      g.strokeRect(x + 0.5, y + 0.5, CELL_W - 1, CELL_H - 1);
    }
  }
  // 右侧入侵区域微光
  const gr = g.createLinearGradient(W - 90, 0, W, 0);
  gr.addColorStop(0, 'rgba(255,80,60,0)');
  gr.addColorStop(1, 'rgba(255,80,60,0.13)');
  g.fillStyle = gr;
  g.fillRect(W - 90, GRID_Y, 90, ROWS * CELL_H);
  // 左侧基地
  g.fillStyle = '#1b2434';
  g.fillRect(0, 0, GRID_X - 8, H);
  g.fillStyle = '#141b27';
  g.fillRect(0, 0, GRID_X - 8, GRID_Y);
  // 警戒条纹
  g.save();
  g.beginPath();
  g.rect(GRID_X - 8, 0, 8, H);
  g.clip();
  for (let y = -20; y < H + 20; y += 16) {
    g.fillStyle = (y / 16) % 2 === 0 ? '#ffc531' : '#20242c';
    g.save();
    g.translate(GRID_X - 4, y);
    g.rotate(-0.6);
    g.fillRect(-12, 0, 24, 8);
    g.restore();
  }
  g.restore();
  // 基地盾徽 + 文字
  g.fillStyle = '#2a3850';
  g.beginPath();
  g.arc(28, H / 2 - 88, 17, 0, TAU);
  g.fill();
  g.fillStyle = '#4cc2ff';
  g.font = '900 17px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('🛡️', 28, H / 2 - 87);
  g.fillStyle = '#8fa1b8';
  g.font = '800 20px "PingFang SC","Microsoft YaHei",sans-serif';
  g.fillText('基', 28, H / 2 - 40);
  g.fillText('地', 28, H / 2 - 12);
  g.fillStyle = 'rgba(143,161,184,0.5)';
  g.font = '10px sans-serif';
  g.save();
  g.translate(28, H / 2 + 66);
  g.fillText('DEFEND', 0, 0);
  g.restore();
}

/* ---- 机器绘制 ---- */
function drawMachine(ctx, type, x, y, s, m) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 36, 30, 7, 0, 0, TAU);
  ctx.fill();
  switch (type) {
    case 'turret': drawTurret(ctx, m); break;
    case 'generator': drawGenerator(ctx, m); break;
    case 'barricade': drawBarricade(ctx, m); break;
    case 'shredder': drawShredder(ctx, m); break;
    case 'fan': drawFan(ctx, m); break;
    case 'tesla': drawTesla(ctx, m); break;
    case 'rocket': drawRocket(ctx, m); break;
  }
  ctx.restore();
  // 血条
  if (m && m.maxHp && m.hp < m.maxHp) {
    const bw = 44 * s;
    const ratio = clamp(m.hp / m.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - bw / 2, y - 52 * s, bw, 5);
    ctx.fillStyle = ratio > 0.4 ? '#58d68b' : '#ff5d5d';
    ctx.fillRect(x - bw / 2, y - 52 * s, bw * ratio, 5);
  }
}

function drawTurret(ctx, m) {
  const rec = (m && m.recoil > 0) ? m.recoil * 30 : 0;
  // 底座
  ctx.fillStyle = '#2f3d4e';
  rr(ctx, -20, 16, 40, 20, 5); ctx.fill();
  ctx.fillStyle = '#243141';
  rr(ctx, -14, 6, 28, 14, 4); ctx.fill();
  // 炮管
  ctx.fillStyle = '#57687c';
  rr(ctx, 2 - rec, -16, 36, 12, 4); ctx.fill();
  ctx.fillStyle = '#3c4b5d';
  rr(ctx, 30 - rec, -18, 8, 16, 3); ctx.fill();
  // 炮塔
  ctx.fillStyle = '#71859b';
  ctx.beginPath();
  ctx.arc(-4, -8, 17, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#8ba1b8';
  ctx.beginPath();
  ctx.arc(-7, -11, 9, 0, TAU);
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
  // 电池外壳
  ctx.fillStyle = '#2b3a4a';
  rr(ctx, -20, -24, 40, 58, 8); ctx.fill();
  ctx.strokeStyle = '#4a5c70';
  ctx.lineWidth = 2;
  rr(ctx, -20, -24, 40, 58, 8); ctx.stroke();
  // 正极头
  ctx.fillStyle = '#ffc531';
  rr(ctx, -8, -32, 16, 9, 3); ctx.fill();
  // 电量条
  ctx.fillStyle = '#39506b';
  rr(ctx, -13, -16, 26, 42, 4); ctx.fill();
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
  // 主体钢板
  ctx.fillStyle = '#5d7186';
  rr(ctx, -26, -34, 52, 70, 7); ctx.fill();
  ctx.fillStyle = '#6d8299';
  rr(ctx, -26, -34, 52, 14, 7); ctx.fill();
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

function drawShredder(ctx, m) {
  const chew = m && m.chew > 0 ? m.chew : 0;
  const ready = !m || !m.cd || m.cd <= 0;
  const jx = chew > 0 ? rand(-2, 2) : 0;
  const jy = chew > 0 ? rand(-1.5, 1.5) : 0;
  ctx.save();
  ctx.translate(jx, jy);
  // 纸箱主体（收集桶）
  ctx.fillStyle = '#37475a';
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
  ctx.strokeStyle = '#7fd7ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, -8, 24, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = 'rgba(38,66,88,0.85)';
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
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(0, -26, 11 + flash * 2, 0, TAU);
  ctx.fill();
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

function drawRocket(ctx, m) {
  const blink = Math.sin((m && m.spin ? m.spin : 0) * 5) > 0;
  // 发射井
  ctx.fillStyle = '#3a4656';
  rr(ctx, -24, -14, 48, 50, 8); ctx.fill();
  ctx.fillStyle = '#2b3543';
  rr(ctx, -18, -10, 36, 40, 6); ctx.fill();
  // 舱门（打开状态）
  ctx.fillStyle = '#4c5b6d';
  rr(ctx, -26, -22, 20, 10, 3); ctx.fill();
  rr(ctx, 6, -22, 20, 10, 3); ctx.fill();
  // 火箭
  ctx.fillStyle = '#d5dde6';
  rr(ctx, -7, -18, 14, 30, 4); ctx.fill();
  ctx.fillStyle = '#ff5d5d';
  ctx.beginPath();
  ctx.moveTo(-7, -18);
  ctx.lineTo(0, -34);
  ctx.lineTo(7, -18);
  ctx.closePath();
  ctx.fill();
  // 舷窗
  ctx.fillStyle = '#4cc2ff';
  ctx.beginPath();
  ctx.arc(0, -8, 3.6, 0, TAU);
  ctx.fill();
  // 警示灯
  ctx.fillStyle = blink ? '#ffc531' : '#6b5514';
  ctx.beginPath();
  ctx.arc(19, -8, 3, 0, TAU);
  ctx.fill();
  // 警戒条
  ctx.fillStyle = '#ffc531';
  ctx.fillRect(-24, 30, 48, 4);
}

/* ---- 敌人绘制 ---- */
function drawEnemy(e) {
  const y = cellCy(e.row);
  const bob = Math.sin(e.anim * 7) * 2.5;
  g.save();
  if (e.type === 'drone') {
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
  if (frozen) {
    g.globalAlpha = 0.35;
    g.fillStyle = '#7fd7ff';
    g.beginPath();
    g.arc(0, -6, e.w / 2 + 3, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
  }
  g.restore();
  // 血条
  if (e.hp < e.maxHp) {
    const bw = e.type === 'crusher' ? 64 : 40;
    const ratio = clamp(e.hp / e.maxHp, 0, 1);
    const by = rowCy(e) - (e.type === 'crusher' ? 52 : 46);
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(e.x - bw / 2, by, bw, 4.5);
    g.fillStyle = ratio > 0.4 ? '#58d68b' : '#ff5d5d';
    g.fillRect(e.x - bw / 2, by, bw * ratio, 4.5);
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
function drawBullets() {
  for (const b of bullets) {
    const y = cellCy(b.row) - 8;
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
    } else {
      g.fillStyle = 'rgba(255,197,49,0.3)';
      g.beginPath(); g.arc(b.x - 7, y, 6.5, 0, TAU); g.fill();
      g.fillStyle = '#ffd764';
      g.beginPath(); g.arc(b.x, y, 4.5, 0, TAU); g.fill();
    }
  }
}

function drawZaps() {
  for (const z of zaps) {
    const alpha = z.t / z.max;
    g.strokeStyle = 'rgba(200,150,255,' + (0.85 * alpha) + ')';
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
    g.strokeStyle = 'rgba(240,225,255,' + (0.5 * alpha) + ')';
    g.lineWidth = 1;
    g.stroke();
  }
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
    g.fillStyle = 'rgba(255,197,49,0.22)';
    g.beginPath(); g.arc(0, 0, 24, 0, TAU); g.fill();
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
  const type = hand[sel.idx];
  if (!type) return;
  g.fillStyle = occupied ? 'rgba(255,93,93,0.22)' : 'rgba(88,214,139,0.16)';
  g.fillRect(x, y, CELL_W, CELL_H);
  g.strokeStyle = occupied ? 'rgba(255,93,93,0.7)' : 'rgba(88,214,139,0.7)';
  g.lineWidth = 2;
  g.strokeRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);
  if (!occupied) {
    g.globalAlpha = 0.55;
    drawMachine(g, type, cellCx(cell.c), cellCy(cell.r) + 6, 1.0, {});
    g.globalAlpha = 1;
  }
}

function drawBanner() {
  if (bannerT <= 0) return;
  const alpha = bannerT > 2 ? (2.4 - bannerT) / 0.4 : clamp(bannerT / 0.5, 0, 1);
  g.globalAlpha = clamp(alpha, 0, 1);
  g.fillStyle = 'rgba(8,12,18,0.55)';
  const y = GRID_Y + ROWS * CELL_H * 0.32;
  rr(g, W / 2 - 220, y - 34, 440, bannerSub ? 84 : 62, 14);
  g.fill();
  g.fillStyle = '#ffc531';
  g.font = '900 30px "PingFang SC","Microsoft YaHei",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(bannerText, W / 2, y);
  if (bannerSub) {
    g.fillStyle = '#dce6f2';
    g.font = '600 15px "PingFang SC","Microsoft YaHei",sans-serif';
    g.fillText(bannerSub, W / 2, y + 30);
  }
  g.globalAlpha = 1;
}

/* ========== 调试接口（供自动化测试） ========== */
window.__game = {
  start: startGame,
  addEnergy: n => { energy += n; },
  openBox,
  give: t => { if (hand.length < HAND_MAX) { hand.push(t); renderTray(); } },
  placeAt: (t, r, c) => place(t, r, c),
  playCard: (idx, r, c) => {
    const type = hand[idx];
    if (!type) return false;
    if (!place(type, r, c)) return false;
    hand.splice(idx, 1);
    renderTray();
    return true;
  },
  spawn: (t, r) => spawnEnemy(t, r),
  advance: sec => {
    const steps = Math.round(sec * 60);
    for (let i = 0; i < steps; i++) {
      if (state !== 'playing') break;
      update(1 / 60);
    }
  },
  machineAt: (r, c) => (grid[r][c] ? grid[r][c].type : null),
  collectAll: () => {
    let got = 0;
    for (let i = orbs.length - 1; i >= 0; i--) {
      if (!orbs[i].falling) { got += orbs[i].val; energy += orbs[i].val; orbs.splice(i, 1); }
    }
    return got;
  },
  get state() { return state; },
  get energy() { return energy; },
  get hand() { return hand.slice(); },
  get enemyCount() { return enemies.length; },
  get score() { return score; },
  get kills() { return kills; },
  get wave() { return wave; },
};

/* ========== 启动 ========== */
initGame();
requestAnimationFrame(frame);
