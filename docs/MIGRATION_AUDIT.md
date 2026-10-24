# 原型迁移审查（2026-10-24）

旧原型位于 `../riize-clip-prototype/`，在父级 Git 工作区中是未跟踪目录。它通过 Node.js 的 `server.js` 在 `127.0.0.1:8766` 提供页面，启动时还会编译 `ocr.swift`。新项目迁移时使用 Node.js 24.11.1，仅用内置模块，通过 `npm start` 在 8767 端口单独运行。没有复制旧 `.git` 历史；旧目录及旧服务均未被覆盖或停止。

| 能力 | 旧位置 | 新位置与处理方式 | 验证结果与限制 |
| --- | --- | --- | --- |
| LRCLIB 歌词检索、时长匹配、LRC 时间戳 | `vibe-data.js` | `backend/media/lyrics.js`，整理后迁入 | 已用离线测试检查解析与版本不匹配；真实 LRCLIB 不在 CI 中调用。未迁入完整歌词缓存。 |
| 本机资料库歌曲匹配 | `vibe-data.js`、`music-bridge.js` | `backend/media/mac-music.js`、`backend/media/library-index.js`、`frontend/music.js` | 本机曾读到 18 首 RIIZE 歌曲；CI 不依赖个人资料库，仓库也未复制其内容。 |
| 本地音频逐句播放、循环、变速 | `vibe.html` | `frontend/app.js`，整理后迁入 | 浏览器文件选择与时间边界已实现；未附带音频，成员需使用有权使用的本地文件。 |
| Mac「音乐」定位与句末暂停 | `music-bridge.js` | `backend/media/mac-music.js`，隔离为 macOS 路由 | 本机《Memories》5–8 秒片段成功定位，在约 8.06 秒暂停；尚未验证所有歌曲版本与长期稳定性。 |
| 模型调用与输出结构校验 | `vibe-study-agent.js`、`vibe-detective-agent.js` | `backend/agent/model.js`，收窄为可选解释 | 支持本机环境变量配置与结构检查；真实外部密钥及提供方未在 CI 测试，尚无完整自适应教学。 |
| 两歌教学样例 | `vibe-analysis.js`、`vibe-detective-agent.js` | `content/fixtures/demo.js`，改写为原创文本 | 旧案例涉及商业歌词，只复用了教学结构；新样例明确标为原创、固定内容。 |
| 学习状态与反馈 | `vibe-study-ui.js` 和内存回合数据 | `backend/agent/session.js`，整理后迁入 | 答错补教、重试和重复提交已测试；服务重启后的持久化待做。 |
| Discover 跨歌曲文字检索 | `vibe-data.js`、`vibe.html` | `backend/media/library-index.js`、`frontend/music.js` | 本机 18 首 RIIZE 歌中 14 首匹配到歌词，3 首来源请求失败，1 首版本未匹配；「다시」在 4 首歌中出现 5 处。文字命中不代表词义不同。 |
| OCR 与视频画面采集 | `server.js`、`ocr.swift`、`frames/` | 暂缓 | 本次项目以歌曲为核心，未复制个人采集画面。 |
| 其他平台与旧页面 | `korean.html`、`synced.html` 等 | 暂缓 | 尚未逐项迁入；旧原型仍可供项目发起人在本机对照。 |

## 敏感信息与素材检查

旧 `data/lyric-cache/` 含批量外部歌词；旧 `data/`、`frames/` 含学习或视频采集结果；旧 `audio/`、`word-audio/` 和截图的分发权限尚不明确。这些内容均未复制到新仓库。旧网页曾允许在请求中填写 API Key，新项目改为服务端环境变量读取。迁移时对相关源码做过只输出命中文件名的密钥模式检查，未发现字面密钥；这**不等于**完成了旧 Git 历史的全部凭据审计。没有有意复制个人路径、账户资料或音乐资料库导出。每次向 GitHub 推送前仍须审查本次暂存与提交内容。
