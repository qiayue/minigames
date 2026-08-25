# 网页小游戏开发规范与流程

> 从《机械防线 · 盲盒塔防》(9000 行 / 27 种机器 / 26 种敌人 / 零依赖 Canvas) 沉淀出来的一套做法。
> 适用于：**纯前端、零资源、单页即玩、部署到 Cloudflare Workers 的 2D 小游戏**（塔防 / 射击 / 消除 / Roguelite / 放置类）。
> 直接把这个文件丢进新仓库当 `CLAUDE.md` 或开发约定，AI 和人都照着做。

---

## 目录

1. [技术选型与硬约束](#1-技术选型与硬约束)
2. [项目结构](#2-项目结构)
3. [核心架构：数据表驱动](#3-核心架构数据表驱动)
4. [★ 模块化能力系统（最重要的一条）](#4--模块化能力系统最重要的一条)
5. [主循环与状态管理](#5-主循环与状态管理)
6. [纯矢量美术规范](#6-纯矢量美术规范)
7. [输入规范：鼠标 / 触屏 / 旋转](#7-输入规范鼠标--触屏--旋转)
8. [自适应布局与移动端](#8-自适应布局与移动端)
9. [★ 调试接口 window.__game（Day 1 就要建）](#9--调试接口-window__gameday-1-就要建)
10. [测试流程：Playwright + 机器人玩家](#10-测试流程playwright--机器人玩家)
11. [数值平衡方法](#11-数值平衡方法)
12. [性能预算与测量](#12-性能预算与测量)
13. [每轮迭代的标准节奏](#13-每轮迭代的标准节奏)
14. [踩过的坑清单](#14-踩过的坑清单)
15. [Day 1 启动清单](#15-day-1-启动清单)
16. [和 AI 协作的提示词规范](#16-和-ai-协作的提示词规范)

---

## 1. 技术选型与硬约束

| 项 | 选择 | 理由 |
| --- | --- | --- |
| 渲染 | **原生 Canvas 2D** | 零构建、零依赖、单文件可读；小游戏用不上 WebGL |
| 美术 | **全部代码手绘矢量** | 没有图片资源 = 秒开、无 CDN、无版权问题、改配色一行搞定 |
| 音效 | **WebAudio 实时合成** | 同上，几十行换掉整包音频文件 |
| 框架 | **无** | 引入框架的收益 < 它带来的构建复杂度 |
| 后端 | Cloudflare Workers `assets` + `/api/*` | 静态托管 + 少量接口（排行榜）一体，push 即部署 |
| 存储 | Workers KV（可选），**默认降级 localStorage** | 没配 KV 也能玩，不阻塞上线 |

**硬约束（写进项目规范，不要破例）：**

- 零 npm 运行时依赖，`public/` 下只有 `index.html` + `game.js`
- 打开网页即玩，不需要任何加载进度条
- 逻辑分辨率固定（如 `940×526`），显示尺寸靠 CSS/JS 缩放，**游戏代码里永远只用逻辑坐标**
- 所有随机性走统一的 `rand()`，方便以后加种子复现

---

## 2. 项目结构

```
├── public/
│   ├── index.html      # 布局 + CSS + DOM 覆盖层（菜单/结算/面板）
│   └── game.js         # 游戏本体，单文件
├── src/
│   └── worker.js       # Cloudflare Worker：/api/* + 静态资源
├── docs/
│   ├── screenshot.png  # README 用，每轮迭代重新生成
│   └── *.png           # 功能特写图
├── wrangler.jsonc
├── package.json
└── README.md           # 玩法 + 图鉴 + 部署说明，当作产品文档维护
```

**`game.js` 内部固定分区顺序**（用 `/* ===== 区块名 ===== */` 分隔）：

```
基础配置常量  →  数据表  →  工具函数  →  DOM 引用  →  游戏状态
→  初始化 / 开局 / 结算  →  实体创建（place / spawn）
→  更新逻辑（updateXxx）  →  绘制原语  →  绘制实现（drawXxx）
→  输入事件  →  UI 事件  →  主循环  →  window.__game 调试接口
```

单文件到 1 万行也不难维护，前提是**分区顺序永远不变**，新东西加在对应区块尾部。

---

## 3. 核心架构：数据表驱动

**规则：任何"一类东西"都必须先有一张表，代码只读表，绝不硬编码个体。**

```js
const ENEMIES = {
  scrap:   { name: '废铁机器人', hp: 100, speed: 14, dmg: 45, score: 10, w: 46 },
  drone:   { name: '疾速无人机', hp: 70,  speed: 30, dmg: 30, score: 15, w: 44, fly: true },
  gunner:  { name: '炮击机器人', hp: 260, speed: 9,  dmg: 40, score: 45, w: 50,
             range: 3.0, rdmg: 34, rcd: 1.8, rkind: 'shell' },   // 加个字段就是新兵种
};
```

**行为用「能力标记」组合，不要用继承 / switch 分支：**

```js
fly / boss / heavy / suicide / dash / jumps / heal / cloak / splits / regen
range+rdmg+rcd+rkind   // 有 range 就是远程兵，不需要单独的类
```

`updateEnemies()` 里挨个检查标记即可。加一种敌人 = 表里加一行 + 写一个 `drawXxx()`，**零架构改动**。

同一套做法用在：己方单位、波次表、掉落表、成就表。

---

## 4. ★ 模块化能力系统（最重要的一条）

这是本项目最大的架构收获。如果你的游戏有**合成 / 进化 / 升级 / 装备**，照抄这套。

### 思路

不要写"A + B = C"的配方表（N 种单位就要 N² 条配方，加一个单位要补一整列）。
把单位拆成**能力模块数组**，合成 = 数组合并：

```js
machine = { modules: [ {kind:'shot', lv:3}, {kind:'frost', lv:2} ], ... }

function mergeModules(a, b) {
  const map = {};
  for (const mod of [...a, ...b]) map[mod.kind] = (map[mod.kind] || 0) + mod.lv;
  return sortModules(Object.keys(map).map(k => ({ kind: k, lv: map[k] })));
}
// 同类相加 = 升级；异类并存 = 叠能力。数量与等级都无上限。
```

### 一切都从模块推导

| 推导项 | 函数 | 说明 |
| --- | --- | --- |
| 名字 | `nameOfModules()` | 修饰词链 + 本体名：`冰霜加特林炮台 Lv6`；超过 4 种能力用「全能」概括 |
| 类型 id | `typeOfModules()` | 单模块查阶梯表，多模块统一叫 `hybrid`，经典组合有专属 id |
| 血量 | `hpOfModules()` | `基础 + Σ(KIND_HP[kind] × lv) + 总等级奖励` |
| 数值 | `modStat(kind, prop, lv)` | 查 `MOD_STAT` 表，超出表长按 `STAT_GROWTH` 外推 |
| 造型 | `drawChassis()` + `drawThemeDeco()` | 主模块决定机体，副模块决定配色与外挂件 |
| 描述 | `descOfModules()` | 拼接各模块描述 |

### 等级无上限的关键：外推规则

```js
const MOD_STAT = {
  shot: { interval: [1.15, 0.6, 0.32], dmg: [25, 28, 30] },   // 只写前 3 级
};
const STAT_GROWTH = {
  interval: { mul: 0.86, min: 0.05 },   // 4 级往上每级 ×0.86，触底停住
  dmg:      { mul: 1.3 },
  targets:  { add: 1, max: 40 },
};
```

只手写 1/2/3 级手感，Lv22 自动算出来且不会爆炸。**每加一个新属性，必须同时在 `STAT_GROWTH` 里给规则**，否则外推会用默认值出问题。

### 收益

- 加一种能力 = 往 8 张表里各加一行 + 写 3 级造型，自动获得与其它 N 种能力的所有组合
- 玩家能造出「全能雷电狙击自动炮台 Lv22」这种东西，而你一行专门代码都没写

---

## 5. 主循环与状态管理

```js
let state;   // 'menu' | 'playing' | 'paused' | 'over' | 'win'
let mode;    // 玩法模式，影响经济与 UI，不影响核心循环

function frame(ts) {
  const dt = Math.min((ts - last) / 1000, 0.05);   // 夹住 dt，切后台回来不会瞬移
  last = ts;
  if (state === 'playing') update(dt);
  draw();
  requestAnimationFrame(frame);
}
```

**`update()` 内部顺序固定，不要随意调换：**

```
波次生成 → 己方单位 → 己方投射物 → 敌方投射物 → 敌人 → 掉落物 → 特效
```

**特效数组统一生命周期**：每种特效一个数组，元素带 `t`（剩余时间）和 `max`，
`updateFx()` 统一递减、到点 splice，`drawXxx()` 用 `t/max` 算 alpha。

```js
let bullets, ebullets, parts, floats, zaps, beams, mines, shocks, allies, ...;
```

**暂停 / 切后台**：`visibilitychange` 自动暂停，避免回来时一堆 dt 堆积。

---

## 6. 纯矢量美术规范

### 6.1 共享绘制原语（先写这些，再画任何单位）

```js
rr(g, x, y, w, h, r)          // 圆角矩形（务必处理负宽高，见坑 #3）
panel(ctx, x,y,w,h,r, P)      // 斜面金属板：主渐变 + 顶部软高光 + 左缘轮廓光 + 描边
bolt(ctx, x, y, P, rad)       // 铆钉：沉头孔 + 帽 + 高光
pedestal(ctx, P, w, lv)       // 底座：面板 + 散热格栅 + 落地接触阴影
hazard(ctx, x, y, w, h)       // 警戒斜纹条
emissive(ctx, color, blur, f) // 发光包装（内部按 fxQuality 降级）
eBody / eRim / eEye / eRotor / eTread    // 敌人专用原语
```

**统一光照模型**（所有单位共用，这是"看起来是一套"的关键）：

```
顶光 → 本色 → 暗部 → 底部环境反射
```

底部那一档冷色反射光很重要——没有它，单位会像贴纸一样贴在黑背景上。直接烘进主渐变，不额外填充：

```js
ctx.fillStyle = cachedLG(ctx, x, y, x, y + h,
  [0, P.light, 0.4, P.base, 0.84, P.dark, 1, bounceOf(P.dark)]);
```

### 6.2 材质分档

```js
const TIERS = [
  { base:'#75899d', dark:'#2a3847', light:'#c2d3e2', trim:'#9db0c4', led:'#ffc531' }, // 1 钢铁
  { base:'#7fa9cf', dark:'#25517a', light:'#e0f1ff', trim:'#bfe3ff', led:'#7fd7ff' }, // 2 合金
  { base:'#5f5578', dark:'#1e1a2c', light:'#c8b8f2', trim:'#f0d488', led:'#ffd764' }, // 3 秘金
];
```

一级材质**不要太灰**，明暗对比拉开，否则低级单位看起来像塑料。

### 6.3 主题染色（合成体外观自动变化）

```js
const KIND_THEME = { frost: { tint:'#4aa8d8', amt:0.5, accent:'#bfe9ff' }, ... };
let curTheme = null;
function themed(P) { /* 用 mixHex 把整套调色板往 tint 混，结果缓存 */ }
```

绘制合成体时 `curTheme = 副模块.kind`，所有 `panel()` 自动变色 → **冰霜自动炮台真的是蓝的**，不用为每种组合画一张图。再加 `drawThemeDeco()` 挂物理外设（冰晶 / 燃料罐 / 电池组）。

### 6.4 性能：缓存与降级

```js
// 渐变按 (坐标 + 色标) 缓存在 ctx.__gc 这个 Map 上
function cachedLG(ctx, x0,y0,x1,y1, stops) { ... }
```

⚠️ **缓存 key 必须是有限集合**。铆钉那种"坐标每次都不同"的调用不能用缓存渐变，否则 Map 无限膨胀（本项目真踩过）。

```js
let fxQuality = 1;
fxQuality = units > 58 ? 0.35 : units > 38 ? 0.65 : 1;   // 每帧按场上单位数算
// 细节绘制统一包一层：if (fxQuality > 0.5) { 高光/格栅/接触阴影 }
```

### 6.5 让美术"好看"的实操清单

- **不要孤立的形状**：炮管要有炮座连到机身，雷达要有桅杆，否则看起来像浮空零件
- **加结构性小物件**：散热鳍、弹链、软管、警示条、铆钉阵、观察窗、旋转警灯
- **发光要有来源**：不要凭空的光斑，要么是灯、要么是能量缝、要么是枪口焰
- **状态用轮廓+粒子表现，不要整体染色**：灼烧 = 橙色轮廓 + 上跳火苗，
  中毒 = 绿色轮廓 + 气泡。整体染色叠加多了会糊成白团（真踩过）
- **等级差异要看得见**：1/2/3 级不只是换色，要加结构（第二根炮管、第三片棱镜、城垛）

---

## 7. 输入规范：鼠标 / 触屏 / 旋转

### 7.1 逻辑坐标换算（唯一入口）

```js
function toGame(ev) {
  const rect = cv.getBoundingClientRect();
  if (rotated) {                      // 竖屏整体旋转 90° 时的逆变换
    return { x: (ev.clientY - rect.top)   * W / rect.height,
             y: (rect.right - ev.clientX) * H / rect.width };
  }
  return { x: (ev.clientX - rect.left) * W / rect.width,
           y: (ev.clientY - rect.top)  * H / rect.height };
}
```

**所有输入只走 `pointerdown` / `pointermove` / `pointerup`**，鼠标和触屏一套代码。

### 7.2 双击 / 拖拽自己实现，不要用 `dblclick` / `dragstart`

```js
// 双击：340ms + 40px 内的同格两次按下（touch 上比 dblclick 可靠得多）
const isDouble = cell && now - lastTap.t < 340
  && lastTap.r === cell.r && lastTap.c === cell.c
  && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 40;

// 拖拽：pointerdown 拿起 + 记 grabbed，pointerup 落到别的格子就放下
// 同时天然兼容「点一下拿起、点一下放下」，两种手感都能用
```

### 7.3 触屏杂项

```css
body { touch-action: manipulation; }   /* 禁双击缩放 */
#cv  { touch-action: none; user-select: none; }
```

```js
document.addEventListener('touchstart', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive:false });
document.addEventListener('gesturestart', e => e.preventDefault());   // iOS 手势缩放
cv.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') mouse = {x:-1,y:-1}; });  // 抬手清悬停预览
```

### 7.4 操作设计原则

- **一个工具能干两件事就别做两个按钮**：手套拖到空格=搬运，拖到单位身上=合成
- **模式化操作要「粘住」**：执行一次后保持激活，别每次都要重新点按钮
- **落子前给预览**：目标格高亮 + 半透明幽灵 + 结果名字浮层，松手前就知道会发生什么

---

## 8. 自适应布局与移动端

### 8.1 一屏铺满，不滚动

```css
body { height: 100dvh; overflow: hidden; overscroll-behavior: none; }
#wrap { height: 100%; display: flex; flex-direction: column;
        padding: calc(6px + env(safe-area-inset-top)) ... ; }
#stageWrap { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; }
```

### 8.2 舞台尺寸用 JS 精确算，不要只靠 `aspect-ratio`

⚠️ `width:100% + aspect-ratio + max-height:100%` **不会**反向收缩宽度，会把画面压扁。

```js
function fitStage() {
  const aw = stageWrap.clientWidth, ah = stageWrap.clientHeight;
  const k = Math.min(aw / W, ah / H);
  stage.style.width  = Math.floor(W * k) + 'px';
  stage.style.height = Math.floor(H * k) + 'px';
}
new ResizeObserver(fitStage).observe(stageWrap);
new ResizeObserver(fitStage).observe(tray);   // 卡槽换行会改变可用高度
```

### 8.3 三种布局档位

| 档位 | 触发 | 做法 |
| --- | --- | --- |
| `compact` | 可用高 < 620 或宽 < 780 | 收紧头部/卡槽/弹窗，隐藏页脚 |
| `side` | 矮而宽（高 < 520 且宽 > 高） | **卡槽竖排到左侧**，战场吃满整块高度（比横排大 ~26%） |
| `rot` | 竖屏 且 短边 < 560 | **整个界面 `rotate(90deg)`**，竖着拿也是完整横屏 |

```css
body.rot #wrap {
  position: fixed; top: 0; left: 0;
  width: 100dvh; height: 100dvw;
  transform-origin: 0 0; transform: rotate(90deg) translateY(-100%);
}
```

旋转后**只有 canvas 的手工坐标换算需要改**（见 7.1），DOM 按钮的命中测试浏览器自己处理。
HTML 浮层放在 `#wrap` 内部就会跟着一起转。

### 8.4 全屏

```js
document.documentElement.requestFullscreen()
  .then(() => screen.orientation?.lock?.('landscape').catch(() => {}));
```

iPhone Safari 没有全屏 API → **检测不到就把按钮隐藏**，靠自动旋转兜底。

---

## 9. ★ 调试接口 `window.__game`（Day 1 就要建）

**这是整个流程的地基。没有它，所有自动化测试都写不了。**

```js
window.__game = {
  // 控制
  start: m => startGame(m),
  advance: sec => { for (let i = 0; i < sec * 60; i++) update(1/60); },  // 快进！
  clear: () => { /* 清空场地与所有特效数组 */ },

  // 造场景
  placeAt: (type, r, c) => place(type, r, c),
  spawn: (type, row) => spawnEnemy(type, row),
  setEnemyX: (i, x) => { enemies[i].x = x; },
  addEnergy: n => { energy += n; },

  // 读状态
  get state() {}, get wave() {}, get score() {}, get energy() {},
  get enemyList() { return enemies.map(e => ({ type, x, hp, frozen, stunned, cloaked, ... })); },
  machineAt: (r,c) => grid[r][c]?.type,
  machineInfo: (r,c) => ({ name, hp, sh, haste, mods, stunned }),
  get bulletCount() {}, get allyCount() {},

  // 模拟操作（每加一个交互就补一个）
  fuse: (r1,c1,r2,c2) => {}, drag: (r1,c1,r2,c2) => {},
  grab: (r,c) => {}, drop: (r,c) => {}, playCard: (t,r,c) => {},
};
```

三条规矩：

1. **`advance(sec)` 是灵魂**——固定步长快进，10 分钟的对局在 1 秒内跑完
2. **每加一个玩法，同步加对应的读写接口**，否则下次没法测
3. 接口只读内部状态、不改渲染，发布版留着也无所谓（几 KB）

---

## 10. 测试流程：Playwright + 机器人玩家

```js
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));   // ← 必须，Canvas 抛错不会白屏
await page.goto('http://127.0.0.1:8123/index.html');
```

### 固定的脚本清单

| 脚本 | 职责 |
| --- | --- |
| `smoke.js` | 开局→放置→战斗→失败→重开，跑通主流程 |
| `<feature>.js` | 每个新系统一个专项脚本（本项目有 ranged / m6 / lvpanel / dragfuse …） |
| `balance.js` | **机器人玩家**跑完整对局，输出胜负 |
| `classic.js` | 另一个模式的机器人 |
| `responsive.js` | 6 种视口下测布局比例 + 点击命中 |
| `mobile2.js` | 触屏专项（真 `touchscreen.tap`） |
| `perf.js` / `perf2.js` | 压力 / 常规两档 FPS |
| `allgal.js` | 全单位造型总览截图，肉眼过一遍 |
| `screenshot.js` | 生成 README 用的宣传图 |

### 写测试的要点

- **先造确定的场景再断言**：`clear()` → `placeAt` → `spawn` → `setEnemyX` → `advance`
- **断言要贴着机制**，别只测"没报错"：
  ```js
  R.spitterSplash = { before, after, splashed: after[0] < before[0] && after[2] < before[2] };
  ```
- **测试失败先怀疑测试**：本项目一半以上的"失败"是场景没摆对（敌人还没走进射程、
  格子被占、伤害类型不对），不是代码错
- **`page.on('pageerror')` 不能省**：Canvas 里抛异常游戏会静默卡住，只有这里能抓到
- 视觉不用断言，**截图人眼看**。但结构性的东西（比例、是否溢出、点击命中）要断言

### 点击命中测试（防止坐标换算写错）

```js
// 算出格子中心的屏幕坐标 → 真实点击 → 断言机器落在那一格
const sx = rect.left + gx * rect.width / W, sy = rect.top + gy * rect.height / H;
await page.mouse.click(sx, sy);
expect(await page.evaluate(() => __game.machineAt(2,3))).toBe('turret');
```

旋转布局下换一套公式再测一遍，这是唯一能保证移动端不错位的方法。

---

## 11. 数值平衡方法

**用机器人玩家量化，不要靠感觉。**

```js
for (let t = 0; t < 3000; t++) {
  if (G.state !== 'playing') break;
  G.advance(1);
  G.collectAll();
  // 一套朴素但合理的 AI 策略：先攒产能 → 威胁行补防御 → 富余上高级货
}
return { state: G.state, wave: G.wave, score: G.score };
```

- **目标胜率**：完美 AI 跑 3 局，**2/3 胜**比较合适（3/3 = 太简单，0/3 = 太难）
- **分模式定目标**：随机性强的模式（抽卡）可以更难，确定性模式（种卡）要能稳定通关
- **改数值 → 立刻重跑 → 记录**，一轮改动别超过 2 个变量
- **注意区分"输了"和"跑超时"**：机器人循环上限不够也会返回 `playing`，加大上限再判

### 加新内容后的平衡流程

```
加内容 → 跑 balance → 如果 3/3 就给后面几波加量 → 再跑 → 收敛到 2/3
```

---

## 12. 性能预算与测量

```js
const fps = await page.evaluate(() => new Promise(res => {
  let n = 0; const t0 = performance.now();
  (function tick(){ n++; performance.now()-t0 < 3000 ? requestAnimationFrame(tick)
                                                     : res(Math.round(n/((performance.now()-t0)/1000))); })();
}));
```

| 档位 | 场景 | 目标 |
| --- | --- | --- |
| 常规 | 16 单位 + 14 敌人 | **≥ 55 FPS** |
| 压力 | 45 满级单位 + 40 敌人 | **≥ 30 FPS** |

⚠️ **测量有波动（±10 FPS）**。怀疑性能回退时，`git stash` 回到基线**当场再测一次**再下结论——
本项目曾误判"43 掉到 28"，实际是机器负载变了，基线重测也是 33。

优化优先级：
1. 去掉 `save/clip/restore`（最贵），用内缩绘制代替
2. 渐变缓存，但**注意 key 的基数**
3. 把多次填充烘进一次渐变
4. `fxQuality` 分级降级细节
5. 最后才考虑离屏 canvas 缓存

---

## 13. 每轮迭代的标准节奏

一次需求（比如"加 5 种远程敌人 + 6 台新机器"）按这个顺序做，**每步都验证再进下一步**：

```
1. 读现有数据表结构，确认要改哪几张表
2. 数据层：往所有相关表里加行     → node --check 语法过
3. 机制层：更新逻辑 + 新状态数组   → node --check
4. 接线：update() / draw() 里挂上  → node --check
5. 美术层：每个新单位的 1/2/3 级造型 → node --check
6. 写专项测试脚本，跑通所有新机制   → 全绿
7. 渲染造型总览图，肉眼过一遍，修丑的
8. 跑全量回归（所有历史脚本）      → 全绿
9. 跑 balance / perf，调到目标区间
10. 重新生成 README 截图
11. 更新 README（图鉴表格、数量、新机制说明）
12. commit + push（一次需求一个 commit，说明写清"做了什么/为什么"）
```

**用 Python 脚本做代码修改**（`rep(old, new)` + `assert old in s`），比手工编辑可靠：
匹配不到会立刻炸，不会静默改错地方。改完立刻 `node --check`。

---

## 14. 踩过的坑清单

| # | 坑 | 症状 | 解法 |
| --- | --- | --- | --- |
| 1 | **远程单位停在屏幕外开火** | 卡在某一波不结束，敌人无敌 | 开火前先要求 `e.x <= W - e.w/2 - 8`，必须走进战场 |
| 2 | **`aspect-ratio` 不反向收缩** | 画面被压扁成 2.9:1 | 用 JS + `ResizeObserver` 算精确像素 |
| 3 | **`rr()` 负宽度 → 负半径** | `arcTo: radius is negative` 整个画面卡死 | `rr()` 内部归一化负宽高 |
| 4 | **渐变缓存 key 无限膨胀** | 越玩越卡、内存涨 | 坐标可变的调用不要用缓存渐变 |
| 5 | **DoT 每帧设 `flash`** | 敌人变成白色团块 | 持续伤害传 `noFlash` 参数 |
| 6 | **状态染色叠加** | 中毒+灼烧+冰冻 = 一坨白 | 改成轮廓线 + 上浮粒子 |
| 7 | **调试接口 `place()` 绕过重构** | `m.modules is not iterable` | 所有创建路径统一走 `place()` |
| 8 | **半透明浮层挡住 canvas 点击** | 点不动 | `pointer-events: none` |
| 9 | **`grep \| head` 的退出码是 head 的** | `\|\|` 分支不触发 | 判断退出码时别接管道 |
| 10 | **性能测量波动** | 误判回退 | 回到基线当场重测 |
| 11 | **调色板缺字段** | `addColorStop('undefined')` 崩 | 原语里给 `P.base \|\| P.light` 兜底 |
| 12 | **炮管旋转方向搞反** | 炮口朝地 | 屏幕 y 向下：要朝上就 `sin(θ) > 0` |

---

## 15. Day 1 启动清单

新游戏第一天按这个顺序搭骨架，**当天就能跑起自动化测试**：

- [ ] `wrangler.jsonc` + `src/worker.js`（`/api/health` 先通）+ `public/index.html` 空壳
- [ ] 常量区：`W / H / 网格 / TAU`，`rr / rand / clamp / shuffle` 工具
- [ ] `DPR` 缩放的 canvas + `toGame()` 坐标换算
- [ ] 主循环 `frame / update / draw` + `state` 状态机
- [ ] **自适应布局**（`fitStage` + `ResizeObserver` + compact/side/rot 三档）
- [ ] **`window.__game` 调试接口**（至少 `start / advance / clear / spawn / placeAt / state`）
- [ ] `smoke.js` + `perf.js`，本地 `python3 -m http.server` 起服务跑通
- [ ] 绘制原语（`panel / bolt / pedestal / emissive / TIERS`）
- [ ] 一个单位 + 一个敌人，端到端打通
- [ ] README 骨架 + `screenshot.js`

**之后每加一个系统，都要同步补：数据表行 → 调试接口 → 专项测试脚本 → README 段落。**

---

## 16. 和 AI 协作的提示词规范

如果这个游戏主要由 AI 写，把下面这段放进 `CLAUDE.md`：

```markdown
## 开发约定

- 单文件 `public/game.js`，分区顺序固定，新内容加在对应区块尾部
- 任何"一类东西"先加数据表行，再写逻辑；禁止硬编码个体分支
- 改代码用 Python 脚本做精确替换（`assert old in s`），改完立刻 `node --check`
- 每加一个玩法：同步补 `window.__game` 接口 + 专项 Playwright 脚本
- 提交前必须：全量回归脚本全绿 + balance 达标 + perf 达标 + 重新生成截图 + 更新 README
- 测试脚本必须监听 `page.on('pageerror')`
- 视觉改动要渲染出来看图，不要凭想象；测试"失败"先怀疑测试场景摆错了
- 性能怀疑回退时，先 `git stash` 回基线当场重测
```

**提需求时给 AI 的信息越具体越好：**

- ❌ "让机器好看点"
- ✅ "一级自动炮台太素了，加弹鼓/炮口制退器/瞄准镜；另外所有单位底部贴在黑背景上没有体积感"

**每轮需求控制在「一个主题」**：加内容 / 改手感 / 优化美术 / 做适配，混在一起会让回归范围失控。

---

## 附：本项目最终规模参考

| 指标 | 数值 |
| --- | --- |
| `game.js` | ~9,000 行 |
| `index.html` | ~580 行（含全部 CSS） |
| `worker.js` | ~105 行 |
| 己方单位 | 27 种 × 3 级造型 + 无限杂交组合 |
| 敌人 | 26 种（含 9 种远程、4 种融合 Boss） |
| 运行时依赖 | 0 |
| 图片资源 | 0 |
| 测试脚本 | 18 个 |
| 常规 FPS / 压力 FPS | 57 / 33 |
