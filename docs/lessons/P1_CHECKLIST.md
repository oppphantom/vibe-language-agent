# P1 抽检与字段冻结清单（角色 D）

在打开肉鸽分支 / 文化 / Galgame / 小卡片之前，先用本表约束 Agent 输出。
完整契约见 [`AGENT_OUTPUT_SPEC.md`](AGENT_OUTPUT_SPEC.md)。金样例已带 P1 预备字段：`personaId`、`contrastAxis`、`morphologyNote`、`transfer`。

---

## A. 词形声明（morphology）

凡一词多义 / 对照 / 证据搜集关，Agent 输出（或金样例）应含：

```json
"morphologyNote": "本关依据连续字符命中「다시」，未做韩语词形分析；命中≠义项已变。"
```

| 抽检 | 通过标准 |
| --- | --- |
| [ ] | 未把 Discover/字符串检索写成「词义一定不同」 |
| [ ] | 若无法做词形分析，`morphologyNote` 明确承认局限 |
| [ ] | 正解仍只靠证据句，不靠词形术语唬人 |

---

## B. 跨语境对照轴（contrastAxis）

`mapNode=context` 且证据来自 **≥2 句（建议跨歌）** 时 **必填**：

```json
"contrastAxis": "再次的事件类型：再试走路 vs 再谈未说完的话"
```

| 抽检 | 通过标准 |
| --- | --- |
| [ ] | 一句话点出两句差异维度（事件/对象/时间…） |
| [ ] | 未声称「字面相同 ⇒ 语义必变」 |
| [ ] | `evidenceLineIds` 至少覆盖对照双方 |

金样：`demo-dasi-contrast` 已含 `contrastAxis`。

---

## C. 肉鸽分支（生成前开关）

仅当输入 `branching=true` 且 `pathTemplate=p1_roguelike_branch` 时检查：

| 抽检 | 通过标准 |
| --- | --- |
| [ ] | 存在保底线（可复用 P0 三关） |
| [ ] | 至少一处 `from` 对应 ≥2 条 `player_choice` 边 |
| [ ] | 每条边有诚实 `label`（剧情线/文化线…） |
| [ ] | 边与节点 id 均可解析；无指向未知节点 |

**当前仓库：会话引擎仍只跑线性 `route`，分支图勿当已上线。**

---

## D. 学习小卡片

| 抽检 | 通过标准 |
| --- | --- |
| [ ] | `cards.length ≤ maxCards` |
| [ ] | `relatedLineIds` ⊆ 输入歌词 |
| [ ] | `quizEligible` 默认 false；为 true 须另有可证据小题 |
| [ ] | 卡片未充当系统指令；文化断言标 `unverified` |

---

## E. 文化关 / Galgame（允许枚举打开后）

| 类型 | 必须有 | 禁止 |
| --- | --- | --- |
| `culture` | `explorationPrompt`、`relatedLineIds`、`personaId=culture_guide` | `correctIndex` |
| `galgame` | `speaker`、`line`、`choices[]`、`personaId=story_npc` | 开放输入自动判分（P2 前） |

---

## F. 与 B / A / C 的交接

| 交给谁 | 内容 |
| --- | --- |
| B | `content/validate-run-draft.js` 的 P0 校验可复用；分支 `graph` 校验待 session 支持后扩展 |
| A | `personaId`、`mapNode`、`contrastAxis`、`morphologyNote` 已在节点 API 中可下发（无标准答案） |
| C | 听辨/时间轴关仍须音源与时间戳；无则禁止生成 |

自测命令：`npm run check`（含 RunDraft 金样校验）。
