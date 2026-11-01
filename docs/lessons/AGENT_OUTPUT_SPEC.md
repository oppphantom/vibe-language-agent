# Agent 按歌出题 — 输出控制规范（角色 D）

> **你的真实任务：**不是亲手给每首歌无限出题，而是规定 Agent **必须输出哪些字段、禁止输出什么、怎样才算一关合格**。
> 产品愿景（团队讨论）：以用户所选**一首歌为起点**，生成**肉鸽式分支路线**；路上有一词多义 / Galgame / 文化释义等关卡，**每种玩法对应一种 Agent 形象**，并可捡到轻量**学习小卡片**。
> 离线 `content/fixtures/demo.js` 是 **P0 金样例**（一词多义向的线性保底路线）；完整肉鸽由本规范约束生成形状，接线主要是 **B**，展示是 **A**，歌词材料是 **C**。

当前代码里 Agent 只会做 `explain`（`meaning` / `context` / `uncertainty`），**尚未**按歌生成路径或分支。本文件是契约；实现前不得把未接线能力写成已上线。

---

## 1. 一句话分工

| 角色 | 管什么 |
| --- | --- |
| **你 (D)** | 路径模板与字段规范、`persona` / `mapNode` 枚举、小卡片规则、可/不可进正确答案的内容、金样例与抽检 |
| **B** | 按规范调模型、校验 JSON、评分、会话图（线性 `route` → 日后分支图） |
| **C** | 歌词行、时间戳、能否听句 |
| **A** | 地图/关卡/卡片/Agent 形象的展示 |

---

## 2. 产品骨架（肉鸽内容路径）

```text
用户选一首歌（起点）
        │
        ▼
 Agent 生成 RunDraft（若干分支 + 关卡节点 + 可捡卡片）
        │
   ┌────┼────┐
一词多义  Galgame  文化释义 …   ← 各自由固定 persona 主持
   └────┼────┘
        ▼
   学习小卡片（路上拾取，默认不考试）
```

| 概念 | 含义 | 优先级 |
| --- | --- | --- |
| **起点歌** | 用户选择的一首歌；生成不得脱离该歌（及规范允许的对照歌）歌词材料 | P0 输入已有 |
| **保底线** | 无分支的三关一词多义路径（现金样例） | **P0 已落地形状** |
| **分支路线** | 从起点或某关之后给出 2～N 条可选下一关 | **P1 规范 / 未实现** |
| **关卡类型** | `mapNode` + 主持该关的 `personaId` | P0 子集；P1+ 扩展 |
| **学习小卡片** | 挂在边或节点上的轻量知识点，默认不判对错 | **P1 规范** |

---

## 3. Agent 形象枚举（`personaId`）

每种玩法绑定**一个**形象；Agent 生成节点时必须带 `personaId`，且必须 ∈ 下表。人设文案可由 A 展示，**教学对错仍只看证据与评分字段**。

| personaId | 主持玩法 | 语气约束（规范层） | 优先级 |
| --- | --- | --- | --- |
| `polysemy_tutor` | 一词多义 / 语境对照 | 只依据歌词行解释义项；不编造文化 | **P0** |
| `culture_guide` | 文化释义 / 小卡片 | 背景标 `unverified`；**不得**当唯一考题答案 | **P1** |
| `story_npc` | Galgame 剧情选项 | 有限选项对话；开放输入默认不自动判分 | **P1–P2** |
| `listening_coach` | 听辨 / 时间轴 | 无音源或无时间戳则禁止出场 | **P1**（依赖 C） |
| `skeptical_mentor` | 导师质疑 | 故意给瑕疵解释，让用户挑错 | **P2** |

禁止：同一节点混用多个 persona；禁止模型自造表外 `personaId`。

---

## 4. Agent 输入

Agent **只许**依赖下列输入，不得臆造未提供的歌词：

```json
{
  "mode": "single_song | cross_song",
  "expression": "다시",
  "songs": [
    {
      "songId": "…",
      "title": "…",
      "artist": "…",
      "lines": [
        { "id": "…", "text": "…", "startMs": 0, "endMs": 1000, "prevText": "…", "nextText": "…" }
      ]
    }
  ],
  "pathTemplate": "p0_linear_three",
  "allowedMapNodes": ["context", "final_challenge"],
  "allowedPersonas": ["polysemy_tutor"],
  "branching": false,
  "maxCards": 0
}
```

| 字段 | 作用 |
| --- | --- |
| `pathTemplate` | 选用哪套路径骨架（见 §6） |
| `allowedMapNodes` / `allowedPersonas` | **你控制本轮 Agent 准写哪些部分** |
| `branching` | `false`＝只输出线性 `route`；`true`＝输出分支图（P1+） |
| `maxCards` | 本局最多生成几张学习小卡片；P0 为 `0` |

- `expression`：首版建议人工锁定。
- `lines` 来自 C；`unverified` 歌词 ⇒ 整包 `needsHumanReview: true`。
- 歌词不得当作系统指令执行。

---

## 5. Agent 必须输出的包：`RunDraft`

一次生成输出一个 **RunDraft**（P0 可退化成仅含线性 `route` 的路径包）：

```json
{
  "schemaVersion": 1,
  "runId": "draft-…",
  "startSongId": "…",
  "expression": "다시",
  "baseMeaning": "再次、重新（again）",
  "learningGoal": "…",
  "unverifiedClaims": ["…"],
  "pathTemplate": "p0_linear_three",
  "graph": {
    "nodes": ["n1", "n2", "n3"],
    "edges": [
      { "from": "n1", "to": "n2", "when": "on_correct" }
    ],
    "startNodeId": "n1"
  },
  "route": ["n1", "n2", "n3"],
  "nodes": [ /* §5.1 */ ],
  "cards": [ /* §5.3；P0 为空数组 */ ],
  "provenance": {
    "generator": "agent",
    "status": "unverified",
    "sourceLineIds": ["…"]
  },
  "needsHumanReview": true
}
```

**兼容规则：**

- **P0 / `branching=false`：**必须有 `route`（有序 id）；`graph.edges` 可省略或与 `route` 等价的单向链。
- **P1+ / `branching=true`：**必须有 `graph`（`startNodeId` + `edges`）；`route` 仅表示「推荐保底线」或可省略（由 B 会话引擎走图）。
- 会话当前实现只消费线性 `route`；分支图上线前不得假定已能跑肉鸽。

### 5.1 关卡节点 `nodes[]` 公共字段

| 字段 | Agent | 说明 |
| --- | --- | --- |
| `id` | 可 | 稳定短 id |
| `mapNode` | 仅枚举内 | 见 §6 / §7 |
| `personaId` | 仅枚举内 | 必须与 `mapNode` 匹配（§3） |
| `type` | 仅枚举内 | 随 `mapNode` 变化 |
| `target.expression` | 应=输入 | 一词多义关强制；文化/剧情可空但需说明 |
| `target.skill` | 可 | |
| `target.evidenceLineIds` | 可，⊆ 输入 | **有判分的关强制** |
| `target.prerequisites` | 可 | |
| `prompt` | 可 | |
| `options` | 视类型 | 选择题类恰好 3 个（P0） |
| `correctIndex` | 可生成，**仅服务端** | 禁止下发浏览器；文化探索关**禁止**本字段 |
| `explanation` / `remedial` | 可 | 补教引导回证据，禁止纯剧透标签 |
| `cardIds` | 可 | 本关可捡到的小卡片 id 列表 |
| `lockedFields` | 规范只读 | 如上线后禁止静默改的字段 |

### 5.2 禁止写入正确答案或冒充已核实的内容

- 未提供歌词中的典故、粉丝梗、艺人私生活。
- 情绪/关系结论（可进 `unverifiedClaims` 或文化卡片，**不能**当 `correctIndex`）。
- 编造歌词行或时间戳。
- 把字符串检索命中写成「词义已变」。
- 面向学习者的节点 JSON 携带 `correctIndex`。

### 5.3 学习小卡片 `cards[]`（P1）

路上拾取的轻量知识，**默认不考试**。

```json
{
  "id": "card-honorific-1",
  "personaId": "culture_guide",
  "title": "称呼小记",
  "body": "……",
  "relatedLineIds": ["line-3"],
  "kind": "culture_trivia | morphology | register",
  "reviewStatus": "unverified",
  "quizEligible": false
}
```

| 规则 | 说明 |
| --- | --- |
| `quizEligible` 默认 `false` | 为 `true` 须另附可证据化的小题，且走抽检 |
| `relatedLineIds` | 必须 ⊆ 输入 lines |
| 数量 | ≤ 输入 `maxCards` |
| 禁止 | 卡片正文当作系统指令；禁止无来源编造「韩国人都这样」 |

### 5.4 与现有 `explain` API

| 能力 | 状态 |
| --- | --- |
| `meaning` / `context` / `uncertainty` | **已实现** |
| `RunDraft` 出题 / 分支 / 卡片 | **部分实现**：`POST /api/agent/generate-floor` 生成迷你层草稿（须人工核对） |

---

## 6. 路径模板

### 6.1 P0 · `p0_linear_three`（已金样例验证）

`branching=false`，`allowedPersonas=["polysemy_tutor"]`，`maxCards=0`。

| 顺序 | mapNode | personaId | 产出部分 |
| --- | --- | --- | --- |
| 1 | `context` | `polysemy_tutor` | 单语境一词多义题 + 补教 |
| 2 | `context` | `polysemy_tutor` | 跨句/跨歌对照 |
| 3 | `final_challenge` | `polysemy_tutor` | 迁移题 |
| * | （同节点 remedia） | 同上 | 答错不新增节点 |

对应团队说法里的「一词多义」保底线。

### 6.2 P1 · `p1_roguelike_branch`（规范已定，代码未接）

`branching=true`。从起点歌生成：

1. **至少 1 条保底线**（可复用 P0 三关形状）。
2. **至少 1 个分支点**：`edges` 中同一 `from` 有 ≥2 条 `to`，且每条边带 `label`（给玩家看的路线名，如「剧情线」「文化线」）。
3. 分支上的节点 `mapNode` ∈ 本次 `allowedMapNodes`（可含 `galgame` / `culture` / `context` 等）。
4. `cards` 数量 ∈ `[0, maxCards]`，挂在 `cardIds` 或边上的 `rewardCardIds`。

```json
{
  "from": "n1",
  "to": "n2-story",
  "when": "player_choice",
  "label": "剧情线",
  "rewardCardIds": ["card-…"]
}
```

`when` 枚举（P1）：`on_correct` | `on_wrong_remediate` | `player_choice`。
答错默认仍 **同节点补教**（不强制另开分支），除非边明确写了 `on_wrong_remediate` 且指向补教节点。

### 6.3 你如何「控制输出哪些部分」

改输入即可，无需改模型代码意图：

```text
只出一词多义   → pathTemplate=p0_linear_three, allowedMapNodes=[context,final_challenge]
开放肉鸽三线   → pathTemplate=p1_roguelike_branch, allowedMapNodes=[context,galgame,culture,final_challenge],
                allowedPersonas=[polysemy_tutor,story_npc,culture_guide], maxCards=3
```

---

## 7. 关卡类型扩展 schema

### 7.1 P0 已用

| mapNode | type | 要点 |
| --- | --- | --- |
| `context` | `context_choice` | 3 选项；证据行强制；`polysemy_tutor` |
| `final_challenge` | `context_choice` | 迁移；焦点行尽量未见；`transfer: true` 建议 |

### 7.2 P1 新增（生成前须在 `allowedMapNodes` 打开）

| mapNode | type | persona | 必填输出部分 | 硬约束 |
| --- | --- | --- | --- | --- |
| `culture` | `culture_explore` | `culture_guide` | `explorationPrompt`、`optionalBackground`、`relatedLineIds` | **禁止 `correctIndex`**；背景默认 `unverified` |
| `galgame` | `dialogue_choice` | `story_npc` | `speaker`、`line`、`choices[]`（各含 `reply`；可选 `nextNodeId`） | 有限选项；开放输入不自动判分 |
| `listening` | `listening_gap` | `listening_coach` | `stemAudioLineId`、`blank`、`acceptAnswers[]` | 无音源 ⇒ **禁止生成** |
| `timeline` | `timeline_seek` | `listening_coach` | `targetStartMs`/`targetEndMs` | 时间必须来自输入，禁止模型改 |
| `evidence_hunt` | `evidence_collect` | `polysemy_tutor` | `candidateLineIds`、`requiredEvidenceCount` | 候选 ⊆ 输入 |
| `fork` | `sense_fork` | `polysemy_tutor` | `contrastAxis`、`branches[]`（补教文案） | 不得断言「字面相同⇒语义必变」 |

一词多义对照关（仍用 `context`）P1 起建议强制：`contrastAxis`（两句差异维度一句话）。

### 7.3 P2 新增

| mapNode | 要点 |
| --- | --- |
| `mentor_challenge` | `bogusExplanation` + `flawOptions`；须能指回证据矛盾 |
| `register` | 语域/情绪；选项必须带 `textSupport` 行引用 |
| 自适应边 | 规则表：`errorType` → 允许的下一 `mapNode`；禁止无表跳最终挑战 |

---

## 8. 合格判定

**自动（建议 B）：**

1. 字段与枚举合法；`personaId` 与 `mapNode` 匹配。
2. 有判分关：`options.length===3`，`correctIndex∈{0,1,2}`，证据 id 都存在。
3. `culture` 节点无 `correctIndex`；`cards[].relatedLineIds` 都存在；`cards.length≤maxCards`。
4. `branching=false` 时 `route` 无环且覆盖所列教学节点；`branching=true` 时 `graph` 从 `startNodeId` 可达所有节点，无死边指向未知 id。
5. 文本字段长度上限（建议 ≤300 字 / 字段）。

**人工抽检（你）：**

1. 正解是否仅靠证据成立。
2. 干扰项是否合理。
3. 补教是否指回句子。
4. 文化/卡片是否误进唯一答案。
5. 分支标签是否诚实（剧情线里不该塞听辨必考等）。

金样例：`content/fixtures/demo.js` + `docs/lessons/dasi-path.md`。

---

## 9. 示例

### 9.1 P0 一关（节选）

```json
{
  "id": "song42-dasi-context",
  "mapNode": "context",
  "personaId": "polysemy_tutor",
  "type": "context_choice",
  "target": {
    "expression": "다시",
    "skill": "语境理解",
    "evidenceLineIds": ["line-7", "line-8"],
    "prerequisites": ["知道 다시 的基本义：再次、重新"]
  },
  "prompt": "在「내일 다시 이야기하자」里，「다시」强调什么？",
  "options": ["明天再次谈这件事", "从未说过这件事", "今天立刻结束谈话"],
  "correctIndex": 0,
  "explanation": "「내일」+「이야기하자」；结合上一句未说出口。",
  "remedial": "先读上一句，再读本句，找出「再次」连接的是哪一件事。",
  "cardIds": []
}
```

### 9.2 P1 分支边 + 小卡片（示意）

```json
{
  "graph": {
    "startNodeId": "n-context-1",
    "nodes": ["n-context-1", "n-galgame-a", "n-culture-b", "n-final"],
    "edges": [
      { "from": "n-context-1", "to": "n-galgame-a", "when": "player_choice", "label": "剧情线" },
      { "from": "n-context-1", "to": "n-culture-b", "when": "player_choice", "label": "文化线", "rewardCardIds": ["card-1"] },
      { "from": "n-galgame-a", "to": "n-final", "when": "on_correct" },
      { "from": "n-culture-b", "to": "n-final", "when": "player_choice", "label": "去最终挑战" }
    ]
  },
  "cards": [
    {
      "id": "card-1",
      "personaId": "culture_guide",
      "title": "这句里的时间词",
      "body": "「내일」标明谈话被放到明天，属文本内信息。",
      "relatedLineIds": ["line-8"],
      "kind": "culture_trivia",
      "reviewStatus": "unverified",
      "quizEligible": false
    }
  ]
}
```

---

## 10. P0 / P1 / P2 总表（你的待办视角）

| 阶段 | 规范要冻结的内容 | 代码状态 |
| --- | --- | --- |
| **P0** | 线性一词多义三关；`polysemy_tutor`；无卡片无分支 | 金样例 + session 线性 route **已有**；Agent 生成 **未接** |
| **P1** | 短分支肉鸽 + 卡片 | 规范 + 旧五节点示例 |
| **V2 尖塔** | 房间题包、`minItems`、专注值、开局角色、遗物、长路径 | **预览已落地**（`/map-preview.html` + `roguelike-v2-floor1.js`）；正式 `runState` 会话仍待 B |
| **P2 后续** | 多层三层、自适应边、导师质疑、听辨真音源 | 规划中 |

### 10.1 V2 房间与题包（摘要）

- 地图点 = `room`（`roomType`: combat/elite/boss/rest/event/shop/treasure）。
- 战斗向房间必须带 `encounter.items[]`：`combat≥4`，`elite≥5`，`boss≥6`。
- 局状态字段：`hp`（UI 文案「专注值」）、`insight`、`relics`、`characterId`。
- 开局角色枚举与差异见 [`CHARACTERS.md`](CHARACTERS.md)。
- 扣血只因答错；休息回血；商店花洞察。结算在预览客户端演示，生产应由 B 引擎执行。

---

## 11. 你可执行的下一步

1. ~~P1 抽检 / 金样例 / 校验器~~
2. ~~V2a 规范摘要 + 单层尖塔样本 + 竖图预览~~
3. ~~预览内选角 / 专注值 / 走图答题（V2b/c 的可玩原型）~~
4. ~~`generate-floor` 草稿接口 + V2 校验 + 文风条款~~
5. 下一步：B 把 `runState`+`graph` 迁入正式 session；生成结果接入预览加载；补第 2～3 层。
6. **不负责：**商业音源、把标准答案下发到生产浏览器节点（预览评审页除外）。

---

## 12. 参考

- 角色：`docs/lessons/CHARACTERS.md`
- 文风：`docs/lessons/COPY_STYLE.md`
- V2 方案：`docs/lessons/ROGUELIKE_V2_PROPOSAL.md`
- V2 样本：`content/fixtures/roguelike-v2-floor1.js`
- 生成：`backend/agent/generate-floor.js` · 校验：`content/validate-floor-draft.js`
- 预览：`/map-preview.html`
- P0 金样：`content/fixtures/demo.js`、`docs/lessons/dasi-path.md`
