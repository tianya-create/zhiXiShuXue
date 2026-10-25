# 智析数学认知心理双层自适应机制开发文档

> 文档版本：V2.0 最终需求基线  
> 适用项目：智析数学初中数学智能学情分析网页系统  
> 适用人员：产品、前端、后端、数据库、测试与实施人员  
> 基线日期：2026-10-25

## 1. 开发目标

在保留智析数学现有学生端、教师端、管理端及答题、作业、学情看板、错题本、学习轨迹、知识图谱、推荐和 AI 助教等功能的基础上，新增两层顺序执行的自适应机制：

1. 第一层根据本轮正确率、题目认知负荷等级、学生感知认知负荷和学业控制感，决定下一轮任务复杂度、教学支架及页面信息密度。
2. 第二层读取学生当前有效的 VARK 学习偏好，在不改变第一层任务目标和难度的前提下，匹配学习资源并切换页面呈现方式。

所有问卷均保存原始答案。学生可以看到 VARK 测评结果，但不得看到学业控制感的分数、等级或原始答案；教师端和管理端可以查看完整结果与历史。

本文档为本次开发和验收的最终需求基线。旧规格、旧原型或现有代码与本文冲突时，以本文为准。

## 2. 生效范围

首期仅在以下知识点启用双层适配机制：

| 知识点 ID | 知识点名称 |
| --- | --- |
| `alg-1` | 整式 |
| `alg-2` | 整式加减 |
| `algebra-3` | 分式与分式运算 |
| `alg-3` | 一元一次方程 |

白名单应由后端统一配置，前端通过接口读取，不允许前后端分别写死。白名单外的知识点继续使用原有推送逻辑和页面样式，不触发本机制专属问卷。

## 3. 已确认的核心规则

| 主题 | 最终规则 |
| --- | --- |
| 一轮练习 | 同一知识点固定 5 题，5 题全部成功提交后才形成有效轮次 |
| 无效轮次 | 中途退出或未答满 5 题时，不保存本轮作答、不触发控制感量表、不更新难度和学情画像 |
| VARK 周期 | 首次进入白名单薄弱练习且无有效结果时必测；结果缓存 7 天；过期后的首次进入重新测评 |
| VARK 结果 | 测评完成后必须先显示单一或双偏好结果，学生确认后才能开始做题 |
| 控制感周期 | 每个有效 5 题轮次完成后必须测评，不允许跳过或空白提交 |
| 控制感隐私 | 学生端不显示分数、原始答案或高、中、低标签；仅显示鼓励便利贴；教师端和管理端可见完整结果 |
| 难度优先级 | 低控制感且高感知认知负荷时强制降一级；否则按正确率规则降级、维持或升级 |
| VARK 混合型 | 只比较排名第 1 和第 2 的偏好，差值不超过 0.5 时双通道，否则单通道；最多两个偏好 |

## 4. 术语与数据口径

### 4.1 题目认知负荷等级

题库预标字段，取值为 `low`、`medium`、`high`，表示任务本身的复杂程度。教师端和管理端均可编辑。

### 4.2 感知认知负荷

学生在轮后 Q3 对本轮费脑程度的 1～5 分自评：

- 1～2：低
- 3：中
- 4～5：高

### 4.3 学业控制感

Q1 与 Q2 的总分反映当前知识点、当前轮次的即时状态，不是人格或心理诊断标签。

### 4.4 VARK 学习偏好

VARK 表示当前资源呈现偏好，不代表能力，不得改变第一层确定的知识目标和任务复杂度。

### 4.5 有效轮次

有效轮次必须同时满足：

- 题目属于同一知识点；
- 题目数量恰好为 5；
- 5 题全部作答；
- 服务器原子提交成功。

开发中必须把“题目预标认知负荷”和“学生感知认知负荷”拆成两个独立字段。强制降级条件中的“高认知负荷”指 Q3 的高感知认知负荷；题目认知负荷等级用于计算本轮基准复杂度和筛选下一轮题目。

## 5. 整体业务流程

```text
进入白名单薄弱练习
  -> 检查 VARK 最近一次结果是否仍在 7 天有效期
  -> 缺失或过期时完成 VARK 问卷
  -> 展示单一或双偏好结果
  -> 学生确认开始练习
  -> 系统组装同一知识点 5 题任务包
  -> 学生完成并提交全部 5 题
  -> 生成有效学习轮次并计算正确率
  -> 弹出表情 + Q1 + Q2 + Q3 轮后自评
  -> 第一层确定下一轮复杂度、支架和页面密度
  -> 第二层按 VARK 单通道或双通道匹配资源
  -> 显示鼓励便利贴
  -> 进入下一轮
```

### 5.1 时序要求

1. VARK 缺失或过期时，系统不得提前加载或显示练习题。
2. VARK 提交后先显示结果，学生点击“开始薄弱练习”后再进入 5 题任务。
3. 5 题未全部提交时不得生成学习轮次。
4. 有效轮次完成后必须提交轮后自评，才能获得下一轮任务。
5. 第一层先执行，第二层只能包装第一层输出，不得改写任务复杂度。

## 6. 模块一 学业控制感与任务复杂度自适应

### 6.1 题库新增字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `cognitiveLoadLevel` | enum | 是 | `low`、`medium`、`high` |
| `conciseStem` | text | 低负荷题建议 | 低信息密度模式使用的精简题干，不得删除必要条件 |
| `scaffoldSteps` | JSON array | 中高负荷题建议 | 分步提示，按支架等级展开 |
| `resourceBindings` | JSON | 否 | 绑定 V、A、R、K 的图片、音频、文本或变式题资源 |

后台要求：

- 教师端和管理端题库均可编辑认知负荷等级；
- 支持按认知负荷筛选和批量设置；
- 历史题迁移时默认设为 `medium`，并记录 `migrationDefault=true`；
- 题库不足时可以回退到最接近等级，但必须保存 `fallbackReason`，不得跨越班级已学范围。

### 6.2 五题轮次与原子提交

| 场景 | 服务器行为 |
| --- | --- |
| 完成 0～4 题后退出 | 丢弃本轮临时作答，不创建正式学习记录、学习轮次或画像事件 |
| 提交题数不是 5 | 返回 `422 ROUND_SIZE_INVALID`，不执行部分写入 |
| 5 题来自多个知识点 | 返回 `422 ROUND_KNOWLEDGE_MISMATCH` |
| 5 题全部提交成功 | 同一事务内保存作答、判分结果和学习轮次，返回 `reflectionRequired=true` |
| 同一请求重试 | 根据 `requestId` 幂等返回同一学习轮次，不得重复计分或重复弹窗 |

白名单薄弱练习中的临时答案只允许存在于当前页面会话中，离开页面即清除。不得将无效轮次的答案写入学习轨迹、统计或推荐依据。

### 6.3 轮后自评内容

指导语：

> 同学你好！做完这组题，请根据你现在的真实感受选择最符合的一项。答案没有对错，仅用于帮你安排下一组更适合你的题目。

| 题号 | 维度 | 题项 | 计分 |
| --- | --- | --- | --- |
| 表情 | 情绪支持 | 现在完成这组题后，我感觉…… | 枚举，不计入控制感分数 |
| Q1 | 控制感 | 做完这组题，我有信心掌握刚才涉及的知识点。 | 1～5 |
| Q2 | 控制感 | 如果下次遇到同类型的数学题，我觉得自己能够独立做出来。 | 1～5 |
| Q3 | 感知认知负荷 | 刚才这组题，你觉得自己在理解上花了多大的脑力或精神劲？ | 1 极少～5 极多 |

Q1、Q2 五级选项：

1. 非常不符合
2. 比较不符合
3. 一般或不确定
4. 比较符合
5. 非常符合

表情、Q1、Q2、Q3 全部必填。问卷不可通过点击遮罩、Esc 或关闭按钮跳过。

### 6.4 分数与等级

| 指标 | 计算 | 等级 |
| --- | --- | --- |
| 控制感总分 | `Q1 + Q2`，范围 2～10 | 2～4 低；5～7 中；8～10 高 |
| 感知认知负荷 | Q3，范围 1～5 | 1～2 低；3 中；4～5 高 |
| 正确率 | `correctCount / 5` | `<60%` 降级；`60%～80%` 含边界维持；`>80%` 升级 |

### 6.5 难度判定规则

判定优先级：

1. 如果 `controlLevel=low` 且 `perceivedLoadLevel=high`，无论正确率多少都强制降一级。
2. 未命中强制条件时，按正确率基准规则：
   - 正确率 `<60%`：降一级；
   - `60% <= 正确率 <= 80%`：维持；
   - 正确率 `>80%`：升一级。

```js
if (controlLevel === 'low' && perceivedLoadLevel === 'high') {
  adjustment = -1
} else if (accuracy < 0.60) {
  adjustment = -1
} else if (accuracy <= 0.80) {
  adjustment = 0
} else {
  adjustment = 1
}

targetComplexity = clamp(currentComplexity + adjustment, 'low', 'high')
```

补充约束：

- 每轮最多升降一级；
- 最低为 `low`，最高为 `high`；
- 高控制感加低负荷不单独强制升级，仍按正确率执行；
- 任务复杂度改变时，页面信息密度必须同步调整；
- VARK 只改变资源形式，不改变 `targetComplexity`；
- 保存输入快照、输出、`rationaleCodes`、`fallbackReason` 和 `ruleVersion=adaptive-v2.0`。

### 6.6 页面和支架输出

| 目标复杂度 | 题目与页面要求 |
| --- | --- |
| `low` | 分步小题、精简题干、突出当前步骤、增加留白、减少并列卡片和装饰信息 |
| `medium` | 标准题干、常规间距、保留必要提示 |
| `high` | 同知识点变式或迁移题、完整题干、标准信息密度、适度减少提示 |

决策对象建议结构：

```json
{
  "difficultyAdjustment": -1,
  "targetComplexity": "low",
  "scaffoldLevel": "high",
  "pageDensity": "low",
  "guidanceKey": "control_low_load_high",
  "rationaleCodes": ["LOW_CONTROL_HIGH_LOAD_OVERRIDE"],
  "ruleVersion": "adaptive-v2.0"
}
```

### 6.7 学生端便利贴

| 后台等级 | 学生端策略 | 示例文案 |
| --- | --- | --- |
| 低 | 安抚、拆步、建立小成功，不出现“低控制感” | 这组题确实不轻松。下一轮我们把步骤拆小，一步一步来。 |
| 中 | 肯定已有方法，鼓励稳住节奏 | 你已经找到一部分方法，再用一组相似题把步骤连起来。 |
| 高 | 奖励、温和挑战、提醒说明理由，不显示“高分”标签 | 做得不错！下一轮会多一点变化，试着把关键理由也说清楚。 |

便利贴要求：

- 自评提交并生成决策后出现；
- 可手动关闭；
- 不遮挡题目、解析、提交按钮和下一轮按钮；
- 可显示表情、鼓励语、奖励徽章或下一步建议；
- 不显示控制感数值、等级或原始答案。

## 7. 模块二 VARK 测评与资源适配

### 7.1 触发与七天有效期

| 状态 | 进入白名单薄弱练习时的行为 |
| --- | --- |
| 无历史结果 | 强制弹出问卷，完成、保存并显示结果后才能加载 5 题任务 |
| `completedAt + 7天` 未到期 | 直接使用缓存偏好，不重复测评 |
| `completedAt + 7天` 已到期 | 强制重新测评并显示新结果，旧结果保留为历史 |
| 问卷未完成或提交失败 | 停留在问卷，禁止进入练习，不产生空记录 |
| 白名单外知识点 | 不触发本机制问卷，继续使用原逻辑 |

七天以服务器时间为准：

```text
validUntil = completedAt + 7 * 24 小时
```

接口同时返回 `varkDue`、`completedAt` 和 `validUntil`，前端不得自行决定是否到期。

### 7.2 VARK 问卷题项

问卷共 12 题，每个维度 3 题，均采用 1～5 分李克特量表。

| 题号 | 维度 | 题项 |
| --- | --- | --- |
| V1 | V | 学习新数学知识点时，我喜欢看思维导图或示意图把关系画出来。 |
| V2 | V | 理解函数图像平移时，我更倾向于看图像动态变化的示意图。 |
| V3 | V | 整理错题时，我习惯在错题旁画个图来帮助理解。 |
| A1 | A | 学习数学概念时，我更喜欢听老师或微课口头讲解一遍。 |
| A2 | A | 遇到不会的题，我倾向于找人问，听别人讲一遍思路。 |
| A3 | A | 在数学课上，我更容易记住老师反复强调的口头解释。 |
| R1 | R | 复习时，我觉得重新整理一遍文字笔记和公式对我最有效。 |
| R2 | R | 自学新方法时，我喜欢找一篇文字教程从头读到尾。 |
| R3 | R | 记忆公式时，我通常会抄写几遍，边抄边看文字。 |
| K1 | K | 学习新知识时，我倾向于直接做几道例题，边做边体会。 |
| K2 | K | 面对几何证明题时，我通常会直接尝试从条件往下推导几步。 |
| K3 | K | 当想确认自己是否理解概念时，我会试着用它去解一道新题。 |

### 7.3 计分和混合型规则

1. 分别计算 V、A、R、K 三道题的平均分，保留两位小数。
2. 按得分从高到低排序，只检查第 1 和第 2 名。
3. 第一、第二名差值 `<=0.5`：保存两个偏好并启用双通道。
4. 差值 `>0.5`：只保存第 1 名并启用单通道。
5. 即使三项或四项并列，也只保留排序后的前两个维度。
6. 同分排序固定为 `V -> A -> R -> K`，保证结果可复现。

### 7.4 四类资源映射

| 维度 | 名称 | 优先资源 | 界面特征 |
| --- | --- | --- | --- |
| V | 视觉型 | 几何图解、知识关系图、思维导图、可视化推导 | 图形优先，减少连续大段文字，突出结构关系 |
| A | 听觉型 | 微课语音讲解、口述思路音频、步骤旁白 | 提供播放控件、字幕和进度；不得映射为例题示范型 |
| R | 阅读书写型 | 文字版解题步骤、要点清单、推导文本、笔记总结 | 排版规整、文字层级清晰，图形仅辅助 |
| K | 动觉实操型 | 梯度变式题、案例化应用题、即时试错练习 | 讲解精简，优先作答和操作，反馈及时 |

混合型需要在同一任务页中按优先级组合两种资源，不能简单堆叠两套完整页面。例如 VK 同时展示示意图和实操变式练习。

### 7.5 学生结果展示

- 必须显示偏好名称、图标、简要解释和将优先提供的资源形式；
- 混合型同时显示两类，例如“视觉型 V + 动觉实操型 K”；
- 提供“开始薄弱练习”主按钮，点击后才加载练习；
- 可以重新填写当前问卷，但重新提交后应形成新的历史记录，不能覆盖旧记录；
- 明确说明偏好不是能力标签，题目难度由正确率、控制感和感知认知负荷决定。

### 7.6 长期学习效果微调

系统可以根据长期学习效果调整资源权重，但不得静默改写问卷原始答案。建议在至少 6 个有效轮次后，结合最近 8 轮正确率、完成时长和感知负荷生成“建议增加第二通道”事件；正式偏好仍由每周 VARK 复测刷新。教师端和管理端可查看微调依据与规则版本。

## 8. 两层组装规则

| 第一层输出 | 第二层处理 | 最终页面 |
| --- | --- | --- |
| `targetComplexity` | 不得修改 | 决定 5 题的任务复杂度分布 |
| `scaffoldLevel` | 将支架转换为对应 VARK 资源 | 例如高支架搭配 V 图解或 A 语音步骤 |
| `pageDensity` | VARK 样式必须服从密度上限 | 低密度时不能因双通道堆叠过多内容 |
| `guidance` | 不参与 VARK 评分 | 显示不含心理标签的便利贴 |
| `presentationMode` | 单通道或双通道 | 只改变资源组织形式 |

## 9. 权限与隐私

| 数据项 | 学生端 | 教师端 | 管理端 |
| --- | --- | --- | --- |
| VARK 原始答案与四维分数 | 仅显示本次结果摘要 | 可见所教学生历史 | 可见全部历史 |
| VARK 单一或双偏好 | 可见 | 可见 | 可见 |
| 控制感 Q1、Q2、总分和等级 | 不可见 | 可见所教学生 | 可见 |
| Q3 感知负荷和等级 | 不可见 | 可见所教学生 | 可见 |
| 情绪表情 | 提交后不回显统计标签 | 可见所教学生 | 可见 |
| 难度决策及原因码 | 仅显示普通的下一轮安排描述 | 可见 | 可见 |
| 班级分布统计 | 不可见 | 仅所教班级 | 全部班级 |

学生反馈接口必须使用专门的 DTO 白名单，禁止直接返回 `controlAssessments` 或 `adaptationDecisions` 的完整存储对象。教师接口必须校验班级归属；管理端接口必须校验管理员角色并记录操作日志。

## 10. 数据模型

### 10.1 `questions`

新增或规范字段：

```text
id
knowledgePointId
cognitiveLoadLevel
conciseStem
scaffoldSteps
resourceBindings
migrationDefault
updatedBy
updatedAt
```

### 10.2 `varkAssessments`

```text
id
studentId
classId
answers
scores
primaryDimension
secondaryDimension
mixed
questionnaireVersion
completedAt
validUntil
createdAt
```

### 10.3 `learningRounds`

```text
id
studentId
classId
knowledgePointId
questionIds[5]
accuracy
taskComplexity
status
requestId
createdAt
```

### 10.4 `controlAssessments`

```text
id
roundId
studentId
classId
knowledgePointId
emotion
controlItem1
controlItem2
cognitiveLoadItem
controlScore
controlLevel
perceivedLoadLevel
ruleVersion
createdAt
```

### 10.5 `adaptationDecisions`

```text
id
roundId
studentId
knowledgePointId
sourceComplexity
targetComplexity
difficultyAdjustment
scaffoldLevel
pageDensity
guidanceKey
rationaleCodes
fallbackReason
ruleVersion
createdAt
```

### 10.6 `presentationEvidence`

```text
id
studentId
varkAssessmentId
roundId
activeDimensions
accuracy
duration
perceivedLoadLevel
createdAt
```

### 10.7 状态与唯一约束

- `learningRound`：`awaiting_reflection -> adapted`；待教师复核时为 `pending_review -> awaiting_reflection -> adapted`。
- 每个 `roundId` 最多存在一条 `controlAssessment`。
- 每个 `roundId` 最多存在一条 `adaptationDecision`。
- 未完成的 VARK 问卷不落正式记录。

## 11. API 设计

### 11.1 学生端

| 方法与路径 | 用途 | 关键要求 |
| --- | --- | --- |
| `GET /student/adaptation/status` | 进入薄弱练习时检查 | 返回 `varkDue`、`validUntil`、`presentationMode`、`pendingReflection`，不返回控制感详情 |
| `GET /student/vark/questionnaire` | 获取问卷 | 返回 12 题、量表选项和版本 |
| `POST /student/vark/assessments` | 提交 VARK | 12 题全填，返回学生可见结果 DTO |
| `GET /student/practice/:knowledgePointId` | 加载 5 题 | VARK 到期时返回 `409 VARK_REQUIRED`；白名单必须恰好返回 5 题 |
| `POST /student/practice/:knowledgePointId/submit` | 提交一轮 | 恰好 5 题、同一知识点、事务和幂等；返回 `roundId` 和 `reflectionRequired` |
| `POST /student/learning-rounds/:id/reflection` | 提交表情、Q1、Q2、Q3 | 全部必填；只返回便利贴和普通任务描述，不返回分数或等级 |
| `GET /student/adaptation/next/:knowledgePointId` | 获取下一轮信息 | 返回目标复杂度、布局和资源模式的学生安全 DTO |

### 11.2 教师端和管理端

| 方法与路径 | 用途 |
| --- | --- |
| `GET /teacher/adaptation/overview?classId=` | 班级控制感、感知负荷、题目认知负荷和 VARK 分布 |
| `GET /teacher/adaptation/students/:studentId/history` | 查看学生控制感、Q3、VARK、原始答案和决策历史 |
| `GET /admin/adaptation/overview` | 管理员跨班级汇总和筛选 |
| `GET /admin/adaptation/students/:studentId/history` | 管理员查看学生完整历史 |
| `PUT /admin/adaptation/settings` | 配置白名单、七天周期、阈值、便利贴文案和规则版本 |
| `PUT /questions/:id/cognitive-load` | 教师或管理员编辑题目认知负荷等级 |

## 12. 前端页面与组件

| 页面或组件 | 必须实现的行为 |
| --- | --- |
| 薄弱练习入口 | 先检查 VARK 是否到期；到期时阻断题目加载，未到期直接加载缓存样式 |
| VARK 问卷弹窗 | 12 题完整展示、不可空白提交、不可跳过，提交失败时保留本地选择 |
| VARK 结果卡 | 清楚显示单一或双偏好及资源说明，确认后才进入练习 |
| 5 题练习页 | 显示 1/5～5/5 进度，未答完不可提交，退出时提示本轮不会保存 |
| 轮后自评弹窗 | 表情 + Q1 + Q2 + Q3 全部必填，提交前不可进入下一轮 |
| 便利贴 | 不遮挡题目，可关闭，按 `guidanceKey` 匹配文案和表情 |
| 学生轮后页 | 显示正确率、下一轮普通安排和 VARK 资源形式；禁止显示控制感及 Q3 结果 |
| 教师统计页 | 班级分布、时间和知识点筛选、单个学生历史明细 |
| 管理统计页 | 全部班级分布、学生明细、规则版本和数据导出 |
| 题库编辑页 | 认知负荷等级必填、可筛选、可批量编辑 |

## 13. 教师端和管理端统计

| 指标 | 计算口径 |
| --- | --- |
| 控制感分布 | 所选范围内每名学生最新有效轮次的低、中、高人数；支持查看全部轮次分布 |
| 感知负荷分布 | Q3 低、中、高的轮次数和占比 |
| 题目认知负荷分布 | 题库或实际推送轮次中 low、medium、high 的题数和占比 |
| VARK 分布 | 按当前有效结果统计；混合型同时计入两个维度，并单列 `mixedStudentCount` |
| 学生历史 | 时间、知识点、正确率、Q1、Q2、Q3、控制感等级、负荷等级、VARK、决策和版本 |
| 复测状态 | 上次 VARK 时间、有效截止时间、是否过期和历史变化 |

## 14. 当前代码差异与改造清单

当前仓库已包含部分自适应组件和接口，但以下行为与最终需求不一致：

| 位置或能力 | 当前状态 | 目标状态 |
| --- | --- | --- |
| `backend/routes/student.js` | 薄弱练习最多取 6 题，提交允许 1～20 题 | 白名单任务固定 5 题，提交必须恰好 5 题且属于同一知识点 |
| `WeakPractice.vue` | 每次进入白名单练习都弹 VARK | 由后端 `varkDue` 控制，7 天内不重复测评 |
| `adaptive-learning.js` 的 A 维度 | A 题项和资源映射为 `workedExample` 例题示范 | 改为 Aural 听觉：语音讲解、口述思路和步骤旁白 |
| VARK 混合判定 | 所有与最高分差不超过 0.5 的维度都可能入选 | 只比较第 1 和第 2 名，最多两个维度 |
| `AdaptiveReflectionDialog.vue` | 只有表情和两道控制感题 | 增加必填 Q3 感知认知负荷题 |
| 控制感计分 | 两题均分，使用 2.4 和 3.8 阈值 | 使用总分：2～4 低、5～7 中、8～10 高 |
| 正确率阈值 | 高正确率从 85% 起 | 大于 80% 升级；60%～80% 含边界维持 |
| 难度决策 | 低控制感普遍降级，高控制感且高正确率升级 | 只有低控制感加高感知负荷强制覆盖；其他情况按正确率 |
| `AdaptiveFeedback.vue` | 向学生展示控制感等级和两题原始分数 | 完全移除学生端控制感分数、等级和原始答案 |
| 教师和管理统计 | 教师端已有部分概览；管理端不完整 | 两端都支持完整结果、历史、感知负荷和 VARK 分布 |
| 题库字段 | 使用兼容推断 `taskComplexity` 的逻辑 | 正式落库 `cognitiveLoadLevel`，提供后台编辑和迁移 |

## 15. 迁移与兼容

- 新规则版本为 `adaptive-v2.0`，旧决策保留原版本，不批量改写历史；
- 历史题缺少 `cognitiveLoadLevel` 时回填 `medium`，后台提供“待校准”筛选；
- 旧 VARK 档案缺少 `completedAt` 或使用旧 A 题项版本时视为过期；
- 旧控制感记录缺少 Q3 时标记 `legacy=true`，仅用于历史查看，不作为 v2.0 新决策输入；
- 学生端缓存和接口缓存均按 `questionnaireVersion`、`ruleVersion` 和 `validUntil` 失效；
- 部署前备份 SQLite 数据；迁移脚本必须可重复执行并输出新增、回填和失败数量。

## 16. 测试与验收

### 16.1 核心业务用例

| 编号 | 场景 | 验收结果 |
| --- | --- | --- |
| T01 | 白名单知识点加载练习 | 始终返回同一知识点的 5 题 |
| T02 | 只完成 4 题后退出 | 无服务器作答记录、无轮次、无自评、画像不变 |
| T03 | 提交 4 题或 6 题 | 返回 422，数据库无部分写入 |
| T04 | 首次进入且无 VARK | 必须测评并看到结果后才能做题 |
| T05 | VARK 完成后第 6 天进入 | 不重复弹窗，自动使用缓存偏好 |
| T06 | VARK 完成后满 7 天进入 | 重新弹窗并保存新的历史记录 |
| T07 | 第一和第二名差值为 0.5 | 判定双偏好；差值为 0.51 时判定单偏好 |
| T08 | 三项同分第一 | 只保留固定排序后的前两项 |
| T09 | 完成有效 5 题 | 必须填写表情、Q1、Q2、Q3，任一缺失不可提交 |
| T10 | 控制感总分为 4、5、7、8 | 依次为低、中、中、高 |
| T11 | Q3 为 2、3、4 | 依次为低、中、高感知负荷 |
| T12 | 低控制感、Q3 高、正确率 100% | 仍强制降一级 |
| T13 | 未触发强制条件，正确率为 40%、60%、80%、100% | 依次降级、维持、维持、升级 |
| T14 | 学生提交控制感后查看页面和网络响应 | 看不到分数、等级和原始答案，只看到便利贴和普通任务描述 |
| T15 | 教师和管理员查看同一学生 | 均能看到完整控制感、Q3、VARK 和历史决策 |
| T16 | 白名单外知识点 | 完全保持原推送、页面和问卷行为 |

### 16.2 非功能验收

- 所有提交接口具备鉴权、角色校验、幂等控制、参数校验和事务一致性；
- VARK 和轮后自评弹窗在桌面端、移动端均可完整滚动并支持键盘操作；
- 便利贴不遮挡题目、解析、提交按钮和下一轮按钮；
- 双通道资源不会导致首屏信息过量，低密度模式必须明显低于标准模式；
- 教师只能查看所教班级学生，管理端查看和配置修改写入日志；
- 自动化测试覆盖所有阈值边界、七天时间边界、白名单边界和学生数据脱敏。

## 17. 建议开发顺序

| 阶段 | 交付内容 |
| --- | --- |
| 1 数据和规则 | 迁移字段、量表版本、七天有效期、5 题约束、v2.0 判定引擎和单元测试 |
| 2 学生端闭环 | VARK 到期门禁、结果页、5 题轮次、三题自评、便利贴和学生接口脱敏 |
| 3 资源适配 | V、A、R、K 四类资源组件、双通道组装和页面密度联动 |
| 4 教师和管理端 | 班级分布、个人历史、题库负荷编辑、规则设置和操作日志 |
| 5 验收上线 | 迁移演练、自动化测试、隐私检查、性能检查和灰度启用 |

## 18. 默认配置

| 配置项 | 默认值 |
| --- | --- |
| `adaptive.enabled` | `true` |
| `adaptive.ruleVersion` | `adaptive-v2.0` |
| `adaptive.roundSize` | `5` |
| `adaptive.varkValidityDays` | `7` |
| `adaptive.control.lowMax` | `4`，总分 |
| `adaptive.control.highMin` | `8`，总分 |
| `adaptive.perceivedLoad.lowMax` | `2` |
| `adaptive.perceivedLoad.highMin` | `4` |
| `adaptive.accuracy.lowThreshold` | `0.60`，严格小于时降级 |
| `adaptive.accuracy.highThreshold` | `0.80`，严格大于时升级 |
| `adaptive.vark.mixedGapMax` | `0.5` |
| `adaptive.vark.maxDimensions` | `2` |

## 19. 完成定义

满足以下条件才视为开发完成：

1. 第 16 节全部验收用例通过；
2. 学生端页面和网络响应均不包含控制感敏感字段；
3. VARK 七天周期在刷新、退出和跨设备场景下保持一致；
4. 五题轮次在退出、断网重试和重复提交场景下不会产生残缺或重复记录；
5. 教师端和管理端统计均可追溯到原始问卷、具体学习轮次和规则版本；
6. 白名单外知识点的原有功能和样式不受影响。

## 20. 参考依据

1. Pekrun, R. (2006). The control-value theory of achievement emotions. *Educational Psychology Review*, 18(4), 315-341.
2. Perry, R. P., Hladkyj, S., Pekrun, R., & Pelletier, S. T. (2001). Academic control and action control in the achievement of college students. *Journal of Educational Psychology*, 93(4), 776-789.
3. Paas, F. (1992). Training strategies for attaining transfer of problem-solving skill in statistics: A cognitive-load approach. *Journal of Educational Psychology*, 84(4), 429-434.
4. Fleming, N. D., & Mills, C. (1992). Not another inventory, rather a catalyst for reflection. *To Improve the Academy*, 11(1), 137-155.
5. Wong, J. S. W., & Chin, K. C. W. (2018). Reliability of the VARK questionnaire in Chinese nursing undergraduates. *US-China Education Review A*, 8(8), 332-340.
6. Leite, W. L., Svinicki, M., & Shi, Y. (2010). Attempted validation of the scores of the VARK learning styles inventory. *Educational and Psychological Measurement*, 70(2), 323-339.
