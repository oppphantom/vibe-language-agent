# API 与数据契约（版本 1）

`shared/contract.js` 是歌词行及答案提交的运行时校验来源；本文说明其他对象的公开形状。时间一律用**整数毫秒**。未知起止时间用 `null`；已知开始、未知结束的最后一行可以保留，但不能启用「播完这一句自动暂停」。

| 对象 | 必需字段与含义 |
| --- | --- |
| `Song` | 稳定 `id`、`title`、`artist`、`language`、`version`、`durationMs`、`source`；离线样例还提供 `audio.available` 与原因。 |
| `LyricLine` | `id`、`songId`、`text`、`startMs`、`endMs`、`source`、`reviewStatus`（`original`、`verified`、`unverified`）。 |
| `PlaybackCapabilities` | `seek`、`lineLoop`、`speed`、`wordSeek` 布尔值及不支持时的 `reason`。 |
| `LearningTarget` | `expression`、`skill`、`evidenceLineIds`、`prerequisites`。 |
| `LessonNode` | `id`、`type`、`target`、`prompt`、`material`、`options`、`status`、`provenance`。 |
| `AnswerSubmission` | `sessionId`、`nodeId`、用于幂等的 `submissionId`、`choice`、`attempt`、`hintUsed`。 |
| `Feedback` | `verdict`、`explanation`、`errorType`、`evidenceLineIds`、`nextAction`、实际执行的 `toolLog`。 |
| `LearningSession` | `id`、`schemaVersion`、`mode`、`currentNodeId`、`route`、`history`、`progress`、`songId`。 |

正确选项索引和评分依据保存在服务端，不放进学习者收到的节点选项。模型地址由本机服务配置，接口不允许匿名转发到任意地址。

## 离线教学回合

```http
POST /api/sessions
Content-Type: application/json

{"songId":"demo-morning"}
```

创建后调用 `GET /api/sessions/{id}/node` 获取题面。提交答案的示例：

```json
{"sessionId":"会话 ID","nodeId":"demo-dasi","submissionId":"attempt-1","choice":1,"attempt":1,"hintUsed":false}
```

向 `POST /api/answers` 重复发送同一 `submissionId` 会返回同一结果，不会重复增加历史。答错时 `feedback.nextAction.type` 为 `remediate`，节点仍可作答。刷新网页后可通过 `GET /api/sessions/{id}` 读取进度；服务重启后当前内存会话会失效。

## 歌词与模型

- `POST /api/lyrics/search` 接收 `{"title":"...","artist":"...","durationMs":180000}`；只返回时长匹配的同步歌词。结果为 `unverified` 或 `no_matched_version`，找不到匹配版本时不提供冒充的歌词。
- `POST /api/agent/explain` 接收 `{"expression":"다시","lines":["..."]}`，仅在本机服务配置模型后可用；返回结果标记为「AI 生成，未人工核对」。

## Mac「音乐」本机桥接

- `GET /api/mac/status`：查看当前播放器状态。
- `GET /api/mac/library?artist=RIIZE`：列出本机资料库中匹配歌手的歌曲元信息。
- `POST /api/mac/play-line`：例如 `{"title":"Memories","artist":"RIIZE","startMs":5000,"endMs":8000}`。桥接会检查是否定位成功，并安排句末暂停。
- `POST /api/mac/discover`：例如 `{"artist":"RIIZE","expression":"다시"}`。返回文字命中、上下句、索引覆盖情况与来源失败数量；**不**判定韩语词形或语义差异。

这些 Mac 路由只在 macOS 可用。服务绑定 `127.0.0.1`，带 `Origin` 的浏览器请求必须来自当前本机页面。

错误统一表示为 `{"error":{"code":"INVALID_INPUT","message":"..."}}`，并使用合适的 HTTP 状态。工具日志只含工具名、状态与脱敏摘要，不包含模型隐藏推理。
