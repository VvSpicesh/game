# Roadmap

当前基线：大厅 + Chess Stable + Mahjong 家庭版 v0.14.0（计分）+ **PWA 离线（nocturne-games-v3）**。

## Done recently

- PWA：manifest、根目录 Service Worker、添加到主屏幕、离线大厅/象棋/麻将
- 文档：`docs/PWA.md`、`docs/RELEASE_NOTES.md`
- Mahjong：`score.js` 接入（起始 20000、一番一分、自摸加一番、杠分、终局总结、侧栏、用眼提示）

## Near term

### Chess

1. AI：更深搜索 + 开局库（仍放在 `js/ai.js`）
2. Debug Mode 场景入口（仅 localhost）

### Mahjong

1. 更完整四川番种表 / 不封顶选项 UI
2. 将 `game.js` 内联 AI 迁入 `ai.js`
3. Debug Mode 场景扩充（七对 / 抢杠 / 多副露等）

### Platform

1. `shared/` 统一 Dialog / Toast / 飘字 API（与麻将自有 Toast 对齐）
2. PWA：缓存清单自动化检查脚本（防漏文件）

## Mid term

- 统一设置与音效偏好（可落在 `shared/`）
- 移动端触控与横竖屏体验细化
- gomoku 子项目骨架

## Out of scope

- 引入 React / Vue / npm / Workbox
- 删除 `legacy/`（保留作备份直到确认稳定）
