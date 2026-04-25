<template>
  <div class="weak-practice-page">
    <header class="page-header">
      <div class="header-content">
        <div class="header-text">
          <h2>{{ pageTitle }}</h2>
          <p>{{ pageDesc }}</p>
        </div>
        <el-button type="primary" :loading="loading" @click="loadRecommendations(true)">换一批</el-button>
      </div>
    </header>

    <el-empty v-if="!loading && !questions.length" description="恭喜！当前暂无新的补练题目" />

    <div v-else v-loading="loading">
      <el-card v-for="(item, index) in questions" :key="item.id" class="recommend-card" shadow="hover">
        <div class="reason">推荐理由：{{ item.recommendationReason || '根据当前掌握情况智能推荐。' }}</div>
        <div class="question-no">{{ item.visibleQuestionNo || `第${index + 1}题` }}</div>
        <QuestionCard
          :question="normalizeQuestion(item)"
          :index="index"
          v-model="answers[item.id]"
          :result="results[item.id]"
        />
      </el-card>

      <div class="batch-action-row">
        <el-button type="primary" :loading="submitting" @click="submitBatch">提交本页答案</el-button>
      </div>
    </div>

    <el-dialog v-model="batchDialogVisible" title="本页补练结果" width="620px" destroy-on-close>
      <div class="batch-summary">
        <div class="batch-stat-card">
          <span>本页正确率</span>
          <strong>{{ batchSummary.accuracy }}%</strong>
        </div>
        <div class="batch-stat-card">
          <span>答题数量</span>
          <strong>{{ batchSummary.total }}</strong>
        </div>
      </div>
      <div class="batch-knowledge-list">
        <div v-for="item in batchSummary.knowledgePoints" :key="item.name" class="batch-knowledge-item">
          <span>{{ item.name }}</span>
          <el-tag :type="item.type">{{ item.label }}</el-tag>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="confirmNextBatch">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import QuestionCard from '@/components/QuestionCard.vue'

const route = useRoute()
const loading = ref(false)
const submitting = ref(false)
const batchDialogVisible = ref(false)
const questions = ref([])
const answers = ref({})
const results = ref({})
const practiceMeta = reactive({ knowledgePointId: '', mode: 'weak-point', title: '薄弱补练' })
const batchSummary = reactive({ accuracy: 0, total: 0, knowledgePoints: [] })

const pageTitle = computed(() => practiceMeta.title || '薄弱补练')
const pageDesc = computed(() => practiceMeta.mode === 'wrong-question'
  ? '逐题重做错题，系统将记录历次作答轨迹并同步更新掌握状态。'
  : '每次仅加载一批新题，提交整页后展示结果，再进入下一批。')

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

function loadRecommendations(refresh) {
  loading.value = true
  resetAnswers()
  practiceMeta.knowledgePointId = route.query.kpId || ''
  practiceMeta.mode = route.query.questionId || route.query.mode === 'wrong-redo' ? 'wrong-question' : 'weak-point'
  practiceMeta.title = practiceMeta.mode === 'wrong-question' ? '错题重做模式' : '薄弱补练'

  if (route.query.questionId || route.query.questionIds || route.query.kpId) {
    api.get(`/student/practice/${practiceMeta.knowledgePointId || 'custom'}`, {
      questionId: route.query.questionId,
      questionIds: route.query.questionIds,
      mode: route.query.mode
    }).then(res => {
      if (res.success) {
        const data = res.data || {}
        questions.value = data.questions || []
        if (data.title) practiceMeta.title = data.title
        if (data.mode) practiceMeta.mode = data.mode
        if (!questions.value.length && practiceMeta.knowledgePointId) {
          return api.student.getPracticeQuestions(practiceMeta.knowledgePointId).then(fallback => {
            if (fallback.success) questions.value = fallback.data || []
          })
        }
      }
      return null
    }).finally(() => {
      loading.value = false
    })
    return
  }

  api.student.getRecommendations({ limit: 3, refresh: refresh ? 'true' : 'false' })
    .then(res => {
      if (res.success) questions.value = res.data || []
    })
    .finally(() => {
      loading.value = false
    })
}

function submitBatch() {
  const filledIds = questions.value.map(item => item.id).filter(id => String(answers.value[id] || '').trim())
  if (filledIds.length !== questions.value.length) {
    ElMessage.warning('请完成本页全部题目后再提交')
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
    title: practiceMeta.title
  }).then(res => {
    if (res.success) {
      const data = res.data || {}
      ;(data.questionResults || []).forEach(item => {
        results.value[item.questionId] = {
          isCorrect: !!item.correct,
          userAnswer: item.answer || '',
          correctAnswer: item.correctAnswer || '-',
          explanation: item.correct ? '回答正确，继续保持。' : '建议回看知识点后再次尝试。'
        }
      })
      const total = (data.questionResults || []).length
      const correct = (data.questionResults || []).filter(item => item.correct).length
      batchSummary.accuracy = total ? Math.round(correct / total * 100) : 0
      batchSummary.total = total
      batchSummary.knowledgePoints = (data.knowledgePointChanges || []).map(item => ({
        name: item.knowledgePointName,
        label: `${item.correctCount}/${item.questionCount} 正确`,
        type: item.masteryAfter >= 80 ? 'success' : item.masteryAfter >= 60 ? 'warning' : 'danger'
      }))
      batchDialogVisible.value = true
    }
  }).catch(() => {
    ElMessage.error('提交失败')
  }).finally(() => {
    submitting.value = false
  })
}

function confirmNextBatch() {
  batchDialogVisible.value = false
  loadRecommendations(true)
}

onMounted(() => loadRecommendations(false))
</script>

<style scoped>
.weak-practice-page { padding: 24px; }
.header-content { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.header-text { flex: 1; }
.recommend-card { margin-bottom: 16px; border-radius: 18px; }
.reason { margin-bottom: 12px; color: #92400e; background: #fffbeb; border-radius: 12px; padding: 10px 12px; }
.question-no { font-size: 13px; color: #2563eb; font-weight: 700; margin-bottom: 8px; }
.batch-action-row { display: flex; justify-content: flex-end; margin-top: 18px; }
.batch-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.batch-stat-card { padding: 16px; border-radius: 14px; background: #f8fafc; display: flex; flex-direction: column; gap: 8px; }
.batch-stat-card strong { font-size: 26px; color: #0f172a; }
.batch-knowledge-list { display: grid; gap: 10px; }
.batch-knowledge-item { display: flex; justify-content: space-between; gap: 12px; padding: 12px 14px; border-radius: 12px; background: #f8fafc; }
</style>
