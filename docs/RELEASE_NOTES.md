# RELEASE NOTES

## Mahjong v0.14.15

Service Worker 缓存：`nocturne-games-v18`

### 修改
- 顶栏增加「← 返回游戏大厅」，可回到站点主页

---

## Mahjong v0.14.14（评分与桌面打磨）

Service Worker 缓存：`nocturne-games-v17`

### 新增 / 重要功能
- **计分**：起始 20000、一番一分、自摸加一番；允许负分；侧栏分数；终局战况总结；2 小时用眼提示
- **胡牌**：弹窗放大显示胡牌图；桌面赢家手牌最右明牌胡张
- **暗杠**：他家全牌背；自家末张明牌
- **PWA**：离线 / 安装 / 更新条（见下）

### 体验
- 座位名：自己瑞、上家安彬、对家兰儿、下家小诺
- 布局：副露 / 弃牌 / 侧栏高度 / 点炮文案等多项打磨
- 明杠显示为「杠」；一炮多响结算修复

详见 `mahjong/CHANGELOG.md`。

---

## nocturne-games-v1（PWA）

### 新增
- Progressive Web App：`manifest.webmanifest` + `service-worker.js` + `shared/pwa.js`
- 本地图标：`assets/icons/icon.svg`、`icon-192.png`、`icon-512.png`
- 离线可打开大厅、国际象棋、四川麻将
- 顶栏「发现新版本，刷新后更新」+ Toast 离线/恢复提示
- 文档：`docs/PWA.md`

### 说明
- 存档仍使用 localStorage；升级 SW 不会清空牌局
- 不引入 npm / Workbox / 外部依赖
