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
├─ docs/
│  ├─ PWA.md              # 安装 / 清缓存 / 测试步骤
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

## PWA 要点

- 首次联网访问后，断网仍可打开大厅 / 象棋 / 麻将
- Android / iOS 可「添加到主屏幕」：见 [`docs/PWA.md`](docs/PWA.md)
- 清 Cache / Unregister SW 时 **不要**误清 Local Storage（牌局存档）
- 改 `service-worker.js` 预缓存时 bump `nocturne-games-vN`

## 当前状态

- Chess：Stable 可玩框架
- Mahjong：血战到底家庭大字版（持续迭代）
- PWA：`nocturne-games-v2`
- 长期规范：`docs/Nocturne_Games_Project_Guide.md`
