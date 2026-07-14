# Nocturne Mahjong — Architecture

四川麻将（血战到底）前端模块。原生 HTML / CSS / ES Module，GitHub Pages 直开即用。

## 文件职责

### `index.html`
入口页面：牌桌 DOM 结构、规则开关、换三张 / 胡牌 / 终局弹窗、右侧分数栏、缓存版本号 `?v=`。

### `style.css`
布局与视觉：四家座位带、副露轨、弃牌区、操作坞、弹窗、分数栏、老人模式大字与响应式断点。

### `game.js`
负责：
- 游戏规则与阶段机（大厅 → 开局掷骰发牌 → 换三张 → 摸牌 → 反应 → 出牌 → 血战续打 → 终局）
- 状态创建 / 提交 / 兼容校验
- 轮流坐庄与开局动画编排
- 碰、杠、胡、抢杠、一炮多响
- 调用 `score.js` 即时结算（胡 / 刮风下雨）
- 会话用眼提示（连续 2 小时）
- 简易 AI（选打、认碰认杠）
- localhost 规则测试场景

不直接拼麻将 SVG；UI 通过 `render.js` 刷新。

### `render.js`
负责：
- DOM 刷新（手牌、副露、弃牌、状态栏、分数栏、日志、庄家角标）
- 开局掷骰 / 发牌遮罩动画
- 操作坞反应按钮（含牌面 SVG）
- 非阻塞飘字（碰 / 杠 / 胡 + 分数）
- 胡牌弹窗（含番数分）、终局战况总结弹窗
- 换三张选牌 UI

不改游戏规则状态机（除按钮回调触发的动作）。

### `tiles.js`
负责：
- 牌名文案
- 万 / 条 / 筒 SVG 牌面

### `hu.js`
负责：
- 胡牌判定与基础番型信息（`getWinInfo`）
- 七对、对对胡等轻量规则标签

### `score.js`
负责：
- 起始分 / 一番一分 / 番种累加（含自摸加一番）
- 自摸 / 点炮 / 抢杠 / 明暗补杠结算
- 会话总分持久化（独立 key，跨局保留；允许负分）
- 连续游玩 2 小时用眼提示时钟

### `storage.js`
负责：
- `localStorage` 存读清牌局状态

### `config.js`
负责：
- 规则开关持久化（换三张、刮风下雨）
- 上一局庄家座位持久化（轮流坐庄）

## 运行时状态（概要）

```
state
├── version          // 存档兼容标记（当前 "0.10"）
├── phase            // 准备 | 开局 | 换三张 | 摸牌 | 出牌 | 等待操作 | 结束
├── dealer           // 庄家座位 0-3
├── dealing          // 开局发牌动画中
├── wall[]           // { s, n, id }
├── players[4]       // { name, hand[], melds[], won }
├── turn
├── discards[]       // { player, tile }
├── lastDiscard
├── lastAction
├── pendingGang
├── drawnTileId
├── selectedTileIndex
├── activeRules      // { exchangeThree, gangRain }
├── scores[4]        // 总分（可负；会话级持久化）
├── roundDelta[4]    // 本局累计得失
├── scoreLog[]       // 短流水（侧栏）
└── logs[]
```

座位索引：`0` 自己（下） / `1` 上家（左） / `2` 对家（上） / `3` 下家（右）。

## 协作与文档约定

- **小改动**（CSS / UI 微调 / Bug / 动画 / 小功能 / AI 参数）：直接改代码，不另生文档。
- **大改动**（大模块、多新 js、数据结构、流程变更、职责重划、~300+ 行重构）：同步更新本文件与 `CHANGELOG.md`。
- 每次有意义版本发布：在 `CHANGELOG.md` 记一页以内条目。
- 技术栈锁定：原生 HTML/CSS/JS Module；禁止 React/Vue/npm/TS/外部麻将库。

## 预留扩展

| 模块 | 用途 |
|------|------|
| `ai.js` | 从 `game.js` 拆出更复杂 AI |
