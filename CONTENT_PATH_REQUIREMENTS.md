# 具体内容路径设计 — 需求文档（角色 D）

> 依据仓库根目录与 `docs/` 中现有约定整理：`README.md`、`CONTRIBUTING.md`、`AGENTS.md`、`docs/ROADMAP.md`、`docs/ARCHITECTURE.md`、`docs/API_CONTRACT.md`、`docs/MIGRATION_AUDIT.md`，以及当前实现 `content/fixtures/demo.js`、`backend/agent/session.js`。
> 负责人：教学内容 / 具体内容路径设计（四人分工中的 **D**）。
> 文档版本：2026-10-26（P0 三节点路径已落地）。

---

## 1. 背景与目标

项目以歌曲为入口做韩语语境学习，当前优先验证：**听原声 → 读歌词 → 比较语境 → 获得学习反馈**。离线教学演示以「다시」跨语境样例为入口。

**本角色目标（校正后）：**产品上最终是 **Agent 根据每首歌（组）出题**；你负责的是**控制 Agent 输出哪些部分**——字段规范、路径模板、禁止项、合格标准——并用离线金样例验收形状。你不是长期手写全曲库的出题机器。

- **规范正文：**[`docs/lessons/AGENT_OUTPUT_SPEC.md`](docs/lessons/AGENT_OUTPUT_SPEC.md)
- **P1 抽检：**[`docs/lessons/P1_CHECKLIST.md`](docs/lessons/P1_CHECKLIST.md)
- **金样例：**`content/fixtures/demo.js`（P0 三关 + P1 预备字段）+ `docs/lessons/dasi-path.md`
- **校验器：**`content/validate-run-draft.js`；肉鸽示例（未接线）`content/fixtures/roguelike-draft.example.json`
- **接线实现：**主要由 B 按规范调模型与校验；你维护规范与抽检。

一首歌可视为一张**内容小地图**：你规定地图上允许出现哪些节点类型；Agent 只在允许集合内填充题干/选项/补教。P0 允许：语境关、同节点补教、最终挑战。

---

## 2. 职责边界（四人分工）

| 角色 | 范围 | 与本角色的关系 |
| --- | --- | --- |
| **A 前端** | 对照阅读、播放状态、窄屏答题与重试 UI | 消费你定义的题面、证据行、补教文案；你不改视觉实现，但需保证字段够用、文案可展示 |
| **B Agent/API** | 会话、评分、幂等、持久化、模型解释 | 消费你定义的节点、`route`、标准答案与补教；改契约时双方同步 |
| **C 媒体播放** | 歌词来源、定位、暂停、多端播放桥接 | 你不负责桥接；若路径依赖「听句」，需标明对起止时间 / 音源可用性的要求 |
| **D 内容路径（你）** | Agent 出题输出规范、路径模板、金样例、抽检标准 | 规定「按歌出题」必须/禁止输出的字段；教学结论与规范变更由你核对 |

跨目录改动正常；若动 `shared/contract.js`、公开 API 字段，须同步文档与测试，并通知 A/B/C。

**明确不做（产品能力）：**真实大地图 UI、语音评分、多 Agent、影视/综艺检索；不把 Discover 的连续字符命中当成词义结论；不提交商业歌词全文、音频、个人资料库或密钥。

---

## 3. 现状基线（P0 已落地）

| 对象 | 现状 |
| --- | --- |
| 演示歌 | `demo-morning`、`demo-return`、`demo-retry`（原创，无音源） |
| 证据句 | 带 `startMs`/`endMs`，`reviewStatus: original` |
| 课节节点 | 三题 `context_choice`：`demo-dasi` → `demo-dasi-contrast` → `demo-dasi-final` |
| 路径 | `route` 长度 3；答错同节点 `remediate`；答对推进；末关完成后 `currentNodeId = null` |
| 评分 | 服务端 `correctIndex`；不下发浏览器 |
| 说明文档 | `docs/lessons/dasi-path.md`、`docs/lessons/trial-log.md` |

---

## 3.1 内容地图与肉鸽愿景

产品方向：用户选**一首歌为起点** → Agent 生成**分支路线（肉鸽）** → 关卡含一词多义 / Galgame / 文化释义等 → **每种玩法绑定一种 Agent 形象** → 路上可捡**学习小卡片**。完整字段与开关见 [`docs/lessons/AGENT_OUTPUT_SPEC.md`](docs/lessons/AGENT_OUTPUT_SPEC.md)。

**P0 已落地（保底线）：**线性一词多义三关 + 同节点补教（无分支、无卡片、单一 `polysemy_tutor`）。

| 地图节点 | 玩法 | 默认 persona | 优先级 |
| --- | --- | --- | --- |
| **语境关（一词多义）** | 跨句/跨歌用法选择 | `polysemy_tutor` | **P0** |
| **休息点（同节点补教）** | 答错引导回证据 | 同当前关 | **P0** |
| **最终挑战** | 迁移题 | `polysemy_tutor` | **P0** |
| 肉鸽分支边 | 同一关后多条 `player_choice` 路线 | — | **P1 规范** |
| 学习小卡片 | 轻量知识，默认不考试 | `culture_guide` 等 | **P1 规范** |
| 文化释义关 | 探索背景；禁止绑死 `correctIndex` | `culture_guide` | P1 |
| Galgame 剧情关 | 有限选项对话 | `story_npc` | P1–P2 |
| 听辨 / 时间轴 | 听句、定位 | `listening_coach` | P1（依赖 C） |
| 易混分叉 / 证据搜集 | 语义岔路、收集证据 | `polysemy_tutor` | P1 |
| 导师质疑 / 语域 | 挑错解释、语气 | `skeptical_mentor` 等 | P2 |

你通过输入里的 `pathTemplate` / `allowedMapNodes` / `allowedPersonas` / `maxCards` / `branching` **控制 Agent 本轮准输出哪些部分**。

---

## 4. 用户故事与成功标准

### 4.1 学习者（离线演示）

1. 选择原创样例歌后，能按路径完成「看语境 → 作答 → 答错补教 → 重试 → 答对推进下一关 → 最终挑战」。
2. 能看清：本关学什么、证据在哪几句、干扰项为何错。
3. 刷新页面后，在会话仍有效时进度一致（磁盘持久化由 B 负责；节点 ID 与 route 稳定可恢复）。

### 4.2 协作者 / 评审

1. 任意一关都能追溯：学习目标、基础义、证据来源与核对状态、选项依据、补教逻辑。
2. 至少完成一次试用记录（设计者自测已写入 `docs/lessons/trial-log.md`；同伴试用可追加）。

### 4.3 路线图对本角色的硬验收

> 设计并核对下一组原创韩语跨语境样例：有来源、学习目标、选项依据、补教提示与一次真实学习者试用记录。

---

## 5. 功能需求

### 5.1 内容路径（Content Path）

| ID | 需求 | 优先级 | P0 状态 |
| --- | --- | --- | --- |
| CP-01 | 完整 `route`：起点、同节点补教分支、终点 | P0 | 已实现 |
| CP-02 | 每节点含 id/type/target/prompt/options/补教与答对推进 | P0 | 已实现 |
| CP-03 | 跨 ≥2 段原创语境对照 | P0 | 已实现 |
| CP-04 | `prerequisites` 声明完整 | P0 | 已实现 |
| CP-05 | 扩展题型规划 | P1 | 见节点目录 |
| CP-06 | 人工锁定字段 vs 可替换字段标注 | P2 | 待做 |

### 5.2 教学内容样例（Fixtures）

| ID | 需求 | 优先级 | P0 状态 |
| --- | --- | --- | --- |
| CT-01 | 增强原创跨语境样例 | P0 | 已实现（三关 + 第三样例歌） |
| CT-02 | 行级 source / reviewStatus / 毫秒时间 | P0 | 已实现 |
| CT-03 | 正误依据、干扰项说明、补教 | P0 | 见 dasi-path.md |
| CT-04 | `audio.available` 诚实声明 | P0 | 已实现 |
| CT-05 | 未证实推断不进唯一正确答案 | P0 | 已实现 |
| CT-06 | 词形核对清单 | P1 | 待做 |

### 5.3 来源、评测与协作交付

| ID | 需求 | 优先级 | P0 状态 |
| --- | --- | --- | --- |
| EV-01 | 路径说明文档 | P0 | `docs/lessons/dasi-path.md` |
| EV-02 | 试用记录 | P0 | `docs/lessons/trial-log.md`（含设计者自测；同伴试用可追加） |
| EV-03 | 不提交未授权真实歌词 | P0 | 遵守中 |
| EV-04 | 契约与测试同步 | P0 | session / API / smoke |
| EV-05 | check + smoke | P0 | 合并前必跑 |

---

## 6. 内容与数据规格（对接现有契约）

- `Song` / `LyricLine` / `LearningTarget` / `LessonNode` / `Feedback` / `LearningSession`
- 时间：整数毫秒；选项索引与评分只在服务端
- `LessonNode.provenance`：标明「非实时 Agent 生成」
- `Feedback.nextAction`：`remediate`（不推进）| `continue`（推进或完成）
- `LearningSession.route`：有序节点 id；`progress.total = route.length`；`progress.completed` 为已答对关数

落地：

```text
content/fixtures/demo.js     # songs、lines、lessons、route
docs/lessons/dasi-path.md    # 教学设计
docs/lessons/trial-log.md    # 试用记录
```

---

## 7. 非功能与合规约束

1. **原创与许可：**入库文本为原创教学文本；禁止商业歌曲完整歌词/音视频。
2. **演示与真实分离：**fixture 不得标成实时 Agent 生成。
3. **隐私：**不提交个人学习原始记录或密钥。
4. **可审查：**教学结论可回溯到证据行 ID。
5. **最小依赖：**不引入新 npm 运行依赖。

---

## 8. 交付物清单

| 交付物 | 说明 | 验收参照 |
| --- | --- | --- |
| 路径设计说明 | `docs/lessons/dasi-path.md` | CP-01～04 |
| 原创样例数据 | `content/fixtures/demo.js` 三节点 | CT-01～04 |
| 命题与补教说明 | 写入 dasi-path | EV-01 |
| 试用记录 | `docs/lessons/trial-log.md` | EV-02 |
| 可运行路径 | session + 前端多关推进 | EV-04～05 |

---

## 9. 任务拆解

### P0（本轮）

1. ~~盘点并扩展「다시」为三节点路径~~
2. ~~编写对照关与最终挑战原创句~~
3. ~~session 多节点推进 + 前端进关~~
4. ~~dasi-path / trial-log + check/smoke~~

### 随后（P1–P2，规范见 AGENT_OUTPUT_SPEC）

1. 冻结肉鸽分支图 + 小卡片 JSON，等 B 接 `graph` 会话。
2. 打开 `culture` / `galgame` / 听辨等 `allowedMapNodes` 并补抽检表。
3. 词形声明、`contrastAxis`、自适应边表（P2）。

---

## 10. 验收检查表（P0）

- [x] 存在可描述的完整内容路径（三关线性 + 同节点补教）
- [x] 增强的原创跨语境样例可加载
- [x] 每题具备目标、证据行、选项依据、补教
- [x] 来源与 `reviewStatus` 完整；无商业歌词全文
- [x] 未证实推断未写入唯一正确答案
- [x] 有脱敏试用记录（设计者自测；同伴试用可追加）
- [x] `npm run check`、`npm run smoke` 通过
- [x] 标准答案未下发浏览器；API 文档已同步多节点说明

---

## 11. 风险与依赖

| 风险/依赖 | 应对 |
| --- | --- |
| 无音源时听句不可用 | P0 不依赖听辨；样例声明 `audio.available: false` |
| 语义主观争议 | 正确答案只绑定可从文本推出的用法 |
| 同伴试用未完成 | 模板已就绪，不阻塞 P0 代码验收 |

---

## 12. 参考索引

| 文档/代码 | 用途 |
| --- | --- |
| `docs/ROADMAP.md` | D 的认领任务 |
| `docs/lessons/dasi-path.md` | 「다시」路径设计 |
| `docs/lessons/trial-log.md` | 试用记录 |
| `docs/API_CONTRACT.md` | 多节点 session 字段 |
| `content/fixtures/demo.js` | 样例与 route |
| `backend/agent/session.js` | 路径推进 |
| `AGENTS.md` | fixture 约定 |
