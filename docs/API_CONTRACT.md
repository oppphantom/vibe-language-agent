# API 与数据契约（版本 2）

`shared/contract.js` 是歌曲、歌词行及答案提交的运行时校验来源，`shared/languages.js` 是 `ko`、`ja`、`zh` 语言代码的唯一注册表。本文说明其他对象的公开形状。时间一律用**整数毫秒**。未知起止时间用 `null`；已知开始、未知结束的最后一行可以保留，但不能启用「播完这一句自动暂停」。

| 对象 | 必需字段与含义 |
| --- | --- |
| `Song` | 稳定 `id`、`title`、`artist`、`language`（`ko` / `ja` / `zh`）、`languageLabel`、`version`、`durationMs`、`source`；离线样例还提供 `audio.available` 与原因。 |
| `LyricLine` | `id`、`songId`、`text`、`startMs`、`endMs`、`source`、`reviewStatus`（`original`、`verified`、`unverified`）。 |
| `PlaybackCapabilities` | `seek`、`lineLoop`、`speed`、`wordSeek` 布尔值及不支持时的 `reason`。 |
| `LearningTarget` | `expression`、`skill`、`evidenceLineIds`、`prerequisites`。 |
| `LessonNode` | `id`、`type`、`interaction`、`persona`、`stage`、`title`、`language`、`languageLabel`、`target`、`material`、`status`、`provenance`、`room`、`teaching`；`map` 含 Agent 决定的动态关卡路线，`edges` 含公开连边。 |
| `AnswerSubmission` | `sessionId`、`nodeId`、用于幂等的 `submissionId`、`choice`、`attempt`、`hintUsed`。 |
| `Feedback` | `verdict`、`explanation`、`errorType`、`evidenceLineIds`、`nextAction`、实际执行的 `toolLog`。 |
| `LearningSession` | `id`、`schemaVersion`、`mode`、`status`、`language`、`languageLabel`、`currentNodeId`、`route`、`history`、`progress`、`mastery`、`game`、`songId`。 |

正确选项索引、评分依据和补教条件保存在服务端，不放进学习者收到的节点或地图。模型地址由本机服务配置，接口不允许匿名转发到任意地址。
`mode` 为 `offline_demo` 或 `ai_generated`。后者只表示课程由本机配置模型生成并通过结构校验，不表示语言内容已人工核对。

## 离线教学回合

`GET /api/songs` 返回 `songs`、`lines`、`languages` 和来源说明。`languages` 当前为韩语 `ko`、日语 `ja`、中文 `zh`。网页操作界面保持中文，语言字段表示学习目标语言。

```http
POST /api/sessions
Content-Type: application/json

{"songId":"demo-morning"}
```

韩语、日语和中文各有一套原创知识内容。真实歌曲由专用地下城 Agent 决定 2–5 个普通关卡、每关可验证的教学包和每张地图的 note/npc/card 组合，系统再固定追加“串词成句”终关，因此公开地图通常包含 3–6 个节点。

创建后调用 `GET /api/sessions/{id}/node` 获取当前 19×9 ASCII 房间、角色位置、任务、符号图例和公开地图。

每关先进入服务端控制的教学状态机。`teaching.phase` 依次为 `brief`（目标与选材理由）、`reading`（词块、读音与基本义）、`context`（整句翻译、歌曲语境与文化说明）、`check`（带提示的三选一检查）和 `ready`（允许进入地图）。继续教学使用：

```json
{"sessionId":"会话 ID","nodeId":"当前节点 ID","submissionId":"幂等教学 ID","action":"continue"}
```

引导检查使用同一 `POST /api/teach`，提交 `{"action":"answer","choice":0}`。答错会回到 `reading` 并提供补救说明，答对才进入 `ready`。公开响应不会返回 `correctIndex` 或评分解释；未进入 `ready` 时调用移动接口会返回 `409 TEACHING_REQUIRED`。相同 `submissionId` 不会重复记录教学尝试。固定课程使用人工编写的读音、基本义和整句翻译；AI 课程的每个拆读词块必须逐字存在于引用歌词行，语义内容仍明确标为“AI 生成，未人工核对”。

新学习页面使用 `POST /api/moves`：

```json
{"sessionId":"会话 ID","nodeId":"当前房间节点 ID","submissionId":"幂等移动 ID","direction":"up"}
```

`direction` 只允许 `up`、`down`、`left`、`right`。响应包含本次 `event`、`session`、新 `node`、完整 `map` 和 `edges`。踩到 `♪`、`?`、`✦` 或终局单字会自动触发对象；墙体、旧房间、已完成会话和非法方向由服务端处理。相同 `submissionId` 原样返回，不会重复移动、经验或卡片。

碰到 `♪` 或 `?` 时，响应 `event.type` 为 `challenge`，房间进入 `pending`，移动暂停。提交三选一答案使用：

```json
{"sessionId":"会话 ID","nodeId":"房间节点 ID","submissionId":"幂等答题 ID","choice":0}
```

接口为 `POST /api/respond`。答错保留挑战并返回补教；答对后对应对象消失、移动恢复。碰到 `✦` 时响应 `event.type` 为 `card`，包含 `term`、`reading`、`meaning`、`usage`、`example` 和 `lineId`，卡片同时进入 `session.game.cards`。

旧 `/api/answers` 暂时保留用于兼容；它只能在房间存在 `pending` 挑战时提交选择，不能用于移动或领取知识卡。示例：

```json
{"sessionId":"会话 ID","nodeId":"demo-dasi-listen","submissionId":"attempt-1","choice":1,"attempt":1,"hintUsed":false}
```

向 `/api/answers` 或 `/api/respond` 重复发送同一 `submissionId` 会返回同一结果，不会重复增加经验。答错时保留当前题目；答对后对象消失并恢复移动。提交已经离开的节点会返回 `409 STALE_NODE`，完成整轮后提交新答案会返回 `409 ALREADY_COMPLETED`。

当前游戏公开 `interaction` 为 `dungeon` 或 `final`。地图节点状态为 `locked`、`active` 或 `completed`。

`session.game` 包含经验、连续首次答对次数、已获得知识卡和本轮路线。卡片正文只在获得后公开；关卡节点的 `reward` 仅提供标题和类型预览。
`session.route` 是实际走过的路线，`session.progress.total` 等于 Agent 决定的普通关卡数加最终关。节点的 `room` 提供 9 行、每行 19 个字符的 `tiles`、同尺寸 `cells` 类型矩阵、目标说明、收集进度、已拼字符前缀、循环歌词 ID、待答题状态和回合数。最终关的 `charObjects` 直接提供地图位置与原始单字，不提供数字编号或完整顺序答案；位置由 Agent 给出的 `scatterSeed` 打乱。玩家、噪声精灵和收集状态只保存在服务端会话中。

`session.mastery` 汇总服务端实际记录的尝试、错误和提示使用情况。技能状态为 `new`、`needs_review`、`practicing` 或 `mastered`；客户端传入的 `attempt` 只作展示，不用于评分或掌握判断。刷新网页后可通过 `GET /api/sessions/{id}` 读取进度；服务重启后当前内存会话会失效。

公开普通关卡 `type` 为 `level`，最终关为 `final`。前端以 `interaction` 和 `room` 决定舞台表现。当前版本不提供语音评分、逐词时间戳或大世界自由移动；AI 课程仍明确为未人工核对。

## 歌词与模型

- `POST /api/lyrics/search` 接收 `{"title":"...","artist":"...","durationMs":180000,"language":"ko|ja|zh"}`；`language` 省略时为韩语，可由用户显式选择日语或中文，服务不会声称自动识别语言。可带 `album`、`providerId` 缩小到对应版本，只返回标题、歌手、时长及已提供专辑匹配的同步歌词。`provider:"netease"` 时优先读取网易云对应歌曲 ID 的同步歌词；`provider:"qqmusic"` 时使用导入歌单携带的 song MID，或根据 macOS 本机 QQ 曲目 ID 查找歌曲 MID，再从 QQ 歌词接口读取逐行时间戳，失败才尝试 LRCLIB。`providerId` 指定用户在列表选中的版本。其他来源从 LRCLIB 匹配。结果为 `unverified` 或 `no_matched_version`，找不到匹配版本时不提供冒充的歌词。
- `POST /api/agent/explain` 接收 `{"expression":"また","language":"ja","lines":["..."]}`，仅在本机服务配置模型后可用；`language` 省略时为韩语。返回结果标记为「AI 生成，未人工核对」，并回显规范化后的 `language` 和 `languageLabel`。
- `POST /api/agent/plan` 接收同步歌词检索结果中的 `song`、`lines` 和 `language`。服务端要求至少四行歌词，先校验知识节点，再由专用地下城 Agent 根据歌曲特征决定 2–5 个普通关卡、教学包、布局和 note/npc/card 实体组合，并固定追加串词成句关。每个教学包必须包含证据行、学习目标、选材理由、读音词块、整句翻译、歌曲语境、文化说明和带解释的三选一引导检查。只有这些字段以及歌词引用、答案、知识卡和字符顺序全部通过校验后才返回 `courseId`；公开响应不包含答案键或隐藏题库。

网页使用异步生成任务避免单个 HTTP 请求长时间悬空：

- `POST /api/agent/plan-jobs` 接收与 `/api/agent/plan` 相同的课程材料，立即返回 `202`、任务 `id`、`status` 和 `phase`。
- `GET /api/agent/plan-jobs/{id}` 返回当前真实阶段：`queued`、`analyzing_lyrics`、`generating_teaching`、`designing_dungeon`、`completed` 或 `failed`。
- `completed` 时响应含 `result`，形状与同步规划接口一致；`failed` 时含脱敏后的 `error`。
- 课程规划和地下城生成两次模型调用的单次超时均为 120 秒。任务只在本机内存保存两小时；当前页面会持续轮询，服务重启或刷新页面后不会自动恢复正在显示的任务。

`POST /api/sessions` 兼容两种开始方式：

```json
{"songId":"demo-morning"}
```

```json
{"courseId":"AI 规划接口返回的服务端课程 ID"}
```

动态 AI 课程保存在当前 Node 进程内存中，默认 2 小时过期；课程、歌词片段和学习会话都不会写入仓库或持久化文件。服务重启后动态课程与会话失效，因此不能把真实歌曲课程链接当作长期资源。

完成全部关卡后可调用 `POST /api/sessions/{id}/restart`：

- 只有 `completed` 会话允许重开，否则返回 `409 RUN_INCOMPLETE`。
- AI 课程会重新调用地下城 Agent，生成新的普通关卡、布局、音符/NPC/知识卡组合和字符散布。
- 离线课程会重新组装新会话，但不保留旧进度、经验或卡片。
- 返回新会话和新节点，旧会话保持完成状态不变，浏览器切换到新的 `session.id`。
- 同一完成会话的并发重开请求复用同一个生成 Promise，不会重复发起 plan；前端在请求完成前也会锁定所有交互。

## Mac「音乐」本机桥接

- `GET /api/mac/status`：查看当前播放器状态。
- `GET /api/mac/library?artist=RIIZE&language=ja`：列出本机资料库中匹配歌手的歌曲元信息，并给当前学习语言标记；`artist` 留空时列出整个 Mac「音乐」资料库，`language` 省略时为 `ko`。
- `POST /api/mac/play-line`：例如 `{"title":"Memories","artist":"RIIZE","startMs":5000,"endMs":8000}`。桥接会检查是否定位成功，并安排句末暂停。
- `POST /api/mac/discover`：例如 `{"artist":"RIIZE","expression":"また","language":"ja"}`。返回文字命中、上下句、索引覆盖情况与来源失败数量；`language` 省略时为 `ko`。表达可来自所选目标语言，但该接口**不**判定词形或语义差异。

这些 Mac 路由只在 macOS 可用。服务绑定 `127.0.0.1`，带 `Origin` 的浏览器请求必须来自当前本机页面。

## QQ 音乐与网易云音乐当前歌曲桥接

- `GET /api/player/status?source=qqmusic` 或 `source=netease`：读取系统媒体状态和当前曲目；`running` 表示所选软件是系统当前播放来源。
- `POST /api/player/play-line`：例如 `{"source":"netease","title":"Honestly","artist":"RIIZE","album":"Get A Guitar","durationMs":194000,"startMs":50000,"endMs":52000}`。仅控制当前歌曲；先核对播放来源、歌名、歌手，以及提供的专辑和时长，再暂停、定位、播放，并安排句末暂停。系统状态读取偶发失败时会有限次重试。
- `POST /api/player/control`：`source` 为 `qqmusic` 或 `netease`，`action` 为 `play`、`pause` 或 `jump`；跳转时另传 `seconds`。可带 `album`、`durationMs` 核对同名歌曲的版本。只控制已核对的当前歌曲，跳转后继续播放。
- `GET /api/netease/search?q=RIIZE%20Love%20119`：从网易云公开歌曲目录返回候选歌曲 ID、歌名、歌手和时长，供用户核对版本、预览歌词；搜索结果未人工核对。
- `GET /api/netease/library`：在 macOS 或 Windows 从当前用户网易云客户端的本地缓存只读提取歌曲列表，仅返回歌曲 ID、歌名、歌手、专辑和时长。缓存可能不完整，不等于账号全部歌曲；不返回数据库原始 JSON 或账号字段。
- `GET /api/qq/library`：仅在 macOS 从当前用户 QQ 音乐客户端的 `qqmusic.sqlite` 只读提取已缓存的歌曲列表，仅返回歌曲 ID、歌名、歌手、专辑和时长。缓存可能不完整；不返回文件路径或账号字段。
- `GET /api/qq/playlist?value=歌单链接或ID`：分页读取 QQ 音乐公开分享歌单，返回歌单名称和完整歌曲元数据。歌曲带数字 ID、song MID、歌单 ID 和顺序；不接收 Cookie，也不读取私密歌单。
- `GET /api/netease/playlists`：仅在 Windows 只读读取当前用户的 `webdb.dat` 与 `playingList`，返回歌单名称和最少歌曲元数据。不会返回文件路径、数据库原始 JSON 或账号信息。
- `POST /api/player/open-track`：仅在 Windows 接受 `{"source":"qqmusic|netease","song":{"id":"...","playlistId":"...","trackIndex":0}}`。QQ 使用数字歌曲 ID 调用客户端原生命令；网易云使用歌单 ID 与歌曲位置在本机页面中定位语义行并调用播放器。浏览器不能提交可执行脚本或任意命令行参数。

macOS 桥接需要 `nowplaying-cli`。Windows QQ 使用系统媒体会话和客户端原生命令；Windows 网易云需要用 `--remote-debugging-port=9222` 启动客户端，端口只绑定 `127.0.0.1`。状态中的播放进度可能滞后，因此 QQ 的 `positionReliable` 和 `playbackStateReliable` 仍为 `false`。Windows 可按经过校验的数字歌曲 ID 点播，但不会读取私密远端账号资料。

`POST /api/player/queue-step` 接受 `source`、`direction`（`next` / `previous`）、当前歌曲的 `title` 与 `artist`，也可传 `album`、`durationMs` 核对当前版本。它仅切换客户端现有播放队列中的相邻歌曲；返回新歌曲元数据前，桥接会核对系统播放来源与歌曲信息确实变化。返回的歌曲保留系统上报的专辑名，供同步歌词版本匹配。同名同版本连续出现时无法可靠区分，会返回未确认错误。网页收到新曲目后重新检索同步歌词。

网易云搜索结果提供“复制网易云播放地址”。地址格式为 `orpheus://` 加 Base64 编码的 `{"type":"song","id":"歌曲 ID","cmd":"play"}`。QQ 本机歌曲列表提供 `qqmusicmac://cmd_count==1&&cmd_0==playsong&&id_0==歌曲ID` 地址；字段与命令来自本机已安装客户端的只读分析。用户在这台电脑上分别验证：把两种地址手动粘贴到浏览器地址栏并回车，可令对应客户端切歌播放；QQ 返回网页后还自动识别新曲目并载入同步歌词。歌曲卡片另外提供一个需用户主动点击的客户端协议链接；用户已验证在 Safari 点击 QQ 或网易云链接，均可直接切歌、回到网页载入同步歌词并逐句播放至句末暂停。当前内置浏览器点击客户端专用链接已实测未切歌。用户回到网页时，前端在聚焦或标签页重新可见时读取系统当前曲目，核对歌名、歌手、时长及可用的专辑名；匹配时保留歌曲 ID 并载入同步歌词，不匹配则明确提示实际播放的歌曲。仍可手动点“连接当前音乐来源”。这些客户端私有协议可能随版本改变。

错误统一表示为 `{"error":{"code":"INVALID_INPUT","message":"..."}}`，并使用合适的 HTTP 状态。业务错误包括 `INVALID_INPUT`（400）、`NOT_FOUND`（404）、`STALE_NODE`（409）、`ALREADY_COMPLETED`（409）、`RUN_INCOMPLETE`（409）、`TEACHING_REQUIRED`（409）、`TEACHING_STATE`（409）、`MODEL_UNAVAILABLE`（503）、`MODEL_UPSTREAM`（502）、`MODEL_OUTPUT`（502）、`MODEL_CONFIG`（500）和 `COURSE_INVALID`（500）。工具日志只含工具名、状态与脱敏摘要，不包含模型隐藏推理。
