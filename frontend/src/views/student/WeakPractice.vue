<template>
  <div :class="['weak-practice-page', `density-${activeDecision?.pageDensity || 'standard'}`, `preference-${adaptationEnabled ? presentationMode.primary : 'standard'}`, { 'has-secondary-preference': adaptationEnabled && presentationMode.secondary }]">
    <header class="page-header">
      <div class="header-content">
        <div class="header-text">
          <h2>{{ pageTitle }}</h2>
          <p>{{ pageDesc }}</p>
        </div>
        <el-button v-if="!planIds.length && practiceMeta.mode !== 'wrong-question'" type="primary" :loading="loading" @click="restartPracticeRound">换一批</el-button>
      </div>
      <div v-if="activeDecision" class="adaptation-banner">
        <span class="adaptation-icon">{{ activeDecision.guidance?.emoji || '🧭' }}</span>
        <div>
          <b>本轮学习安排</b>
          <p>{{ activeDecision.strategy }}</p>
        </div>
        <el-tag effect="plain">{{ complexityLabel(activeDecision.targetComplexity) }}</el-tag>
      </div>
      <div v-if="planIds.length" class="plan-progress">
        <span class="plan-label">补练计划</span>
        <el-steps :active="planIndex" finish-status="success" simple class="plan-steps">
          <el-step v-for="(name, i) in planNames" :key="planIds[i]" :title="name" />
        </el-steps>
      </div>
    </header>

    <section v-if="!practiceReady && !loading" class="practice-gate">
      <span>🧭</span>
      <div><b>先完成本轮学习偏好问卷</b><p>问卷完成后会先展示你的本轮资源呈现偏好，再开始薄弱补练。</p></div>
    </section>

    <AdaptiveResourcePanel
      v-if="practiceReady && adaptationEnabled"
      :mode="presentationMode.primary"
      :secondary-mode="presentationMode.secondary"
      :knowledge-point-name="KP_NAME[practiceMeta.knowledgePointId] || '当前知识点'"
    />

    <el-empty v-if="practiceReady && !loading && !questions.length" :description="emptyReason" />

    <div v-else-if="practiceReady" v-loading="loading" class="practice-list">
      <div v-for="(item, index) in questions" :key="item.id" class="practice-item">
        <p class="reason"><span class="reason-label">为什么推荐</span>{{ reasonText(item) }}</p>
        <QuestionCard
          :question="normalizeQuestion(item)"
          :index="index"
          v-model="answers[item.id]"
          :result="results[item.id]"
          :presentation-mode="adaptationEnabled ? presentationMode.primary : 'standard'"
          :auto-expand-scaffold="adaptationEnabled && activeDecision?.scaffoldLevel === 'high'"
        />
      </div>

      <div class="submit-bar">
        <span>{{ adaptationEnabled ? '本轮需一次完成，中途退出不会保存' : (draft.status.value || '作答会自动保存') }}</span>
        <span class="submit-progress">已答 <b class="nb-num">{{ answeredTotal }}</b> / <span class="nb-num">{{ questions.length }}</span> 题</span>
        <el-button v-if="!submitted" type="primary" size="large" :loading="submitting" @click="submitBatch">交卷批改</el-button>
        <el-button v-else type="primary" size="large" @click="confirmNextBatch">{{ nextButtonText }}</el-button>
      </div>
    </div>

    <el-dialog v-model="batchDialogVisible" title="批改结果" width="620px" destroy-on-close>
      <div class="batch-summary">
        <div class="batch-score" :aria-label="'本页正确率 ' + batchSummary.accuracy + '%'">
          <span class="batch-score-num">{{ batchSummary.accuracy }}</span>
          <svg class="batch-score-line" viewBox="0 0 160 20" aria-hidden="true">
            <path d="M6 8 C 50 2, 110 4, 154 7" />
            <path d="M14 16 C 60 11, 108 12, 150 14" />
          </svg>
        </div>
        <p class="batch-score-text">已自动判定题目正确率 {{ batchSummary.accuracy }}%，共 {{ batchSummary.total }} 题；解答题等待教师复核。</p>
      </div>
      <div class="batch-knowledge-list">
        <div v-for="item in batchSummary.knowledgePoints" :key="item.name" class="batch-knowledge-item">
          <span>{{ item.name }}</span>
          <el-tag :type="item.type">{{ item.label }}</el-tag>
        </div>
      </div>
      <template #footer>
        <el-button @click="batchDialogVisible = false">查看逐题解析</el-button>
        <el-button type="primary" @click="confirmNextBatch">{{ nextButtonText }}</el-button>
      </template>
    </el-dialog>

    <AdaptiveReflectionDialog
      v-model="reflectionVisible"
      :round="pendingRound"
      @completed="handleReflectionCompleted"
    />
    <PracticePreferenceDialog
      v-model="preferenceDialogVisible"
      @completed="startPracticeAfterPreference"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import { useAnswerDraft } from '@/composables/useAnswerDraft'
import QuestionCard from '@/components/QuestionCard.vue'
import AdaptiveReflectionDialog from '@/components/adaptive/AdaptiveReflectionDialog.vue'
import AdaptiveResourcePanel from '@/components/adaptive/AdaptiveResourcePanel.vue'
import PracticePreferenceDialog from '@/components/adaptive/PracticePreferenceDialog.vue'
import { KNOWLEDGE_TREE_SHARED_CONFIG } from '@/utils/knowledge-meta'

const route = useRoute()
const router = useRouter()
const planIds = computed(() => String(route.query.plan || '').split(',').filter(Boolean))
const planNames = computed(() => {
  const names = String(route.query.planNames || '').split(',')
  return planIds.value.map((id, i) => names[i] || id)
})
const planIndex = computed(() => Math.max(0, planIds.value.indexOf(String(route.query.kpId || ''))))
const hasNextInPlan = computed(() => planIds.value.length > 0 && planIndex.value < planIds.value.length - 1)
const submitted = computed(() => Object.keys(results.value).length > 0)
const nextButtonText = computed(() => {
  if (hasNextInPlan.value) return '进入下一个知识点'
  if (planIds.value.length) return '完成计划'
  return '再来一批'
})
const loading = ref(false)
const submitting = ref(false)
const batchDialogVisible = ref(false)
const reflectionVisible = ref(false)
const preferenceDialogVisible = ref(false)
const practiceReady = ref(false)
const pendingRound = ref(null)
const activeDecision = ref(null)
const adaptationEnabled = ref(false)
const presentationMode = reactive({ primary: 'readWrite', secondary: null, mixed: false })
const adaptationStatus = ref(null)
const emptyReason = ref('当前没有可用题目，请先完成班级已学范围设置。')
const questions = ref([])
const answers = ref({})
const answeredTotal = computed(() => questions.value.filter(item => String(answers.value[item.id] || '').trim()).length)
const results = ref({})
const draft = useAnswerDraft(computed(() => 'practice-' + (route.query.kpId || 'custom') + '-' + (route.query.questionId || '')), answers, questions)
const startedAt = Date.now()
// 知识点编号 → 名称（后端有时只返回编号）
const KP_NAME = KNOWLEDGE_TREE_SHARED_CONFIG.categories.reduce((acc, category) => {
  category.nodes.forEach(node => { acc[node.id] = node.name })
  return acc
}, {})
const ADAPTIVE_KNOWLEDGE_POINT_IDS = new Set(['alg-1', 'alg-2', 'algebra-3', 'alg-3'])
const practiceMeta = reactive({ knowledgePointId: '', mode: 'weak-point', title: '薄弱补练' })
const batchSummary = reactive({ accuracy: 0, total: 0, knowledgePoints: [] })
const isAdaptiveWeakPractice = () =>
  !route.query.questionId && !route.query.questionIds && route.query.mode !== 'wrong-redo' &&
  ADAPTIVE_KNOWLEDGE_POINT_IDS.has(String(route.query.kpId || ''))

function complexityLabel(value) {
  return ({ low: '低复杂度 · 分步练习', medium: '标准复杂度', high: '进阶变式挑战' })[value] || '标准复杂度'
}

const pageTitle = computed(() => practiceMeta.title || '薄弱补练')
const pageDesc = computed(() => practiceMeta.mode === 'wrong-question'
  ? '把以前做错的题再做一遍，做对了才算真正掌握。'
  : '做完这一页统一批改，看完解析再换下一批。')

function reasonText(item) {
  if (item.recommendationReason) return item.recommendationReason
  if (practiceMeta.mode === 'wrong-question') return '这道题你之前做错过，重做一遍检验是否真正掌握。'
  if (item.knowledgeNodeName) return `针对知识点「${item.knowledgeNodeName}」的专项练习。`
  return '根据你的掌握情况挑选的练习题。'
}

function normalizeQuestion(item) {
  return {
    ...item,
    type: item.type === 'objective' ? 'choice' : item.type,
    difficulty: item.difficulty || item.difficultyLevel || 3,
    answer: item.standardAnswer || item.answerDisplay || item.answer || '-'
  }
}

function resetAnswers() {
  Object.keys(answers.value).forEach(key => delete answers.value[key])
  Object.keys(results.value).forEach(key => delete results.value[key])
}

async function preparePracticeSession() {
  const isWrongRedo = Boolean(route.query.questionId || route.query.questionIds || route.query.mode === 'wrong-redo')
  if (isWrongRedo) {
    practiceReady.value = true
    loadRecommendations(false)
    return
  }
  if (!route.query.kpId) {
    loading.value = true
    try {
      const response = await api.student.getWeakPoints()
      const target = (response.data || [])
        .filter(item => item.eligible && item.masteryRate !== null && Number(item.masteryRate) < 80)
        .sort((a, b) => Number(a.masteryRate) - Number(b.masteryRate))[0]
      if (!target) {
        emptyReason.value = '暂时没有需要薄弱补练的知识点。错题原题请前往错题本重做。'
        practiceReady.value = true
        return
      }
      await router.replace({ query: { ...route.query, kpId: target.id } })
    } finally {
      loading.value = false
    }
  }
  if (!isAdaptiveWeakPractice()) {
    practiceReady.value = true
    loadRecommendations(false)
    return
  }
  if (!adaptationStatus.value) {
    const response = await api.get('/student/adaptation/status')
    adaptationStatus.value = response.data || {}
  }
  if (adaptationStatus.value.varkDue) {
    preferenceDialogVisible.value = true
    return
  }
  Object.assign(presentationMode, adaptationStatus.value.presentationMode || { primary: 'readWrite', secondary: null, mixed: false })
  practiceReady.value = true
  loadRecommendations(false)
}

function startPracticeAfterPreference(result) {
  preferenceDialogVisible.value = false
  adaptationStatus.value = { ...(adaptationStatus.value || {}), varkDue: false, ...(result || {}) }
  Object.assign(presentationMode, result?.presentationMode || { primary: 'readWrite', secondary: null, mixed: false })
  practiceReady.value = true
  loadRecommendations(false)
}

function restartPracticeRound() {
  if (!ADAPTIVE_KNOWLEDGE_POINT_IDS.has(String(route.query.kpId || ''))) {
    loadRecommendations(true)
    return
  }
  loadRecommendations(true)
}

async function loadRecommendations(refresh) {
  draft.pause()
  const adaptiveSession = isAdaptiveWeakPractice()
  const saved = !adaptiveSession && !refresh ? await draft.read() : null
  if (refresh || adaptiveSession) await draft.clear()
  loading.value = true
  resetAnswers()
  practiceMeta.knowledgePointId = route.query.kpId || ''
  practiceMeta.mode = route.query.questionId || route.query.mode === 'wrong-redo' ? 'wrong-question' : 'weak-point'
  practiceMeta.title = practiceMeta.mode === 'wrong-question' ? '错题重做' : '薄弱补练'

  // 只有 URL 显式带来的题目才属于「错题重做 / 指定题目」；
  // 本地或服务端草稿里的 questionIds 只用于恢复作答，绝不能当作请求参数，
  // 否则从侧栏进入「薄弱补练」会被上一轮草稿劫持成「错题重做」。
  if (route.query.questionId || route.query.questionIds || route.query.kpId) {
    api.get(`/student/practice/${practiceMeta.knowledgePointId || 'custom'}`, {
      questionId: route.query.questionId,
      questionIds: route.query.questionIds,
      mode: route.query.mode,
      adaptive: adaptiveSession ? 'true' : undefined
    }).then(res => {
      if (res.success) {
        const data = res.data || {}
        questions.value = data.questions || []
        if (!adaptiveSession) draft.restore(saved)
        if (data.title) practiceMeta.title = data.title
        if (data.mode) practiceMeta.mode = data.mode
        activeDecision.value = data.adaptation || null
        adaptationEnabled.value = Boolean(data.adaptationEnabled)
        Object.assign(presentationMode, data.presentationMode || { primary: 'readWrite', secondary: null, mixed: false })
        emptyReason.value = data.emptyReason || '当前没有可用题目，请选择已学知识点或联系老师补充审核题目。'
      }
      return null
    }).finally(() => {
      loading.value = false
    })
    return
  }

  api.student.getRecommendations({ limit: 3, refresh: refresh ? 'true' : 'false' })
    .then(res => {
      if (res.success) { questions.value = res.data || []; if (!adaptiveSession) draft.restore(saved); adaptationEnabled.value = false; activeDecision.value = null; emptyReason.value = res.message || '当前没有可用题目，请选择已学知识点或联系老师补充审核题目。' }
    })
    .finally(() => {
      loading.value = false
    })
}

function submitBatch() {
  const filledIds = questions.value.map(item => item.id).filter(id => String(answers.value[id] || '').trim())
  if (filledIds.length !== questions.value.length) {
    ElMessage.warning('还有题没做完，做完再交卷')
    return
  }

  submitting.value = true
  api.post(`/student/practice/${practiceMeta.knowledgePointId || 'custom'}/submit`, {
    answers: filledIds.reduce((acc, id) => {
      acc[id] = String(answers.value[id] || '').trim()
      return acc
    }, {}),
    questionIds: filledIds,
    mode: practiceMeta.mode,
    title: practiceMeta.title,
    adaptive: adaptationEnabled.value,
    requestId: draft.requestId.value,
    costTime: Math.round((Date.now() - startedAt) / 1000)
  }).then(res => {
    if (res.success) {
      const data = res.data || {}
      draft.clear()
      ;(data.questionResults || []).forEach(item => {
        results.value[item.questionId] = {
          isCorrect: item.correct,
          needsReview: item.needsReview,
          userAnswer: item.answer || '',
          correctAnswer: item.correctAnswer || '-'
        }
      })
      const total = (data.questionResults || []).filter(item => !item.needsReview).length
      const correct = (data.questionResults || []).filter(item => item.correct).length
      batchSummary.accuracy = total ? Math.round(correct / total * 100) : 0
      batchSummary.total = total
      batchSummary.knowledgePoints = (data.knowledgePointChanges || []).map(item => ({
        name: KP_NAME[item.knowledgePointName] || KP_NAME[item.knowledgePointId] || item.knowledgePointName,
        label: `答对 ${item.correctCount}/${item.questionCount}` + (item.masteryAfter !== undefined && item.masteryAfter !== null ? `，掌握度 ${Math.round(item.masteryAfter)}%` : ''),
        type: item.masteryAfter >= 80 ? 'success' : item.masteryAfter >= 60 ? 'warning' : 'danger'
      }))
      pendingRound.value = data.learningRound || null
      if (pendingRound.value?.reflectionRequired) reflectionVisible.value = true
      else batchDialogVisible.value = true
    }
  }).catch(() => {
    ElMessage.error('提交失败')
  }).finally(() => {
    submitting.value = false
  })
}

function handleReflectionCompleted() {
  if (!pendingRound.value?.id) {
    batchDialogVisible.value = true
    return
  }
  router.replace({
    name: 'StudentAdaptiveFeedback',
    params: { roundId: pendingRound.value.id },
    query: { source: 'practice', ...route.query }
  })
}

function confirmNextBatch() {
  batchDialogVisible.value = false
  if (practiceMeta.mode === 'wrong-question') {
    router.push('/student/wrong-questions')
    return
  }
  if (hasNextInPlan.value) {
    router.replace({ query: { ...route.query, kpId: planIds.value[planIndex.value + 1] } })
    return
  }
  if (planIds.value.length) {
    ElMessage.success('本次补练计划已完成，掌握情况已更新')
    router.push('/student/weak-points')
    return
  }
  restartPracticeRound()
}

watch(() => route.query.kpId, (value, oldValue) => {
  if (value !== oldValue && route.path === '/student/practice' && practiceReady.value) {
    practiceReady.value = false
    preparePracticeSession()
  }
})

onMounted(async () => {
  await api.get('/student/adaptation/status').then(res => {
    if (!res.success) return
    adaptationStatus.value = res.data || {}
    if (res.data.pendingRound?.reflectionRequired) {
      pendingRound.value = res.data.pendingRound
      reflectionVisible.value = true
    }
  }).catch(() => {})
  await preparePracticeSession()
})
</script>

<style scoped>
.weak-practice-page { display: flex; flex-direction: column; gap: 20px; padding-bottom: 24px; }
.header-content { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.header-text { flex: 1; min-width: 0; }
.plan-progress { margin-top: 18px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.plan-label { font-weight: 700; color: var(--nb-ink); white-space: nowrap; }
.plan-steps { flex: 1; min-width: 260px; background: var(--nb-sheet) !important; border: 1px solid var(--nb-line); border-radius: 10px; }
.adaptation-banner { display: flex; align-items: center; gap: 12px; margin-top: 14px; padding: 12px 14px; border: 1px solid var(--nb-blue); border-radius: 12px; background: var(--nb-blue-soft); color: var(--nb-ink); }
.adaptation-banner div { flex: 1; min-width: 0; }.adaptation-banner p { margin: 3px 0 0; color: var(--nb-ink-2); font-size: 14px; line-height: 1.5; }.adaptation-icon { font-size: 27px; }

.practice-list { max-width: 880px; }
.practice-gate { display: flex; align-items: center; gap: 13px; max-width: 760px; padding: 16px 18px; border: 1px solid var(--nb-line); border-radius: 14px; background: var(--nb-sheet); color: var(--nb-ink); }.practice-gate > span { display: grid; flex: 0 0 42px; height: 42px; place-items: center; border-radius: 12px; background: var(--nb-blue-soft); font-size: 23px; }.practice-gate b { font-size: 16px; }.practice-gate p { margin: 4px 0 0; color: var(--nb-ink-2); font-size: 14px; line-height: 1.5; }
.practice-item { margin-bottom: 8px; }
.preference-visual .practice-list { max-width: 960px; padding-left: 18px; border-left: 2px solid #cbd8ff; }
.preference-visual .reason-label { background: #edf2ff; color: #557ad7; }
.preference-readWrite .practice-list { max-width: 760px; }
.preference-readWrite .reason { max-width: 66ch; line-height: 1.8; }
.preference-readWrite .reason-label { background: #e9f7f2; color: #387e72; }
.preference-aural .practice-list { max-width: 860px; }
.preference-aural .reason-label { background: #f5edff; color: #8b5dc5; }
.preference-kinesthetic .practice-list { max-width: 980px; }
.preference-kinesthetic .practice-item { margin-bottom: 12px; }
.preference-kinesthetic .reason { justify-content: space-between; padding: 6px 10px; border-radius: 8px; background: #fff7ea; }
.preference-kinesthetic .reason-label { background: #fff0d6; color: #b56a2d; }
.density-low .practice-list { max-width: 760px; }
.density-low .practice-item { margin-bottom: 24px; }
.density-low .reason { max-width: 62ch; margin-bottom: 14px; }
.reason { margin: 0 0 8px; display: flex; gap: 8px; align-items: baseline; color: var(--nb-ink-2); font-size: 14px; line-height: 1.6; }
.reason-label { flex-shrink: 0; padding: 0 6px; border-radius: 4px; background: var(--nb-blue-soft); color: var(--nb-blue); font-weight: 700; font-size: 14px; }

.submit-bar {
  position: sticky;
  bottom: 16px;
  z-index: 5;
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px 12px 20px;
  background: var(--nb-sheet);
  border: 1px solid var(--nb-line-strong);
  border-radius: 12px;
  box-shadow: 0 16px 30px -18px rgba(28, 37, 65, 0.45);
}
.submit-progress { color: var(--nb-ink-2); font-size: 14px; }
.submit-progress b { color: var(--nb-ink); font-size: 18px; }

/* 批改结果：红笔写下的分数 */
.batch-summary { display: flex; align-items: center; gap: 24px; margin-bottom: 18px; flex-wrap: wrap; }
.batch-score { position: relative; width: 160px; text-align: center; }
.batch-score-num {
  display: block;
  font-family: var(--nb-font-hand);
  font-weight: 700;
  font-size: 92px;
  line-height: 0.9;
  color: var(--nb-red-ink);
  transform: rotate(-6deg);
}
.batch-score-line { width: 150px; height: 20px; }
.batch-score-line path { fill: none; stroke: var(--nb-red); stroke-width: 3; stroke-linecap: round; }
.batch-score-text { flex: 1; min-width: 180px; margin: 0; color: var(--nb-ink-2); font-size: 15px; line-height: 1.7; }
.batch-knowledge-list { display: grid; gap: 8px; }
.batch-knowledge-item { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--nb-line); }

@media (max-width: 640px) {
  .preference-visual .practice-list { padding-left: 10px; }
  .submit-bar { bottom: 10px; padding: 10px 10px 10px 14px; }
}
</style>
