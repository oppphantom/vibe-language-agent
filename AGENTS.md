# 给后续 Codex 的项目约定

- 在仓库根目录执行 `npm ci`、`npm run check`、`npm run smoke`；网页用 `npm start` 启动。项目使用 Node.js 内置模块，不要无故引入框架或依赖。
- `shared/contract.js` 是运行时数据契约。修改公开字段时同步更新 `docs/API_CONTRACT.md`、后端校验和测试。
- 浏览器交互放在 `frontend/`；教学状态与答案留在 `backend/agent/`；歌词、来源和播放适配放在 `backend/media/`。
- `content/fixtures/demo.js` 是原创固定样例，不能标成实时 Agent 生成。外部歌词和模型解释都要标注来源与核对状态。
- 不提交 `.env`、真实密钥、个人音乐资料库、商业歌曲音视频、完整歌词缓存、日志或个人学习记录。
- Mac 桥接只能在本机回环地址运行，只接受预定义动作和经过校验的参数；不能接收可执行脚本文本。
- 工具日志只记录真实执行结果与脱敏摘要；不要伪造工具调用或公开模型隐藏推理。
- 当前私有仓库不能启用强制分支保护；依照 `CONTRIBUTING.md` 的 PR 与 CI 团队约定协作。
