# 智析数学：认知—心理双维度双层自适应学习机制开发文档

> 文档状态：V1.0（开发基线）  
> 适用项目：智析数学  
> 核心模块：认知负荷与情境性学业控制感协同调节  
> 配套模块：多模态学习资源偏好适配  
> 生效范围：整式、整式加减、分式与分式运算、一元一次方程  
> 原则：保留现有三端、答题、作业、掌握度、错题本、学习轨迹和 AI 助教等功能

## 1. 文档目的

本文档用于指导产品设计、前后端开发、测试、试点实施和答辩说明。它定义新增机制的业务边界、理论口径、数据模型、接口、决策规则、界面行为和验收标准。

本次开发不是另建一套独立推荐系统，而是在现有学习闭环上增加两个连续执行的适配层：

1. 第一层根据学习表现、任务复杂度、心理努力和情境性学业控制感，决定下一轮任务难度与教学支架。
2. 第二层在不改变知识目标和题目难度的前提下，根据学生的资源呈现偏好组装页面与学习资源。

第一层是主要创新和答辩重点；第二层是从属的呈现优化机制。

## 2. 产品目标与非目标

### 2.1 产品目标

- 在学生完成一轮练习后获得轻量、可解释的心理状态反馈。
- 避免仅凭正确率机械升降题目难度。
- 对“不会且没有把握”的学生降低无关信息负担并提供分步支架。
- 对“会做但没有把握”的学生提供情绪支持和可控选择，而不是继续降低知识难度。
- 对“正确率高且控制感高”的学生增加变式、迁移和解释要求，避免停留在熟练重复。
- 为教师提供需要情感关注的线索，但不把系统测评包装成心理诊断。
- 保留所有原有学习记录，使新增决策可以追溯、解释和复核。

### 2.2 非目标

- 不进行心理疾病、焦虑症或人格诊断。
- 不用两道自评题给学生贴永久心理标签。
- 不宣称某种固定“学习风格”必然提高学习成绩。
- 不让 AI 助教取代班主任或数学教师的情感支持。
- 不跨越教师设置的已学范围推送内容。
- 不在首期对全知识图谱启用新增机制。
- 不根据单轮结果永久降低学生的学习目标。

## 3. 理论与术语口径

### 3.1 任务复杂度

题库能够预先标注的是任务本身的复杂程度，而不是某位学生实际产生的认知负荷。字段和后台文案统一使用“任务复杂度”。

任务复杂度由教师综合以下因素标注：

- 同时需要处理的数学元素数量。
- 推理、计算或证明步骤数。
- 前置知识数量。
- 题干信息量及无关信息干扰程度。
- 表示转换要求，例如文字、式子与图形之间转换。

等级为 `low`、`medium`、`high`，学生端显示“基础”“标准”“挑战”，不直接显示专业术语。

### 3.2 感知心理努力

感知心理努力是学生完成本轮任务后，对“本轮有多费脑”的主观评分，用于补充题目预标复杂度。首期采用 1—5 级单题量表。

### 3.3 情境性学业控制感

情境性学业控制感指学生对“当前知识点、当前一轮任务”是否知道如何行动、是否相信自己能够完成的即时感受。它是状态变量，不是人格特征。

学生端禁止出现“低控制感学生”等标签，统一转译为：

- 低：现在需要更多支持。
- 中：正在逐步建立方法。
- 高：已经较有把握，可以接受进一步挑战。

### 3.4 教学支架

教学支架是帮助学生完成当前知识目标的临时支持，包括：

- 分步呈现。
- 例题示范。
- 条件高亮。
- 一次只呈现一个问题。
- 提示层级。
- 减少无关视觉信息。

支架应在学生稳定掌握后逐步撤除，不能长期替代独立作答。

### 3.5 多模态资源呈现偏好

原“VARK 学习类型”在产品和答辩中统一调整为“多模态学习资源呈现偏好”。四种模式为：

- `visual`：图示优先。
- `readWrite`：规范文字优先。
- `workedExample`：分步例题优先。
- `practice`：练习试错优先。

系统保存四维分数，允许并列和混合模式。主偏好只代表当前呈现选择，不代表固定能力或永久类型。

## 4. 功能生效范围

首期只对白名单内知识点启用：

| 知识点 ID | 名称 | 是否启用 |
| --- | --- | --- |
| `alg-1` | 整式 | 是 |
| `alg-2` | 整式加减 | 是 |
| `algebra-3` | 分式与分式运算 | 是 |
| `alg-3` | 一元一次方程 | 是 |

明确不包含：

- `alg-5` 一元二次方程。
- `equation-2` 分式方程。
- 其他几何、函数、统计概率等知识点。

白名单应集中配置，不允许在多个文件中重复写死：

```js
const ADAPTIVE_KNOWLEDGE_IDS = new Set([
  "alg-1",
  "alg-2",
  "algebra-3",
  "alg-3",
]);
```

白名单外继续使用现有 `personalized-push`、掌握度和页面布局。

## 5. 总体业务流程

```text
学生首次登录
  ↓
完成资源呈现偏好问卷
  ↓
进入原有作业或练习流程
  ↓
完成一个学习轮次（同一知识点 4—6 题）
  ↓
原有自动判分 / 教师复核
  ↓
若属于白名单且存在可判定结果，要求完成轮后自评
  ↓
采集情绪、两道控制感题、心理努力
  ↓
第一层生成：难度变化 + 支架等级 + 页面密度 + 情感语气
  ↓
第二层读取资源呈现偏好，选择资源组织方式
  ↓
生成下一轮任务并保存完整决策快照
  ↓
学生进入下一轮；教师端同步统计与关注线索
```

### 5.1 学习轮次定义

- 一个轮次包含同一主知识点下 4—6 道题。
- 作业中跨知识点的题目按知识点拆分统计，但完成整份作业后只弹出一次自评。
- 作业自评的适配决策优先作用于后续专项练习，不修改已经发布的作业。
- 专项练习自评直接作用于下一轮专项练习。
- 图片答题、全部等待教师复核的轮次，在复核完成前不生成最终适配决策。

## 6. 第一层：认知—心理协同适配

### 6.1 轮后自评

每轮结束后显示不可空白提交的轻量自评卡：

1. 表情选择：“现在完成这组题后，我感觉……”
2. 控制感题 1：“做完这组题，我有信心掌握刚才涉及的知识点。”
3. 控制感题 2：“如果下次遇到同类型的数学题，我觉得自己能够独立做出来。”
4. 心理努力题：“刚才这组题，你觉得自己在理解上花了多大的脑力/精神劲？”

#### 计分方式

- 控制感题使用 1—5 分。
- `controlScore = (controlItem1 + controlItem2) / 2`。
- `controlScore <= 2.4`：`low`。
- `2.4 < controlScore < 3.8`：`medium`。
- `controlScore >= 3.8`：`high`。
- 心理努力使用 1—5 分，4—5 视为高努力。
- 表情只用于情感文案选择和教师关注，不直接单独改变题目难度。

阈值必须通过配置读取，并记录规则版本，试点后允许根据数据校准。

### 6.2 表现分层

- `accuracy < 0.60`：低正确率。
- `0.60 <= accuracy < 0.85`：中等正确率。
- `accuracy >= 0.85`：高正确率。

准确率只统计已经自动判定或教师复核完成的题目。空答、待复核题不得当作错误直接进入心理适配。

### 6.3 基础决策矩阵

| 正确率 | 控制感 | 默认难度变化 | 支架 | 页面密度 | 情感策略 |
| --- | --- | ---: | --- | --- | --- |
| 低 | 低 | -1 | 高 | 低 | 安抚、拆步、建立小成功 |
| 低 | 中 | 高努力时 -1，否则 0 | 高 | 低 | 明确下一步、减少干扰 |
| 低 | 高 | 0 | 中 | 标准 | 校准信心、针对错误反馈 |
| 中 | 低 | 0 | 高 | 低 | 保持目标、增加可控选择 |
| 中 | 中 | 0 | 中 | 标准 | 稳定反馈 |
| 中 | 高 | 0 | 低至中 | 标准 | 鼓励解释方法 |
| 高 | 低 | 0 | 中 | 低 | 不降知识难度，增强信心 |
| 高 | 中 | 低努力时 +1，否则 0 | 低至中 | 标准 | 温和挑战 |
| 高 | 高 | 低努力时 +1，否则 0 | 低 | 标准 | 变式、迁移、严格要求 |

### 6.4 调节保护规则

- 每轮任务复杂度最多改变一级。
- 不能超出 `low`—`high` 范围。
- 降级不改变知识目标，只改变题目复杂程度和支架。
- 升级至少需要高正确率，并且不得处于高心理努力状态。
- 连续两轮满足升级条件后才正式升级，避免一次猜对造成跳级。
- “低正确率 + 低控制感 + 高心理努力”允许立即降低一级并增加支架。
- 连续两轮低控制感时显示教师支持入口，但不得自动向教师发送心理数据。
- 学生点击“我想和老师说说”后才创建教师支持请求。
- 教师可以冻结自动升降级或指定目标复杂度。
- 题库不足时回退为最接近复杂度，并保存 `fallbackReason`。

### 6.5 页面和任务的双输出

适配引擎必须分别输出：

```js
{
  difficultyAdjustment: -1 | 0 | 1,
  targetComplexity: "low" | "medium" | "high",
  scaffoldLevel: "low" | "medium" | "high",
  layoutDensity: "low" | "standard",
  emotionalTone: "comfort" | "steady" | "challenge",
  requireExplanation: true | false,
  rationaleCodes: [],
  rulesVersion: "adaptive-v1"
}
```

`difficultyAdjustment` 决定选题；`scaffoldLevel` 和 `layoutDensity` 决定呈现。二者不得合并成单一“难度”。

## 7. 情感引导与教师介入

### 7.1 学生端便利贴

自评提交后显示非阻塞式便利贴：

- 可以手动关闭。
- 不遮挡题目、提交按钮和解析。
- 每次只显示一条主文案和一个行动入口。
- 不使用“差”“能力不足”“低控制感”等评价。
- 不承诺“系统理解你的情绪”。

#### 低控制感文案池

- “这组题确实不轻松，没关系。下一轮我们把步骤拆小，一步一步来。”
- “暂时没把握不代表你学不会。先完成一个小步骤，再继续往前。”
- “你已经完成了这一轮，这本身就是进展。下一轮会少一些干扰，多一些提示。”

#### 中等控制感文案池

- “你已经找到一部分方法，下一轮继续稳住节奏。”
- “有些步骤已经清楚了，我们再用一组相似题把方法连起来。”

#### 高控制感文案池

- “你已经掌握当前方法。下一轮提高一点要求：不仅做对，还要说清为什么。”
- “有信心很好，接下来用变式题检验方法是否真正稳定。”
- “保持认真。下一轮提示会减少，需要你独立检查每一步。”

### 7.2 像素风卡通老师

前端使用已生成的透明素材：

`/images/pixel-math-teacher.png`

组件名称建议为 `PixelTutorTeacher.vue`，定位是“AI 学习助教的视觉代理”，不是学生的真实任课教师。

行为要求：

- 默认位于页面右下角，不遮挡内容。
- 支持静止、轻微呼吸/上下浮动、收到消息三个状态。
- 点击后打开现有 AI 助教窗口。
- 低控制感状态优先显示梳理步骤，不主动输出完整答案。
- 固定说明：“我可以陪你梳理步骤；需要情感支持时，老师更懂你。”
- 不使用真人教师姓名或头像，避免误导。

### 7.3 教师支持请求

学生主动点击“我想和老师说说”后创建请求。请求包含：

- 学生 ID、班级 ID。
- 知识点、学习轮次。
- 学生主动选择的求助类型。
- 经学生确认后附带的简要状态摘要。
- 创建时间、处理状态和教师回复。

禁止默认把全部原始心理问卷内容推送给教师。教师有权限在学生学情详情中查看历史自评时，应显示“学习状态参考，非心理诊断”。

教师端新增“需要关注”列表，处理状态为：

- `open`：待关注。
- `acknowledged`：教师已查看。
- `resolved`：已沟通或处理。

## 8. 第二层：多模态资源呈现适配

### 8.1 首次问卷

- 只对学生角色显示。
- 首次登录后、进入学生主页前完成。
- 采用用户提供的 12 道初中数学情境题，V、A、R、K 四维各 3 题，统一使用 1—5 分李克特计分。
- 保存每道题的原始选择、问卷版本和完成时间。
- 不显示“你只能用某种方式学习”。
- 问卷结果显示为“你目前更喜欢的学习呈现方式”。
- 允许学生在个人设置中重新测评或手动切换模式。

问卷原始维度与产品呈现模式映射如下：`V → visual`、`A → workedExample`（教师/微课讲解与例题示范）、`R → readWrite`、`K → practice`。原始 VARK 分数保留用于研究追溯，学生端只使用“资源呈现偏好”的产品名称，不展示固定学习类型标签。最高分与次高分差值不超过 0.5 时保存为混合偏好，并优先组合两个通道。

### 8.2 偏好模型

```js
{
  scores: {
    visual: 0,
    readWrite: 0,
    workedExample: 0,
    practice: 0
  },
  primaryMode: "visual",
  secondaryMode: "workedExample",
  confidence: 0.0,
  source: "questionnaire" | "manual" | "behavior",
  questionnaireVersion: "presentation-v1"
}
```

并列最高分时使用 `mixed`，由学生选择默认模式。首期不得根据单次点击自动改变主偏好。

### 8.3 四种页面模式

#### 图示优先 `visual`

- 优先显示结构图、关系图、条件标注和颜色编码。
- 控制单屏文字量。
- 图示必须服务于数学内容，不能为了“视觉型”添加无意义装饰。

#### 规范文字优先 `readWrite`

- 先显示定义、性质和规范表达。
- 文字分段、标题层级清楚。
- 图形作为必要辅助，不得删除几何或函数所必需的图形。

#### 分步例题优先 `workedExample`

- 先显示一个相近例题。
- 步骤逐段展开。
- 每一步说明依据。
- 随掌握度提高逐步隐藏步骤，防止支架依赖。

#### 练习试错优先 `practice`

- 精简前置讲解。
- 快速进入题目。
- 作答后给出针对当前错误的反馈和重试机会。
- 不把标准答案直接暴露在首次尝试前。

### 8.4 长期微调

首期只记录不同模式下的完成率、正确率、心理努力和退出率，不自动大幅改变偏好。

后续版本可采用以下保护规则：

- 至少积累三个有效轮次才产生行为证据。
- 单次更新每个维度最多变化 0.1。
- 学生手动选择优先于系统推断。
- 系统建议切换前需要学生确认。
- 题目本身需要特定表示形式时，以学科需要优先于个人偏好。

## 9. 数据模型

现有项目使用集合式业务存储。新增集合加入 `backend/database/memory-db.js` 的默认数据结构，并由现有 `business-store` 持久化。

### 9.1 题目字段扩展

```js
{
  taskComplexity: "low" | "medium" | "high",
  complexityDimensions: {
    elementCount: 1 | 2 | 3,
    reasoningSteps: 1 | 2 | 3,
    prerequisiteDemand: 1 | 2 | 3,
    informationDensity: 1 | 2 | 3,
    representationSwitch: 1 | 2 | 3
  },
  complexityRationale: "教师填写的简短依据",
  complexityReviewedBy: "teacher-or-admin-id",
  complexityReviewedAt: "ISO datetime",
  complexityVersion: 1
}
```

白名单内题目在启用机制前必须完成复杂度审核。历史题缺少字段时运行期按 `medium` 兼容，但在后台标为“待标注”，不得把默认值描述为教师审核结果。

### 9.2 `learningRounds`

```js
{
  id: "uuid",
  studentId: "student-id",
  classId: "class-id",
  sourceType: "assignment" | "practice",
  sourceRecordId: "answer-or-learning-record-id",
  knowledgePointId: "alg-1",
  questionIds: [],
  gradedQuestionCount: 0,
  correctCount: 0,
  accuracy: 0,
  averageTaskComplexity: "medium",
  costTime: 0,
  status: "awaiting_review" | "awaiting_reflection" | "adapted",
  createdAt: "ISO datetime"
}
```

### 9.3 `controlAssessments`

```js
{
  id: "uuid",
  roundId: "round-id",
  studentId: "student-id",
  emotion: "worried" | "uncertain" | "neutral" | "confident" | "very_confident",
  controlItem1: 1,
  controlItem2: 1,
  mentalEffort: 1,
  controlScore: 1.0,
  controlLevel: "low" | "medium" | "high",
  questionnaireVersion: "control-v1",
  submittedAt: "ISO datetime"
}
```

同一学生、同一轮次只能存在一条有效自评，接口必须幂等。

### 9.4 `adaptationDecisions`

```js
{
  id: "uuid",
  roundId: "round-id",
  studentId: "student-id",
  knowledgePointId: "alg-1",
  inputs: {
    accuracy: 0.67,
    currentComplexity: "medium",
    controlScore: 2.0,
    controlLevel: "low",
    mentalEffort: 4,
    previousDecisionId: null
  },
  outputs: {
    difficultyAdjustment: -1,
    targetComplexity: "low",
    scaffoldLevel: "high",
    layoutDensity: "low",
    emotionalTone: "comfort",
    requireExplanation: false
  },
  rationaleCodes: [
    "LOW_ACCURACY",
    "LOW_CONTROL",
    "HIGH_MENTAL_EFFORT"
  ],
  fallbackReason: "",
  rulesVersion: "adaptive-v1",
  createdAt: "ISO datetime"
}
```

### 9.5 `learnerPresentationProfiles`

```js
{
  id: "uuid",
  studentId: "student-id",
  scores: {
    visual: 3,
    readWrite: 1,
    workedExample: 3,
    practice: 1
  },
  primaryMode: "mixed",
  secondaryMode: "workedExample",
  manualMode: null,
  rawAnswers: [],
  source: "questionnaire",
  questionnaireVersion: "presentation-v1",
  completedAt: "ISO datetime",
  updatedAt: "ISO datetime"
}
```

### 9.6 `adaptiveResources`

```js
{
  id: "uuid",
  knowledgePointId: "alg-1",
  mode: "visual" | "readWrite" | "workedExample" | "practice",
  title: "资源标题",
  resourceType: "diagram" | "concept" | "worked_example" | "practice_hint",
  content: {},
  reviewStatus: "pending" | "approved" | "withdrawn",
  createdBy: "user-id",
  reviewedBy: "user-id"
}
```

### 9.7 `teacherSupportRequests`

```js
{
  id: "uuid",
  studentId: "student-id",
  classId: "class-id",
  teacherId: "teacher-id",
  roundId: "round-id",
  knowledgePointId: "alg-1",
  requestType: "need_encouragement" | "cannot_start" | "repeated_failure" | "other",
  message: "学生主动填写，可为空",
  sharedSummary: {
    controlLevel: "low",
    mentalEffort: 5,
    accuracy: 0.5
  },
  status: "open" | "acknowledged" | "resolved",
  teacherReply: "",
  createdAt: "ISO datetime",
  resolvedAt: null
}
```

## 10. 后端服务设计

建议新增：

```text
backend/services/adaptive-learning.js
backend/services/control-assessment.js
backend/services/adaptive-question-selector.js
backend/services/presentation-preference.js
backend/services/emotional-guidance.js
backend/services/adaptive-resources.js
```

### 10.1 `control-assessment.js`

职责：

- 校验问卷原始答案。
- 计算控制感分数与等级。
- 生成学生端友好状态，不返回心理标签解释。
- 保持计分规则版本化。

### 10.2 `adaptive-learning.js`

职责：

- 接收学习轮次与自评。
- 执行决策矩阵和保护规则。
- 保存输入、输出、原因和规则版本。
- 不直接操作页面组件。

核心函数建议：

```js
evaluateRound(round, assessment, history)
decideDifficulty(input)
decideScaffold(input)
buildAdaptationDecision(input)
```

### 10.3 `adaptive-question-selector.js`

在现有推荐逻辑基础上增加：

- 白名单检查。
- 已学范围检查。
- 审核状态检查。
- 目标任务复杂度过滤。
- 最近作答与复习间隔过滤。
- 同知识点变式优先。
- 题库不足回退。

选题结果必须继续使用现有 `publicQuestion()` 隐藏答案和解析。

### 10.4 `presentation-preference.js`

职责：

- 计算四维问卷分数。
- 处理并列和混合偏好。
- 读取学生手动覆盖模式。
- 记录行为证据，但首期不自动大幅切换。

### 10.5 `emotional-guidance.js`

职责：

- 根据 `emotionalTone` 选择便利贴模板。
- 返回稳定的文案 ID，避免一次请求多次随机变化。
- 对外只返回文案、表情、行动入口，不返回内部心理标签。

## 11. API 设计

所有接口沿用现有 JWT 和行级权限模型。

### 11.1 学生端

#### 获取适配初始化状态

`GET /api/student/adaptation/status`

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "preferenceAssessmentRequired": true,
    "activeKnowledgePointIds": ["alg-1", "alg-2", "algebra-3", "alg-3"]
  }
}
```

#### 提交资源呈现偏好问卷

`POST /api/student/adaptation/presentation-assessment`

请求必须带问卷版本和完整原始答案。重复提交使用 `requestId` 幂等。

#### 获取或切换呈现模式

- `GET /api/student/adaptation/presentation-profile`
- `PUT /api/student/adaptation/presentation-profile`

手动切换只更新 `manualMode`，不得覆盖原始问卷。

#### 提交轮后自评

`POST /api/student/learning-rounds/:roundId/reflection`

请求：

```json
{
  "requestId": "uuid",
  "emotion": "worried",
  "controlItem1": 2,
  "controlItem2": 2,
  "mentalEffort": 4,
  "questionnaireVersion": "control-v1"
}
```

响应：

```json
{
  "success": true,
  "data": {
    "decisionId": "uuid",
    "studentState": "需要更多支持",
    "nextTask": {
      "targetComplexity": "low",
      "scaffoldLevel": "high",
      "layoutDensity": "low",
      "presentationMode": "workedExample"
    },
    "stickyNote": {
      "tone": "comfort",
      "emoji": "worried-hopeful",
      "text": "这组题确实不轻松，没关系。下一轮我们把步骤拆小，一步一步来。",
      "teacherSupportVisible": true
    }
  }
}
```

#### 获取下一轮任务

`GET /api/student/learning-rounds/:roundId/next-task`

只有完成自评并生成决策后才返回适配任务。无足量题目时返回回退说明，不得静默返回跨范围题目。

#### 创建教师支持请求

`POST /api/student/support-requests`

必须由学生主动触发，禁止系统自动代发。

### 11.2 原提交接口扩展

以下接口保持原有返回字段，只增加可选字段：

- `POST /api/student/practice/:knowledgePointId/submit`
- `POST /api/student/assignments/:id/submit`

新增返回：

```json
{
  "learningRound": {
    "id": "uuid",
    "reflectionRequired": true,
    "status": "awaiting_reflection"
  }
}
```

等待教师复核时：

```json
{
  "learningRound": {
    "id": "uuid",
    "reflectionRequired": false,
    "status": "awaiting_review"
  }
}
```

教师复核完成后再把轮次更新为 `awaiting_reflection`。

### 11.3 教师端

- `GET /api/teacher/analytics/adaptation/class/:classId`
- `GET /api/teacher/analytics/adaptation/student/:studentId`
- `GET /api/teacher/support-requests`
- `PUT /api/teacher/support-requests/:id`
- `GET /api/teacher/questions/complexity-coverage`

### 11.4 管理员端

- 复用现有题目 CRUD，增加任务复杂度字段。
- 增加适配机制开关和阈值配置。
- 增加自适应资源 CRUD。
- 只有管理员可以修改全局阈值和规则版本。

## 12. 前端设计

### 12.1 新增页面与组件

```text
frontend/src/views/student/PresentationPreference.vue
frontend/src/components/adaptive/AfterRoundReflection.vue
frontend/src/components/adaptive/EmotionSelector.vue
frontend/src/components/adaptive/LikertScale.vue
frontend/src/components/adaptive/AdaptationPreview.vue
frontend/src/components/adaptive/EmotionalStickyNote.vue
frontend/src/components/adaptive/PixelTutorTeacher.vue
frontend/src/components/adaptive/SteppedExampleCard.vue
frontend/src/components/adaptive/TeacherSupportEntry.vue
frontend/src/components/adaptive/PresentationModeSwitcher.vue
frontend/src/stores/adaptation.js
```

### 12.2 自评卡交互

- 作答提交成功后先展示原有结果。
- 如果 `reflectionRequired=true`，在结果区域内展示自评卡，不使用突然覆盖全屏的强打断弹窗。
- 未完成所有必答项时禁用提交按钮，并指出遗漏项。
- 提交时按钮进入 loading，防止重复提交。
- 成功后自评卡收起，显示适配预览与便利贴。
- 网络失败时保存本地草稿，恢复后允许重试同一 `requestId`。

### 12.3 页面密度

`layoutDensity=low` 时：

- 主内容单列或窄双列。
- 每步单独一行。
- 增大段间距和题目留白。
- 一次只突出一个操作。
- 次要信息折叠。
- 禁止同时显示多个弹窗、提示条和浮层。

`layoutDensity=standard` 时保持现有页面风格。

### 12.4 视觉基线

高保真概念稿：

`docs/ui-mockups/cognitive-control-student-v2-pixel-teacher.png`

像素老师素材：

`frontend/public/images/pixel-math-teacher.png`

实现时不得把整张概念稿作为背景图片，应使用真实 DOM、CSS、KaTeX 和可访问表单控件还原。

### 12.5 可访问性

- 表情选项必须同时有文字和 `aria-label`。
- 不能只用颜色表达状态。
- 李克特量表支持键盘操作。
- 便利贴关闭按钮有明确可访问名称。
- 动画遵循 `prefers-reduced-motion`。
- 最小正文不低于 14px，主要答题文字不低于 16px。

## 13. 教师端统计

### 13.1 班级统计

- 当前控制感等级分布。
- 心理努力分布。
- 任务复杂度分布。
- 本周难度上调、维持、下调次数。
- 高支架使用比例。
- 多模态呈现偏好分布。
- 学生主动求助数量及处理状态。

所有图表必须显示样本数和时间范围。样本不足时不显示百分比结论。

### 13.2 学生详情

- 控制感和心理努力随时间变化。
- 正确率、任务复杂度与控制感的联合趋势。
- 历史适配决策及可解释原因。
- 当前呈现偏好四维分数。
- 学生主动求助历史。

禁止显示“心理健康正常/异常”等诊断性结论。

## 14. 题库后台

白名单内题目编辑表单增加：

- 任务复杂度必填。
- 五项复杂度维度评分。
- 标注依据。
- “保存为待复核”和“审核通过”状态。

题库列表增加：

- 复杂度筛选。
- 复杂度待标注筛选。
- 各知识点低、中、高题量覆盖。

启用机制前，每个知识点建议最低题量：

- 低复杂度不少于 12 道。
- 中复杂度不少于 12 道。
- 高复杂度不少于 8 道。
- 每个等级至少包含 3 道不同题目，避免重复题造成虚假掌握。

题量不足时后台显示阻塞提示，但不自动生成未经教师审核的题目。

## 15. 配置与功能开关

在系统设置中新增：

```js
{
  adaptiveLearningEnabled: false,
  adaptiveKnowledgePointIds: ["alg-1", "alg-2", "algebra-3", "alg-3"],
  controlLowMax: 2.4,
  controlHighMin: 3.8,
  accuracyLowMax: 0.6,
  accuracyHighMin: 0.85,
  highMentalEffortMin: 4,
  minQuestionsPerRound: 4,
  maxQuestionsPerRound: 6,
  adaptationRulesVersion: "adaptive-v1"
}
```

默认关闭。完成数据迁移、题库标注和测试后，由管理员按学校开启。

## 16. 兼容与迁移

### 16.1 数据迁移

1. 新增集合，默认空数组。
2. 为题目补充兼容读取：缺失复杂度时视为 `medium`，但标记 `complexityUnreviewed=true`。
3. 不修改历史答题、掌握度和错题数据。
4. 不为历史答题伪造控制感或心理努力记录。
5. 新机制只从启用时间之后产生学习轮次。

### 16.2 功能回退

- 功能关闭：完全使用现有流程。
- 白名单外：完全使用现有流程。
- 学生未完成偏好问卷：可以保存答题，但进入下一轮前要求完成；页面使用标准布局兜底。
- 自评接口失败：保留本轮结果，不重复记分；允许稍后重试。
- 题库不足：回退到现有推荐并明确记录原因。
- AI 助教不可用：不影响自评、便利贴、教师求助和适配决策。

## 17. 权限、隐私与伦理

- 学生只能读取自己的自评、偏好和决策。
- 教师只能读取自己班级学生的数据。
- 管理员可以配置规则，但不能修改学生已经提交的原始自评答案。
- 原始问卷属于敏感教育数据，备份和导出需沿用管理员权限。
- 删除学生账号时同步删除所有新增集合中的个人记录。
- 日志只记录操作和记录 ID，不记录完整自评文案。
- UI 和文档明确说明结果用于学习支持，不构成心理诊断。
- 教师支持请求必须由学生主动发送。
- AI 助教不得根据自评推断疾病、家庭情况或人格特征。

## 18. 测试计划

### 18.1 单元测试

- 控制感边界值 2.4、3.8。
- 正确率边界值 0.60、0.85。
- 九种正确率 × 控制感组合。
- 高心理努力阻止升级。
- 每轮最多升降一级。
- 连续两轮才升级。
- 低控制感不必然降低题目难度。
- 白名单外不生成新增决策。
- 文案不包含内部心理标签。
- 并列偏好生成 `mixed`。

### 18.2 API 测试

- 学生无法提交他人的轮次自评。
- 教师无法查看其他班级自评。
- 自评重复提交保持幂等。
- 待复核轮次不能提前适配。
- 学生端响应不泄露题目答案。
- 题库不足不会跨已学范围取题。
- 停用功能后原接口行为不变。
- 账号删除清除新增数据。

### 18.3 前端测试

- 自评不可空白提交。
- 键盘可完成量表。
- 便利贴可关闭且不遮挡题目。
- 低密度布局在 1366px、1024px 和移动端可用。
- 像素老师不遮挡提交按钮。
- AI 服务断开不影响适配 UI。
- 刷新后能够恢复未提交自评。

### 18.4 端到端验收

至少覆盖：

1. 学生首次登录并完成呈现偏好问卷。
2. 进入白名单知识点完成一轮练习。
3. 提交低控制感和高心理努力自评。
4. 系统降低任务复杂度或增加支架。
5. 页面进入低信息密度模式并显示安抚便利贴。
6. 学生主动发送教师支持请求。
7. 教师查看并处理请求。
8. 学生连续高正确率、高控制感、低努力后获得变式挑战。
9. 白名单外知识点保持原有流程。

## 19. 效果评估与答辩指标

试点不能只用“功能已上线”证明教育效果。建议设置三组：

- A 组：原有推荐机制。
- B 组：第一层认知—心理协同适配。
- C 组：第一层 + 多模态呈现适配。

主要指标：

- 后测和延迟后测正确率。
- 同知识点变式迁移表现。
- 单位学习时间的有效正确率。
- 感知心理努力变化。
- 情境性控制感变化。
- 中途退出率和轮次完成率。
- 教师求助处理时间。

次要指标：

- 页面模式主动切换率。
- 不同模式下完成率。
- 题目纠错率。
- 自动适配被教师覆盖的比例。

答辩时不得仅根据满意度或点击量宣称学习效果提高。

## 20. 开发阶段

### 阶段一：数据与规则基础

- 新增题目复杂度字段和后台编辑。
- 新增集合与功能开关。
- 实现控制感计分和决策引擎。
- 编写决策矩阵单元测试。

### 阶段二：学生轮后自评与情感引导

- 创建学习轮次。
- 接入作业和专项练习提交。
- 实现自评卡、适配预览和便利贴。
- 接入像素老师素材。

### 阶段三：自适应选题与支架

- 扩展推荐逻辑。
- 实现任务复杂度过滤。
- 实现分步例题和页面密度切换。
- 完成完整闭环测试。

### 阶段四：资源呈现偏好

- 首次问卷与个人设置。
- 四种呈现模式。
- 资源后台和资源审核。
- 记录不同模式下的学习效果。

### 阶段五：教师统计和情感介入

- 班级统计面板。
- 学生历史详情。
- 教师支持请求队列。
- 导出与试点评估。

## 21. 最终验收标准

满足以下条件才可认为新增机制完成：

- 原有三端和学习闭环无回归。
- 白名单内题目能够由教师标注并审核任务复杂度。
- 学生轮后自评保存全部原始数据且不可空白提交。
- 系统能够解释每次任务和页面调整原因。
- 难度与教学支架分别输出。
- 低控制感学生获得安抚、分步和教师求助入口。
- 高控制感学生获得变式和解释要求，而不是只有表扬。
- 像素老师素材在桌面端和移动端不遮挡核心操作。
- 多模态偏好可以混合、切换和重新测评。
- 白名单外保持原有逻辑和样式。
- 学生看不到标准答案、内部心理标签或教师端分析字段。
- 教师只能访问授权班级。
- 功能可以通过开关安全关闭并回退到原流程。
- 自动化测试覆盖规则边界、权限、幂等和端到端闭环。

## 22. 相关实现基线

- 当前学习同步：`backend/services/learning.js`
- 当前掌握度：`backend/services/masteryEngine.js`
- 当前个性化推送：`backend/services/personalized-push.js`
- 当前课程范围：`backend/services/curriculum.js`
- 当前学生接口：`backend/routes/student.js`
- 当前教师共享教学接口：`backend/routes/teaching.js`
- 当前题目校验：`backend/services/question-quality.js`
- 当前学生练习页：`frontend/src/views/student/Practice.vue`
- 当前答题草稿：`frontend/src/composables/useAnswerDraft.js`
- UI 概念稿：`docs/ui-mockups/cognitive-control-student-v2-pixel-teacher.png`
- 像素老师素材：`frontend/public/images/pixel-math-teacher.png`

## 23. 理论参考说明

开发与答辩可引用以下研究方向，但产品不得夸大结论：

- 控制—价值理论强调控制评价与学业情绪之间的关系：<https://doi.org/10.1007/s10648-006-9029-9>
- 自适应任务选择可结合能力与感知负荷：<https://www.sciencedirect.com/science/article/pii/S0361476X08000118>
- 心理努力可使用简短自评量表测量：<https://pmc.ncbi.nlm.nih.gov/articles/PMC5696680/>
- 学习风格匹配证据存在争议，因此本项目采用“资源呈现偏好”而非固定学习类型：<https://pmc.ncbi.nlm.nih.gov/articles/PMC11270031/>

