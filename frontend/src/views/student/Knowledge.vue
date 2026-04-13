<template>
  <div class="knowledge-graph-page">
    <div class="page-header">
      <h2>知识图谱</h2>
      <p>用知识结构定位薄弱点，把补练、错题与掌握变化连成一个闭环。</p>
    </div>

    <div class="hero-strip">
      <div class="hero-card gradient-card">
        <div class="hero-kicker">PERSONALIZED LEARNING MAP</div>
        <div class="hero-title">{{ studentDisplayName }} · 初中数学知识诊断中心</div>
        <div class="hero-desc">
          左侧知识图谱按统一规则着色：已掌握 ≥80%，待巩固 60~79%，薄弱 &lt;60%。点击任意知识点可在右侧直接查看详情、错题、补练题与进步变化。
        </div>
        <div class="hero-tags">
          <span class="hero-tag">知识树联动</span>
          <span class="hero-tag">当前页直接补练</span>
          <span class="hero-tag">自动批改</span>
          <span class="hero-tag">错题本同步</span>
          <span class="hero-tag">掌握度更新</span>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stats-card gradient-card">
          <div class="stats-label">薄弱节点</div>
          <div class="stats-value">{{ masteryBreakdown.weak }}</div>
          <div class="stats-desc">与首页薄弱知识点实时同步</div>
        </div>
        <div class="stats-card gradient-card">
          <div class="stats-label">待巩固</div>
          <div class="stats-value">{{ masteryBreakdown.learning }}</div>
          <div class="stats-desc">与首页知识掌握概览实时同步</div>
        </div>
        <div class="stats-card gradient-card">
          <div class="stats-label">已掌握</div>
          <div class="stats-value">{{ masteryBreakdown.mastered }}</div>
          <div class="stats-desc">与首页知识掌握概览实时同步</div>
        </div>
        <div class="stats-card gradient-card">
          <div class="stats-label">当前聚焦</div>
          <div class="stats-value small">{{ selectedKnowledge.name }}</div>
          <div class="stats-desc">{{ getMasteryLabel(selectedKnowledge.masteryRate) }}</div>
        </div>
      </div>
    </div>

    <div class="top-layout">
      <el-card class="gradient-card chart-card">
        <template #header>
          <div class="section-header">
            <div>
              <div class="section-title">初中数学知识树</div>
              <div class="section-desc">默认展开前两层，可缩放、拖拽、点击节点联动右侧内容。</div>
            </div>
            <div class="legend-row">
              <span class="legend-item"><i class="legend-dot green"></i>掌握 ≥80%</span>
              <span class="legend-item"><i class="legend-dot yellow"></i>待巩固 60~79%</span>
              <span class="legend-item"><i class="legend-dot red"></i>薄弱 &lt;60%</span>
            </div>
          </div>
        </template>
        <div ref="chartRef" class="tree-chart"></div>
      </el-card>

      <div class="detail-column">
        <el-card class="gradient-card detail-card">
          <template #header>
            <div class="section-header compact">
              <div>
                <div class="section-title">知识点详情</div>
                <div class="section-desc">当前所选知识点的即时诊断与状态概览。</div>
              </div>
              <el-tag :type="getTagTypeByRate(selectedKnowledge.masteryRate)">
                {{ selectedKnowledge.masteryRate }}%
              </el-tag>
            </div>
          </template>

          <div class="focus-title">{{ selectedKnowledge.name }}</div>
          <div class="focus-meta">
            <span class="focus-pill">状态：{{ getMasteryLabel(selectedKnowledge.masteryRate) }}</span>
            <span class="focus-pill">错题 {{ selectedWrongQuestions.length }}</span>
            <span class="focus-pill">补练 {{ selectedPracticeQuestions.length }}</span>
            <span class="focus-pill">例题 {{ selectedExamples.length }}</span>
          </div>

          <div class="focus-summary">
            <div class="summary-box">
              <div class="summary-label">当前掌握度</div>
              <div class="summary-value">{{ selectedKnowledge.masteryRate }}%</div>
            </div>
            <div class="summary-box">
              <div class="summary-label">推荐优先级</div>
              <div class="summary-value">{{ getPriorityText(selectedKnowledge.masteryRate) }}</div>
            </div>
          </div>
        </el-card>

        <el-card class="gradient-card practice-card">
          <template #header>
            <div class="section-header compact">
              <div>
                <div class="section-title">个性化补练习题</div>
                <div class="section-desc">可在当前页直接作答、自动批改，并同步更新掌握状态。</div>
              </div>
              <el-tag type="warning">{{ selectedPracticeQuestions.length }} 题</el-tag>
            </div>
          </template>

          <div v-if="selectedPracticeQuestions.length" class="practice-question-list">
            <div
              v-for="(item, index) in selectedPracticeQuestions"
              :key="item.id || index"
              class="practice-question-item"
            >
              <div class="practice-main">
                <div class="practice-title-row">
                  <div class="practice-title">第 {{ index + 1 }} 题 · {{ getQuestionTypeLabel(item.type) }}</div>
                  <el-tag size="small" effect="plain">{{ getDifficultyLabel(item.difficulty) }}</el-tag>
                </div>

                <div class="practice-text">{{ item.content }}</div>

                <div v-if="item.options && item.options.length" class="practice-options">
                  <div
                    v-for="(option, optionIndex) in item.options"
                    :key="optionIndex"
                    class="practice-option"
                  >
                    {{ String.fromCharCode(65 + optionIndex) }}. {{ option }}
                  </div>
                </div>

                <div class="practice-meta">
                  <span>知识点：{{ selectedKnowledge.name }}</span>
                  <span>难度：{{ getDifficultyLabel(item.difficulty) }}</span>
                </div>
              </div>

              <el-input
                v-model="practiceAnswers[item.id]"
                type="textarea"
                :rows="item.type === 'shortAnswer' ? 4 : 2"
                placeholder="请输入你的答案"
                class="practice-answer-input"
              />

              <div
                v-if="practiceFeedbackMap[item.id]"
                :class="[
                  'practice-feedback',
                  practiceFeedbackMap[item.id].correct ? 'is-correct' : 'is-wrong'
                ]"
              >
                <div class="practice-feedback-title">
                  {{ practiceFeedbackMap[item.id].correct ? '回答正确' : '回答有误' }}
                </div>
                <div>正确答案：{{ practiceFeedbackMap[item.id].answer || '-' }}</div>
                <div v-if="practiceFeedbackMap[item.id].analysis">
                  解析：{{ practiceFeedbackMap[item.id].analysis }}
                </div>
              </div>
            </div>

            <div class="practice-submit-bar">
              <div class="practice-submit-text">
                已作答 {{ selectedPracticeAnsweredCount }} / {{ selectedPracticeQuestions.length }} 题
              </div>
              <div class="practice-submit-actions">
                <el-button @click="resetSelectedPracticeAnswers">清空答案</el-button>
                <el-button
                  type="primary"
                  :loading="selectedPracticeSubmitting"
                  @click="submitSelectedPractice"
                >
                  提交并同步状态
                </el-button>
                <el-button type="primary" plain @click="startPractice()">
                  进入独立补练页
                </el-button>
              </div>
            </div>
          </div>
          <el-empty v-else description="当前知识点暂无可用练习题" />
        </el-card>

        <el-card class="gradient-card example-card">
          <template #header>
            <div class="section-title">例题演示</div>
          </template>

          <div v-if="selectedExamples.length" class="example-list">
            <div v-for="(item, index) in selectedExamples" :key="index" class="example-item">
              <div class="example-title">例题 {{ index + 1 }}：{{ item.title }}</div>
              <div class="example-question">题目：{{ item.question }}</div>
              <div class="example-answer">思路：{{ item.solution }}</div>
            </div>
          </div>
          <el-empty v-else description="当前节点暂无例题演示" />
        </el-card>
      </div>
    </div>

    <div class="bottom-layout">
      <el-card class="gradient-card report-card">
        <template #header>
          <div class="section-title">漏洞报告</div>
        </template>
        <div class="report-text">
          <p><strong>未掌握的知识点：</strong>{{ weakNamesText }}</p>
          <p><strong>普遍问题：</strong>{{ commonProblemText }}</p>
          <p><strong>个人特殊漏洞：</strong>{{ isolatedWeakText }}</p>
          <p><strong>原因分析：</strong>{{ reasonAnalysisText }}</p>
        </div>
      </el-card>

      <el-card class="gradient-card route-card">
        <template #header>
          <div class="section-title">补弱路径</div>
        </template>
        <div class="route-list">
          <div v-for="item in routeSteps" :key="item.step" class="route-item">
            <div class="route-step">{{ item.step }}</div>
            <div class="route-main">
              <div class="route-title">第{{ item.step }}步：{{ item.title }}</div>
              <div class="route-desc">{{ item.desc }}</div>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <div class="bottom-layout">
      <el-card class="gradient-card wrong-book-card">
        <template #header>
          <div class="section-header compact">
            <div>
              <div class="section-title">个人错题本</div>
              <div class="section-desc">所有错题汇总，支持重做、标注掌握状态、添加笔记。</div>
            </div>
            <el-tag type="danger">{{ wrongQuestionBook.length }} 道</el-tag>
          </div>
        </template>

        <div class="wrong-list">
          <div v-for="item in wrongQuestionBook" :key="item.id" class="wrong-item">
            <div class="wrong-head">
              <div class="wrong-title">{{ item.title }}</div>
              <el-tag :type="getTagTypeByRate(getWrongQuestionMasteryRate(item))">
                {{ getMasteryLabel(getWrongQuestionMasteryRate(item)) }}
              </el-tag>
            </div>
            <div class="wrong-text">题干：{{ item.content || item.stem }}</div>
            <div class="wrong-text">上次作答：{{ item.studentAnswerDisplay || item.studentAnswer || '未作答' }}</div>
            <div class="wrong-text">正确答案：{{ item.answerDisplay || item.answer || '-' }}</div>
            <div class="wrong-note">笔记：{{ item.note || '暂无笔记' }}</div>

            <div class="wrong-actions">
              <el-button type="primary" plain @click="redoWrongQuestion(item)">重做</el-button>
              <el-button
                :type="item.mastered ? 'warning' : 'success'"
                plain
                @click="toggleMastered(item)"
              >
                {{ item.mastered ? '标记未掌握' : '标记已掌握' }}
              </el-button>
              <el-button type="info" plain @click="appendNote(item)">添加笔记</el-button>
            </div>
          </div>
        </div>
      </el-card>

      <el-card class="gradient-card progress-card">
        <template #header>
          <div class="section-header compact">
            <div>
              <div class="section-title">补练结果统计</div>
              <div class="section-desc">补练正确率、知识点掌握度更新，可视化展示学习进步。</div>
            </div>
            <el-tag type="success">持续提升中</el-tag>
          </div>
        </template>

        <div class="progress-overview">
          <div class="progress-box">
            <div class="progress-label">补练正确率</div>
            <div class="progress-value">{{ overallPracticeAccuracy }}%</div>
          </div>
          <div class="progress-box">
            <div class="progress-label">掌握提升</div>
            <div class="progress-value">+{{ totalMasteryGain }}%</div>
          </div>
        </div>

        <div class="progress-bars">
          <div v-for="item in progressStats" :key="item.name" class="progress-item">
            <div class="progress-item-head">
              <span>{{ item.name }}</span>
              <span>{{ item.after }}%</span>
            </div>
            <div class="progress-track">
              <div class="progress-before" :style="{ width: item.before + '%' }"></div>
              <div class="progress-after" :style="{ width: item.after + '%' }"></div>
            </div>
            <div class="progress-meta">前：{{ item.before }}% → 后：{{ item.after }}%</div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'
import * as echarts from 'echarts'

const router = useRouter()

const userInfo = (() => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}')
  } catch (error) {
    return {}
  }
})()

const studentDisplayName = computed(() => userInfo.name || userInfo.username || '当前学生')

const chartRef = ref(null)
let chart = null

const knowledgeMastery = {
  有理数运算: 88,
  整式加减: 82,
  因式分解: 35,
  一元一次方程: 84,
  一元二次方程求根公式: 65,
  二次函数图像性质: 45,
  一次函数图像: 86,
  反比例函数: 72,
  全等三角形判定: 81,
  相似三角形性质: 68,
  圆的基本性质: 74,
  数据平均数与中位数: 90,
  概率初步: 79
}

const dependencyMap = {
  因式分解: [],
  一元二次方程求根公式: ['因式分解'],
  二次函数图像性质: ['一元二次方程求根公式', '因式分解'],
  反比例函数: ['一次函数图像'],
  相似三角形性质: ['全等三角形判定']
}

const exampleBank = {
  因式分解: [
    { title: '提公因式', question: '分解因式：6x²-9x', solution: '先提公因式 3x，得到 3x(2x-3)。' },
    { title: '十字相乘', question: '分解因式：x²-5x+6', solution: '寻找两个数积为 6、和为 -5，即 -2 与 -3，所以是 (x-2)(x-3)。' }
  ],
  一元二次方程求根公式: [
    { title: '直接套公式', question: '解方程：x²-3x-4=0', solution: 'a=1,b=-3,c=-4，代入公式得 x=(3±5)/2，所以 x=4 或 -1。' }
  ],
  二次函数图像性质: [
    { title: '求对称轴', question: '求 y=x²-4x+3 的对称轴', solution: '对称轴 x=-b/2a=4/2=2。' },
    { title: '顶点坐标', question: '求 y=x²-6x+5 的顶点', solution: '先求对称轴 x=3，再代入得 y=-4，所以顶点是 (3,-4)。' }
  ],
  反比例函数: [
    { title: '函数值计算', question: '已知 y=6/x，求 x=3 时 y', solution: '代入 x=3，得 y=6/3=2。' }
  ],
  相似三角形性质: [
    { title: '面积比', question: '若相似比是 2:3，面积比是多少', solution: '面积比等于相似比的平方，所以是 4:9。' }
  ]
}

const weakPointList = ref([])
const wrongQuestionBook = ref([])
const selectedPracticeQuestions = ref([])
const practiceAnswers = ref({})
const practiceFeedbackMap = ref({})
const selectedPracticeSubmitting = ref(false)

const progressStats = ref([
  { name: '因式分解', before: 35, after: 52 },
  { name: '一元二次方程求根公式', before: 65, after: 74 },
  { name: '二次函数图像性质', before: 45, after: 61 },
  { name: '相似三角形性质', before: 68, after: 76 }
])

const selectedKnowledge = ref({
  name: '因式分解',
  masteryRate: knowledgeMastery['因式分解']
})

const knowledgeTree = {
  name: '初中数学',
  children: [
    {
      name: '数与式',
      children: [
        {
          name: '整式与因式分解',
          children: [{ name: '有理数运算' }, { name: '整式加减' }, { name: '因式分解' }]
        }
      ]
    },
    {
      name: '方程与不等式',
      children: [
        {
          name: '方程基础',
          children: [{ name: '一元一次方程' }, { name: '一元二次方程求根公式' }]
        }
      ]
    },
    {
      name: '函数',
      children: [
        {
          name: '一次与反比例函数',
          children: [{ name: '一次函数图像' }, { name: '反比例函数' }]
        },
        {
          name: '二次函数',
          children: [{ name: '二次函数图像性质' }]
        }
      ]
    },
    {
      name: '几何',
      children: [
        {
          name: '三角形',
          children: [{ name: '全等三角形判定' }, { name: '相似三角形性质' }]
        },
        {
          name: '圆',
          children: [{ name: '圆的基本性质' }]
        }
      ]
    },
    {
      name: '统计与概率',
      children: [
        {
          name: '数据分析',
          children: [{ name: '数据平均数与中位数' }, { name: '概率初步' }]
        }
      ]
    }
  ]
}

const selectedWrongQuestions = computed(() =>
  wrongQuestionBook.value.filter(item => {
    return Array.isArray(item.knowledgePoints) && item.knowledgePoints.some(kpId => {
      const matched = weakPointList.value.find(kp => kp.id === kpId)
      return matched && matched.name === selectedKnowledge.value.name
    })
  })
)

const selectedExamples = computed(() => exampleBank[selectedKnowledge.value.name] || [])

const selectedPracticeAnsweredCount = computed(() =>
  selectedPracticeQuestions.value.filter(item => String(practiceAnswers.value[item.id] || '').trim()).length
)

const allLeafNodes = computed(() =>
  weakPointList.value.map(item => ({ name: item.name, score: parseInt(item.masteryRate || 0) }))
)

const masteryBreakdown = computed(() => {
  return allLeafNodes.value.reduce((acc, item) => {
    const score = parseInt(item.score || 0)
    if (score >= 80) acc.mastered++
    else if (score >= 60) acc.learning++
    else acc.weak++
    return acc
  }, { mastered: 0, learning: 0, weak: 0 })
})

const weakNodes = computed(() => weakPointList.value.filter(item => parseInt(item.masteryRate || 0) < 60))

const weakNamesText = computed(() => weakNodes.value.map(item => item.name).join('、') || '暂无')

const commonProblemText = computed(() =>
  allLeafNodes.value
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(item => `${item.name}（掌握度 ${item.score}%）`)
    .join('；')
)

const isolatedWeakText = computed(() => {
  const isolated = allLeafNodes.value.filter(
    item => item.score < 60 && (!dependencyMap[item.name] || dependencyMap[item.name].length === 0)
  )
  return isolated.length
    ? isolated.map(item => `${item.name}（掌握度 ${item.score}%）`).join('、')
    : '当前没有明显孤立薄弱点'
})

const reasonAnalysisText = computed(() => {
  const parts = allLeafNodes.value
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 4)
    .map(item => {
      if (item.score < 60) return `${item.name}当前掌握度为 ${item.score}%，仍处于薄弱区间，建议优先补练并结合错题回顾。`
      if (item.score < 80) return `${item.name}当前掌握度为 ${item.score}%，已进入待巩固区间，建议持续复盘。`
      return `${item.name}当前掌握度较稳定。`
    })
  return parts.join('') || '当前整体掌握情况稳定。'
})

const routeSteps = computed(() =>
  allLeafNodes.value
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((item, index) => ({
      step: index + 1,
      title: item.name,
      desc: item.score < 60
        ? `当前掌握度 ${item.score}%，建议优先补练并回顾对应错题。`
        : item.score < 80
          ? `当前掌握度 ${item.score}%，建议继续巩固，避免回落。`
          : `当前掌握度 ${item.score}%，建议通过少量练习保持稳定。`
    }))
)

const overallPracticeAccuracy = computed(() => {
  const list = progressStats.value
  if (!list.length) return 0
  return Math.round(list.reduce((sum, item) => sum + item.after, 0) / list.length)
})

const totalMasteryGain = computed(() => {
  return progressStats.value.reduce((sum, item) => sum + (item.after - item.before), 0)
})

function loadWeakPoints() {
  return api.get('/student/weak-points')
    .then((res) => {
      if (res.success) {
        weakPointList.value = res.data || []

        weakPointList.value.forEach(item => {
          knowledgeMastery[item.name] = item.masteryRate
        })

        if (selectedKnowledge.value && selectedKnowledge.value.name) {
          const matched = weakPointList.value.find(item => item.name === selectedKnowledge.value.name)
          if (matched) {
            selectedKnowledge.value = {
              name: matched.name,
              masteryRate: matched.masteryRate
            }
          }
        }
      }
    })
    .catch((error) => {
      console.error('加载薄弱知识点失败:', error)
      ElMessage.error('加载薄弱知识点失败')
    })
}

function loadWrongQuestionBook() {
  return api.get('/student/wrong-questions')
    .then((res) => {
      if (res.success) {
        wrongQuestionBook.value = res.data || []
      }
    })
    .catch((error) => {
      console.error('加载错题本失败:', error)
      ElMessage.error('加载错题本失败')
    })
}

function loadSelectedPracticeQuestions() {
  const target = weakPointList.value.find(item => item.name === selectedKnowledge.value.name)
  if (!target || !target.id) {
    selectedPracticeQuestions.value = []
    practiceAnswers.value = {}
    practiceFeedbackMap.value = {}
    return Promise.resolve()
  }

  return api.get('/student/practice/' + target.id)
    .then((res) => {
      if (res.success) {
        selectedPracticeQuestions.value = Array.isArray(res.data && res.data.questions) ? res.data.questions : []
        practiceAnswers.value = {}
        practiceFeedbackMap.value = {}
      }
    })
    .catch((error) => {
      console.error('加载知识点补练失败:', error)
      ElMessage.error('加载知识点补练失败')
    })
}

function buildPracticeAnalysis(question, isCorrect) {
  if (isCorrect) return '本题作答正确，当前知识点状态已同步更新。'
  if (question.type === 'choice') return '建议重新核对题干条件与选项关系。'
  if (question.type === 'fill') return '建议检查计算步骤、符号和结果是否完整。'
  return '建议对照标准答案重新梳理解题步骤。'
}

function resetSelectedPracticeAnswers() {
  practiceAnswers.value = {}
  practiceFeedbackMap.value = {}
}

function getQuestionTypeLabel(type) {
  if (type === 'choice') return '选择题'
  if (type === 'fill') return '填空题'
  if (type === 'shortAnswer') return '简答题'
  return '题目'
}

function getDifficultyLabel(level) {
  if (level === 'easy') return '基础'
  if (level === 'medium') return '提升'
  if (level === 'hard') return '挑战'
  return level || '常规'
}

function submitSelectedPractice() {
  const target = weakPointList.value.find(item => item.name === selectedKnowledge.value.name)
  if (!target || !target.id) {
    ElMessage.warning('当前知识点暂无可提交的补练')
    return
  }

  const questionIds = selectedPracticeQuestions.value
    .map(item => item.id)
    .filter(id => String(practiceAnswers.value[id] || '').trim())

  if (!questionIds.length) {
    ElMessage.warning('请至少完成一道题')
    return
  }

  selectedPracticeSubmitting.value = true
  api.post('/student/practice/' + target.id + '/submit', {
    answers: questionIds.reduce((acc, id) => {
      acc[id] = String(practiceAnswers.value[id]).trim()
      return acc
    }, {}),
    questionIds,
    mode: 'weak-point',
    title: selectedKnowledge.value.name + ' · 个性化补练'
  })
    .then((res) => {
      if (res.success) {
        const results = Array.isArray(res.data && res.data.questionResults) ? res.data.questionResults : []
        const nextFeedback = {}

        selectedPracticeQuestions.value.forEach((question) => {
          const result = results.find(item => item.questionId === question.id)
          if (result) {
            nextFeedback[question.id] = {
              correct: !!result.correct,
              answer: question.answerDisplay || question.answer || '-',
              analysis: buildPracticeAnalysis(question, !!result.correct)
            }
          }
        })

        practiceFeedbackMap.value = nextFeedback
        ElMessage.success(res.message || '补练提交成功')

        return Promise.all([
          loadWeakPoints(),
          loadWrongQuestionBook(),
          loadSelectedPracticeQuestions()
        ]).then(() => {
          refreshProgressStatsFromWeakPoints()
          rebuildChart()
        })
      }
    })
    .catch((error) => {
      console.error('提交知识点补练失败:', error)
      ElMessage.error('提交知识点补练失败')
    })
    .finally(() => {
      selectedPracticeSubmitting.value = false
    })
}

function refreshProgressStatsFromWeakPoints() {
  progressStats.value = weakPointList.value
    .filter(item => item.masteryRate < 100)
    .slice(0, 6)
    .map(item => {
      const before = Math.max(0, item.masteryRate - 10)
      return {
        name: item.name,
        before,
        after: item.masteryRate
      }
    })
}

function getNodeColor(score) {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#fbbf24'
  return '#ef4444'
}

function getMasteryLabel(score) {
  if (score >= 80) return '已掌握'
  if (score >= 60) return '待巩固'
  return '薄弱'
}

function getWrongQuestionMasteryRate(item) {
  const kpId = item && Array.isArray(item.knowledgePoints) && item.knowledgePoints.length ? item.knowledgePoints[0] : ''
  const matched = weakPointList.value.find(point => point.id === kpId)
  if (matched) return parseInt(matched.masteryRate || 0)
  return item.mastered ? 80 : 59
}

function getTagTypeByRate(score) {
  if (score >= 80) return 'success'
  if (score >= 60) return 'warning'
  return 'danger'
}

function getPriorityText(score) {
  if (score < 40) return '高'
  if (score < 60) return '中'
  return '常规'
}

function enrichTree(node, depth = 0) {
  const children = node.children || []
  const score = knowledgeMastery[node.name]
  const enrichedChildren = children.map(child => enrichTree(child, depth + 1))

  const currentScore =
    typeof score === 'number'
      ? score
      : enrichedChildren.length
        ? Math.round(
            enrichedChildren.reduce((sum, item) => sum + (item.masteryScore || 0), 0) /
              enrichedChildren.length
          )
        : 82

  return {
    ...node,
    collapsed: !(depth < 2),
    masteryScore: currentScore,
    value: currentScore,
    itemStyle: {
      color: getNodeColor(currentScore),
      borderColor: '#dbeafe',
      borderWidth: children.length ? 1.2 : 1.6
    },
    lineStyle: {
      color: getNodeColor(currentScore),
      width: children.length ? 1.6 : 2.2
    },
    label: {
      color: '#e5eefc',
      fontSize: children.length ? 14 : 13,
      fontWeight: children.length ? 700 : 600
    },
    children: enrichedChildren
  }
}

function initChart() {
  if (!chartRef.value) return

  chart = echarts.init(chartRef.value)
  const data = enrichTree(knowledgeTree)

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter(params) {
        const dataItem = params.data || {}
        const score = typeof dataItem.masteryScore === 'number' ? dataItem.masteryScore : null
        return `
          <div style="font-weight:700;margin-bottom:6px;">${dataItem.name}</div>
          <div>掌握状态：${score !== null ? getMasteryLabel(score) : '结构节点'}</div>
          <div>掌握度：${score !== null ? score + '%' : '—'}</div>
          <div style="margin-top:6px;color:#94a3b8;">点击查看右侧详情与下方报告</div>
        `
      }
    },
    series: [
      {
        type: 'tree',
        data: [data],
        top: '4%',
        left: '6%',
        bottom: '4%',
        right: '14%',
        symbol: 'circle',
        symbolSize: 18,
        roam: true,
        expandAndCollapse: true,
        initialTreeDepth: 2,
        orient: 'LR',
        edgeShape: 'polyline',
        edgeForkPosition: '50%',
        lineStyle: {
          width: 2,
          curveness: 0.4
        },
        label: {
          position: 'left',
          verticalAlign: 'middle',
          align: 'right',
          backgroundColor: 'rgba(15,23,42,0.45)',
          borderRadius: 12,
          padding: [7, 12]
        },
        leaves: {
          label: {
            position: 'right',
            align: 'left'
          }
        },
        emphasis: {
          focus: 'descendant'
        }
      }
    ]
  })

  chart.on('click', function (params) {
    if (params && params.data && params.data.name) {
      selectedKnowledge.value = {
        name: params.data.name,
        masteryRate: typeof params.data.masteryScore === 'number' ? params.data.masteryScore : 82
      }
      loadSelectedPracticeQuestions()
    }
  })
}

function rebuildChart() {
  if (chart) {
    chart.dispose()
    chart = null
  }
  nextTick().then(() => {
    initChart()
  })
}

function handleResize() {
  if (chart) chart.resize()
}

function startPractice() {
  if (!selectedKnowledge.value || !selectedKnowledge.value.name) {
    ElMessage.warning('请先选择一个知识点')
    return
  }

  const target = weakPointList.value.find(item => item.name === selectedKnowledge.value.name)
  if (!target || !target.id) {
    ElMessage.warning('当前知识点暂无可用补练')
    return
  }

  router.push({
    path: '/student/practice',
    query: { kpId: target.id }
  })
}

function redoWrongQuestion(item) {
  if (!item || !item.id) {
    ElMessage.warning('当前错题无法重做')
    return
  }

  const kpId = item.knowledgePoints && item.knowledgePoints.length
    ? item.knowledgePoints[0]
    : ''

  router.push({
    path: '/student/practice',
    query: {
      kpId: kpId || 'custom',
      questionId: item.id
    }
  })
}

function toggleMastered(item) {
  if (!item || !item.id) {
    ElMessage.warning('当前错题状态无法更新')
    return
  }

  const url = item.mastered
    ? '/student/wrong-questions/' + item.id + '/unmaster'
    : '/student/wrong-questions/' + item.id + '/master'

  api.post(url)
    .then((res) => {
      if (res.success) {
        item.mastered = !item.mastered
        ElMessage.success(res.message || (item.mastered ? '已标记为已掌握' : '已标记为待巩固'))
        loadWeakPoints().then(() => rebuildChart())
      }
    })
    .catch((error) => {
      console.error('更新掌握状态失败:', error)
      ElMessage.error('更新掌握状态失败')
    })
}

function appendNote(item) {
  if (!item || !item.id) {
    ElMessage.warning('当前错题无法添加笔记')
    return
  }

  ElMessageBox.prompt('请输入错题笔记', '添加笔记', {
    inputValue: item.note || '',
    confirmButtonText: '保存',
    cancelButtonText: '取消'
  })
    .then(({ value }) => {
      api.post('/student/wrong-questions/' + item.id + '/note', {
        note: value || ''
      })
        .then((res) => {
          if (res.success) {
            item.note = value || ''
            ElMessage.success(res.message || '笔记已保存')
          }
        })
        .catch((error) => {
          console.error('保存笔记失败:', error)
          ElMessage.error('保存笔记失败')
        })
    })
    .catch(() => {})
}

onMounted(async () => {
  await Promise.all([
    loadWeakPoints(),
    loadWrongQuestionBook()
  ])

  await loadSelectedPracticeQuestions()
  refreshProgressStatsFromWeakPoints()

  await nextTick()
  initChart()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (chart) chart.dispose()
})
</script>

<style scoped>
.knowledge-graph-page {
  display: flex;
  flex-direction: column;
  gap: 22px;
  --panel-bg: linear-gradient(145deg, rgba(255,255,255,0.96), rgba(247,250,255,0.95));
  --text-main: #0f172a;
  --text-sub: #64748b;
  --line-soft: #e2e8f0;
  --blue: #2563eb;
  --cyan: #0ea5e9;
  --navy: #0f172a;
}

.hero-strip {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 18px;
}

.gradient-card {
  border: 1px solid rgba(148, 163, 184, 0.15);
  background: var(--panel-bg);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(14px);
}

.hero-card,
.stats-card,
.chart-card,
.detail-card,
.practice-card,
.example-card,
.report-card,
.route-card,
.wrong-book-card,
.progress-card {
  border-radius: 24px;
}

.hero-card {
  padding: 28px;
  background:
    radial-gradient(circle at top left, rgba(14, 165, 233, 0.18), transparent 34%),
    radial-gradient(circle at bottom right, rgba(37, 99, 235, 0.14), transparent 30%),
    linear-gradient(145deg, #ffffff, #f7fbff);
}

.hero-kicker {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: #2563eb;
}

.hero-title {
  margin-top: 10px;
  font-size: 30px;
  font-weight: 900;
  line-height: 1.3;
  color: var(--text-main);
}

.hero-desc {
  margin-top: 14px;
  font-size: 14px;
  line-height: 1.9;
  color: var(--text-sub);
}

.hero-tags {
  margin-top: 18px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.hero-tag {
  border-radius: 999px;
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 700;
  color: #1d4ed8;
  background: rgba(37, 99, 235, 0.09);
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.stats-card {
  padding: 20px;
}

.stats-label {
  font-size: 13px;
  color: var(--text-sub);
  font-weight: 700;
}

.stats-value {
  margin-top: 10px;
  font-size: 32px;
  line-height: 1;
  font-weight: 900;
  color: var(--text-main);
}

.stats-value.small {
  font-size: 24px;
  line-height: 1.2;
}

.stats-desc {
  margin-top: 8px;
  color: var(--text-sub);
  line-height: 1.7;
  font-size: 13px;
}

.top-layout,
.bottom-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  gap: 18px;
}

.chart-card :deep(.el-card__body) {
  padding: 0 10px 14px;
}

.tree-chart {
  height: 620px;
  width: 100%;
}

.detail-column {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-header.compact {
  align-items: flex-start;
}

.section-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-main);
}

.section-desc {
  margin-top: 6px;
  color: var(--text-sub);
  line-height: 1.7;
  font-size: 13px;
}

.legend-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: flex-end;
}

.legend-item {
  font-size: 12px;
  color: var(--text-sub);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.legend-dot.green { background: #22c55e; }
.legend-dot.yellow { background: #fbbf24; }
.legend-dot.orange { background: #fb923c; }
.legend-dot.red { background: #ef4444; }

.focus-title {
  font-size: 24px;
  font-weight: 900;
  color: var(--text-main);
}

.focus-meta {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.focus-pill {
  border-radius: 999px;
  padding: 7px 12px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 700;
}

.focus-summary {
  margin-top: 18px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.summary-box,
.progress-box {
  padding: 16px;
  border-radius: 18px;
  background: rgba(37, 99, 235, 0.05);
  border: 1px solid rgba(37, 99, 235, 0.08);
}

.summary-label,
.progress-label {
  font-size: 13px;
  color: var(--text-sub);
  font-weight: 700;
}

.summary-value,
.progress-value {
  margin-top: 8px;
  font-size: 28px;
  font-weight: 900;
  color: var(--text-main);
}

.practice-question-list,
.example-list,
.route-list,
.wrong-list,
.progress-bars {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.practice-question-item,
.example-item,
.route-item,
.wrong-item,
.progress-item {
  border-radius: 18px;
  padding: 18px;
  background: linear-gradient(135deg, #ffffff, #f8fbff);
  border: 1px solid #e8eef8;
  box-shadow: 0 10px 24px rgba(31, 41, 55, 0.06);
}

.practice-title-row,
.progress-item-head,
.wrong-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.practice-title,
.example-title,
.wrong-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-main);
}

.practice-text,
.example-question,
.example-answer,
.route-desc,
.wrong-text,
.wrong-note,
.report-text,
.progress-meta {
  margin-top: 10px;
  color: var(--text-sub);
  line-height: 1.85;
}

.practice-options {
  margin-top: 12px;
  display: grid;
  gap: 8px;
}

.practice-option {
  padding: 10px 12px;
  border-radius: 12px;
  background: #f8fafc;
  color: #334155;
}

.practice-meta {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  color: var(--text-sub);
  font-size: 13px;
}

.practice-answer-input {
  margin-top: 16px;
}

.practice-feedback {
  margin-top: 14px;
  border-radius: 14px;
  padding: 14px 16px;
}

.practice-feedback.is-correct {
  background: #f0fdf4;
  color: #166534;
}

.practice-feedback.is-wrong {
  background: #fff7ed;
  color: #9a3412;
}

.practice-feedback-title {
  font-weight: 800;
  margin-bottom: 8px;
}

.practice-submit-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.practice-submit-text {
  color: var(--text-sub);
  font-size: 13px;
}

.practice-submit-actions,
.wrong-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.route-item {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.route-step {
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2563eb, #0ea5e9);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
}

.route-title {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-main);
}

.report-text p {
  margin: 0 0 10px;
}

.progress-overview {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}

.progress-track {
  margin-top: 8px;
  width: 100%;
  height: 12px;
  border-radius: 999px;
  overflow: hidden;
  background: #e5e7eb;
  position: relative;
}

.progress-before {
  position: absolute;
  inset: 0 auto 0 0;
  background: rgba(148, 163, 184, 0.45);
}

.progress-after {
  position: absolute;
  inset: 0 auto 0 0;
  background: linear-gradient(90deg, #2563eb, #0ea5e9);
}

@media (max-width: 1200px) {
  .hero-strip,
  .top-layout,
  .bottom-layout {
    grid-template-columns: 1fr;
  }

  .tree-chart {
    height: 520px;
  }
}

@media (max-width: 768px) {
  .stats-grid,
  .focus-summary,
  .progress-overview {
    grid-template-columns: 1fr;
  }

  .hero-title {
    font-size: 24px;
  }
}
</style>