# Nocturne Games 开发规范（Project Engineering Guide）

Version: 1.1

## 1. 项目定位

Nocturne Games 是长期维护的游戏平台，而不是单一游戏。

目标：
- 长期维护
- GitHub Pages 直接运行
- 原生 HTML/CSS/JavaScript
- 手机、折叠屏、平板、电脑统一体验
- 老人模式友好
- **PWA：首次联网后可离线使用，可添加到主屏幕**

## 2. 推荐目录

    nocturne-games/
    ├── docs/
    │   ├── ROADMAP.md
    │   ├── PWA.md
    │   ├── RELEASE_NOTES.md
    ├── assets/icons/
    ├── shared/
    │   ├── base.css
    │   ├── app.js
    │   └── pwa.js
    ├── manifest.webmanifest
    ├── service-worker.js
    ├── mahjong/
    ├── chess/
    └── gomoku/

## 3. 分工

### ChatGPT

-   产品设计
-   游戏规则
-   架构设计
-   UX/UI 建议
-   Code Review
-   Cursor 开发任务设计

### Cursor

-   编码
-   Refactor
-   Bug 修复
-   CHANGELOG
-   ARCHITECTURE

### 项目负责人

-   决策
-   测试
-   Git 管理
-   发布

## 4. 技术原则

保持： - HTML - CSS - JavaScript ES Module

不要引入： - React - Vue - Angular - TypeScript - npm - 外部麻将库 -
Workbox / 外部 PWA 库 / 外链图标

## 5. 模块职责

-   game.js：规则、状态、AI
-   render.js：DOM、UI、动画
-   tiles.js：SVG 牌面
-   hu.js：胡牌算法
-   score.js：番型与计分（已接入家麻规则）
-   storage.js：本地存档
-   config.js：配置
-   shared/pwa.js：Service Worker 注册、更新条、离线 Toast
-   service-worker.js：预缓存与离线策略（根目录唯一 SW）

## 17. PWA

- 详述见 `docs/PWA.md`
- 注册：`shared/pwa.js` 内 `new URL("../service-worker.js", import.meta.url)`
- 改 SW 或预缓存清单时必须 bump `nocturne-games-vN`
- activate 只删旧 Cache Storage，永不清空 localStorage
- 更新仅提示，用户点击后再刷新；对局中不自动刷新

## 6. 开发流程

需求 → 设计(ChatGPT) → 实现(Cursor) → 测试 → 发布

## 7. Git

建议： - main - develop - feature/* - fix/*

一个 Commit 只做一个主题。

## 8. 文档

维护： - CHANGELOG.md - ARCHITECTURE.md - ROADMAP.md - TODO.md -
RELEASE_NOTES.md

## 9. Debug Mode

所有游戏提供本地调试模式。

麻将： - 七对 - 对对胡 - 抢杠胡 - 四杠 - 海底 - 多副露

国际象棋： - 将军 - 王车易位 - 吃过路兵 - 升变 - 残局

正式环境隐藏。

## 10. AI 规范

统一采用： 评估 → 打分 → 最高分方案。

## 11. UI 规范

公共能力放 shared： - Toast - Dialog - 飘字 - 动画 - 按钮风格

## 12. 配置

config.js 管理： - 动画速度 - AI 等级 - 老人模式 - 是否显示提示 - 牌尺寸

## 13. 老人模式

长期目标： - 大牌 - 大按钮 - 高对比 - 慢动画 - 自动提示

## 14. 大需求规则

超过约300行、修改数据结构、修改流程或新增模块时： Cursor 先输出： 1.
实现方案 2. 修改文件 3. 风险 4. 测试点 确认后再编码。

## 15. Cursor 输出

完成后输出： - 修改文件 - 修改内容 - 新增函数 - 流程变化 -
数据结构变化 - 测试建议 - 已知问题

## 16. 项目目标

坚持： - 可维护 - 可扩展 - 可测试 - 长期演进

优先级： 可读性 \> 可维护性 \> 扩展性 \> 功能数量
