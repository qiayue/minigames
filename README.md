# ⚙️ 机械防线 · 盲盒塔防

一个部署在 **Cloudflare Workers** 上的网页小游戏。玩法类似《植物大战僵尸》：
开盲盒随机抽出各种防御机器，布置在战场上，抵挡一波波废铁机器人的进攻——
大嘴花变成了**碎纸机**，豌豆射手变成了**自动炮台**。

打开网页即玩，无需安装，支持电脑和手机触屏。

![游戏截图](docs/screenshot.png)

## 🎮 玩法

- **🎁 开盲盒**：花 50⚡ 能量随机抽一台机器（普通 58% / 稀有 30% / 史诗 12%，连续 4 次普通后必出稀有以上）
- **🏗️ 布防**：点选卡槽里的卡片，再点击战场空格部署；🔧 可拆除已放置的机器
- **⚡ 能量**：点击天上掉落的电池收集能量，能量发电机也会定期产电
- **🛡️ 目标**：守住 10 波进攻，别让机器人冲进左侧基地；通关后可挑战无尽模式

### 机器图鉴

| 机器 | 稀有度 | 作用 |
| --- | --- | --- |
| 自动炮台 | 普通 | 向前方持续发射能量弹（豌豆射手） |
| 能量发电机 | 普通 | 每 7 秒产出 25 能量（向日葵） |
| 装甲路障 | 普通 | 高耐久，把敌人挡在身前（坚果墙） |
| 碎纸机 | 稀有 | 把靠近的机器人整个粉碎，随后冷却（大嘴花） |
| 冷冻风扇 | 稀有 | 冰弹攻击并大幅减速敌人（寒冰射手） |
| 特斯拉线圈 | 史诗 | 闪电链同时打击本行多个敌人 |
| 火箭发射井 | 史诗 | 敌人进入本行时发射火箭贯穿全行（一次性） |

敌人有四种：废铁机器人、装甲机器人、疾速无人机、重型碾压车（Boss 级）。

## 📁 项目结构

```
├── public/            # 静态页面（游戏本体，纯 Canvas，无外部依赖）
│   ├── index.html
│   └── game.js
├── src/
│   └── worker.js      # Cloudflare Worker：/api/* 排行榜接口 + 静态资源托管
├── wrangler.jsonc     # Workers 配置
└── package.json
```

## 🚀 部署到 Cloudflare Workers

### 方式一：GitHub 自动部署（推荐）

1. 打开 [Cloudflare 控制台](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Workers** → **Connect to Git**
2. 选择本仓库，构建配置保持默认（部署命令 `npx wrangler deploy`）
3. 完成后每次 push 到默认分支都会自动构建部署

### 方式二：命令行手动部署

```bash
npm install
npx wrangler login
npm run deploy
```

### 本地开发

```bash
npm install
npm run dev     # http://localhost:8787
```

## 🏆 可选：启用云端排行榜

游戏默认可玩，排行榜数据存在浏览器本地。想让所有玩家共享排行榜，需要绑定一个 KV 命名空间：

```bash
npx wrangler kv namespace create SCORES
```

把命令输出的 `id` 填入 `wrangler.jsonc` 底部的 `kv_namespaces` 配置并取消注释，
重新部署即可。接口说明：

- `GET /api/scores` — 返回前 20 名
- `POST /api/scores` — 提交成绩 `{ name, score, wave }`
- `GET /api/health` — 健康检查（`storage` 字段显示是否已启用 KV）

## 🛠️ 技术说明

- 前端：原生 JavaScript + Canvas 2D，所有画面均为程序绘制，零图片资源、零依赖、单页即玩
- 音效：WebAudio 实时合成（可静音）
- 后端：Cloudflare Worker 处理 `/api/*`，其余请求走 [Workers 静态资源](https://developers.cloudflare.com/workers/static-assets/)
- 排行榜：Workers KV（未配置时前端自动退回 localStorage）
