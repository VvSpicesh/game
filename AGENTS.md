# Nocturne Games

本仓库为 **Nocturne Games** 游戏平台工作区。

## 长期开发规范（权威）

请始终遵守：

**[docs/Nocturne_Games_Project_Guide.md](docs/Nocturne_Games_Project_Guide.md)** · PWA：[`docs/PWA.md`](docs/PWA.md)

Cursor 已通过 `.cursor/rules/`（`alwaysApply`）加载：

- `nocturne-games-guide.mdc` — 工程约束
- `development-workflow.mdc` — 收工检查与跨会话交接

Guide / 工作流更新后，Agent 应重读文档并同步规则摘要，无需用户反复粘贴。

## 换电脑 / 新会话

先读：

1. [`docs/00_project_handoff.md`](docs/00_project_handoff.md)
2. [`docs/04_decisions.md`](docs/04_decisions.md)
3. [`docs/05_next_tasks.md`](docs/05_next_tasks.md)

再运行：`python scripts/verify.py`

**聊天记录不是项目记忆**；结论写入 `docs/`。

## 子项目文档

- 麻将：`mahjong/ARCHITECTURE.md`、`mahjong/CHANGELOG.md`
- 其他游戏目录见 Guide 推荐结构（chess / gomoku / shared 等）
