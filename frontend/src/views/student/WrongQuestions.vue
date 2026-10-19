<template>
  <div class="wrong-page">
    <header class="page-header">
      <div class="header-content">
        <div class="header-text">
          <h2>错题本</h2>
          <p>做错的题都收在这里。看懂解析后点“重做”，做对了才算订正。</p>
        </div>
        <el-radio-group v-model="sortBy" size="small">
          <el-radio-button value="time">按最后练习时间</el-radio-button>
          <el-radio-button value="count">按错误次数</el-radio-button>
        </el-radio-group>
      </div>
    </header>

    <el-card class="filter-card">
      <el-form :inline="true">
        <el-form-item label="知识点">
          <el-select v-model="filters.kpCode" clearable placeholder="全部知识点" style="width: 180px">
            <el-option v-for="item in kpOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="错误类型">
          <el-select v-model="filters.errorType" clearable placeholder="全部类型" style="width: 160px">
            <el-option label="计算" value="计算" />
            <el-option label="概念" value="概念" />
            <el-option label="审题" value="审题" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="掌握状态">
          <el-select v-model="filters.masteryStatus" clearable placeholder="全部状态" style="width: 160px">
            <el-option v-for="label in MASTERY_LABELS" :key="label" :label="label" :value="label" />
          </el-select>
        </el-form-item>
      </el-form>
    </el-card>

    <div v-loading="loading" class="wrong-list">
      <el-card v-for="item in filteredList" :key="item.questionId" class="wrong-card" shadow="hover">
        <div class="wrong-card-top">
          <div>
            <MathText class="summary" tag="div" :text="item.content" />
            <div class="meta-row">
              <el-tag size="small">{{ item.kpName }}</el-tag>
              <el-tag size="small" type="warning">{{ item.errorType || '其他' }}</el-tag>
              <el-tag size="small" :type="statusTagType(item.statusLabel)">{{ item.statusLabel }}</el-tag>
            </div>
          </div>
          <div class="side-meta">
            <div>错误次数 {{ item.wrongCount || 1 }}</div>
            <div>{{ formatTime(item.lastPracticeTime) }}</div>
          </div>
        </div>

        <el-collapse>
          <el-collapse-item title="查看详情">
            <div class="detail-box">
              <div>题型：{{ typeText(item) }} · 难度：{{ difficultyText(item) }}</div>
              <div v-if="item.options && item.options.length">
                选项：
                <span v-for="(opt, i) in item.options" :key="i" class="option-chip">
                  {{ String.fromCharCode(65 + i) }}. <MathText :text="opt" />
                </span>
              </div>
              <div>正确答案：<MathText class="answer-text" :text="item.answerDisplay || item.answer || '-'" /></div>
              <div>解析：<MathText :text="analysisText(item)" /></div>
            </div>
            <div class="redo-row">
              <el-button type="primary" size="small" @click="redoOne(item)">重做这道题</el-button>
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-card>
      <el-empty v-if="!loading && !filteredList.length" description="暂无符合条件的错题" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import api from '@/utils/api'
import MathText from '@/components/MathText.vue'
import { MASTERY_LABELS, normalizeStatusLabel, statusTagType } from '@/utils/knowledge-meta'

const TYPE_TEXT = { choice: '选择题', fill: '填空题', judge: '判断题', subjective: '解答题' }
const DIFFICULTY_TEXT = { easy: '易', medium: '中', hard: '难', 1: '易', 2: '易', 3: '中', 4: '难', 5: '难' }

const router = useRouter()
const loading = ref(false)
const list = ref([])
const sortBy = ref('time')
const filters = ref({ kpCode: '', errorType: '', masteryStatus: '' })

const kpOptions = computed(() => {
  const map = {}
  list.value.forEach(item => { if (item.kpCode) map[item.kpCode] = item.kpName })
  return Object.keys(map).map(value => ({ value, label: map[value] }))
})

const filteredList = computed(() => {
  var result = list.value.slice()
  if (filters.value.kpCode) result = result.filter(item => item.kpCode === filters.value.kpCode)
  if (filters.value.errorType) result = result.filter(item => item.errorType === filters.value.errorType)
  if (filters.value.masteryStatus) result = result.filter(item => item.statusLabel === filters.value.masteryStatus)
  result.sort((a, b) => {
    if (sortBy.value === 'count') return (b.wrongCount || 0) - (a.wrongCount || 0)
    return new Date(b.lastPracticeTime || 0) - new Date(a.lastPracticeTime || 0)
  })
  return result
})

function formatTime(value) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '暂无'
}

function typeText(item) {
  const type = item.type || (item.question && item.question.type)
  return (item.question && item.question.questionTypeLabel) || TYPE_TEXT[type] || '其他'
}

function difficultyText(item) {
  const q = item.question || {}
  return DIFFICULTY_TEXT[q.difficulty] || DIFFICULTY_TEXT[item.difficulty] || '中'
}

function analysisText(item) {
  const q = item.question || {}
  return q.analysis || q.explanation || '暂无文字解析。'
}

function loadData() {
  loading.value = true
  api.student.getWrongQuestions().then(res => {
    if (res.success) list.value = (res.data || []).map((item, index) => ({
      ...item,
      kpName: (item.question && item.question.knowledgeNodeName) || item.kpName || item.kpCode || '未分类',
      statusLabel: normalizeStatusLabel(item.masteryStatus),
      visibleQuestionNo: item.visibleQuestionNo || `错题${index + 1}`
    }))
  }).finally(() => {
    loading.value = false
  })
}

function redoOne(item) {
  if (!item || !item.questionId) return
  router.push({ path: '/student/practice', query: { kpId: item.knowledgePointId || 'custom', questionId: item.questionId, mode: 'wrong-redo' } })
}

onMounted(loadData)
</script>

<style scoped>
.wrong-page { display: flex; flex-direction: column; gap: 4px; max-width: 980px; }
.header-content { display: flex; justify-content: space-between; gap: 16px; align-items: center; }
.header-text { flex: 1; }
.filter-card { margin-bottom: 16px; border-radius: 16px; }
.wrong-list { display: grid; gap: 16px; }
.wrong-card { border-radius: 18px; }
.wrong-card-top { display: flex; justify-content: space-between; gap: 16px; }
.summary { font-size: 15px; color: var(--nb-ink); line-height: 1.7; margin-bottom: 10px; }
.meta-row { display: flex; flex-wrap: wrap; gap: 8px; }
.side-meta { text-align: right; color: var(--nb-ink-3); font-size: 14px; min-width: 120px; }
.detail-box { color: var(--nb-ink-2); line-height: 1.9; }
.redo-row { margin-top: 12px; display: flex; justify-content: flex-end; gap: 8px; }
.option-chip { display: inline-block; margin-right: 14px; }
.answer-text { color: var(--nb-red-ink); font-weight: 600; }
@media (max-width: 640px) {
  .header-content { flex-direction: column; align-items: flex-start; }
  .wrong-card-top { flex-direction: column; }
  .side-meta { text-align: left; }
}
</style>
