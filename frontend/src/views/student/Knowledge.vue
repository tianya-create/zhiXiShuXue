<template>
  <div class="knowledge-graph-page">
    <!-- 页面头部 -->
    <header class="page-header">
      <div class="header-content">
        <div class="header-text">
          <h2>知识图谱</h2>
          <p>用一张分层知识树，直观看到学生在初中数学各大类与核心知识点上的掌握情况。</p>
        </div>
        <div class="header-focus-panel">
          <span class="focus-badge">当前聚焦</span>
          <strong>{{ selectedKnowledge.name }}</strong>
          <span class="focus-rate">{{ selectedKnowledge.masteryRate }}%</span>
        </div>
      </div>
    </header>

    <!-- 统计概览 -->
    <section class="stats-overview">
      <div class="stats-grid stats-grid-compact">
        <div class="stat-card">
          <div class="stat-icon is-danger">
            <el-icon><WarningFilled /></el-icon>
          </div>
          <div class="stat-value">{{ masteryBreakdown.weak }}</div>
          <div class="stat-label">薄弱</div>
          <div class="stat-desc">优先处理的知识点</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon is-warning">
            <el-icon><Clock /></el-icon>
          </div>
          <div class="stat-value">{{ masteryBreakdown.learning }}</div>
          <div class="stat-label">待巩固</div>
          <div class="stat-desc">需要稳定训练</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon is-success">
            <el-icon><CircleCheck /></el-icon>
          </div>
          <div class="stat-value">{{ masteryBreakdown.mastered }}</div>
          <div class="stat-label">已掌握</div>
          <div class="stat-desc">相对稳定的知识点</div>
        </div>
      </div>
    </section>

    <!-- 主内容区 -->
    <div class="top-layout">
      <div class="chart-column">
        <!-- 知识树 -->
        <el-card class="panel-card">
          <template #header>
            <div class="section-header">
              <div>
                <div class="section-title">初中数学知识树</div>
                <div class="section-desc">点击后展开细分知识点；颜色直接反映掌握状态。</div>
              </div>
              <div class="legend-row">
                <span class="legend-item"><i class="legend-dot green"></i>已掌握</span>
                <span class="legend-item"><i class="legend-dot yellow"></i>待巩固</span>
                <span class="legend-item"><i class="legend-dot red"></i>薄弱</span>
              </div>
            </div>
          </template>
          <div ref="chartRef" class="tree-chart"></div>
        </el-card>

        <!-- 补练习题 -->
        <el-card class="panel-card">
          <template #header>
            <div class="section-header">
              <div>
                <div class="section-title">个性化补练习题</div>
                <div class="section-desc">在当前页直接作答、自动批改，并同步更新掌握状态。</div>
              </div>
              <el-tag type="warning">{{ selectedPracticeQuestions.length }} 题</el-tag>
            </div>
          </template>

          <div v-if="selectedPracticeQuestions.length" class="practice-list">
            <div
              v-for="(item, index) in selectedPracticeQuestions"
              :key="item.id || index"
              class="practice-item"
            >
              <div class="practice-main">
                <div class="practice-title-row">
                  <span class="practice-title">第 {{ index + 1 }} 题 · {{ getQuestionTypeLabel(item.type) }}</span>
                  <el-tag size="small" effect="plain">{{ getDifficultyLabel(item.difficulty) }}</el-tag>
                </div>
                <div class="practice-content">{{ item.content }}</div>
                <div v-if="item.options && item.options.length" class="practice-options">
                  <div v-for="(option, optIdx) in item.options" :key="optIdx" class="practice-option">
                    {{ String.fromCharCode(65 + optIdx) }}. {{ option }}
                  </div>
                </div>
                <div class="practice-meta">
                  <span><el-icon><Share /></el-icon> {{ selectedKnowledge.name }}</span>
                  <span><el-icon><TrendCharts /></el-icon> {{ getDifficultyLabel(item.difficulty) }}</span>
                </div>
              </div>

              <el-input
                v-model="practiceAnswers[item.id]"
                type="textarea"
                :rows="item.type === 'shortAnswer' ? 3 : 2"
                placeholder="请输入你的答案"
                class="practice-answer"
              />

              <div
                v-if="practiceFeedbackMap[item.id]"
                :class="['practice-feedback', practiceFeedbackMap[item.id].correct ? 'is-correct' : 'is-wrong']"
              >
                <div class="feedback-title">
                  {{ practiceFeedbackMap[item.id].correct ? '✓ 回答正确' : '✗ 回答有误' }}
                </div>
                <div>正确答案：{{ practiceFeedbackMap[item.id].answer || '-' }}</div>
                <div v-if="practiceFeedbackMap[item.id].analysis">{{ practiceFeedbackMap[item.id].analysis }}</div>
              </div>
            </div>

            <div class="practice-footer">
              <span class="footer-text">
                已作答 {{ selectedPracticeAnsweredCount }} / {{ selectedPracticeQuestions.length }} 题
              </span>
              <div class="footer-actions">
                <el-button @click="resetSelectedPracticeAnswers">清空答案</el-button>
                <el-button type="primary" :loading="selectedPracticeSubmitting" @click="submitSelectedPractice">
                  提交并同步状态
                </el-button>
                <el-button type="primary" plain @click="startPractice()">进入独立补练页</el-button>
              </div>
            </div>
          </div>
          <el-empty v-else :description="getPracticeEmptyText()" />
        </el-card>
      </div>

      <!-- 详情列 -->
      <div class="detail-column">
        <el-card class="panel-card">
          <template #header>
            <div class="section-header">
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
          <div class="focus-pills">
            <span class="pill" :class="'is-' + getMasteryStatus(selectedKnowledge.masteryRate)">
              {{ getMasteryLabel(selectedKnowledge.masteryRate) }}
            </span>
            <span class="pill">错题 {{ selectedWrongQuestions.length }}</span>
            <span class="pill">题目 {{ selectedKnowledge.totalQuestionCount || 0 }}</span>
          </div>

          <div class="focus-summary">
            <div class="summary-box">
              <div class="summary-label">当前掌握度</div>
              <div class="summary-value">{{ selectedKnowledge.masteryRate }}%</div>
            </div>
            <div class="summary-box">
              <div class="summary-label">题目总数</div>
              <div class="summary-value">{{ selectedKnowledge.totalQuestionCount || 0 }}</div>
            </div>
            <div class="summary-box">
              <div class="summary-label">薄弱后代</div>
              <div class="summary-value">{{ selectedKnowledge.descendantWeakCount || 0 }}</div>
            </div>
          </div>

          <div class="diagnosis-list">
            <div class="diagnosis-item">
              <div class="diagnosis-label">知识点说明</div>
              <div class="diagnosis-text">{{ selectedKnowledge.description || '当前知识点暂无补充说明。' }}</div>
            </div>

            <div class="diagnosis-item">
              <el-button type="primary" size="small" @click="showAllQuestionsDialog = true">
                查看全部题目 ({{ selectedKnowledge.totalQuestionCount || 0 }})
              </el-button>
            </div>

            <div class="diagnosis-item">
              <div class="diagnosis-label">推荐策略</div>
              <div class="diagnosis-text">{{ selectedKnowledge.recommendationText || '建议先查看相关例题，再进行专项补练。' }}</div>
            </div>

            <div class="diagnosis-item">
              <div class="diagnosis-label">前置路径</div>
              <div class="chip-list">
                <span v-if="selectedKnowledge.ancestorNames?.length" v-for="item in selectedKnowledge.ancestorNames" :key="'anc-' + item" class="chip">
                  {{ item }}
                </span>
                <span v-else class="chip is-empty">当前为一级知识点</span>
              </div>
            </div>

            <div class="diagnosis-item">
              <div class="diagnosis-label">薄弱子节点</div>
              <div class="chip-list">
                <span v-if="selectedKnowledge.weakChildNames?.length" v-for="item in selectedKnowledge.weakChildNames" :key="'wc-' + item" class="chip is-warning">
                  {{ item }}
                </span>
                <span v-else class="chip is-empty">当前没有待处理子节点</span>
              </div>
            </div>
          </div>
        </el-card>

        <el-card class="panel-card">
          <template #header>
            <div class="section-header">
              <div>
                <div class="section-title">补练结果统计</div>
                <div class="section-desc">补练正确率、知识点掌握度更新。</div>
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
              <div class="progress-head">
                <span>{{ item.name }}</span>
                <span>{{ item.after }}%</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" :style="{ width: item.after + '%' }"></div>
              </div>
              <div class="progress-meta">{{ item.before }}% → {{ item.after }}%</div>
            </div>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 侧边抽屉 -->
    <el-drawer v-model="showDetailDrawer" :title="detailData.name || '知识点详情'" size="450px" direction="rtl" destroy-on-close>
      <div v-loading="loadingDetail" class="drawer-content">
        <div v-if="detailData.id">
          <div class="drawer-section">
            <div class="drawer-title">近 30 日关联错题</div>
            <div v-if="detailData.wrongQuestions?.length" class="wrong-list">
              <div v-for="q in detailData.wrongQuestions" :key="q.id" class="wrong-item">
                <div class="wrong-content">{{ q.content }}</div>
                <div class="wrong-answers">
                  <div class="ans-box">
                    <span class="ans-label">你的答案</span>
                    <span class="ans-value wrong">{{ q.userAnswer || '未填' }}</span>
                  </div>
                  <div class="ans-box">
                    <span class="ans-label">正确答案</span>
                    <span class="ans-value correct">{{ q.answerDisplay || q.answer }}</span>
                  </div>
                </div>
                <div class="wrong-footer">
                  <el-tag size="small" type="danger" effect="plain">{{ q.errorType || '计算错误' }}</el-tag>
                  <span class="wrong-time">{{ formatDate(q.lastAnsweredAt || q.createdAt) }}</span>
                </div>
              </div>
            </div>
            <el-empty v-else description="近 30 日暂无错题记录" :image-size="60" />
          </div>

          <div class="drawer-section">
            <div class="drawer-title">推荐补练变式题</div>
            <div v-if="detailData.recommendedQuestions?.length" class="recommend-list">
              <div v-for="q in detailData.recommendedQuestions" :key="q.id" class="recommend-item">
                <div class="recommend-content">{{ q.content }}</div>
                <div class="recommend-footer">
                  <el-tag size="small">{{ getDifficultyLabel(q.difficulty) }}</el-tag>
                  <el-button type="primary" size="small" plain @click="addToPracticeQueue(q)">加入补练队列</el-button>
                </div>
              </div>
            </div>
            <el-empty v-else description="暂无推荐变式题" :image-size="60" />
          </div>
        </div>
      </div>
    </el-drawer>

    <!-- 全部题目弹窗 -->
    <el-dialog v-model="showAllQuestionsDialog" :title="selectedKnowledge.name + ' - 全部题目'" width="800px" destroy-on-close>
      <div v-loading="loadingAllQuestions" class="all-questions">
        <div v-if="allQuestions.length">
          <div v-for="(q, index) in allQuestions" :key="q.id" class="question-item">
            <div class="q-header">
              <span class="q-index">题目 {{ index + 1 }}</span>
              <el-tag size="small" :type="q.difficulty === 'hard' ? 'danger' : q.difficulty === 'medium' ? 'warning' : 'success'">
                {{ getDifficultyLabel(q.difficulty) }}
              </el-tag>
              <el-tag size="small" effect="plain" style="margin-left: 8px;">{{ getQuestionTypeLabel(q.type) }}</el-tag>
            </div>
            <div class="q-content">{{ q.content }}</div>
            <div v-if="q.options?.length" class="q-options">
              <div v-for="(opt, optIdx) in q.options" :key="optIdx" class="q-option">
                {{ String.fromCharCode(65 + optIdx) }}. {{ opt }}
              </div>
            </div>
            <el-collapse>
              <el-collapse-item title="查看答案与解析" :name="q.id">
                <div class="q-answer"><strong>答案：</strong>{{ q.answerDisplay || q.answer }}</div>
                <div v-if="q.analysis" class="q-analysis"><strong>解析：</strong>{{ q.analysis }}</div>
              </el-collapse-item>
            </el-collapse>
          </div>
        </div>
        <el-empty v-else description="该知识点暂无题目" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import * as echarts from 'echarts'
import { MAJOR_CATEGORY_CONFIG, getMasteryStatus, getMasteryLabel as getUnifiedMasteryLabel, getMasteryTagType, inferMajorCategory } from '@/utils/knowledge-meta'

const router = useRouter()
const userInfo = JSON.parse(localStorage.getItem('user') || '{}')
const studentDisplayName = computed(() => userInfo.name || userInfo.username || '同学')

const chartRef = ref(null)
let chart = null
const weakPointList = ref([])
const wrongQuestionBook = ref([])
const selectedPracticeQuestions = ref([])
const practiceAnswers = ref({})
const practiceFeedbackMap = ref({})
const selectedPracticeSubmitting = ref(false)
const progressStats = ref([])
const selectedKnowledge = ref({ id: '', name: '未选择知识点', masteryRate: 100, parentId: '', childrenIds: [] })

const showDetailDrawer = ref(false)
const loadingDetail = ref(false)
const detailData = ref({ id: '', name: '', wrongQuestions: [], recommendedQuestions: [] })

const showAllQuestionsDialog = ref(false)
const allQuestions = ref([])
const loadingAllQuestions = ref(false)

function loadKnowledgeDetail(id) {
  loadingDetail.value = true
  showDetailDrawer.value = true
  api.get(`/student/knowledge-point/${id}/detail`).then(res => {
    if (res.success) detailData.value = res.data
  }).finally(() => { loadingDetail.value = false })
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function addToPracticeQueue(q) {
  ElMessage.success(`题目已加入补练队列：${q.content.slice(0, 15)}...`)
}

watch(showAllQuestionsDialog, (val) => { if (val && selectedKnowledge.value.id) loadAllQuestions() })

function loadAllQuestions() {
  loadingAllQuestions.value = true
  api.get('/student/questions', { knowledgePointId: selectedKnowledge.value.id, all: true })
    .then(res => { if (res.success) allQuestions.value = res.data || [] })
    .finally(() => { loadingAllQuestions.value = false })
}

const weakPointMap = computed(() => {
  const map = {}
  weakPointList.value.forEach(item => { map[item.id] = item })
  return map
})

const selectedWrongQuestions = computed(() =>
  wrongQuestionBook.value.filter(item => Array.isArray(item.knowledgePoints) && item.knowledgePoints.includes(selectedKnowledge.value.id))
)

const selectedPracticeAnsweredCount = computed(() =>
  selectedPracticeQuestions.value.filter(item => String(practiceAnswers.value[item.id] || '').trim()).length
)

const leafNodes = computed(() => weakPointList.value.filter(item => item.isLeaf))

const masteryBreakdown = computed(() =>
  weakPointList.value.reduce((acc, item) => {
    const status = getMasteryStatus(item.masteryRate)
    if (status === 'mastered') acc.mastered += 1
    else if (status === 'learning') acc.learning += 1
    else acc.weak += 1
    return acc
  }, { mastered: 0, learning: 0, weak: 0 })
)

const overallPracticeAccuracy = computed(() => {
  if (!progressStats.value.length) return 0
  return Math.round(progressStats.value.reduce((sum, item) => sum + item.after, 0) / progressStats.value.length)
})

const totalMasteryGain = computed(() =>
  progressStats.value.reduce((sum, item) => sum + Math.max(0, item.after - item.before), 0)
)

function loadWeakPoints() {
  return api.get('/student/weak-points').then((res) => {
    if (res.success) {
      weakPointList.value = res.data || []
      if (!selectedKnowledge.value.id && weakPointList.value.length) {
        const firstWeak = weakPointList.value.find(item => getMasteryStatus(item.masteryRate) === 'weak') || weakPointList.value[0]
        selectedKnowledge.value = firstWeak
      } else if (selectedKnowledge.value.id) {
        const matched = weakPointList.value.find(item => item.id === selectedKnowledge.value.id)
        if (matched) selectedKnowledge.value = matched
      }
    }
  })
}

function loadWrongQuestionBook() {
  return api.get('/student/wrong-questions').then((res) => {
    if (res.success) wrongQuestionBook.value = res.data || []
  })
}

function loadSelectedPracticeQuestions() {
  if (!selectedKnowledge.value.id) {
    selectedPracticeQuestions.value = []
    practiceAnswers.value = {}
    practiceFeedbackMap.value = {}
    return Promise.resolve()
  }
  if (getMasteryStatus(selectedKnowledge.value.masteryRate) === 'mastered' && selectedKnowledge.value.isLeaf) {
    selectedPracticeQuestions.value = []
    practiceAnswers.value = {}
    practiceFeedbackMap.value = {}
    return Promise.resolve()
  }
  return api.get('/student/practice/' + selectedKnowledge.value.id).then((res) => {
    if (res.success) {
      selectedPracticeQuestions.value = Array.isArray(res.data?.questions) ? res.data.questions : []
      practiceAnswers.value = {}
      practiceFeedbackMap.value = {}
    }
  })
}

function buildPracticeAnalysis(question, isCorrect) {
  if (isCorrect) return '回答正确，说明你已经掌握了这道题的核心思路。'
  if (question.type === 'choice') return '选择题出错时，建议重点核对题干条件和各选项差异。'
  if (question.type === 'fill') return '填空题出错时，通常是公式、步骤或计算细节没有落实到位。'
  return '这道题还需要加强表达与步骤完整性，建议对照答案重新整理思路。'
}

function resetSelectedPracticeAnswers() {
  practiceAnswers.value = {}
  practiceFeedbackMap.value = {}
}

function getQuestionTypeLabel(type) {
  if (type === 'choice') return '选择题'
  if (type === 'fill') return '填空题'
  if (type === 'shortAnswer') return '简答题'
  return '未知题型'
}

function getDifficultyLabel(level) {
  if (level === 'easy') return '简单'
  if (level === 'medium') return '中等'
  if (level === 'hard') return '困难'
  return level || '未知'
}

function getPracticeEmptyText() {
  if (!selectedKnowledge.value.id) return '请先选择一个知识点'
  if (getMasteryStatus(selectedKnowledge.value.masteryRate) === 'mastered' && selectedKnowledge.value.isLeaf) return '当前知识点已掌握，暂不生成个性化练习题'
  return '当前知识点暂无可用练习题'
}

function submitSelectedPractice() {
  if (!selectedKnowledge.value.id) {
    ElMessage.warning('请先选择一个知识点再开始补练')
    return
  }
  const questionIds = selectedPracticeQuestions.value.map(item => item.id).filter(id => String(practiceAnswers.value[id] || '').trim())
  if (!questionIds.length) {
    ElMessage.warning('请至少完成一道题后再提交')
    return
  }
  selectedPracticeSubmitting.value = true
  api.post('/student/practice/' + selectedKnowledge.value.id + '/submit', {
    answers: questionIds.reduce((acc, id) => { acc[id] = String(practiceAnswers.value[id]).trim(); return acc }, {}),
    questionIds,
    mode: 'weak-point',
    title: selectedKnowledge.value.name + ' · 个性化补练'
  }).then((res) => {
    if (res.success) {
      const results = Array.isArray(res.data?.questionResults) ? res.data.questionResults : []
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
      ElMessage.success(res.message || '提交成功')
      return Promise.all([loadWeakPoints(), loadWrongQuestionBook(), loadSelectedPracticeQuestions()]).then(() => {
        refreshProgressStatsFromWeakPoints()
        rebuildChart()
      })
    }
  }).catch((error) => {
    console.error('提交补练失败:', error)
    ElMessage.error('提交补练失败')
  }).finally(() => { selectedPracticeSubmitting.value = false })
}

function refreshProgressStatsFromWeakPoints() {
  progressStats.value = leafNodes.value.slice().sort((a, b) => a.masteryRate - b.masteryRate).slice(0, 6).map(item => ({
    name: item.name,
    before: Math.max(0, item.directMasteryRate ? Math.min(item.directMasteryRate, item.masteryRate) - 10 : item.masteryRate - 10),
    after: item.masteryRate
  }))
}

function getMasteryLabel(score) { return getUnifiedMasteryLabel(score) }
function getTagTypeByRate(score) { return getMasteryTagType(score) }

function focusKnowledgePoint(knowledgePointId) {
  const matched = weakPointMap.value[knowledgePointId]
  if (!matched) return
  selectedKnowledge.value = matched
  loadSelectedPracticeQuestions()
  nextTick(() => {
    if (chart) chart.dispatchAction({ type: 'highlight', seriesIndex: 0, dataId: knowledgePointId })
  })
}

function formatTreeLabel(name) {
  const text = String(name || '')
  if (text.length <= 8) return text
  if (text.length <= 12) return text.slice(0, 6) + '\n' + text.slice(6)
  return text.slice(0, 6) + '\n' + text.slice(6, 12)
}

function pickVisibleKnowledgePoints() {
  return weakPointList.value.filter(item => String(item.id || '').startsWith('kp-')).sort((a, b) => a.depth - b.depth || a.order - b.order || a.name.localeCompare(b.name, 'zh-CN'))
}

function buildKnowledgeTree() {
  const visibleNodes = pickVisibleKnowledgePoints()
  const cloneMap = {}
  const orphanRoots = []

  visibleNodes.forEach(item => { cloneMap[item.id] = { ...item, children: [], masteryScore: parseInt(item.masteryRate || 0, 10), virtual: false } })
  Object.values(cloneMap).forEach(item => {
    if (item.parentId && cloneMap[item.parentId]) cloneMap[item.parentId].children.push(item)
    else orphanRoots.push(item)
  })

  const majorVirtualRoots = MAJOR_CATEGORY_CONFIG.map((item, index) => ({ id: 'major-' + item.name, name: item.name, order: index + 1, children: [], virtual: true }))
  const majorVirtualMap = majorVirtualRoots.reduce((acc, item) => { acc[item.name] = item; return acc }, {})

  orphanRoots.forEach((node) => {
    const majorName = inferMajorCategory(node, '数与式')
    if (majorVirtualMap[majorName]) majorVirtualMap[majorName].children.push(node)
    else majorVirtualRoots[0].children.push(node)
  })

  const enrich = (node, depth = 0) => {
    const children = node.children.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'zh-CN')).map(child => enrich(child, depth + 1))
    const score = node.virtual ? (children.length ? Math.min(...children.map(item => typeof item.masteryScore === 'number' ? item.masteryScore : 100)) : 100) : node.masteryScore
    const status = getMasteryStatus(score)
    return {
      id: node.id, name: node.name, depth, masteryScore: score, masteryLabel: getMasteryLabel(score), masteryStatus: status, value: score,
      symbol: 'roundRect',
      symbolSize: node.virtual ? [126, 46] : depth === 1 ? [98, 36] : [86, 30],
      itemStyle: {
        color: node.virtual ? '#4F46E5' : status === 'weak' ? '#DC2626' : status === 'learning' ? '#D97706' : '#059669',
        borderColor: node.virtual ? '#3730A3' : status === 'weak' ? '#B91C1C' : status === 'learning' ? '#B45309' : '#047857',
        borderWidth: node.virtual ? 3 : status === 'weak' ? 3 : 2,
        shadowBlur: node.virtual ? 16 : status === 'weak' ? 14 : 8,
        shadowColor: node.virtual ? 'rgba(79,70,229,0.28)' : status === 'weak' ? 'rgba(220,38,38,0.24)' : 'rgba(148,163,184,0.18)',
        borderRadius: 10
      },
      label: {
        color: '#ffffff', fontSize: node.virtual ? 15 : 12,
        fontWeight: node.virtual ? 900 : status === 'weak' ? 900 : 700,
        lineHeight: node.virtual ? 19 : 15,
        formatter: ({ name }) => formatTreeLabel(name)
      },
      lineStyle: {
        color: node.virtual ? 'rgba(79,70,229,0.72)' : status === 'weak' ? 'rgba(220,38,38,0.84)' : 'rgba(148,163,184,0.72)',
        width: node.virtual ? 2.2 : status === 'weak' ? 2.6 : 1.4,
        curveness: 0.12
      },
      children,
      collapsed: node.virtual ? true : depth >= 1
    }
  }

  return {
    id: 'root', name: '初中数学', depth: -1, masteryScore: 100,
    children: majorVirtualRoots.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'zh-CN')).map(item => enrich(item, 0))
  }
}

function initChart() {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value)
  const data = buildKnowledgeTree()
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter(params) {
        const d = params.data || {}
        const score = typeof d.masteryScore === 'number' ? d.masteryScore : null
        return `<div style="font-weight:700;margin-bottom:6px;">${d.name}</div>
                <div>状态：${score !== null ? getMasteryLabel(score) : '未知'}</div>
                <div>掌握度：${score !== null ? score + '%' : '-'}</div>
                <div>题目数量：${d.totalQuestionCount || 0} 题</div>
                <div style="margin-top:6px;color:#94a3b8;">点击节点可展开/收起并联动详情。</div>`
      }
    },
    series: [{
      type: 'tree', data: [data], top: '5%', left: '4%', bottom: '5%', right: '18%',
      orient: 'LR', symbol: 'circle', symbolSize: 7, roam: true,
      expandAndCollapse: true, initialTreeDepth: 1, edgeShape: 'polyline', edgeForkPosition: '52%',
      animationDurationUpdate: 420, animationEasingUpdate: 'cubicOut',
      lineStyle: { width: 1.3, curveness: 0.06 },
      label: { position: 'inside', verticalAlign: 'middle', align: 'center' },
      leaves: { label: { position: 'inside', align: 'center' } },
      emphasis: { focus: 'descendant' }
    }]
  })

  chart.on('click', function (params) {
    if (params?.data?.id && params.data.id !== 'root') {
      const matched = weakPointMap.value[params.data.id]
      if (matched) {
        selectedKnowledge.value = matched
        loadSelectedPracticeQuestions()
        loadKnowledgeDetail(params.data.id)
      }
    }
  })
}

function rebuildChart() {
  if (chart) { chart.dispose(); chart = null }
  nextTick().then(() => initChart())
}

function handleResize() { if (chart) chart.resize() }

function startPractice() {
  if (!selectedKnowledge.value.id) {
    ElMessage.warning('请先选择知识点')
    return
  }
  router.push({ path: '/student/practice', query: { kpId: selectedKnowledge.value.id } })
}

onMounted(async () => {
  await Promise.all([loadWeakPoints(), loadWrongQuestionBook()])
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
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 页面头部 */
.page-header {
  background: var(--bg-surface);
  border-radius: var(--radius-xl);
  padding: 28px 32px;
  border: 1px solid var(--border-light);
  position: relative;
  overflow: hidden;
}

.page-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--brand-gradient);
}

.header-content {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 32px;
  position: relative;
  z-index: 1;
}

.header-text h2 {
  font-family: 'Noto Serif SC', serif;
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.header-text p {
  margin: 10px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.header-focus-panel {
  flex-shrink: 0;
  padding: 16px 20px;
  background: var(--bg-hover);
  border-radius: var(--radius-lg);
  text-align: center;
  min-width: 160px;
  position: relative;
  z-index: 2;
}

.focus-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  color: var(--primary-color);
  background: var(--primary-bg);
  padding: 4px 10px;
  border-radius: var(--radius-full);
  margin-bottom: 8px;
}

.header-focus-panel strong {
  display: block;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin-top: 6px;
}

.focus-rate {
  display: block;
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}

/* 统计卡片 */
.stats-overview {
  margin-top: 0;
}

.stats-grid-compact {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-card {
  padding: 20px;
  background: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-bottom: 14px;
}

.stat-icon.is-danger { background: var(--danger-bg); color: var(--danger-color); }
.stat-icon.is-warning { background: var(--warning-bg); color: var(--warning-color); }
.stat-icon.is-success { background: var(--success-bg); color: var(--success-color); }

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  font-family: 'Noto Serif SC', serif;
}

.stat-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 4px;
}

.stat-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

/* 主布局 */
.top-layout {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 20px;
}

.chart-column {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-column {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 面板卡片 */
.panel-card {
  border-radius: var(--radius-lg);
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.section-desc {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 13px;
}

/* 图例 */
.legend-row {
  display: flex;
  gap: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-dot.green { background: #059669; }
.legend-dot.yellow { background: #D97706; }
.legend-dot.red { background: #DC2626; }

/* 知识树 */
.tree-chart {
  height: 680px;
  width: 100%;
  border-radius: var(--radius-lg);
  background: var(--bg-base);
}

/* 题目列表 */
.practice-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.practice-item {
  padding: 20px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-light);
  background: var(--bg-hover);
}

.practice-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.practice-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.practice-content {
  font-size: 15px;
  line-height: 1.7;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.practice-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.practice-option {
  padding: 10px 14px;
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  font-size: 14px;
  color: var(--text-regular);
}

.practice-meta {
  display: flex;
  gap: 16px;
  color: var(--text-muted);
  font-size: 13px;
}

.practice-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.practice-answer {
  margin-top: 16px;
}

.practice-feedback {
  margin-top: 14px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  font-size: 14px;
  line-height: 1.6;
}

.practice-feedback.is-correct {
  background: var(--success-bg);
  color: var(--success-color);
}

.practice-feedback.is-wrong {
  background: var(--warning-bg);
  color: var(--warning-color);
}

.feedback-title {
  font-weight: 700;
  margin-bottom: 8px;
}

.practice-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 8px;
}

.footer-text {
  font-size: 13px;
  color: var(--text-muted);
}

.footer-actions {
  display: flex;
  gap: 10px;
}

/* 知识点详情 */
.focus-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  font-family: 'Noto Serif SC', serif;
}

.focus-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.pill {
  padding: 6px 12px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 500;
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.pill.is-mastered { background: var(--success-bg); color: var(--success-color); }
.pill.is-learning { background: var(--warning-bg); color: var(--warning-color); }
.pill.is-weak { background: var(--danger-bg); color: var(--danger-color); }

.focus-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 20px;
}

.summary-box {
  padding: 14px;
  border-radius: var(--radius-md);
  background: var(--bg-hover);
}

.summary-label {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}

.summary-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  font-family: 'Noto Serif SC', serif;
  margin-top: 6px;
}

.diagnosis-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 20px;
}

.diagnosis-item {
  padding: 14px;
  border-radius: var(--radius-md);
  background: var(--bg-hover);
}

.diagnosis-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary-color);
  margin-bottom: 8px;
}

.diagnosis-text {
  font-size: 13px;
  color: var(--text-regular);
  line-height: 1.7;
}

.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 500;
  background: var(--primary-bg);
  color: var(--primary-color);
}

.chip.is-warning { background: var(--warning-bg); color: var(--warning-color); }
.chip.is-empty { background: var(--bg-elevated); color: var(--text-muted); }

/* 补练统计 */
.progress-overview {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 16px;
}

.progress-box {
  padding: 14px;
  border-radius: var(--radius-md);
  background: var(--bg-hover);
}

.progress-label {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}

.progress-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  font-family: 'Noto Serif SC', serif;
  margin-top: 6px;
}

.progress-bars {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.progress-item {
  padding: 12px;
  border-radius: var(--radius-md);
  background: var(--bg-hover);
}

.progress-head {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.progress-track {
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--border-color);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--brand-gradient);
  border-radius: var(--radius-full);
  transition: width 0.5s ease;
}

.progress-meta {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 6px;
}

/* 抽屉 */
.drawer-content {
  padding: 0 20px 20px;
}

.drawer-section {
  margin-bottom: 28px;
}

.drawer-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 14px;
  padding-left: 10px;
  border-left: 3px solid var(--primary-color);
}

.wrong-list, .recommend-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wrong-item, .recommend-item {
  padding: 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  background: var(--bg-hover);
}

.wrong-content, .recommend-content {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.6;
  margin-bottom: 12px;
}

.wrong-answers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 10px;
}

.ans-box {
  padding: 8px 10px;
  background: var(--bg-surface);
  border-radius: var(--radius-sm);
}

.ans-label {
  font-size: 11px;
  color: var(--text-muted);
  display: block;
  margin-bottom: 4px;
}

.ans-value {
  font-size: 14px;
  font-weight: 600;
}

.ans-value.wrong { color: var(--danger-color); }
.ans-value.correct { color: var(--success-color); }

.wrong-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.wrong-time {
  font-size: 12px;
  color: var(--text-muted);
}

.recommend-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* 全部题目弹窗 */
.all-questions {
  max-height: 600px;
  overflow-y: auto;
}

.question-item {
  padding: 16px 0;
  border-bottom: 1px solid var(--border-light);
}

.question-item:last-child {
  border-bottom: none;
}

.q-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.q-index {
  font-weight: 600;
  color: var(--text-primary);
}

.q-content {
  font-size: 15px;
  line-height: 1.7;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.q-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.q-option {
  padding: 8px 12px;
  background: var(--bg-hover);
  border-radius: var(--radius-sm);
  font-size: 14px;
}

.q-answer {
  color: var(--success-color);
  margin-bottom: 8px;
}

.q-analysis {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

/* 响应式 */
@media (max-width: 1200px) {
  .top-layout {
    grid-template-columns: 1fr;
  }

  .detail-column {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
  }

  .stats-grid-compact {
    grid-template-columns: 1fr;
  }

  .detail-column {
    grid-template-columns: 1fr;
  }

  .focus-summary {
    grid-template-columns: 1fr;
  }

  .practice-options {
    grid-template-columns: 1fr;
  }
}
</style>
