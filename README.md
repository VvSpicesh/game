# Nocturne Games

一个可长期扩展的纯前端小游戏项目（**PWA**：首次联网后可离线使用）。

## 目录

```text
nocturne-games/
├─ index.html
├─ manifest.webmanifest
├─ service-worker.js
├─ assets/icons/          # icon.svg / icon-192.png / icon-512.png
├─ shared/
│  ├─ base.css
│  ├─ app.js
│  └─ pwa.js              # SW 注册 · 更新条 · 离线 Toast
├─ chess/
├─ mahjong/
├─ scripts/               # verify / 规则单测 runner（无 npm）
├─ docs/
│  ├─ 00_project_handoff.md
│  ├─ 04_decisions.md
│  ├─ 05_next_tasks.md
│  ├─ test-results/
│  ├─ PWA.md
│  ├─ Nocturne_Games_Project_Guide.md
│  └─ …
└─ legacy/
```

## 本地启动

```bash
python -m http.server 8080
```

- 首页：http://localhost:8080/
- 国际象棋：http://localhost:8080/chess/
- 四川麻将：http://localhost:8080/mahjong/

Service Worker 需 **localhost** 或 **HTTPS**。

## 校验命令（verify）

本仓库**不使用 npm**。统一入口：

```bash
python scripts/verify.py
# Windows 也可：
pwsh -File scripts/verify.ps1
```

包含：关键文件 / SW precache 落盘检查 + 麻将 `rule-tests`（需 Node；PATH 或 Cursor 自带 node 均可）。

## PWA 要点

- 首次联网访问后，断网仍可打开大厅 / 象棋 / 麻将
- Android / iOS 可「添加到主屏幕」：见 [`docs/PWA.md`](docs/PWA.md)
- 清 Cache / Unregister SW 时 **不要**误清 Local Storage（牌局存档）
- 改 `service-worker.js` 预缓存时 bump `nocturne-games-vN`

## 换电脑继续开发

1. 拉取最新代码：
   ```bash
   git pull --rebase origin main
   ```
2. 依赖：安装 **Python 3**；建议安装 **Node.js LTS**（跑规则单测）。**不需要** `npm install`。
3. 运行检查：
   ```bash
   python scripts/verify.py
   ```
4. 打开 Cursor 后，先让 Agent / 自己阅读：
   - `docs/00_project_handoff.md`
   - `docs/04_decisions.md`
   - `docs/05_next_tasks.md`
   - `.cursor/rules/development-workflow.mdc`
   - `.cursor/rules/nocturne-games-guide.mdc`
5. 然后再开始 coding。

**注意：** Cursor 聊天记录不是项目长期记忆。需求、设计、决策、测试结果必须写入 Git 中的 `docs/` 与 `.cursor/rules/`。

## 当前状态

- Chess：Stable 可玩框架
- Mahjong：血战到底家庭大字版（约 v0.15.24）
- PWA：以 `service-worker.js` 内 `CACHE`（如 `nocturne-games-v115`）为准
- 长期规范：`docs/Nocturne_Games_Project_Guide.md`
- 交接：`docs/00_project_handoff.md`
