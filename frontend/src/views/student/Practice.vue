<template>
  <div class="practice-page" v-loading="loading">
    <div class="page-header compact-header page-shell">
      <div>
        <h2>{{ practiceMeta.mode === 'wrong-question' ? '错题重做' : '个性化补练' }}</h2>
        <p>{{ pageDesc }}</p>
      </div>
      <el-tag :type="practiceMeta.mode === 'wrong-question' ? 'danger' : 'warning'" effect="dark">
        {{ practiceMeta.mode === 'wrong-question' ? '原地重做' : '知识点补练' }}
      </el-tag>
    </div>

    <el-card
      v-if="practiceMeta.title || practiceMeta.chatPractice || practiceMeta.latestPractice"
      class="hero-card gradient-card"
    >
      <div class="hero-main">
        <div>
          <div class="hero-kicker">
            {{ practiceMeta.mode === 'wrong-question' ? 'WRONG QUESTION REDO' : 'SMART PRACTICE' }}
          </div>
          <div class="hero-title">{{ practiceMeta.title || '专项练习' }}</div>
          <div class="hero-desc">
            {{
              practiceMeta.chatPractice && practiceMeta.chatPractice.openingMessage
                ? practiceMeta.chatPractice.openingMessage
                : pageDesc
            }}
          </div>
        </div>

        <div v-if="practiceMeta.latestPractice" class="hero-stat">
          <div class="hero-stat-value">
            {{ latestCorrectCount }}/{{ latestQuestionCount }}
          </div>
          <div class="hero-stat-label">最近一次正确题数</div>
        </div>
      </div>

      <div
        v-if="practiceMeta.chatPractice && practiceMeta.chatPractice.knowledgePoint"
        class="hero-meta"
      >
        <el-tag type="warning">
          知识点：{{ practiceMeta.chatPractice.knowledgePoint.name }}
        </el-tag>
        <span>{{ practiceMeta.chatPractice.knowledgePoint.description }}</span>
      </div>
    </el-card>

    <div class="practice-layout">
      <div class="main-column">
        <el-card v-if="showOverview" class="overview-card gradient-card">
          <template #header>
            <div class="section-header">
              <div>
                <div class="section-title">薄弱板块总览</div>
                <div class="section-desc">按五大类展开薄弱补练任务，点击知识点进入专项补练。</div>
              </div>
              <el-tag type="info">{{ relatedKnowledgePoints.length }} 个知识点</el-tag>
            </div>
          </template>

          <div class="overview-category-list">
            <div v-for="group in groupedPracticeOverview" :key="group.name" class="overview-category-item">
              <div class="overview-category-head" @click="toggleOverviewCategory(group.name)">
                <div>
                  <div class="section-title">{{ group.name }}</div>
                  <div class="section-desc">{{ group.summary }}</div>
                </div>
                <div class="overview-category-head-right">
                  <el-tag :type="group.tagType">{{ group.items.length }} 项</el-tag>
                  <span class="overview-category-toggle">{{ isOverviewCategoryExpanded(group.name) ? '收起' : '展开' }}</span>
                </div>
              </div>

              <div v-show="isOverviewCategoryExpanded(group.name)" class="overview-category-content">
                <div v-if="group.items.length" class="overview-list">
                  <div v-for="item in group.items" :key="item.id" class="overview-item">
                    <div class="overview-item-main">
                      <div class="overview-item-name-row">
                        <span class="overview-item-name">{{ item.name }}</span>
                      </div>
                      <div v-if="item.description" class="overview-item-desc">{{ item.description }}</div>
                      <div class="overview-item-meta">
                        <span>掌握度 {{ item.masteryRate }}%</span>
                        <span>错误 {{ item.wrongCount }}</span>
                        <span>练习题 {{ item.questionCount }}</span>
                      </div>
                    </div>
                    <el-button type="primary" plain @click="openKnowledgePointPractice(item)">
                      开始补练
                    </el-button>
                  </div>
                </div>
                <el-empty v-else description="当前分类暂无待补练知识点" />
              </div>
            </div>
          </div>
        </el-card>

        <el-card v-else class="question-card gradient-card">
          <template #header>
            <div class="section-header">
              <div>
                <div class="section-title">练习题目</div>
                <div class="section-desc">提交后自动判分，并同步更新掌握状态。</div>
              </div>
              <el-tag type="info">共 {{ questions.length }} 题</el-tag>
            </div>
          </template>

          <div v-if="questions.length" class="question-list">
            <template v-if="practiceMeta.mode === 'personalized-recommendation'">
              <div v-for="group in practiceMeta.groups" :key="group.knowledgePointId" class="kp-practice-group">
                <!-- 知识卡片 -->
                <div class="knowledge-card">
                  <div class="card-header">
                    <el-icon><Reading /></el-icon>
                    <span class="kp-name">{{ group.knowledgePointName }} · 知识卡片</span>
                    <el-tag size="small" type="danger" effect="dark">掌握度 {{ group.masteryRate }}%</el-tag>
                  </div>
                  <div class="card-body">
                    <div class="card-row">
                      <span class="row-label">核心概念:</span>
                      <span class="row-content">{{ group.knowledgeCard.concept }}</span>
                    </div>
                    <div class="card-row">
                      <span class="row-label">重要公式:</span>
                      <span class="row-content">{{ group.knowledgeCard.formula }}</span>
                    </div>
                    <div class="card-row warning">
                      <span class="row-label">易错警示:</span>
                      <span class="row-content">{{ group.knowledgeCard.warning }}</span>
                    </div>
                  </div>
                </div>

                <!-- 题目列表 -->
                <div v-for="(question, qIndex) in group.questions" :key="question.id" class="question-item">
                  <div class="question-header">
                    <div class="question-title-row">
                      <span class="question-index">第 {{ qIndex + 1 }} 题 ({{ group.knowledgePointName }})</span>
                      <el-tag size="small" effect="plain">{{ getQuestionTypeLabel(question.type) }}</el-tag>
                      <el-tag size="small" effect="plain">{{ getDifficultyLabel(question.difficulty) }}</el-tag>
                    </div>
                  </div>
                  <div class="question-content">{{ question.content }}</div>
                  <div v-if="question.options && question.options.length" class="option-list">
                    <div v-for="(option, optionIndex) in question.options" :key="optionIndex" class="option-item">
                      {{ String.fromCharCode(65 + optionIndex) }}. {{ option }}
                    </div>
                  </div>
                  <el-input
                    v-model="answers[question.id]"
                    type="textarea"
                    :rows="question.type === 'shortAnswer' ? 4 : 2"
                    placeholder="请输入你的答案"
                    class="question-answer"
                  />
                </div>
              </div>
            </template>

            <template v-else>
              <div v-for="(question, index) in questions" :key="question.id" class="question-item">
                <div class="question-header">
                  <div class="question-title-row">
                    <span class="question-index">第 {{ index + 1 }} 题</span>
                    <el-tag size="small" effect="plain">{{ getQuestionTypeLabel(question.type) }}</el-tag>
                    <el-tag size="small" effect="plain">{{ getDifficultyLabel(question.difficulty) }}</el-tag>
                    <el-tag v-if="practiceMeta.mode === 'wrong-question'" size="small" type="danger">
                      错题重做
                    </el-tag>
                  </div>
                </div>

                <div class="question-content">{{ question.content }}</div>

                <div v-if="question.options && question.options.length" class="option-list">
                  <div
                    v-for="(option, optionIndex) in question.options"
                    :key="optionIndex"
                    class="option-item"
                  >
                    {{ String.fromCharCode(65 + optionIndex) }}. {{ option }}
                  </div>
                </div>

                <el-input
                  v-model="answers[question.id]"
                  type="textarea"
                  :rows="question.type === 'shortAnswer' ? 4 : 2"
                  :placeholder="
                    practiceMeta.mode === 'wrong-question'
                      ? '请输入这道错题的重做答案'
                      : '请输入你的答案'
                  "
                  class="question-answer"
                />

                <div
                  v-if="questionFeedbackMap[question.id]"
                  :class="[
                    'question-feedback',
                    questionFeedbackMap[question.id].correct ? 'is-correct' : 'is-wrong'
                  ]"
                >
                  <div class="feedback-title">
                    {{ questionFeedbackMap[question.id].correct ? '回答正确' : '回答有误' }}
                  </div>
                  <div>正确答案：{{ questionFeedbackMap[question.id].answer || '-' }}</div>
                  <div v-if="questionFeedbackMap[question.id].analysis">
                    解析：{{ questionFeedbackMap[question.id].analysis }}
                  </div>
                </div>
              </div>
            </template>
          </div>

          <el-empty v-else-if="!loading" description="当前没有可作答题目" />

          <div v-if="questions.length" class="submit-bar">
            <div class="submit-summary">
              已作答 {{ answeredCount }} / {{ questions.length }} 题，提交后会同步更新掌握状态。
            </div>
            <div class="submit-actions">
              <el-button @click="resetAnswers">清空答案</el-button>
              <el-button type="primary" size="large" :loading="submitting" @click="submitPractice">
                提交本次练习
              </el-button>
            </div>
          </div>
        </el-card>

        <el-dialog v-model="answerDialogVisible" title="本次作答答案反馈" width="680px">
          <div class="answer-dialog-list">
            <div v-for="item in answerDialogItems" :key="item.id" class="answer-dialog-item">
              <div class="answer-dialog-title">{{ item.title }}</div>
              <div class="answer-dialog-meta">你的答案：{{ item.studentAnswer || '-' }}</div>
              <div class="answer-dialog-meta">正确答案：{{ item.correctAnswer || '-' }}</div>
            </div>
          </div>
          <template #footer>
            <el-button type="primary" @click="answerDialogVisible = false">我知道了</el-button>
          </template>
        </el-dialog>

        <el-card v-if="resultVisible" class="result-card gradient-card">
          <template #header>
            <div class="section-header">
              <div>
                <div class="section-title">练习结果</div>
                <div class="section-desc">本次补练结果统计与知识点掌握变化。</div>
              </div>
              <el-tag :type="resultData.allCorrect ? 'success' : 'warning'">
                {{ resultData.allCorrect ? '已全部掌握' : '继续巩固' }}
              </el-tag>
            </div>
          </template>

          <div class="result-overview">
            <div class="result-box">
              <div class="result-box-label">总分</div>
              <div class="result-box-value">{{ resultData.totalScore }}</div>
            </div>
            <div class="result-box">
              <div class="result-box-label">状态</div>
              <div class="result-box-value status">{{ getStatusText(resultData.status) }}</div>
            </div>
            <div class="result-box">
              <div class="result-box-label">正确率</div>
              <div class="result-box-value">{{ resultAccuracy }}%</div>
            </div>
          </div>

          <div v-if="resultData.report" class="result-report-section">
            <div class="section-title-sm">补练报告</div>
            <div class="report-content">{{ resultData.report }}</div>
          </div>

          <div v-if="resultData.masteryComparison.length" class="result-chart-section">
            <div class="section-title-sm">掌握度变化对比</div>
            <div id="masteryChart" style="height: 300px; margin-top: 10px;"></div>
          </div>

          <div v-if="resultData.ebbinghaus.length" class="result-ebbinghaus-section">
            <div class="section-title-sm">艾宾浩斯复习计划</div>
            <div class="ebbinghaus-list">
              <div v-for="plan in resultData.ebbinghaus" :key="plan.day" class="ebbinghaus-item">
                <el-icon><Calendar /></el-icon>
                <span class="plan-label">{{ plan.label }}</span>
                <span class="plan-date">{{ plan.date }}</span>
              </div>
            </div>
          </div>

          <div v-if="resultData.knowledgePointChanges.length" class="result-kp-list">
            <div
              v-for="item in resultData.knowledgePointChanges"
              :key="item.knowledgePointId"
              class="result-kp-item"
            >
              <div class="result-kp-main">
                <div class="result-kp-name-row">
                  <span class="result-kp-name">{{ item.knowledgePointName }}</span>
                  <el-tag size="small" :type="item.statusType">{{ item.statusLabel }}</el-tag>
                </div>
                <div class="result-kp-meta">
                  题目 {{ item.questionCount }} · 正确 {{ item.correctCount }} · 错误 {{ item.wrongCount }}
                </div>
                <div class="result-kp-meta">
                  掌握度 {{ item.masteryBefore ?? item.masteryAfter }}% → {{ item.masteryAfter }}%
                </div>
              </div>
              <div class="result-kp-rate">当前掌握 {{ item.masteryAfter }}%</div>
            </div>
          </div>
        </el-card>
      </div>

      <div class="side-column">
        <el-card class="gradient-card summary-card">
          <template #header>
            <div class="section-title">补练统计</div>
          </template>

          <div class="summary-grid">
            <div class="summary-box">
              <div class="summary-label">已选题目</div>
              <div class="summary-value">{{ questions.length }}</div>
            </div>
            <div class="summary-box">
              <div class="summary-label">已作答</div>
              <div class="summary-value">{{ answeredCount }}</div>
            </div>
            <div class="summary-box">
              <div class="summary-label">正确率</div>
              <div class="summary-value">{{ resultAccuracy }}%</div>
            </div>
            <div class="summary-box">
              <div class="summary-label">模式</div>
              <div class="summary-value mode">
                {{ practiceMeta.mode === 'wrong-question' ? '重做' : '补练' }}
              </div>
            </div>
          </div>
        </el-card>

        <el-card class="gradient-card progress-card">
          <template #header>
            <div class="section-title">学习进步</div>
          </template>

          <div v-if="resultData.knowledgePointChanges.length" class="progress-bars">
            <div
              v-for="item in resultData.knowledgePointChanges"
              :key="item.knowledgePointId"
              class="progress-item"
            >
              <div class="progress-item-head">
                <span>{{ item.knowledgePointName }}</span>
                <span>{{ item.masteryAfter }}%</span>
              </div>
              <div class="progress-track">
                <div
                  class="progress-after"
                  :style="{ width: item.masteryAfter + '%' }"
                ></div>
              </div>
              <div class="progress-meta">
                掌握度 {{ item.masteryBefore ?? item.masteryAfter }}% → {{ item.masteryAfter }}%
              </div>
            </div>
          </div>
          <el-empty v-else description="提交练习后可查看学习进步" />
        </el-card>

        <el-card class="gradient-card advice-card">
          <template #header>
            <div class="section-title">练习建议</div>
          </template>

          <div class="advice-list">
            <div class="advice-item">先做基础题，再处理综合题，避免一开始被难题打乱节奏。</div>
            <div class="advice-item">答错后优先回看题干条件与关键公式，而不是只记答案。</div>
            <div class="advice-item">完成练习后建议回到知识图谱查看掌握度变化。</div>
            <div class="advice-item">若同一知识点连续出错，建议转到错题本集中复盘。</div>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Reading, Calendar } from '@element-plus/icons-vue'
import api from '@/utils/api'
import { MAJOR_CATEGORY_CONFIG, getMasteryStatus, inferMajorCategory } from '@/utils/knowledge-meta'
import * as echarts from 'echarts'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const submitting = ref(false)
const questions = ref([])
const answers = reactive({})
const questionFeedbackMap = reactive({})

const practiceMeta = reactive({
  mode: 'weak-point',
  title: '',
  knowledgePointId: '',
  latestPractice: null,
  chatPractice: null
})

const resultVisible = ref(false)
const answerDialogVisible = ref(false)
const answerDialogItems = ref([])
const overviewCategoryExpandedMap = ref({})
const resultData = reactive({
  totalScore: 0,
  questionResults: [],
  knowledgePointChanges: [],
  status: '',
  allCorrect: false,
  report: '',
  ebbinghaus: [],
  masteryComparison: []
})

const relatedKnowledgePoints = computed(() => {
  const baseList =
    practiceMeta.chatPractice && Array.isArray(practiceMeta.chatPractice.relatedKnowledgePoints)
      ? practiceMeta.chatPractice.relatedKnowledgePoints
      : []

  const map = {}

  baseList.forEach((item) => {
    map[item.id] = {
      id: item.id,
      name: item.name,
      description: item.description || '',
      questionCount: item.questionCount || 0,
      masteryRate: parseInt(item.masteryRate || 0, 10),
      wrongCount: item.wrongCount || 0
    }
  })

  questions.value.forEach((question) => {
    const kpIds = Array.isArray(question.knowledgePoints) ? question.knowledgePoints : []
    kpIds.forEach((kpId) => {
      if (!map[kpId]) {
        map[kpId] = {
          id: kpId,
          name: kpId,
          description: '',
          questionCount: 0,
          masteryRate: 0,
          wrongCount: 0
        }
      }
      map[kpId].questionCount += 1
    })
  })

  return Object.values(map)
})

const groupedPracticeOverview = computed(() => {
  return MAJOR_CATEGORY_CONFIG.map((config) => {
    const items = relatedKnowledgePoints.value
      .filter((item) => getCategoryName(item) === config.name)
      .sort((a, b) => (a.masteryRate || 0) - (b.masteryRate || 0))

    const weakCount = items.filter((item) => getMasteryStatus(item.masteryRate) === 'weak').length
    const summary = items.length
      ? (weakCount ? `当前有 ${weakCount} 个知识点需要优先补练。` : '当前主要是稳定性巩固。')
      : '当前分类整体稳定。'

    return {
      name: config.name,
      items,
      summary,
      tagType: weakCount ? 'danger' : items.length ? 'warning' : 'success'
    }
  })
})

const showOverview = computed(() => false)

const pageDesc = computed(() => {
  return practiceMeta.mode === 'wrong-question'
    ? '原地完成错题重做，答对后系统会自动标记为已掌握。'
    : '系统根据薄弱知识点自动推送习题，提交后会同步更新掌握状态。'
})

const answeredCount = computed(() => {
  return questions.value.filter((item) => String(answers[item.id] || '').trim()).length
})

const resultAccuracy = computed(() => {
  if (!resultData.questionResults.length) return 0
  const correctCount = resultData.questionResults.filter(item => item.correct).length
  return Math.round((correctCount / resultData.questionResults.length) * 100)
})

const latestQuestionCount = computed(() => {
  if (!practiceMeta.latestPractice) return 0
  const list = Array.isArray(practiceMeta.latestPractice.questionResults)
    ? practiceMeta.latestPractice.questionResults
    : (Array.isArray(practiceMeta.latestPractice.questionIds) ? practiceMeta.latestPractice.questionIds : [])
  return list.length
})

const latestCorrectCount = computed(() => {
  if (!practiceMeta.latestPractice) return 0
  const list = Array.isArray(practiceMeta.latestPractice.questionResults)
    ? practiceMeta.latestPractice.questionResults
    : []
  return list.filter(item => item.correct).length
})

let masteryChart = null

function renderMasteryChart() {
  const chartDom = document.getElementById('masteryChart')
  if (!chartDom) return
  if (masteryChart) masteryChart.dispose()
  masteryChart = echarts.init(chartDom)

  const data = resultData.masteryComparison
  const xData = data.map(item => item.name)
  const beforeData = data.map(item => item.before)
  const afterData = data.map(item => item.after)

  masteryChart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    legend: {
      data: ['练习前掌握度', '练习后掌握度'],
      bottom: 0
    },
    grid: {
      top: 30,
      left: '3%',
      right: '4%',
      bottom: 40,
      containLabel: true
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { formatter: '{value}%' }
    },
    yAxis: {
      type: 'category',
      data: xData,
      axisLabel: {
        width: 100,
        overflow: 'truncate'
      }
    },
    series: [
      {
        name: '练习前掌握度',
        type: 'bar',
        data: beforeData,
        itemStyle: { color: '#94a3b8' }
      },
      {
        name: '练习后掌握度',
        type: 'bar',
        data: afterData,
        itemStyle: { color: '#2563eb' }
      }
    ]
  })
}

onMounted(() => {
  syncPracticeByRoute()
  window.addEventListener('resize', () => {
    masteryChart?.resize()
  })
})

watch(
  () => [route.query.kpId, route.query.questionId, route.query.questionIds, route.query.mode],
  () => {
    syncPracticeByRoute()
  }
)

function syncPracticeByRoute() {
  const kpId = route.query.kpId
  const questionId = route.query.questionId
  const questionIds = route.query.questionIds
  const mode = route.query.mode

  if (mode === 'wrong-redo' && questionIds) {
    loadPractice('custom', null, questionIds, mode)
  } else if (questionId) {
    loadPractice(kpId || 'custom', questionId)
  } else if (kpId) {
    loadPractice(kpId)
  } else {
    loadWeakPointOverview()
  }
}

function resetState() {
  questions.value = []
  resultVisible.value = false

  resultData.totalScore = 0
  resultData.questionResults = []
  resultData.knowledgePointChanges = []
  resultData.status = ''
  resultData.allCorrect = false

  practiceMeta.mode = 'weak-point'
  practiceMeta.title = ''
  practiceMeta.knowledgePointId = ''
  practiceMeta.latestPractice = null
  practiceMeta.chatPractice = null

  Object.keys(answers).forEach((key) => {
    delete answers[key]
  })

  Object.keys(questionFeedbackMap).forEach((key) => {
    delete questionFeedbackMap[key]
  })
}

function loadWeakPointOverview() {
  resetState()
  loading.value = true
  practiceMeta.title = '薄弱补练推荐'
  practiceMeta.mode = 'personalized-recommendation'

  api.get('/student/personalized-recommendations', { all: true })
    .then((res) => {
      if (res.success) {
        const list = res.data.questions || []
        
        // 分组题目
        const grouped = {}
        list.forEach(q => {
          const kpName = q.knowledgePointName || '其他'
          if (!grouped[kpName]) {
            grouped[kpName] = {
              name: kpName,
              reason: q.recommendationReason,
              questions: []
            }
          }
          grouped[kpName].questions.push(q)
        })
        
        practiceMeta.groupedRecommendations = Object.values(grouped)
        questions.value = list
        
        practiceMeta.chatPractice = {
          openingMessage: list.length
            ? '以下是为你量身定制的补练题目，请认真完成。'
            : '当前没有需要补练的题目，继续保持。',
          knowledgePoint: null,
          relatedKnowledgePoints: []
        }
      }
    })
    .catch((error) => {
      console.error('加载失败:', error)
      ElMessage.error('加载推荐失败')
    })
    .finally(() => {
      loading.value = false
    })
}

function getCategoryName(item) {
  return inferMajorCategory(item, '数与式')
}

function ensureOverviewExpandedState() {
  const nextMap = { ...overviewCategoryExpandedMap.value }
  let hasExpanded = false
  groupedPracticeOverview.value.forEach((group) => {
    if (typeof nextMap[group.name] !== 'boolean') nextMap[group.name] = false
    if (nextMap[group.name]) hasExpanded = true
  })
  if (!hasExpanded) {
    const firstGroup = groupedPracticeOverview.value.find(group => group.items.length)
    if (firstGroup) nextMap[firstGroup.name] = true
  }
  overviewCategoryExpandedMap.value = nextMap
}

function toggleOverviewCategory(name) {
  overviewCategoryExpandedMap.value[name] = !overviewCategoryExpandedMap.value[name]
}

function isOverviewCategoryExpanded(name) {
  return !!overviewCategoryExpandedMap.value[name]
}

function loadPractice(kpId, questionId, questionIds, mode) {
  resetState()
  loading.value = true

  let url = `/student/practice/${kpId}`
  const params = []
  if (questionId) params.push(`questionId=${questionId}`)
  if (questionIds) params.push(`questionIds=${questionIds}`)
  if (mode) params.push(`mode=${mode}`)
  
  if (params.length) {
    url += `?${params.join('&')}`
  }

  api.get(url)
    .then((res) => {
      if (res.success && res.data) {
        practiceMeta.mode = res.data.mode || 'weak-point'
        practiceMeta.title = res.data.title || ''
        practiceMeta.knowledgePointId = res.data.knowledgePointId || kpId || ''
        practiceMeta.latestPractice = res.data.latestPractice || null
        practiceMeta.chatPractice = res.data.chatPractice || null
        questions.value = Array.isArray(res.data.questions) ? res.data.questions : []
      }
    })
    .catch((error) => {
      console.error('加载练习失败:', error)
      ElMessage.error('加载练习失败')
    })
    .finally(() => {
      loading.value = false
    })
}

function openKnowledgePointPractice(item) {
  if (!item || !item.id) return
  router.push({ path: '/student/practice', query: { kpId: item.id, parentId: item.parentId || '' } })
}

function buildQuestionAnalysis(question, isCorrect) {
  if (isCorrect) {
    return '本题作答正确，当前知识点状态已同步更新。'
  }
  if (question.type === 'choice') {
    return '建议重新核对题干条件与各选项之间的对应关系。'
  }
  if (question.type === 'fill') {
    return '建议检查计算过程、符号和结果是否完整。'
  }
  return '建议对照标准答案梳理解题步骤，再重新组织思路。'
}

function resetAnswers() {
  Object.keys(answers).forEach((key) => {
    delete answers[key]
  })
  Object.keys(questionFeedbackMap).forEach((key) => {
    delete questionFeedbackMap[key]
  })
  resultVisible.value = false
}

function syncMasteryMetaAfterSubmit(changes = []) {
  if (!practiceMeta.chatPractice || !Array.isArray(practiceMeta.chatPractice.relatedKnowledgePoints)) return

  const changeMap = changes.reduce((acc, item) => {
    acc[item.knowledgePointId] = item
    return acc
  }, {})

  practiceMeta.chatPractice.relatedKnowledgePoints = practiceMeta.chatPractice.relatedKnowledgePoints.map((item) => {
    const change = changeMap[item.id]
    if (!change) return item
    return {
      ...item,
      masteryRate: change.masteryAfter,
      wrongCount: change.wrongCount
    }
  })

  if (practiceMeta.chatPractice.knowledgePoint) {
    const currentChange = changeMap[practiceMeta.chatPractice.knowledgePoint.id]
    if (currentChange) {
      practiceMeta.chatPractice.knowledgePoint = {
        ...practiceMeta.chatPractice.knowledgePoint,
        masteryRate: currentChange.masteryAfter
      }
    }
  }
}

function openAnswerDialog(questionList, resultList) {
  answerDialogItems.value = questionList.map((question, index) => {
    const result = resultList.find(item => item.questionId === question.id) || {}
    return {
      id: question.id || index,
      title: `第 ${index + 1} 题`,
      studentAnswer: result.answer || answers[question.id] || '-',
      correctAnswer: result.correctAnswer || question.answerDisplay || question.answer || '-'
    }
  })
  answerDialogVisible.value = answerDialogItems.value.length > 0
}

function submitPractice() {
  const questionIds = questions.value
    .map((item) => item.id)
    .filter((id) => String(answers[id] || '').trim())

  if (questionIds.length === 0) {
    ElMessage.warning('请至少完成一道题')
    return
  }

  ElMessageBox.confirm(`确定提交本次练习吗？已作答 ${questionIds.length} 道题`, '提示')
    .then(() => {
      submitting.value = true
      return api.post(`/student/practice/${practiceMeta.knowledgePointId || 'custom'}/submit`, {
        answers: Object.keys(answers).reduce((acc, key) => {
          if (String(answers[key] || '').trim()) {
            acc[key] = String(answers[key]).trim()
          }
          return acc
        }, {}),
        questionIds,
        mode: practiceMeta.mode,
        title: practiceMeta.title || '个性化补练'
      })
    })
    .then((res) => {
      if (res && res.success) {
        const data = res.data || {}
        resultVisible.value = true
        resultData.totalScore = data.totalScore || 0
        resultData.questionResults = Array.isArray(data.questionResults) ? data.questionResults : []
        resultData.knowledgePointChanges = Array.isArray(data.knowledgePointChanges) ? data.knowledgePointChanges : []
        resultData.status = data.status || 'completed'
        resultData.allCorrect = !!data.allCorrect
        resultData.report = data.report || ''
        resultData.ebbinghaus = data.ebbinghaus || []
        resultData.masteryComparison = data.masteryComparison || []
        practiceMeta.latestPractice = data
        syncMasteryMetaAfterSubmit(resultData.knowledgePointChanges)

        nextTick(() => {
          renderMasteryChart()
        })

        questions.value.forEach((question) => {
          const result = resultData.questionResults.find(item => item.questionId === question.id)
          if (result) {
            questionFeedbackMap[question.id] = {
              correct: !!result.correct,
              answer:
                question.type === 'choice'
                  ? (question.answerDisplay || question.answer || '-')
                  : (question.answer || '-'),
              analysis: buildQuestionAnalysis(question, !!result.correct)
            }
          }
        })

        openAnswerDialog(questions.value, resultData.questionResults)
        ElMessage.success(res.message || '提交成功')
      }
    })
    .catch((error) => {
      if (error !== 'cancel') {
        console.error('提交练习失败:', error)
        ElMessage.error('提交练习失败')
      }
    })
    .finally(() => {
      submitting.value = false
    })
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

function getStatusText(status) {
  if (status === 'completed') return '已完成'
  if (status === 'pending_review') return '待批改'
  return status || '-'
}
</script>

<style scoped>
.practice-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.compact-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.gradient-card {
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: linear-gradient(145deg, rgba(255,255,255,0.98), rgba(247,250,255,0.96));
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
}

.hero-card {
  padding: 24px 26px;
}

.hero-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
}

.hero-kicker {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: #2563eb;
}

.hero-title {
  margin-top: 8px;
  font-size: 28px;
  font-weight: 900;
  color: #0f172a;
}

.hero-desc {
  margin-top: 12px;
  color: #64748b;
  line-height: 1.85;
}

.hero-stat {
  min-width: 140px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(37, 99, 235, 0.06);
  border: 1px solid rgba(37, 99, 235, 0.12);
}

.hero-stat-value {
  font-size: 30px;
  font-weight: 900;
  color: #0f172a;
}

.hero-stat-label {
  margin-top: 8px;
  color: #64748b;
  font-size: 13px;
}

.hero-meta {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  color: #64748b;
}

.practice-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) 320px;
  gap: 20px;
}

.main-column,
.side-column {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.section-title {
  font-size: 18px;
  font-weight: 800;
  color: #111827;
}

.section-desc,
.overview-item-desc,
.overview-item-meta,
.submit-summary,
.result-kp-meta,
.progress-meta,
.advice-item,
.answer-dialog-meta {
  color: #6b7280;
  line-height: 1.8;
}

.overview-list,
.question-list,
.result-kp-list,
.progress-bars,
.advice-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.overview-category-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.overview-category-item {
  border-radius: 18px;
  padding: 16px;
  background: linear-gradient(135deg, #ffffff, #f8fbff);
  border: 1px solid #e8eef8;
  box-shadow: 0 10px 24px rgba(31, 41, 55, 0.06);
}

.overview-category-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}

.overview-category-head-right {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.overview-category-toggle {
  font-size: 12px;
  color: #6b7280;
  font-weight: 700;
}

.overview-category-content {
  margin-top: 14px;
}

.overview-item,
.question-item,
.result-kp-item,
.advice-item {
  border-radius: 18px;
  padding: 18px 20px;
  background: linear-gradient(135deg, #ffffff, #f8fbff);
  border: 1px solid #e8eef8;
  box-shadow: 0 10px 24px rgba(31, 41, 55, 0.06);
}

.overview-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.overview-item-name-row,
.result-kp-name-row,
.question-title-row,
.progress-item-head,
.submit-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.overview-item-name,
.result-kp-name {
  font-size: 16px;
  font-weight: 800;
  color: #111827;
}

.question-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.question-index {
  font-weight: 800;
  color: #2563eb;
}

.question-content {
  margin-top: 14px;
  color: #111827;
  font-size: 16px;
  line-height: 1.85;
  font-weight: 500;
}

.option-list {
  margin-top: 12px;
  display: grid;
  gap: 8px;
}

.option-item {
  padding: 10px 12px;
  border-radius: 12px;
  background: #f8fafc;
  color: #374151;
}

.question-answer {
  margin-top: 16px;
}

.question-feedback {
  margin-top: 14px;
  border-radius: 14px;
  padding: 14px 16px;
}

.question-feedback.is-correct {
  background: #f0fdf4;
  color: #166534;
}

.question-feedback.is-wrong {
  background: #fff7ed;
  color: #9a3412;
}

.feedback-title {
  font-weight: 800;
  margin-bottom: 8px;
}

.submit-bar {
  margin-top: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.result-overview,
.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.result-report-section,
.result-chart-section,
.result-ebbinghaus-section {
  margin-top: 24px;
  padding: 20px;
  border-radius: 18px;
  background: rgba(37, 99, 235, 0.02);
  border: 1px solid rgba(37, 99, 235, 0.05);
}

.section-title-sm {
  font-size: 15px;
  font-weight: 800;
  color: #1e293b;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title-sm::before {
  content: '';
  width: 4px;
  height: 14px;
  background: #2563eb;
  border-radius: 2px;
}

.report-content {
  color: #475569;
  line-height: 1.7;
  font-size: 14px;
}

.ebbinghaus-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.ebbinghaus-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 13px;
}

.ebbinghaus-item .el-icon {
  color: #2563eb;
}

.plan-label {
  color: #64748b;
  font-weight: 600;
}

.plan-date {
  color: #0f172a;
  font-weight: 700;
}

.summary-grid {
  grid-template-columns: repeat(2, 1fr);
}

.result-box,
.summary-box {
  padding: 16px;
  border-radius: 16px;
  background: rgba(37, 99, 235, 0.05);
  border: 1px solid rgba(37, 99, 235, 0.08);
}

.result-box-label,
.summary-label {
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
}

.result-box-value,
.summary-value {
  margin-top: 8px;
  font-size: 26px;
  font-weight: 900;
  color: #0f172a;
}

.summary-value.mode,
.result-box-value.status {
  font-size: 20px;
}

.result-kp-item,
.progress-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}

.result-kp-rate {
  font-weight: 800;
  color: #2563eb;
}

.progress-track {
  margin-top: 8px;
  width: 100%;
  height: 12px;
  border-radius: 999px;
  overflow: hidden;
  background: #e5e7eb;
}

.progress-after {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #2563eb, #0ea5e9);
}

.advice-item {
  border: 1px solid #e5e7eb;
}

@media (max-width: 1200px) {
  .practice-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .result-overview,
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>

.answer-dialog-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.answer-dialog-item {
  border-radius: 14px;
  padding: 14px 16px;
  background: linear-gradient(135deg, #ffffff, #f8fbff);
  border: 1px solid #e8eef8;
}

.answer-dialog-title {
  font-size: 15px;
  font-weight: 800;
  color: #111827;
  margin-bottom: 8px;
}
