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

- `POST /api/lyrics/search` 接收 `{"title":"...","artist":"...","durationMs":180000}`；可带 `album`、`providerId` 缩小到对应版本，只返回标题、歌手、时长及已提供专辑匹配的同步歌词。`provider:"netease"` 时优先读取网易云对应歌曲 ID 的同步歌词；`provider:"qqmusic"` 时先根据本机 QQ 曲目 ID 查歌曲 MID，从 QQ 歌词接口读取逐行时间戳，失败才尝试 LRCLIB。`providerId` 指定用户在列表选中的版本。其他来源从 LRCLIB 匹配。结果为 `unverified` 或 `no_matched_version`，找不到匹配版本时不提供冒充的歌词。
- `POST /api/agent/explain` 接收 `{"expression":"다시","lines":["..."]}`，仅在本机服务配置模型后可用；返回结果标记为「AI 生成，未人工核对」。

## Mac「音乐」本机桥接

- `GET /api/mac/status`：查看当前播放器状态。
- `GET /api/mac/library?artist=RIIZE`：列出本机资料库中匹配歌手的歌曲元信息。
- `POST /api/mac/play-line`：例如 `{"title":"Memories","artist":"RIIZE","startMs":5000,"endMs":8000}`。桥接会检查是否定位成功，并安排句末暂停。
- `POST /api/mac/discover`：例如 `{"artist":"RIIZE","expression":"다시"}`。返回文字命中、上下句、索引覆盖情况与来源失败数量；**不**判定韩语词形或语义差异。

这些 Mac 路由只在 macOS 可用。服务绑定 `127.0.0.1`，带 `Origin` 的浏览器请求必须来自当前本机页面。

## QQ 音乐与网易云音乐当前歌曲桥接

- `GET /api/player/status?source=qqmusic` 或 `source=netease`：读取系统媒体状态和当前曲目；`running` 表示所选软件是系统当前播放来源。
- `POST /api/player/play-line`：例如 `{"source":"netease","title":"Honestly","artist":"RIIZE","album":"Get A Guitar","durationMs":194000,"startMs":50000,"endMs":52000}`。仅控制当前歌曲；先核对播放来源、歌名、歌手，以及提供的专辑和时长，再暂停、定位、播放，并安排句末暂停。系统状态读取偶发失败时会有限次重试。
- `POST /api/player/control`：`source` 为 `qqmusic` 或 `netease`，`action` 为 `play`、`pause` 或 `jump`；跳转时另传 `seconds`。可带 `album`、`durationMs` 核对同名歌曲的版本。只控制已核对的当前歌曲，跳转后继续播放。
- `GET /api/netease/search?q=RIIZE%20Love%20119`：从网易云公开歌曲目录返回候选歌曲 ID、歌名、歌手和时长，供用户核对版本、预览歌词；搜索结果未人工核对。
- `GET /api/netease/library`：仅在 macOS 从当前用户网易云客户端的本地 SQLite 缓存只读提取歌曲列表，仅返回歌曲 ID、歌名、歌手、专辑和时长。缓存可能不完整，不等于账号全部歌曲；不返回数据库原始 JSON、歌单 ID 或账号字段。
- `GET /api/qq/library`：仅在 macOS 从当前用户 QQ 音乐客户端的 `qqmusic.sqlite` 只读提取已缓存的歌曲列表，仅返回歌曲 ID、歌名、歌手、专辑和时长。缓存可能不完整；不返回文件路径或账号字段。

此桥接需要 macOS 和 `nowplaying-cli`。状态中的播放进度由客户端向系统发布，可能滞后；实测 QQ 音乐暂停后仍长期上报旧进度与播放状态，因此 `positionReliable` 和 `playbackStateReliable` 都标为 `false`。句末暂停使用本机计时，因此存在少量偏差。它不读取 QQ 音乐或网易云音乐的完整资料库，也不能按歌名任意指定并切换歌曲。

`POST /api/player/queue-step` 接受 `source`、`direction`（`next` / `previous`）、当前歌曲的 `title` 与 `artist`，也可传 `album`、`durationMs` 核对当前版本。它仅切换客户端现有播放队列中的相邻歌曲；返回新歌曲元数据前，桥接会核对系统播放来源与歌曲信息确实变化。返回的歌曲保留系统上报的专辑名，供同步歌词版本匹配。同名同版本连续出现时无法可靠区分，会返回未确认错误。网页收到新曲目后重新检索同步歌词。

网易云搜索结果提供“复制网易云播放地址”。地址格式为 `orpheus://` 加 Base64 编码的 `{"type":"song","id":"歌曲 ID","cmd":"play"}`。QQ 本机歌曲列表提供 `qqmusicmac://cmd_count==1&&cmd_0==playsong&&id_0==歌曲ID` 地址；字段与命令来自本机已安装客户端的只读分析。用户在这台电脑上分别验证：把两种地址手动粘贴到浏览器地址栏并回车，可令对应客户端切歌播放；QQ 返回网页后还自动识别新曲目并载入同步歌词。歌曲卡片另外提供一个需用户主动点击的客户端协议链接；用户已验证在 Safari 点击 QQ 或网易云链接，均可直接切歌、回到网页载入同步歌词并逐句播放至句末暂停。当前内置浏览器点击客户端专用链接已实测未切歌。用户回到网页时，前端在聚焦或标签页重新可见时读取系统当前曲目，核对歌名、歌手、时长及可用的专辑名；匹配时保留歌曲 ID 并载入同步歌词，不匹配则明确提示实际播放的歌曲。仍可手动点“连接当前音乐来源”。这些客户端私有协议可能随版本改变。

错误统一表示为 `{"error":{"code":"INVALID_INPUT","message":"..."}}`，并使用合适的 HTTP 状态。工具日志只含工具名、状态与脱敏摘要，不包含模型隐藏推理。
